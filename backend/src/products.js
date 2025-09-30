const express = require('express');
const odbc = require('odbc');
const router = express.Router();

// Velden zoals in je macro en database (let op: exact gespeld, geen haakjes)
const FIELDS = [
  "SKU",
  "SUPPLIER_REFERENCE",
  "PRODUCT_NAME_H1.nl_BE",
  "PRICE",
  "DISCOUNT",
  "DISCOUNT_PCT_INT",
  "ECOTAX",
  "COST",
  "MARGIN",
  "MARGIN_PCT",
  "ACTIVE",
  "VISIBILITY_BE",
  "VISIBILITY_NL",
  "VISIBILITY_COM"
];

// Helper om SKU te formatteren
function formatSku(sku) {
  return sku.trim().padStart(8, '0');
}

// Utility: Maak alles JSON-safe (BigInt naar string)
function safeJson(obj) {
  if (Array.isArray(obj))
    return obj.map(safeJson);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'bigint') out[k] = v.toString();
      else out[k] = safeJson(v);
    }
    return out;
  }
  return obj;
}

// Mapping macro/Excel veldnamen
function mapProductFields(p, extra = {}) {
  return {
    SKU: p.SKU,
    SUPPLIER_REFERENCE: p.SUPPLIER_REFERENCE,
    Name: p["PRODUCT_NAME_H1.nl_BE"] ?? "",
    Price: p.PRICE ?? 0,
    Discount: p.DISCOUNT ?? 0,
    "Discount%": p.DISCOUNT_PCT_INT ?? 0,
    Ecotax: p.ECOTAX ?? 0,
    Cost: p.COST ?? 0,
    "M€": p.MARGIN ?? 0,
    "M%": p.MARGIN_PCT ?? 0,
    "Voor Sale": p.ACTIVE == "1" ? "Yes" : "No",
    "Op BE": p.VISIBILITY_BE == "1" ? "Yes" : "No",
    "Op NL": p.VISIBILITY_NL == "1" ? "Yes" : "No",
    "Op COM": p.VISIBILITY_COM == "1" ? "Yes" : "No",
    Stock: extra.Stock ?? "",
    MSQ: extra.MSQ ?? "",
    UOM: extra.UOM ?? ""
  };
}

// GET /products?skus=... of /products?supref=...
router.get('/products', async (req, res) => {
  try {
    const skusParam = req.query.skus;
    const suprefParam = req.query.supref;
    let whereClause = "ACTIVE = '1'";
    let skus = [];
    if (skusParam) {
      skus = skusParam.split(',').map(formatSku);
      const skuList = skus.map(s => `'${s}'`).join(',');
      whereClause += ` AND SKU IN (${skuList})`;
    } else if (suprefParam) {
      whereClause += ` AND SUPPLIER_REFERENCE LIKE '%${suprefParam}%'`;
    } else {
      return res.status(400).json({ error: 'No SKUs or SupRef provided' });
    }

    const fieldList = FIELDS.join(',');
    const sqlBusiness = `SELECT ${fieldList} FROM business WHERE ${whereClause}`;
    console.log("ODBC QUERY:", sqlBusiness);

    const connection = await odbc.connect('DSN=Elastic PRD');
    const productsRaw = await connection.query(sqlBusiness);

    // Extra info ophalen voor Stock/MSQ/UOM
    let stockMap = {}, msqMap = {}, uomMap = {};
    let batchSkus = [];
    if (skus.length > 0) batchSkus = skus;
    else batchSkus = productsRaw.map(p => p.SKU);
    if (batchSkus.length > 0) {
      // Stock
      let sqlStock = `SELECT SKU, LAST_STATE@IMH_HAS FROM storage_stock_update WHERE SKU IN (${batchSkus.map(s => `'${s}'`).join(',')})`;
      try {
        const stockRows = await connection.query(sqlStock);
        stockRows.forEach(r => { stockMap[r.SKU] = r["LAST_STATE@IMH_HAS"]; });
      } catch (err) {
        // Als veldnaam met @ niet werkt, probeer met vierkante haken:
        try {
          sqlStock = `SELECT SKU, [LAST_STATE@IMH_HAS] FROM storage_stock_update WHERE SKU IN (${batchSkus.map(s => `'${s}'`).join(',')})`;
          const stockRows2 = await connection.query(sqlStock);
          stockRows2.forEach(r => { stockMap[r.SKU] = r["LAST_STATE@IMH_HAS"]; });
        } catch (err2) {
          // Geen stock mogelijk
        }
      }

      // MSQ + UOM
      let sqlMsq = `SELECT SKU, SALES_QUANTITY, UOM FROM storage_article_price WHERE SKU IN (${batchSkus.map(s => `'${s}'`).join(',')})`;
      try {
        const msqRows = await connection.query(sqlMsq);
        msqRows.forEach(r => {
          msqMap[r.SKU] = r.SALES_QUANTITY;
          uomMap[r.SKU] = r.UOM;
        });
      } catch (err) {
        // Geen MSQ/UOM mogelijk
      }
    }
    await connection.close();

    // Combineer de extra velden per SKU
    const mappedProducts = productsRaw.map(p =>
      mapProductFields(p, {
        Stock: stockMap[p.SKU],
        MSQ: msqMap[p.SKU],
        UOM: uomMap[p.SKU]
      })
    );
    res.json({ products: safeJson(mappedProducts) });
  } catch (err) {
    console.error('ODBC Error', err);
    res.status(500).json({ error: 'ODBC query failed', details: err.message });
  }
});

// SupRef search endpoint
router.get('/products/search-supref', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Query too short or missing' });
    }
    const fieldList = FIELDS.join(',');
    const sql = `
      SELECT ${fieldList}
      FROM business
      WHERE ACTIVE = '1' AND SUPPLIER_REFERENCE LIKE '%${q}%'
    `;
    console.log("ODBC QUERY:", sql);

    const connection = await odbc.connect('DSN=Elastic PRD');
    const result = await connection.query(sql);

    // Probeer Stock/MSQ/UOM te vullen als er een product is
    let extra = {};
    if (result.length === 1) {
      const sku = result[0].SKU;
      // STOCK
      try {
        let sqlStock = `SELECT SKU, LAST_STATE@IMH_HAS FROM storage_stock_update WHERE SKU = '${sku}'`;
        const stockRows = await connection.query(sqlStock);
        if (stockRows.length === 1) extra.Stock = stockRows[0]["LAST_STATE@IMH_HAS"];
      } catch (err) {
        try {
          let sqlStock = `SELECT SKU, [LAST_STATE@IMH_HAS] FROM storage_stock_update WHERE SKU = '${sku}'`;
          const stockRows = await connection.query(sqlStock);
          if (stockRows.length === 1) extra.Stock = stockRows[0]["LAST_STATE@IMH_HAS"];
        } catch (err2) {}
      }
      // MSQ/UOM
      try {
        const msqRows = await connection.query(`SELECT SKU, SALES_QUANTITY, UOM FROM storage_article_price WHERE SKU = '${sku}'`);
        if (msqRows.length === 1) {
          extra.MSQ = msqRows[0].SALES_QUANTITY;
          extra.UOM = msqRows[0].UOM;
        }
      } catch (err) {}
    }
    await connection.close();

    const mappedProducts = result.map(p => mapProductFields(p, extra));
    res.json({ products: safeJson(mappedProducts) });
  } catch (err) {
    console.error('ODBC Error', err);
    res.status(500).json({ error: 'ODBC search failed', details: err.message });
  }
});

module.exports = router;
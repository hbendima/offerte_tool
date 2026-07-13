const express = require('express');
const odbc = require('odbc');
const router = express.Router();

const ODBC_DSN = process.env.ODBC_DSN || 'Elastic UAT';
const ODBC_DATABASE = process.env.ODBC_DATABASE || 'de02157346244195ac7c0474dce38008';
const ODBC_CONNECTION_STRING = `DSN=${ODBC_DSN};DATABASE=${ODBC_DATABASE};`;

// Velden zoals in je macro en database (let op: exact gespeld, geen haakjes)
const FIELDS = [
  "SKU",
  "SUPPLIER_REFERENCE",
  "PRODUCT_NAME_H1.nl_BE",
  "LEAD_TIME.KLIUM_LEAD_TIME_DATE",
  "LEAD_TIME.CUSTOMER_LEAD_TIME_DAYS",
  "LEAD_TIME.AVG_ERP_LEAD_TIME_DAYS",
  "LEAD_TIME.THEORETICAL_LEAD_TIME_DAYS",
  "LEAD_TIME.LAST_ACTUAL_LEAD_TIME_DAYS",
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

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

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

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addBusinessDays(date, days) {
  const out = new Date(date);
  let left = Math.max(0, Math.floor(days));
  while (left > 0) {
    out.setDate(out.getDate() + 1);
    const wd = out.getDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return out;
}

function diffCalendarDays(fromDate, toDate) {
  const from = startOfDay(fromDate).getTime();
  const to = startOfDay(toDate).getTime();
  return Math.ceil((to - from) / (1000 * 60 * 60 * 24));
}

function formatDateBE(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function computeLeadTime(product, stockValue) {
  const stock = toNumberOrNull(stockValue) ?? 0;
  const customerDays = toNumberOrNull(product["LEAD_TIME.CUSTOMER_LEAD_TIME_DAYS"]);
  const kliumDate = toDateOrNull(product["LEAD_TIME.KLIUM_LEAD_TIME_DATE"]);
  const today = startOfDay(new Date());

  let leadDate = null;
  let source = 'unknown';

  if (!kliumDate) {
    if (stock > 0) {
      leadDate = today;
      source = 'in_stock_no_klium_date';
    } else if (customerDays !== null) {
      leadDate = addBusinessDays(today, customerDays);
      source = 'customer_days_no_klium_date';
    }
  } else if (stock > 0) {
    leadDate = today;
    source = 'in_stock';
  } else {
    const kliumDiff = diffCalendarDays(today, kliumDate);
    if (customerDays !== null && kliumDiff <= customerDays) {
      leadDate = addBusinessDays(today, customerDays);
      source = 'customer_days_guard';
    } else {
      leadDate = kliumDate;
      source = 'klium_date';
    }
  }

  if (!leadDate) {
    return {
      leadDate: null,
      leadInt: null,
      label: '-',
      source,
      customerDays
    };
  }

  const leadInt = Math.max(0, diffCalendarDays(today, leadDate));
  const dateLabel = formatDateBE(leadDate);
  let label = `Op bestelling: bezorgd vanaf ${dateLabel}`;
  if (leadInt === 0 || stock > 0) label = `Uit voorraad: leverbaar vanaf ${dateLabel}`;

  return {
    leadDate,
    leadInt,
    label,
    source,
    customerDays
  };
}

// Mapping macro/Excel veldnamen
function mapProductFields(p, extra = {}) {
  const lead = computeLeadTime(p, extra.Stock);
  return {
    SKU: p.SKU,
    SUPPLIER_REFERENCE: p.SUPPLIER_REFERENCE,
    Name: p["PRODUCT_NAME_H1.nl_BE"] ?? "",
    Name_nl: p["PRODUCT_NAME_H1.nl_BE"] ?? "",
    Name_fr: extra.Name_fr ?? "",
    Name_en: extra.Name_en ?? "",
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
    UOM: extra.UOM ?? "",
    KliumLeadTimeDate: p["LEAD_TIME.KLIUM_LEAD_TIME_DATE"] ?? "",
    CustomerLeadTimeDays: p["LEAD_TIME.CUSTOMER_LEAD_TIME_DAYS"] ?? "",
    AvgErpLeadTimeDays: p["LEAD_TIME.AVG_ERP_LEAD_TIME_DAYS"] ?? "",
    TheoreticalLeadTimeDays: p["LEAD_TIME.THEORETICAL_LEAD_TIME_DAYS"] ?? "",
    LastActualLeadTimeDays: p["LEAD_TIME.LAST_ACTUAL_LEAD_TIME_DAYS"] ?? "",
    LeadTimeDate: lead.leadDate ? lead.leadDate.toISOString().slice(0, 10) : "",
    LeadTimeInt: lead.leadInt,
    LeadTimeLabel: lead.label,
    LeadTimeSource: lead.source
  };
}

// Vertaalde productnamen (FR/EN). We kennen de exacte veldnaam niet zeker, dus we
// detecteren die één keer uit een lijst kandidaten. Alles gebeurt defensief in try/catch,
// zodat een ontbrekend veld de hoofdquery nooit breekt.
const FR_NAME_CANDIDATES = ["PRODUCT_NAME_H1.fr_BE", "PRODUCT_NAME_H1.fr_FR"];
const EN_NAME_CANDIDATES = ["PRODUCT_NAME_H1.en_GB", "PRODUCT_NAME_H1.en_US", "PRODUCT_NAME_H1.en_BE"];
let _namesDetected = false, _frField = null, _enField = null;

async function detectNameFields(connection, sampleSkus) {
  if (_namesDetected) return;
  const list = (sampleSkus && sampleSkus.length ? sampleSkus.slice(0, 3) : ["00000000"]).map(s => `'${s}'`).join(',');
  for (const f of FR_NAME_CANDIDATES) {
    try { await connection.query(`SELECT ${quoteIdentifier(f)} FROM business WHERE ${quoteIdentifier('SKU')} IN (${list})`); _frField = f; break; } catch (e) { /* veld bestaat niet */ }
  }
  for (const f of EN_NAME_CANDIDATES) {
    try { await connection.query(`SELECT ${quoteIdentifier(f)} FROM business WHERE ${quoteIdentifier('SKU')} IN (${list})`); _enField = f; break; } catch (e) { /* veld bestaat niet */ }
  }
  _namesDetected = true;
  console.log('Vertaalde naamvelden gedetecteerd:', { fr: _frField, en: _enField });
}

async function fetchTranslatedNames(connection, skus) {
  if (!skus || !skus.length) return {};
  await detectNameFields(connection, skus);
  const fields = [];
  if (_frField) fields.push(_frField);
  if (_enField) fields.push(_enField);
  if (!fields.length) return {};
  const list = skus.map(s => `'${s}'`).join(',');
  const sel = ['SKU', ...fields].map(quoteIdentifier).join(',');
  try {
    const rows = await connection.query(`SELECT ${sel} FROM business WHERE ${quoteIdentifier('SKU')} IN (${list})`);
    const map = {};
    rows.forEach(r => {
      map[r.SKU] = {
        fr: _frField ? (r[_frField] ?? "") : "",
        en: _enField ? (r[_enField] ?? "") : ""
      };
    });
    return map;
  } catch (e) { return {}; }
}

// GET /products?skus=... of /products?supref=...
router.get('/products', async (req, res) => {
  try {
    const skusParam = req.query.skus;
    const suprefParam = req.query.supref;
    const nameParam = req.query.name;
    let whereClause = `${quoteIdentifier('ACTIVE')} = '1'`;
    let skus = [];
    if (skusParam) {
      skus = skusParam.split(',').map(formatSku);
      const skuList = skus.map(s => `'${s}'`).join(',');
      whereClause += ` AND ${quoteIdentifier('SKU')} IN (${skuList})`;
    } else if (suprefParam) {
      whereClause += ` AND ${quoteIdentifier('SUPPLIER_REFERENCE')} LIKE '%${suprefParam}%'`;
    } else if (nameParam) {
      whereClause += ` AND ${quoteIdentifier('PRODUCT_NAME_H1.nl_BE')} LIKE '%${nameParam}%'`;
    } else {
      return res.status(400).json({ error: 'No SKUs, SupRef, or Name provided' });
    }

    const fieldList = FIELDS.map(quoteIdentifier).join(',');
    const sqlBusiness = `SELECT ${fieldList} FROM business WHERE ${whereClause}`;
    console.log("ODBC QUERY:", sqlBusiness);

    const connection = await odbc.connect(ODBC_CONNECTION_STRING);
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
    const nameMap = await fetchTranslatedNames(connection, batchSkus);
    await connection.close();

    // Combineer de extra velden per SKU
    const mappedProducts = productsRaw.map(p =>
      mapProductFields(p, {
        Stock: stockMap[p.SKU],
        MSQ: msqMap[p.SKU],
        UOM: uomMap[p.SKU],
        Name_fr: (nameMap[p.SKU] || {}).fr,
        Name_en: (nameMap[p.SKU] || {}).en
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
    const fieldList = FIELDS.map(quoteIdentifier).join(',');
    const sql = `
      SELECT ${fieldList}
      FROM business
      WHERE ${quoteIdentifier('ACTIVE')} = '1' AND ${quoteIdentifier('SUPPLIER_REFERENCE')} LIKE '%${q}%'
    `;
    console.log("ODBC QUERY:", sql);

    const connection = await odbc.connect(ODBC_CONNECTION_STRING);
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
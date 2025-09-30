const express = require('express');
const odbc = require('odbc');
const router = express.Router();

// Velden die je wilt ophalen
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

// GET /api/products?skus=...
router.get('/products', async (req, res) => {
  try {
    const skusParam = req.query.skus;
    if (!skusParam) {
      return res.status(400).json({ error: 'No SKUs provided' });
    }
    const skus = skusParam.split(',').map(formatSku);
    const fieldList = FIELDS.map(f => `"${f}"`).join(',');
    const skuList = skus.map(s => `'${s}'`).join(',');
    const sql = `
      SELECT ${fieldList}
      FROM business
      WHERE SKU IN (${skuList})
    `;
    console.log("ODBC QUERY:", sql);

    const connection = await odbc.connect('DSN=Elastic PRD');
    const result = await connection.query(sql);
    await connection.close();

    res.json({ products: result });
  } catch (err) {
    console.error('ODBC Error', err);
    res.status(500).json({ error: 'ODBC query failed', details: err.message });
  }
});

module.exports = router;
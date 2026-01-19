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
// Nieuwe batch search endpoint voor SupRef/naam LIKE queries
const express = require('express');
const odbc = require('odbc');
const router = express.Router();

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

// POST /products/batch-search
router.post('/products/batch-search', async (req, res) => {
  try {
    const { suprefs = [], names = [] } = req.body;
    if ((!Array.isArray(suprefs) || suprefs.length === 0) && (!Array.isArray(names) || names.length === 0)) {
      return res.status(400).json({ error: 'No search terms provided' });
    }
    let whereParts = ["ACTIVE = '1'"];
    let likeClauses = [];
    if (suprefs.length > 0) {
      likeClauses.push(...suprefs.map(s => `SUPPLIER_REFERENCE LIKE '%${s.trim()}%'`));
    }
    if (names.length > 0) {
      likeClauses.push(...names.map(n => `PRODUCT_NAME_H1.nl_BE LIKE '%${n.trim()}%'`));
    }
    if (likeClauses.length > 0) {
      whereParts.push(`(${likeClauses.join(' OR ')})`);
    }
    const whereClause = whereParts.join(' AND ');
    const fieldList = FIELDS.join(',');
    const sql = `SELECT ${fieldList} FROM business WHERE ${whereClause}`;
    console.log("ODBC BATCH QUERY:", sql);
    const connection = await odbc.connect('DSN=Elastic PRD');
    const result = await connection.query(sql);
    await connection.close();
    res.json({ products: safeJson(result) });
  } catch (err) {
    console.error('ODBC Error', err);
    res.status(500).json({ error: 'ODBC batch search failed', details: err.message });
  }
});

module.exports = router;

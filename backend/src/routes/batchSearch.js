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

const ODBC_DSN = process.env.ODBC_DSN || 'Elastic PRD';
const ODBC_DATABASE = process.env.ODBC_DATABASE || 'de02157346244195ac7c0474dce38008';
const ODBC_CONNECTION_STRING = `DSN=${ODBC_DSN};DATABASE=${ODBC_DATABASE};`;

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

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

// POST /products/batch-search
router.post('/products/batch-search', async (req, res) => {
  try {
    // Verzamel en dedupliceer alle zoektermen
    let { suprefs = [], names = [] } = req.body;
    let allTerms = [...suprefs, ...names].map(s => (s || '').trim()).filter(Boolean);
    allTerms = Array.from(new Set(allTerms));

    // Splits in mogelijke SKU's (8 cijfers) en teksttermen
    const skuRegex = /^\d{8}$/;
    const skus = allTerms.filter(t => skuRegex.test(t));
    // Teksttermen: minimaal 3 tekens, geen SKU's
    const textTerms = allTerms.filter(t => !skuRegex.test(t) && t.length >= 3);

    if (skus.length === 0 && textTerms.length === 0) {
      return res.status(400).json({ error: 'No valid search terms provided' });
    }

    const fieldList = FIELDS.map(quoteIdentifier).join(',');
    let results = [];
    const connection = await odbc.connect(ODBC_CONNECTION_STRING);

    // Query 1: Exacte SKU's
    if (skus.length > 0) {
      const skuList = skus.map(s => `'${s}'`).join(',');
      const sqlSku = `SELECT ${fieldList} FROM business WHERE ${quoteIdentifier('ACTIVE')} = '1' AND ${quoteIdentifier('SKU')} IN (${skuList})`;
      console.log('ODBC SKU QUERY:', sqlSku);
      const skuResult = await connection.query(sqlSku);
      results = results.concat(safeJson(skuResult));
    }

    // Query 2: LIKE op teksttermen
    if (textTerms.length > 0) {
      // Unieke LIKE-termen
      const likeTerms = Array.from(new Set(textTerms));
      let likeClauses = [];
      likeClauses.push(...likeTerms.map(s => `${quoteIdentifier('SUPPLIER_REFERENCE')} LIKE '%${s.replace(/'/g, "''")}%'`));
      likeClauses.push(...likeTerms.map(n => `${quoteIdentifier('PRODUCT_NAME_H1.nl_BE')} LIKE '%${n.replace(/'/g, "''")}%'`));
      const whereLike = [`${quoteIdentifier('ACTIVE')} = '1'`, `(${likeClauses.join(' OR ')})`].join(' AND ');
      const sqlLike = `SELECT ${fieldList} FROM business WHERE ${whereLike}`;
      console.log('ODBC LIKE QUERY:', sqlLike);
      const likeResult = await connection.query(sqlLike);
      results = results.concat(safeJson(likeResult));
    }

    await connection.close();

    // Combineer resultaten zonder dubbels (op SKU)
    const unique = {};
    for (const p of results) {
      if (p.SKU) unique[p.SKU] = p;
    }
    res.json({ products: Object.values(unique) });
  } catch (err) {
    console.error('ODBC Error', err);
    res.status(500).json({ error: 'ODBC batch search failed', details: err.message });
  }
});

module.exports = router;

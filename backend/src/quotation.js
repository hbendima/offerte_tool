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

const MAX_SKUS = 5;
const CDC_COST = -5.45;

// Helper om SKU te formatteren
function formatSku(sku) {
  return sku.trim().padStart(8, '0');
}

// POST /api/quotation
router.post('/quotation', async (req, res) => {
  try {
    let items = req.body.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }
    if (items.length > MAX_SKUS) items = items.slice(0, MAX_SKUS);

    // Format SKUs en aantallen
    const skus = items.map(i => formatSku(i.sku));
    const amounts = Object.fromEntries(items.map(i => [formatSku(i.sku), i.amount]));
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

    // Calculaties (zoals macro)
    let products = [];
    let totalCurrent = 0, totalProposal = 0, totalCost = 0, totalProfit = 0, totalProfitProp = 0;

    for (const prod of result) {
      const amount = amounts[prod.SKU] || 1;
      const price = Number(prod.PRICE) || 0;
      const discount = Number(prod.DISCOUNT) || 0;
      const cost = Number(prod.COST) || 0;
      const margin = Number(prod.MARGIN) || 0;

      // Macro-style fields
      const proposal = price; // eventueel logica voor voorstelprijs toevoegen
      const marginPct = price ? (margin / price) : 0;
      const marginPropPct = proposal ? ((proposal - cost) / proposal) : 0;

      products.push({
        SKU: prod.SKU,
        Name: prod["PRODUCT_NAME_H1.nl_BE"],
        amount,
        Price: price,
        Discount: discount,
        "Discount%": Number(prod.DISCOUNT_PCT_INT) || 0,
        Cost: cost,
        "M€": margin,
        "M%": marginPct,
        Proposal: proposal,
        "M%P": marginPropPct,
        "For Sale": prod.ACTIVE,
        "On BE": prod.VISIBILITY_BE,
        "On NL": prod.VISIBILITY_NL,
        "On COM": prod.VISIBILITY_COM,
        Ecotax: Number(prod.ECOTAX) || 0,
        Stock: "-", // optioneel: extra query
        MSQ: "-",   // optioneel: extra query
      });

      totalCurrent += amount * price;
      totalProposal += amount * proposal;
      totalCost += amount * cost;
      totalProfit += amount * margin;
      totalProfitProp += amount * (proposal - cost);
    }

    // Totalen/offerte
    const totals = {
      currentPrice: totalCurrent,
      newPrice: totalProposal,
      currentMarginPct: totalCurrent ? (totalProfit / totalCurrent) : 0,
      newMarginPct: totalProposal ? (totalProfitProp / totalProposal) : 0,
      currentProfit: totalProfit,
      newProfit: totalProfitProp,
      cdc: products.length * CDC_COST,
      discountEuro: totalCurrent - totalProposal,
      discountPct: totalCurrent ? ((totalCurrent - totalProposal) / totalCurrent) : 0,
    };

    res.json({ products, totals });
  } catch (err) {
    console.error('Quotation error', err);
    res.status(500).json({ error: 'Quotation error', details: err.message });
  }
});

module.exports = router;
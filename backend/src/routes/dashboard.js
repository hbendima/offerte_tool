const express = require("express");
const router = express.Router();

// Dummy offertes data
let NEXT_ID = 3;
const OFFERTES = [
  { id: 1, customer: "Klant A", total: 1200, date: "2025-09-25" },
  { id: 2, customer: "Klant B", total: 980, date: "2025-09-27" },
];

router.get("/dashboard", (req, res) => {
  res.json({ offertes: OFFERTES });
});

// Offerte opslaan endpoint
router.post("/offerte", (req, res) => {
  const data = req.body;
  if (!data.klant || !data.totaal || !data.datum) {
    return res.status(400).json({ error: "Verplichte velden ontbreken" });
  }
  const nieuweOfferte = {
    id: NEXT_ID++,
    customer: data.klant,
    total: data.totaal,
    date: data.datum,
    bedrijf: data.bedrijf,
    producten: data.producten,
    email: data.email
  };
  OFFERTES.push(nieuweOfferte);
  res.json({ success: true, offerte: nieuweOfferte });
});

module.exports = router;
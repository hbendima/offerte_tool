const express = require("express");
const router = express.Router();


const fs = require('fs');
const path = require('path');
const OFFERTES_PATH = path.join(__dirname, '../offertes.json');

function readOffertes() {
  try {
    const data = fs.readFileSync(OFFERTES_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function writeOffertes(offertes) {
  fs.writeFileSync(OFFERTES_PATH, JSON.stringify(offertes, null, 2), 'utf8');
}

function getNextId(offertes) {
  return offertes.length > 0 ? Math.max(...offertes.map(o => o.id)) + 1 : 1;
}

router.get("/dashboard", (req, res) => {
  const offertes = readOffertes();
  res.json({ offertes });
});

// Offerte opslaan endpoint
router.post("/offerte", (req, res) => {
  const data = req.body;
  if (!data.klant || !data.totaal || !data.datum) {
    return res.status(400).json({ error: "Verplichte velden ontbreken" });
  }
  const offertes = readOffertes();
  const nieuweOfferte = {
    id: getNextId(offertes),
    customer: data.klant,
    total: data.totaal,
    date: data.datum,
    bedrijf: data.bedrijf,
    btw: data.btw,
    adres: data.adres,
    postcode: data.postcode,
    gemeente: data.gemeente,
    land: data.land,
    email: data.email,
    producten: Array.isArray(data.producten) ? data.producten.map(p => ({
      sku: p.sku,
      naam: p.naam,
      aantal: p.aantal,
      prijs: p.prijs
    })) : [],
  };
  offertes.push(nieuweOfferte);
  writeOffertes(offertes);
  res.json({ success: true, offerte: nieuweOfferte });
});

module.exports = router;
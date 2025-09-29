const express = require("express");
const router = express.Router();

// Dummy offertes data
const OFFERTES = [
  { id: 1, customer: "Klant A", total: 1200, date: "2025-09-25" },
  { id: 2, customer: "Klant B", total: 980, date: "2025-09-27" },
];

router.get("/dashboard", (req, res) => {
  res.json({ offertes: OFFERTES });
});

module.exports = router;
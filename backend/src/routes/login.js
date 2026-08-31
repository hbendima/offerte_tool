const express = require("express");
const router = express.Router();

const { verifyCredentials } = require('../accountStore');

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = verifyCredentials(username, password);
  if (user) {
    res.json({ user });
  } else {
    res.status(401).json({ error: "Ongeldige gebruikersnaam of wachtwoord" });
  }
});

module.exports = router;
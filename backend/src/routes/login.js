const express = require("express");
const router = express.Router();

// Hardcoded users for demo
const USERS = [
  { username: "admin", password: "test123", name: "Admin User" },
  { username: "user", password: "password", name: "Normal User" },
];

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(
    u => u.username === username && u.password === password
  );
  if (user) {
    res.json({ user: { username: user.username, name: user.name } });
  } else {
    res.status(401).json({ error: "Ongeldige gebruikersnaam of wachtwoord" });
  }
});

module.exports = router;
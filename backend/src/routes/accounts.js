const express = require('express');
const {
  getPublicAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} = require('../accountStore');

const router = express.Router();

function requireAdmin(req, res, next) {
  const role = String(req.headers['x-user-role'] || '').toLowerCase();
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Alleen admins mogen accounts beheren' });
  }

  return next();
}

router.get('/accounts', requireAdmin, (req, res) => {
  res.json({ accounts: getPublicAccounts() });
});

router.post('/accounts', requireAdmin, (req, res) => {
  try {
    const account = createAccount(req.body || {});
    res.status(201).json({ account });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Kon account niet maken' });
  }
});

router.patch('/accounts/:username', requireAdmin, (req, res) => {
  try {
    const account = updateAccount(req.params.username, req.body || {});
    res.json({ account });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Kon account niet bijwerken' });
  }
});

router.delete('/accounts/:username', requireAdmin, (req, res) => {
  try {
    const account = deleteAccount(req.params.username);
    res.json({ account });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Kon account niet verwijderen' });
  }
});

module.exports = router;
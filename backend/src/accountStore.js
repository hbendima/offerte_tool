const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ACCOUNTS_PATH = path.join(__dirname, 'accounts.json');
const PASSWORD_ITERATIONS = 120000;

const SEED_ACCOUNTS = [
  { username: 'admin', name: 'Administrator', password: 'test123', role: 'admin', active: true },
  { username: 'medewerker', name: 'Medewerker', password: 'welkom123', role: 'employee', active: true },
];

function createPasswordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, PASSWORD_ITERATIONS, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function safeString(value) {
  return String(value ?? '').trim();
}

function publicAccount(account) {
  return {
    username: account.username,
    name: account.name,
    role: account.role,
    active: account.active,
  };
}

function normalizeAccount(rawAccount) {
  const username = safeString(rawAccount.username);
  const name = safeString(rawAccount.name) || username;
  const role = rawAccount.role === 'admin' ? 'admin' : 'employee';
  const active = rawAccount.active !== false;

  if (!username) {
    return null;
  }

  if (rawAccount.passwordHash && rawAccount.passwordSalt) {
    return {
      username,
      name,
      role,
      active,
      passwordHash: safeString(rawAccount.passwordHash),
      passwordSalt: safeString(rawAccount.passwordSalt),
    };
  }

  const passwordSource = safeString(rawAccount.password) || 'changeme123';
  const passwordHash = createPasswordHash(passwordSource);

  return {
    username,
    name,
    role,
    active,
    passwordHash: passwordHash.hash,
    passwordSalt: passwordHash.salt,
  };
}

function ensureAccountsFile() {
  if (!fs.existsSync(ACCOUNTS_PATH)) {
    const seeded = SEED_ACCOUNTS.map(normalizeAccount).filter(Boolean);
    fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(seeded, null, 2), 'utf8');
  }
}

function readRawAccounts() {
  ensureAccountsFile();

  try {
    const data = fs.readFileSync(ACCOUNTS_PATH, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts) {
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2), 'utf8');
}

function readAccounts() {
  const normalized = readRawAccounts().map(normalizeAccount).filter(Boolean);
  if (normalized.length === 0) {
    const seeded = SEED_ACCOUNTS.map(normalizeAccount).filter(Boolean);
    writeAccounts(seeded);
    return seeded;
  }

  return normalized;
}

function saveAccounts(accounts) {
  writeAccounts(accounts);
  return accounts;
}

function getPublicAccounts() {
  return readAccounts().map(publicAccount);
}

function findAccount(username) {
  const normalizedUsername = safeString(username);
  return readAccounts().find((account) => account.username.toLowerCase() === normalizedUsername.toLowerCase()) || null;
}

function verifyCredentials(username, password) {
  const account = findAccount(username);
  if (!account || account.active === false) {
    return null;
  }

  const hashed = crypto.pbkdf2Sync(String(password), account.passwordSalt, PASSWORD_ITERATIONS, 32, 'sha256').toString('hex');
  const storedHash = Buffer.from(account.passwordHash, 'hex');
  const candidateHash = Buffer.from(hashed, 'hex');

  if (storedHash.length !== candidateHash.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(storedHash, candidateHash)) {
    return null;
  }

  return publicAccount(account);
}

function createAccount(input) {
  const username = safeString(input.username);
  const name = safeString(input.name) || username;
  const password = safeString(input.password);
  const role = input.role === 'admin' ? 'admin' : 'employee';
  const active = input.active !== false;

  if (!username || !password) {
    throw new Error('Gebruikersnaam en wachtwoord zijn verplicht');
  }

  const accounts = readAccounts();
  if (accounts.some((account) => account.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Deze gebruikersnaam bestaat al');
  }

  const passwordHash = createPasswordHash(password);
  const newAccount = {
    username,
    name,
    role,
    active,
    passwordHash: passwordHash.hash,
    passwordSalt: passwordHash.salt,
  };

  accounts.push(newAccount);
  saveAccounts(accounts);
  return publicAccount(newAccount);
}

function updateAccount(username, input) {
  const accounts = readAccounts();
  const index = accounts.findIndex((account) => account.username.toLowerCase() === safeString(username).toLowerCase());

  if (index === -1) {
    throw new Error('Account niet gevonden');
  }

  const next = { ...accounts[index] };

  if (input.name !== undefined) {
    next.name = safeString(input.name) || next.name;
  }

  if (input.role !== undefined) {
    next.role = input.role === 'admin' ? 'admin' : 'employee';
  }

  if (input.active !== undefined) {
    next.active = Boolean(input.active);
  }

  if (input.password) {
    const passwordHash = createPasswordHash(input.password);
    next.passwordHash = passwordHash.hash;
    next.passwordSalt = passwordHash.salt;
  }

  accounts[index] = next;
  saveAccounts(accounts);
  return publicAccount(next);
}

function deleteAccount(username) {
  const accounts = readAccounts();
  const normalizedUsername = safeString(username);
  const index = accounts.findIndex((account) => account.username.toLowerCase() === normalizedUsername.toLowerCase());

  if (index === -1) {
    throw new Error('Account niet gevonden');
  }

  const target = accounts[index];
  if (target.role === 'admin') {
    const adminCount = accounts.filter((account) => account.role === 'admin').length;
    if (adminCount <= 1) {
      throw new Error('Er moet minstens één admin-account bestaan');
    }
  }

  accounts.splice(index, 1);
  saveAccounts(accounts);
  return publicAccount(target);
}

module.exports = {
  getPublicAccounts,
  verifyCredentials,
  createAccount,
  updateAccount,
  deleteAccount,
};
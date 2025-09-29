const express = require('express');
const cors = require('cors');
const loginRouter = require('./routes/login');
const dashboardRouter = require('./routes/dashboard');
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', loginRouter);
app.use('/api', dashboardRouter);

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Voeg deze blok toe om de server te starten:
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server draait op http://localhost:${PORT}/`);
});

module.exports = app;
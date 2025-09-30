const express = require('express');
const cors = require('cors');

const app = express();

const loginRouter = require('./routes/login');
const dashboardRouter = require('./routes/dashboard');
const productsRouter = require('./products');
const quotationRouter = require('./quotation');

app.use(cors());
app.use(express.json());

app.use('/api', loginRouter);
app.use('/api', dashboardRouter);
app.use('/api', productsRouter);
app.use('/api', quotationRouter); // <-- Quotation endpoint

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.send('Backend server draait!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server draait op http://localhost:${PORT}/`);
});

module.exports = app;
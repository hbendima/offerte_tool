const express = require('express');
const cors = require('cors');
const { initDevLogger, getDevLogs, pushLog } = require('./devLogger');

initDevLogger();

const app = express();

const loginRouter = require('./routes/login');
const accountsRouter = require('./routes/accounts');
const dashboardRouter = require('./routes/dashboard');
const productsRouter = require('./products');
const quotationRouter = require('./quotation');
const batchSearchRoutes = require('./routes/batchSearch');

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const path = req.path || req.originalUrl || '';
    const isRoutinePoll = req.method === 'GET' && (path === '/api/offertes' || path === '/api/dev-logs');
    const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

    pushLog(
      'info',
      `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`,
      'request',
      {
        noise: isRoutinePoll && isSuccess,
        endpoint: path,
      }
    );
  });

  next();
});

app.use('/api', loginRouter);
app.use('/api', accountsRouter);
app.use('/api', dashboardRouter);
app.use('/api', productsRouter);
app.use('/api', quotationRouter); // <-- Quotation endpoint
app.use('/api', batchSearchRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/dev-logs', (req, res) => {
  res.json({ logs: getDevLogs() });
});

app.get('/', (req, res) => {
  res.send('Backend server draait!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server draait op http://localhost:${PORT}/`);
});

module.exports = app;
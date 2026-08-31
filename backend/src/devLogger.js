const util = require('util');

const MAX_LOGS = 500;
const logs = [];
let nextId = 1;
let initialized = false;

function formatValue(value) {
  if (typeof value === 'string') {
    return value;
  }

  return util.inspect(value, {
    depth: 4,
    breakLength: 120,
    compact: true,
  });
}

function pushLog(level, message, source = 'backend', meta = {}) {
  logs.push({
    id: nextId++,
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    meta,
  });

  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

function initDevLogger() {
  if (initialized) {
    return;
  }

  initialized = true;

  ['log', 'info', 'warn', 'error'].forEach((level) => {
    const original = console[level].bind(console);

    console[level] = (...args) => {
      const message = args.map(formatValue).join(' ');
      // Smart-import diagnostics krijgen level 'debug' zodat ze apart gefilterd kunnen worden
      const effectiveLevel = (level === 'log' && message.startsWith('[smart-import]')) ? 'debug' : level;
      pushLog(effectiveLevel, message);
      original(...args);
    };
  });

  process.on('warning', (warning) => {
    pushLog('warn', `${warning.name}: ${warning.message}${warning.stack ? `\n${warning.stack}` : ''}`);
  });

  process.on('uncaughtException', (error) => {
    pushLog('error', `[uncaughtException] ${error.stack || error.message}`);
  });

  process.on('unhandledRejection', (reason) => {
    pushLog('error', `[unhandledRejection] ${formatValue(reason)}`);
  });
}

function getDevLogs() {
  return logs;
}

module.exports = {
  initDevLogger,
  getDevLogs,
  pushLog,
};
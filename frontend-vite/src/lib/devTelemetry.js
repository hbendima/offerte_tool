const MAX_LOGS = 500;
const STORAGE_KEY = "offerte-tool-dev-logs";

const state = {
  initialized: false,
  logs: [],
  listeners: new Set(),
};

function safeStringify(value) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.logs));
  } catch {
    // Ignore storage failures in private/incognito modes.
  }
}

function notify() {
  const snapshot = getFrontendLogs();
  state.listeners.forEach((listener) => listener(snapshot));
}

function addLog(level, source, message, meta = {}) {
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    meta,
  };

  state.logs.push(entry);

  if (state.logs.length > MAX_LOGS) {
    state.logs.splice(0, state.logs.length - MAX_LOGS);
  }

  persist();
  notify();
}

function wrapConsole() {
  ["log", "info", "warn", "error", "debug"].forEach((level) => {
    const original = console[level].bind(console);

    console[level] = (...args) => {
      addLog(level, "frontend", args.map(safeStringify).join(" "), { type: "console" });
      original(...args);
    };
  });
}

function wrapFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const startedAt = performance.now();
    const requestInfo = args[0];
    const requestUrl = typeof requestInfo === "string" ? requestInfo : requestInfo?.url || "unknown request";

    const isRoutinePoll = String(requestUrl).includes("/api/dev-logs") || String(requestUrl).includes("/api/frontend-dev-logs") || String(requestUrl).includes("/api/offertes");
    const shouldLog = !String(requestUrl).includes("/api/dev-logs") && !String(requestUrl).includes("/api/frontend-dev-logs");

    try {
      const response = await originalFetch(...args);

      if (shouldLog) {
        addLog("info", "frontend", `${requestUrl} -> ${response.status} (${Math.round(performance.now() - startedAt)}ms)`, {
          type: "fetch",
          noise: isRoutinePoll,
          method: typeof args[1] === "object" && args[1]?.method ? args[1].method : "GET",
        });
      }

      return response;
    } catch (error) {
      if (shouldLog) {
        addLog("error", "frontend", `${requestUrl} failed: ${error.message || error}`, {
          type: "fetch",
          noise: isRoutinePoll,
          method: typeof args[1] === "object" && args[1]?.method ? args[1].method : "GET",
        });
      }

      throw error;
    }
  };
}

function attachErrorHandlers() {
  window.addEventListener("error", (event) => {
    const message = event.error?.stack || event.message || "Frontend error";
    addLog("error", "frontend", message, { type: "error" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const message = event.reason?.stack || event.reason?.message || safeStringify(event.reason);
    addLog("error", "frontend", message, { type: "unhandledrejection" });
  });
}

export function initializeDevTelemetry() {
  if (state.initialized || typeof window === "undefined") {
    return;
  }

  state.initialized = true;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      state.logs = JSON.parse(stored);
    }
  } catch {
    state.logs = [];
  }

  addLog("info", "system", "Frontend telemetry initialized", { type: "lifecycle" });
  wrapConsole();
  wrapFetch();
  attachErrorHandlers();
}

export function subscribeToFrontendLogs(listener) {
  state.listeners.add(listener);
  listener(getFrontendLogs());

  return () => {
    state.listeners.delete(listener);
  };
}

export function getFrontendLogs() {
  return [...state.logs];
}

export function clearFrontendLogs() {
  state.logs = [];
  persist();
  notify();
}

export function addFrontendNote(message, level = "info", source = "frontend") {
  addLog(level, source, message, { type: "manual" });
}
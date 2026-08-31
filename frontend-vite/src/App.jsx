import React, { useEffect, useState } from "react";
import LoginForm from "./components/LoginForm";
import Dashboard from "./components/Dashboard";
import DevLogs from "./components/DevLogs";
import Settings from "./components/Settings";
import { initializeDevTelemetry } from "./lib/devTelemetry";
// Offerte Tool verwijderd

initializeDevTelemetry();

const THEME_KEY = "offerte-tool-theme";

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard"); // "dashboard" of "devlogs" of "settings"
  const [theme, setTheme] = useState(() => getInitialTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-brand">
          <div className="app-brand__eyebrow">Offerte Tool</div>
          <div className="app-brand__title">Pricing, quoting en observability in één workspace</div>
        </div>

        <div className="app-tabs" role="tablist" aria-label="Navigatie">
          <button
            type="button"
            onClick={() => setView("dashboard")}
            className={`tab-pill ${view === "dashboard" ? "is-active" : ""}`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setView("devlogs")}
            className={`tab-pill tab-pill--teal ${view === "devlogs" ? "is-active" : ""}`}
          >
            Dev logs
          </button>
          {user?.role === "admin" && (
            <button
              type="button"
              onClick={() => setView("settings")}
              className={`tab-pill tab-pill--violet ${view === "settings" ? "is-active" : ""}`}
            >
              Settings
            </button>
          )}
        </div>

        <div className="app-actions">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="theme-toggle"
            aria-label={theme === "dark" ? "Schakel naar light mode" : "Schakel naar dark mode"}
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </header>

      <main className="app-content">
        <section style={{ display: view === "dashboard" ? "block" : "none" }} aria-hidden={view !== "dashboard"}>
          <Dashboard user={user} />
        </section>
        <section style={{ display: view === "devlogs" ? "block" : "none" }} aria-hidden={view !== "devlogs"}>
          <DevLogs user={user} isActive={view === "devlogs"} />
        </section>
        <section style={{ display: view === "settings" ? "block" : "none" }} aria-hidden={view !== "settings"}>
          <Settings user={user} />
        </section>
      </main>
    </div>
  );
}
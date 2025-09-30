import React, { useState } from "react";
import LoginForm from "./components/LoginForm";
import Dashboard from "./components/Dashboard";
import QuotationTool from './components/QuotationTool';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard"); // "dashboard" of "quotation"

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return (
    <div>
      {/* Navigatie na login */}
      <nav style={{ marginBottom: 24, display: "flex", gap: 20 }}>
        <button
          onClick={() => setView("dashboard")}
          style={{
            padding: "10px 28px",
            borderRadius: 7,
            border: "none",
            background: view === "dashboard" ? "#222" : "#888",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "1rem"
          }}
        >
          Dashboard
        </button>
        <button
          onClick={() => setView("quotation")}
          style={{
            padding: "10px 28px",
            borderRadius: 7,
            border: "none",
            background: view === "quotation" ? "#222" : "#888",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "1rem"
          }}
        >
          Offerte Tool
        </button>
      </nav>
      {/* Render de juiste view */}
      {view === "dashboard" && <Dashboard user={user} />}
      {view === "quotation" && <QuotationTool />}
    </div>
  );
}
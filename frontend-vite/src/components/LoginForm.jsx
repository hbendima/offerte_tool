import React, { useState } from "react";
import "./LoginForm.css";

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const raw = await response.text();
      let data = {};

      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error("Loginservice gaf geen geldig antwoord. Controleer of backend draait.");
        }
      }

      if (!response.ok) {
        throw new Error(data.error || "Ongeldige gebruikersnaam of wachtwoord");
      }

      if (!data.user) {
        throw new Error("Loginservice gaf een leeg antwoord. Controleer of backend draait.");
      }

      onLogin(data.user);
    } catch (loginError) {
      setError(loginError.message || "Login mislukt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-form-page">
      <div className="login-layout">
        <aside className="login-hero">
          <div className="login-hero__badge">Klium workspace</div>
          <img
            src="/klium-logo.png"
            alt="Klium logo"
            className="login-hero__logo"
          />
          <h1 className="login-hero__title">Offerte Tool</h1>
          <p className="login-hero__text">
            Maak en beheer offertes met snelle prijscontrole en export naar PDF of Excel.
          </p>
        </aside>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form__brand">
            <div>
              <div className="login-form__eyebrow">Aanmelden</div>
              <h2>Welkom terug</h2>
            </div>
          </div>
          <p className="login-form__subtitle">
            Meld je aan met je medewerkersaccount.
          </p>
          {error && <div className="error">{error}</div>}
          <div className="login-form__field">
            <label>Gebruikersnaam</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="login-form__field">
            <label>Wachtwoord</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={loading}>{loading ? "Bezig..." : "Login"}</button>
          <div className="login-form__hint">
            Geen account? Neem contact op met je beheerder.
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginForm;
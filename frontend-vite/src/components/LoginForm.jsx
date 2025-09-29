import React, { useState } from "react";
import "./LoginForm.css";

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    // Hier zou je login-logica komen, nu alleen demo:
    if (username === "demo" && password === "demo") {
      onLogin({ username });
    } else {
      setError("Ongeldige gebruikersnaam of wachtwoord");
    }
  }

  return (
    <div className="login-form-page">
      <form className="login-form" onSubmit={handleSubmit}>
        <img
          src="/klium-logo.png"
          alt="Klium logo"
          style={{
            width: "120px",
            margin: "0 auto 16px auto",
            display: "block"
          }}
        />
        <h2>Login</h2>
        {error && <div className="error">{error}</div>}
        <div>
          <label>Gebruikersnaam</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label>Wachtwoord</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default LoginForm;
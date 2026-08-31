import React, { useEffect, useMemo, useState } from "react";
import "./Settings.css";

function Settings({ user }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newAccount, setNewAccount] = useState({
    username: "",
    name: "",
    password: "",
    role: "employee",
    active: true,
  });
  const [rowDrafts, setRowDrafts] = useState({});

  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    "x-user-role": user?.role || "",
    "x-current-user": user?.username || "",
  }), [user]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/accounts", {
        headers: {
          "x-user-role": user?.role || "",
          "x-current-user": user?.username || "",
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Kon accounts niet laden");
      }

      const nextAccounts = Array.isArray(data.accounts) ? data.accounts : [];
      setAccounts(nextAccounts);
      setRowDrafts(
        Object.fromEntries(
          nextAccounts.map((account) => [
            account.username,
            {
              name: account.name || "",
              role: account.role || "employee",
              active: account.active !== false,
              password: "",
            },
          ])
        )
      );
      setError("");
    } catch (fetchError) {
      setError(fetchError.message || "Kon accounts niet laden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const stats = useMemo(() => ({
    total: accounts.length,
    admins: accounts.filter((account) => account.role === "admin").length,
    active: accounts.filter((account) => account.active !== false).length,
  }), [accounts]);

  const updateDraft = (username, field, value) => {
    setRowDrafts((current) => ({
      ...current,
      [username]: {
        ...(current[username] || {}),
        [field]: value,
      },
    }));
  };

  const createAccount = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(newAccount),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Kon account niet maken");
      }

      setNewAccount({ username: "", name: "", password: "", role: "employee", active: true });
      setMessage(`Account ${data.account.username} aangemaakt.`);
      await fetchAccounts();
    } catch (createError) {
      setError(createError.message || "Kon account niet maken");
    }
  };

  const saveAccount = async (username) => {
    setMessage("");
    setError("");

    try {
      const draft = rowDrafts[username] || {};
      const payload = {
        name: draft.name,
        role: draft.role,
        active: draft.active,
      };

      if (draft.password) {
        payload.password = draft.password;
      }

      const response = await fetch(`/api/accounts/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Kon account niet opslaan");
      }

      setMessage(`Account ${data.account.username} bijgewerkt.`);
      await fetchAccounts();
    } catch (saveError) {
      setError(saveError.message || "Kon account niet opslaan");
    }
  };

  const removeAccount = async (username) => {
    if (!window.confirm(`Account ${username} verwijderen?`)) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Kon account niet verwijderen");
      }

      setMessage(`Account ${data.account.username} verwijderd.`);
      await fetchAccounts();
    } catch (deleteError) {
      setError(deleteError.message || "Kon account niet verwijderen");
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="settings-page">
        <div className="settings-card">
          <h2>Settings</h2>
          <p>Alleen admins kunnen medewerkersaccounts beheren.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-hero">
        <div>
          <h1 className="settings-hero__title">Accountbeheer</h1>
          <p className="settings-hero__subtitle">
            Maak accounts aan voor medewerkers, wijzig rechten, zet accounts tijdelijk uit en reset wachtwoorden zonder de offerteflow te raken.
          </p>
        </div>
        <div className="settings-hero__stats">
          <div className="settings-chip">Totaal: {stats.total}</div>
          <div className="settings-chip">Actief: {stats.active}</div>
          <div className="settings-chip">Admins: {stats.admins}</div>
        </div>
      </div>

      <div className="settings-grid">
        <section className="settings-card">
          <h2>Nieuw account</h2>
          <p>Gebruik dit om een medewerker direct toegang te geven.</p>

          <form className="settings-form" onSubmit={createAccount}>
            <label className="settings-form__field">
              <span>Gebruikersnaam</span>
              <input
                value={newAccount.username}
                onChange={(e) => setNewAccount((current) => ({ ...current, username: e.target.value }))}
                placeholder="voornaam.naam"
                autoComplete="off"
              />
            </label>

            <label className="settings-form__field">
              <span>Naam</span>
              <input
                value={newAccount.name}
                onChange={(e) => setNewAccount((current) => ({ ...current, name: e.target.value }))}
                placeholder="Volledige naam"
                autoComplete="off"
              />
            </label>

            <label className="settings-form__field">
              <span>Wachtwoord</span>
              <input
                type="password"
                value={newAccount.password}
                onChange={(e) => setNewAccount((current) => ({ ...current, password: e.target.value }))}
                placeholder="Kies een sterk wachtwoord"
                autoComplete="new-password"
              />
            </label>

            <label className="settings-form__field">
              <span>Rol</span>
              <select
                value={newAccount.role}
                onChange={(e) => setNewAccount((current) => ({ ...current, role: e.target.value }))}
              >
                <option value="employee">Medewerker</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <label className="settings-switch">
              <input
                type="checkbox"
                checked={newAccount.active}
                onChange={(e) => setNewAccount((current) => ({ ...current, active: e.target.checked }))}
              />
              Actief
            </label>

            <div className="settings-form__actions">
              <button className="settings-btn settings-btn--primary" type="submit">
                Account aanmaken
              </button>
              <button
                className="settings-btn settings-btn--ghost"
                type="button"
                onClick={() => setNewAccount({ username: "", name: "", password: "", role: "employee", active: true })}
              >
                Wissen
              </button>
            </div>
          </form>
        </section>

        <section className="settings-card">
          <h2>Bestaande accounts</h2>
          <p>Wijzig naam, rol, status of wachtwoord. De wijzigingen gaan rechtstreeks naar de backend-opslag.</p>

          {message && <div className="settings-message">{message}</div>}
          {error && <div className="settings-message settings-message--error">{error}</div>}

          {loading ? (
            <div className="settings-message">Accounts laden...</div>
          ) : (
            <div className="settings-table-shell">
              <table className="settings-table">
                <thead>
                  <tr>
                    <th>Gebruikersnaam</th>
                    <th>Naam</th>
                    <th>Rol</th>
                    <th>Status</th>
                    <th>Nieuw wachtwoord</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => {
                    const draft = rowDrafts[account.username] || {};
                    const isActive = draft.active !== false;

                    return (
                      <tr key={account.username}>
                        <td>
                          <strong>{account.username}</strong>
                          <div className="settings-muted">{account.role === 'admin' ? 'beheerder' : 'medewerker'}</div>
                        </td>
                        <td>
                          <input
                            value={draft.name ?? account.name ?? ""}
                            onChange={(e) => updateDraft(account.username, 'name', e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            value={draft.role ?? account.role ?? 'employee'}
                            onChange={(e) => updateDraft(account.username, 'role', e.target.value)}
                          >
                            <option value="employee">Medewerker</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td>
                          <label className="settings-switch">
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={(e) => updateDraft(account.username, 'active', e.target.checked)}
                            />
                            {isActive ? 'Actief' : 'Uitgezet'}
                          </label>
                        </td>
                        <td>
                          <input
                            type="password"
                            value={draft.password || ""}
                            onChange={(e) => updateDraft(account.username, 'password', e.target.value)}
                            placeholder="Leeg laten om te behouden"
                          />
                        </td>
                        <td>
                          <div className="settings-row-actions">
                            <button className="settings-btn settings-btn--primary" type="button" onClick={() => saveAccount(account.username)}>
                              Opslaan
                            </button>
                            <button className="settings-btn settings-btn--danger" type="button" onClick={() => removeAccount(account.username)}>
                              Verwijder
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Settings;
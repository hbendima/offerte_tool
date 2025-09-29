import React, { useEffect, useState } from "react";
import "./Dashboard.css";

function Dashboard({ user }) {
  const [offertes, setOffertes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(res => res.json())
      .then(data => {
        setOffertes(data.offertes);
        setLoading(false);
      });
  }, []);

  return (
    <div className="dashboard-card">
      <div className="dashboard-title">Dashboard</div>
      <div className="dashboard-welcome">Welkom, <b>{user.name || user.username}</b></div>
      <div className="dashboard-subtitle">Laatste offertes</div>
      {loading ? (
        <p>Laden...</p>
      ) : (
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Offerte ID</th>
              <th>Klant</th>
              <th>Totaal</th>
              <th>Datum</th>
            </tr>
          </thead>
          <tbody>
            {offertes.map(o => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.customer}</td>
                <td>€ {o.total}</td>
                <td>{o.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Dashboard;
import React, { useEffect, useState } from "react";

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
    <div>
      <h2>Dashboard</h2>
      <p>Welkom, {user.name}</p>
      {loading ? (
        <p>Laden...</p>
      ) : (
        <>
          <h3>Laatste offertes</h3>
          <table>
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
        </>
      )}
    </div>
  );
}

export default Dashboard;
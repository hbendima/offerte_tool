// src/components/Dashboard.jsx
import React, { useEffect, useState } from "react";
import "./Dashboard.css";
import QuotationTool from "./QuotationTool"; // <-- Toegevoegd

function Dashboard({ user }) {
  const [offertes, setOffertes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOfferte, setSelectedOfferte] = useState(null);
  const [openOfferte, setOpenOfferte] = useState(null);

  // Ophalen offertes
  const fetchOffertes = () => {
    setLoading(true);
    fetch("/api/dashboard")
      .then(res => res.json())
      .then(data => {
        setOffertes(data.offertes);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchOffertes();
  }, []);

  return (
    <div className="dashboard-card">
      <div className="dashboard-title">Dashboard</div>
      <div className="dashboard-welcome">
        Welkom, <b>{user.name || user.username}</b>
      </div>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {offertes.map(o => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.customer}</td>
                <td>€ {o.total}</td>
                <td>{o.date}</td>
                <td style={{display:'flex',gap:8}}>
                  <button style={{padding:'4px 12px',borderRadius:6}} onClick={() => setSelectedOfferte(o)}>
                    Bekijk
                  </button>
                  <button style={{padding:'4px 12px',borderRadius:6,background:'#0077cc',color:'#fff',fontWeight:600,border:'none',boxShadow:'0 1px 4px #0077cc44',cursor:'pointer'}} onClick={() => setOpenOfferte(o)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Offerte detail modal */}
      {selectedOfferte && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.35)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setSelectedOfferte(null)}>
          <div style={{background:'#fff',padding:32,borderRadius:16,minWidth:440,maxWidth:700,boxShadow:'0 2px 18px rgba(0,0,0,0.18)',position:'relative'}} onClick={e=>e.stopPropagation()}>
            <button style={{position:'absolute',top:18,right:18,fontSize:'1.6em',background:'none',border:'none',cursor:'pointer',color:'#222'}} onClick={()=>setSelectedOfferte(null)}>
              <span style={{color:'#222',background:'#fff',borderRadius:'50%',padding:'2px 8px',fontWeight:700}}>✕</span>
            </button>
            <h2>Offerte #{selectedOfferte.id}</h2>
            <div><b>Klant:</b> {selectedOfferte.customer}</div>
            {selectedOfferte.bedrijf && <div><b>Bedrijf:</b> {selectedOfferte.bedrijf}</div>}
            {selectedOfferte.email && <div><b>Email:</b> {selectedOfferte.email}</div>}
            <div><b>Totaal:</b> € {selectedOfferte.total}</div>
            <div><b>Datum:</b> {selectedOfferte.date}</div>
            {selectedOfferte.producten && selectedOfferte.producten.length > 0 && (
              <div style={{marginTop:18}}>
                <b>Producten:</b>
                <table style={{width:'100%',marginTop:8}}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Naam</th>
                      <th>Aantal</th>
                      <th>Prijs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOfferte.producten.map((p, i) => (
                      <tr key={i}>
                        <td>{p.sku}</td>
                        <td>{p.naam}</td>
                        <td>{p.aantal}</td>
                        <td style={{textAlign:'right', minWidth:'100px', whiteSpace:'nowrap'}}>
                          € {typeof p.prijs === 'number' ? p.prijs.toFixed(2) : p.prijs}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offerte maken tool */}
      <div style={{ marginTop: 32 }}>
        <QuotationTool onOfferteSaved={fetchOffertes} offerteData={openOfferte} />
      </div>
    </div>
  );
}

export default Dashboard;
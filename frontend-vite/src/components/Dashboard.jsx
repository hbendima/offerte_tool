// src/components/Dashboard.jsx
import React, { useEffect, useState } from "react";
import "./Dashboard.css";
import QuotationTool from "./QuotationTool"; // <-- Toegevoegd

function Dashboard({ user }) {
  const [offertes, setOffertes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOfferte, setSelectedOfferte] = useState(null);
  const [openOfferte, setOpenOfferte] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const OFFERTES_PER_PAGE = 10;

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
      <div className="dashboard-subtitle">Recente offertes</div>
      {/* Paginated offertes table */}
      {offertes.length > 0 && (
        (() => {
          const totalPages = Math.max(1, Math.ceil(offertes.length / OFFERTES_PER_PAGE));
          const page = Math.min(currentPage, totalPages);
          const startIdx = (page - 1) * OFFERTES_PER_PAGE;
          const endIdx = startIdx + OFFERTES_PER_PAGE;
          const pagedOffertes = offertes.slice(startIdx, endIdx);
          return (
            <div style={{marginBottom: 32, background: '#fff', borderRadius: 16, padding: 32, color: '#222', boxShadow: '0 2px 18px #000a', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto'}}>
              <h2 style={{ marginBottom: '24px', fontWeight: 700, fontSize: '1.5rem', letterSpacing: '0.5px', color: '#222' }}>Recente offertes</h2>
              <table style={{width:'100%', background:'#fff', borderRadius:12, marginBottom:16, fontSize:'1rem', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                <thead>
                  <tr style={{ background: '#f7f7f7', color: '#222', fontWeight: 700, fontSize: '1.08rem', height: '44px' }}>
                    <th style={{padding:'12px 8px',textAlign:'left',borderBottom:'1px solid #e0e0e0'}}>Datum</th>
                    <th style={{padding:'12px 8px',textAlign:'left',borderBottom:'1px solid #e0e0e0'}}>Klant</th>
                    <th style={{padding:'12px 8px',textAlign:'left',borderBottom:'1px solid #e0e0e0'}}>Bedrijf</th>
                    <th style={{padding:'12px 8px',textAlign:'right',borderBottom:'1px solid #e0e0e0'}}>Totaal</th>
                    <th style={{padding:'12px 8px',textAlign:'center',borderBottom:'1px solid #e0e0e0'}}>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedOffertes.map((o, idx) => (
                    <tr key={o.id || idx} style={{ color: '#111', height: '48px', background: idx % 2 === 0 ? '#fff' : '#f9f9f9', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#eaf3fb'}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#f9f9f9'}>
                        <td style={{padding:'12px 8px',borderBottom:'1px solid #ececec'}}>{o.date || o.datum}</td>
                        <td style={{padding:'12px 8px',borderBottom:'1px solid #ececec'}}>{o.customer || o.klant}</td>
                        <td style={{padding:'12px 8px',borderBottom:'1px solid #ececec'}}>{o.bedrijf}</td>
                        <td style={{padding:'12px 8px',borderBottom:'1px solid #ececec',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{o.total !== undefined ? `€ ${o.total}` : (o.totaal ? `€ ${o.totaal}` : '')}</td>
                        <td style={{padding:'12px 8px',borderBottom:'1px solid #ececec',textAlign:'center'}}>
                          <span style={{ display: 'inline-flex', gap: '8px' }}>
                            <button style={{borderRadius: '6px', background: '#222', color: 'white', padding: '7px 18px', border: 'none', fontWeight: 500, fontSize: '1rem', cursor: 'pointer', transition: 'background 0.2s'}} onClick={() => setSelectedOfferte(o)}>
                              Bekijk
                            </button>
                            <button style={{borderRadius: '6px', background: '#0074d9', color: 'white', padding: '7px 18px', border: 'none', fontWeight: 500, fontSize: '1rem', cursor: 'pointer', transition: 'background 0.2s'}} onClick={() => setOpenOfferte(o)}>
                              Open
                            </button>
                          </span>
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination controls */}
              <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:10,flexWrap:'wrap',marginTop:'10px'}}>
                <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:'7px 20px',borderRadius:6,background:'#444',color:'#fff',border:'none',fontWeight:500,fontSize:'1rem',cursor:page===1?'not-allowed':'pointer',opacity:page===1?0.6:1}}>Vorige</button>
                {Array.from({length: totalPages}, (_,i)=>i+1).map(pageNum => (
                  <button key={pageNum} onClick={()=>setCurrentPage(pageNum)} style={{padding:'7px 14px',borderRadius:6,background:pageNum===page?'#0074d9':'#222',color:'#fff',border:'none',fontWeight:500,margin:'0 2px',fontSize:'1rem',cursor:'pointer',opacity:pageNum===page?1:0.85}}>{pageNum}</button>
                ))}
                <button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{padding:'7px 20px',borderRadius:6,background:'#444',color:'#fff',border:'none',fontWeight:500,fontSize:'1rem',cursor:page===totalPages?'not-allowed':'pointer',opacity:page===totalPages?0.6:1}}>Volgende</button>
              </div>
            </div>
          );
        })()
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
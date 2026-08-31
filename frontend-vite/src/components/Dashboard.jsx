// src/components/Dashboard.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./Dashboard.css";
import QuotationTool from "./QuotationTool"; // <-- Toegevoegd

function Dashboard({ user }) {
  const [offertes, setOffertes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOfferte, setSelectedOfferte] = useState(null);
  const [openOfferte, setOpenOfferte] = useState(null);
  const [openingOfferteId, setOpeningOfferteId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");
  const OFFERTES_PER_PAGE = 10;

  const handleOffertePrefillDone = useCallback((offerteId) => {
    setOpeningOfferteId((current) => (current === offerteId ? null : current));
  }, []);

  // Ophalen offertes
    const fetchOffertes = () => {
      setLoading(true);
      fetch("/api/offertes")
        .then(res => res.json())
        .then(data => {
          setOffertes(data.offertes);
          setLoading(false);
        });
    };

  useEffect(() => {
    fetchOffertes();
  }, []);

  const visibleOffertes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const filtered = offertes.filter((offerte) => {
      if (!term) {
        return true;
      }

      const haystack = [
        offerte.id,
        offerte.date || offerte.datum,
        offerte.customer || offerte.klant,
        offerte.bedrijf,
        offerte.email,
        offerte.total,
        offerte.totaal,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });

    const parseDateValue = (value) => {
      if (!value) return 0;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    };

    const toAmount = (offerte) => {
      const value = offerte.total !== undefined ? offerte.total : offerte.totaal;
      const amount = Number(value);
      return Number.isFinite(amount) ? amount : 0;
    };

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "date-asc":
          return parseDateValue(a.date || a.datum) - parseDateValue(b.date || b.datum);
        case "amount-desc":
          return toAmount(b) - toAmount(a);
        case "amount-asc":
          return toAmount(a) - toAmount(b);
        case "customer-asc":
          return String(a.customer || a.klant || "").localeCompare(String(b.customer || b.klant || ""), "nl", { sensitivity: "base" });
        case "company-asc":
          return String(a.bedrijf || "").localeCompare(String(b.bedrijf || ""), "nl", { sensitivity: "base" });
        case "id-desc":
          return Number(b.id || 0) - Number(a.id || 0);
        case "id-asc":
          return Number(a.id || 0) - Number(b.id || 0);
        case "date-desc":
        default:
          return parseDateValue(b.date || b.datum) - parseDateValue(a.date || a.datum);
      }
    });

    return sorted;
  }, [offertes, searchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(visibleOffertes.length / OFFERTES_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const startIdx = (page - 1) * OFFERTES_PER_PAGE;
  const endIdx = startIdx + OFFERTES_PER_PAGE;
  const pagedOffertes = visibleOffertes.slice(startIdx, endIdx);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="dashboard-card">
      <div className="dashboard-hero">
        <div>
          <div className="dashboard-title">Dashboard</div>
          <div className="dashboard-welcome">
            Welkom, <b>{user.name || user.username}</b>
          </div>
        </div>
        <div className="dashboard-hero__meta">
          <div className="dashboard-hero__chip">Recente offertes: {offertes.length}</div>
          <div className="dashboard-hero__chip dashboard-hero__chip--soft">Live uit `/api/offertes`</div>
        </div>
      </div>

      <div className="dashboard-subtitle">Recente offertes</div>
      {offertes.length > 0 && (
        <div className="dashboard-recent-panel">
          <div className="dashboard-recent-panel__header">
            <div>
              <h2>Recente offertes</h2>
              <p>Zoek, sorteer en blader door offertes zonder de workflow te onderbreken.</p>
            </div>
            <div className="dashboard-recent-panel__count">
              {visibleOffertes.length} zichtbaar · {offertes.length} totaal · pagina {page}/{totalPages}
            </div>
          </div>

          <div className="dashboard-filterbar">
            <label className="dashboard-filterbar__field dashboard-filterbar__field--grow">
              <span>Zoeken</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ID, klant, bedrijf, email, bedrag..."
              />
            </label>

            <label className="dashboard-filterbar__field">
              <span>Sorteren</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="date-desc">Datum: nieuw eerst</option>
                <option value="date-asc">Datum: oud eerst</option>
                <option value="amount-desc">Bedrag: hoog naar laag</option>
                <option value="amount-asc">Bedrag: laag naar hoog</option>
                <option value="customer-asc">Klant: A-Z</option>
                <option value="company-asc">Bedrijf: A-Z</option>
                <option value="id-desc">ID: hoog naar laag</option>
                <option value="id-asc">ID: laag naar hoog</option>
              </select>
            </label>

            <button
              className="dashboard-filterbar__reset"
              type="button"
              onClick={() => {
                setSearchTerm("");
                setSortBy("date-desc");
              }}
              disabled={!searchTerm && sortBy === "date-desc"}
            >
              Reset
            </button>
          </div>

          <div className="dashboard-table-shell">
            <table className="dashboard-offers-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Datum</th>
                  <th>Klant</th>
                  <th>Bedrijf</th>
                  <th className="is-right">Totaal</th>
                  <th className="is-center">Acties</th>
                </tr>
              </thead>
              <tbody>
                {pagedOffertes.map((o, idx) => (
                  <tr key={o.id || idx}>
                    <td>{o.id}</td>
                    <td>{o.date || o.datum}</td>
                    <td>{o.customer || o.klant}</td>
                    <td>{o.bedrijf}</td>
                    <td className="is-right" style={{fontVariantNumeric:'tabular-nums'}}>{o.total !== undefined ? `€ ${(Number(o.total)).toFixed(2)}` : (o.totaal ? `€ ${(Number(o.totaal)).toFixed(2)}` : '')}</td>
                    <td className="is-center">
                      <span className="dashboard-actions">
                        <button className="dashboard-btn dashboard-btn--neutral" onClick={() => setSelectedOfferte(o)}>
                          Bekijk
                        </button>
                        <button
                          className={`dashboard-btn dashboard-btn--primary ${openingOfferteId === o.id ? "is-loading" : ""}`}
                          disabled={openingOfferteId !== null}
                          onClick={() => {
                            setOpeningOfferteId(o.id);
                            setOpenOfferte(o);
                          }}
                        >
                          {openingOfferteId === o.id ? "Openen..." : "Open"}
                        </button>
                        <button
                          className="dashboard-btn dashboard-btn--danger"
                          onClick={() => {
                            if (window.confirm('Bent u zeker dat u deze offerte wilt verwijderen?')) {
                              fetch(`/api/offerte/${o.id}`, { method: 'DELETE' })
                                .then(res => res.json())
                                .then(() => fetchOffertes());
                            }
                          }}
                        >
                          Verwijder
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibleOffertes.length === 0 && (
            <div className="dashboard-empty-state">
              Geen offertes gevonden met deze filter.
            </div>
          )}

          <div className="dashboard-pagination">
            <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={page===1} className="dashboard-page-btn">Vorige</button>
            <div className="dashboard-page-dots">
              {Array.from({length: totalPages}, (_,i)=>i+1).map(pageNum => (
                <button key={pageNum} onClick={()=>setCurrentPage(pageNum)} className={`dashboard-page-dot ${pageNum===page ? 'is-active' : ''}`}>{pageNum}</button>
              ))}
            </div>
            <button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="dashboard-page-btn">Volgende</button>
          </div>
        </div>
      )}

      {/* Offerte detail modal */}
      {selectedOfferte && (
        <div className="dashboard-modal" onClick={()=>setSelectedOfferte(null)}>
          <div className="dashboard-modal__panel" onClick={e=>e.stopPropagation()}>
            <button className="dashboard-modal__close" onClick={()=>setSelectedOfferte(null)} aria-label="Sluit offerte detail">
              ✕
            </button>

            <div className="dashboard-modal__header">
              <div>
                <div className="dashboard-modal__eyebrow">Offerte detail</div>
                <h2>Offerte #{selectedOfferte.id}</h2>
              </div>
              <div className="dashboard-modal__total">
                <span>Totaal</span>
                <strong>€ {Number(selectedOfferte.total || 0).toFixed(2)}</strong>
              </div>
            </div>

            <div className="dashboard-modal__meta-grid">
              <div className="dashboard-modal__meta-item"><span>Klant</span><strong>{selectedOfferte.customer}</strong></div>
              {selectedOfferte.bedrijf && <div className="dashboard-modal__meta-item"><span>Bedrijf</span><strong>{selectedOfferte.bedrijf}</strong></div>}
              {selectedOfferte.email && <div className="dashboard-modal__meta-item"><span>Email</span><strong>{selectedOfferte.email}</strong></div>}
              <div className="dashboard-modal__meta-item"><span>Datum</span><strong>{selectedOfferte.date}</strong></div>
            </div>

            {selectedOfferte.producten && selectedOfferte.producten.length > 0 && (
              <div className="dashboard-modal__products">
                <div className="dashboard-modal__section-title">Producten</div>
                <div className="dashboard-modal__table-shell">
                  <table className="dashboard-modal__table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Naam</th>
                        <th>Aantal</th>
                        <th className="is-right">Prijs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOfferte.producten.map((p, i) => (
                        <tr key={i}>
                          <td>{p.sku}</td>
                          <td>{p.naam}</td>
                          <td>{p.aantal}</td>
                          <td className="is-right">
                            € {typeof p.prijs === 'number' ? p.prijs.toFixed(2) : p.prijs}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offerte maken tool */}
      <div style={{ marginTop: 32 }}>
        {openingOfferteId !== null && (
          <div className="dashboard-open-offerte-loading" role="status" aria-live="polite">
            <span className="dashboard-open-offerte-spinner" aria-hidden="true"></span>
            <span>Offerte wordt opgehaald... even geduld.</span>
          </div>
        )}
        <QuotationTool
          onOfferteSaved={fetchOffertes}
          offerteData={openOfferte}
          onOffertePrefillDone={handleOffertePrefillDone}
        />
      </div>
    </div>
  );
}

export default Dashboard;
import React, { useState } from "react";

// Dummy initial product (structure only, real data from backend)
const initialProducts = [];

export default function QuotationTool() {
  const [rows, setRows] = useState([{ sku: "", amount: 1 }]);
  const [products, setProducts] = useState(initialProducts);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(false);

  // Add new SKU row
  const addRow = () => setRows([...rows, { sku: "", amount: 1 }]);

  // Remove row by index
  const removeRow = (idx) => setRows(rows.filter((_, i) => i !== idx));

  // Update SKU or amount
  const updateRow = (idx, field, value) => {
    const newRows = [...rows];
    newRows[idx][field] = value;
    setRows(newRows);
  };

  // Offerte maken (API request)
  const fetchQuotation = async () => {
    setLoading(true);
    try {
      // Real API call: POST /api/quotation
      const res = await fetch("/api/quotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows }),
      });
      const data = await res.json();
      setProducts(data.products || []);
      setTotals(data.totals || {});
    } catch (e) {
      alert("Fout bij offerte-berekening");
    }
    setLoading(false);
  };

  // PDF download (API call)
  const downloadPDF = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quotation/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows }),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "offerte.pdf";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Fout bij PDF-download");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "auto" }}>
      <h1>Offerte maken</h1>
      <div style={{ marginBottom: 24 }}>
        <b>SKUs en aantallen invoeren:</b>
        <table style={{ marginTop: 12, marginBottom: 8 }}>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Aantal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    value={row.sku}
                    onChange={(e) => updateRow(idx, "sku", e.target.value)}
                    style={{ width: 120 }}
                    placeholder="SKU"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    value={row.amount}
                    onChange={(e) => updateRow(idx, "amount", Number(e.target.value))}
                    style={{ width: 60 }}
                  />
                </td>
                <td>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(idx)}>Verwijderen</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addRow}>Toevoegen</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button onClick={fetchQuotation} disabled={loading}>
          Offerte maken
        </button>
        <button onClick={downloadPDF} disabled={loading || !products.length} style={{ marginLeft: 12 }}>
          Download als PDF
        </button>
      </div>

      {products.length > 0 && (
        <div>
          <h2>Producten & Calculaties</h2>
          <table border="1" cellPadding={6} style={{ borderCollapse: "collapse", marginBottom: 24, width: "100%" }}>
            <thead>
              <tr style={{ background: "#eee" }}>
                <th>SKU</th>
                <th>Naam</th>
                <th>Aantal</th>
                <th>Prijs</th>
                <th>Korting</th>
                <th>Korting %</th>
                <th>Ecotax</th>
                <th>Kost</th>
                <th>Marge (€)</th>
                <th>Marge (%)</th>
                <th>Voorstelprijs</th>
                <th>Voorstel Marge (%)</th>
                <th>Voor Sale</th>
                <th>Op BE</th>
                <th>Op NL</th>
                <th>Op COM</th>
                <th>Stock</th>
                <th>MSQ</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i}>
                  <td>{p.SKU}</td>
                  <td>{p.Name}</td>
                  <td>{p.amount}</td>
                  <td>{p.Price}</td>
                  <td>{p.Discount}</td>
                  <td>{p["Discount%"]}</td>
                  <td>{p.Ecotax}</td>
                  <td>{p.Cost}</td>
                  <td>{p["M€"]}</td>
                  <td>{p["M%"]}</td>
                  <td>{p.Proposal}</td>
                  <td>{p["M%P"]}</td>
                  <td>{p["For Sale"]}</td>
                  <td>{p["On BE"]}</td>
                  <td>{p["On NL"]}</td>
                  <td>{p["On COM"]}</td>
                  <td>{p.Stock}</td>
                  <td>{p.MSQ}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Totalen/offerte</h3>
          <table>
            <tbody>
              <tr>
                <td><b>Current Price:</b></td>
                <td>{totals.currentPrice}</td>
              </tr>
              <tr>
                <td><b>New Price:</b></td>
                <td>{totals.newPrice}</td>
              </tr>
              <tr>
                <td><b>Current Margin %:</b></td>
                <td>{totals.currentMarginPct}</td>
              </tr>
              <tr>
                <td><b>New Margin %:</b></td>
                <td>{totals.newMarginPct}</td>
              </tr>
              <tr>
                <td><b>Current Profit:</b></td>
                <td>{totals.currentProfit}</td>
              </tr>
              <tr>
                <td><b>New Profit:</b></td>
                <td>{totals.newProfit}</td>
              </tr>
              <tr>
                <td><b>CDC:</b></td>
                <td>{totals.cdc}</td>
              </tr>
              <tr>
                <td><b>€ Discount:</b></td>
                <td>{totals.discountEuro}</td>
              </tr>
              <tr>
                <td><b>% Discount:</b></td>
                <td>{totals.discountPct}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
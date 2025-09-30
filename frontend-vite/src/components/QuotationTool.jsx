import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function QuotationTool() {
  // --- States ---
  const [rows, setRows] = useState([{ sku: "", amount: 1 }]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({});
  const [hoveredRow, setHoveredRow] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Proposal per SKU (voor inputveld en berekening)
  const [proposals, setProposals] = useState({});
  const [proposalInputBuffer, setProposalInputBuffer] = useState({});
  const proposalRefs = useRef({});

  // Batch import & SupRef search
  const [batchInput, setBatchInput] = useState("");
  const [supRefInput, setSupRefInput] = useState("");
  const [supRefSearchResults, setSupRefSearchResults] = useState([]);
  const [loadingSupRef, setLoadingSupRef] = useState(false);

  // --- Columns ---
  const columns = [
    { key: "SKU", label: "SKU" },
    { key: "amount", label: "Aantal" },
    { key: "SUPPLIER_REFERENCE", label: "SupRef" },
    { key: "Name", label: "Naam" },
    { key: "Price", label: "Prijs (€)" },
    { key: "Discount", label: "Korting (€)" },
    { key: "Discount%", label: "Korting (%)" },
    { key: "Cost", label: "Kost (€)" },
    { key: "M€", label: "Marge (€)" },
    { key: "M%", label: "Marge (%)" },
    { key: "proposal", label: "Proposal (€)" },
    { key: "mpp", label: "M%P" }
  ];

  // --- Batch import logic with tab support ---
  function handleBatchImport() {
    const lines = batchInput.split(/\n/);
    const newRows = [];
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      // Split op tab, komma, puntkomma, spatie
      const parts = line.split(/[\t,; ]+/).map(x => x.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const sku = parts[0];
        const amount = Number(parts[1]) || 1;
        newRows.push({ sku, amount });
      } else if (parts.length === 1) {
        newRows.push({ sku: parts[0], amount: 1 });
      }
    }
    if (newRows.length > 0) setRows(r => [...r, ...newRows]);
    setBatchInput("");
  }

  // --- SupRef search logic: search, show results, then 'Toevoegen' per match ---
  async function handleSupRefSearch() {
    const queries = supRefInput.split(/[\t,; ]+/).map(x => x.trim()).filter(Boolean);
    if (!queries.length) return;
    setSupRefSearchResults([]);
    setLoadingSupRef(true);
    try {
      let found = [];
      for (let q of queries) {
        // <<< HIER DE JUISTE POORT EN API PREFIX GEBRUIKEN >>>
        const res = await fetch(`http://localhost:3000/api/products?supref=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.products && data.products.length) {
          found.push(...data.products.map(p => ({
            sku: p.SKU,
            supref: p.SUPPLIER_REFERENCE,
            name: p.Name
          })));
        }
      }
      setSupRefSearchResults(found);
    } catch (e) {
      alert("Fout bij zoeken op SupRef");
    }
    setLoadingSupRef(false);
  }

  function handleAddSupRefRow(sku) {
    setRows(r => [...r, { sku, amount: 1 }]);
    setSupRefSearchResults(supRefSearchResults.filter(r => r.sku !== sku));
  }

  // --- Core tool logic ---
  const addRow = () => setRows([...rows, { sku: "", amount: 1 }]);
  const removeRow = idx => setRows(rows.filter((_, i) => i !== idx));
  const updateRow = (idx, field, value) => {
    const newRows = [...rows];
    newRows[idx][field] = value;
    setRows(newRows);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const skuString = rows.map(r => r.sku).join(",");
      // <<< HIER DE JUISTE POORT EN API PREFIX GEBRUIKEN >>>
      const res = await fetch(`http://localhost:3000/api/products?skus=${skuString}`);
      const data = await res.json();
      const enriched = (data.products || []).map(p => {
        const sku = p.SKU;
        let defaultProposal = p.Price ? Number(p.Price).toFixed(2) : "0.00";
        let proposalVal = proposals[sku] !== undefined ? proposals[sku] : defaultProposal;
        return {
          ...p,
          amount: rows.find(r => r.sku === sku)?.amount ?? 1,
          proposal: Number(proposalVal)
        };
      });
      setProducts(enriched);
    } catch (e) {
      alert("Fout bij ophalen producten");
    }
    setLoading(false);
  };

  const handleProposalInput = (sku, value) => {
    setProposalInputBuffer(prev => ({ ...prev, [sku]: value }));
    if (!isNaN(Number(value))) {
      setProposals(prev => ({ ...prev, [sku]: Number(value).toFixed(2) }));
      setProducts(products =>
        products.map(p =>
          p.SKU === sku ? { ...p, proposal: Number(value) } : p
        )
      );
    }
  };

  const confirmProposal = (sku, value) => {
    if (!isNaN(Number(value))) {
      let rounded = Number(value).toFixed(2);
      setProposals(prev => ({ ...prev, [sku]: rounded }));
      setProducts(products =>
        products.map(p =>
          p.SKU === sku ? { ...p, proposal: Number(rounded) } : p
        )
      );
    }
    setProposalInputBuffer(prev => ({ ...prev, [sku]: undefined }));
  };

  const handleProposalKeyDown = (e, sku) => {
    if (e.key === "Enter") {
      confirmProposal(sku, e.target.value);
      if (proposalRefs.current[sku]) {
        proposalRefs.current[sku].blur();
      }
    }
  };

  useEffect(() => {
    if (!products.length) {
      setTotals({});
      return;
    }
    let currentPrice = 0,
      newPrice = 0,
      currentProfit = 0,
      newProfit = 0,
      currentCost = 0,
      cdc = 0,
      discountEuro = 0,
      discountPct = 0;
    products.forEach(p => {
      const amt = p.amount || 1;
      currentPrice += (p.Price || 0) * amt;
      newPrice += (p.proposal || 0) * amt;
      currentCost += (p.Cost || 0) * amt;
      currentProfit += (p["M€"] || 0) * amt;
      newProfit += ((p.proposal || 0) - (p.Cost || 0)) * amt;
    });
    cdc = products.length * -5.45;
    discountEuro = currentPrice - newPrice;
    discountPct = currentPrice ? ((discountEuro / currentPrice) * 100) : 0;
    const currentMarginPct = currentPrice ? ((currentPrice - currentCost) / currentPrice) * 100 : 0;
    const newMarginPct = newPrice ? ((newPrice - currentCost) / newPrice) * 100 : 0;
    setTotals({
      currentPrice,
      newPrice,
      currentMarginPct,
      newMarginPct,
      currentProfit,
      newProfit,
      cdc,
      discountEuro,
      discountPct
    });
  }, [products]);

  function extraInfo(p) {
    return (
      <div>
        <div><b>Voor Sale:</b> {p["Voor Sale"]}</div>
        <div><b>Op BE:</b> {p["Op BE"]}</div>
        <div><b>Op NL:</b> {p["Op NL"]}</div>
        <div><b>Op COM:</b> {p["Op COM"]}</div>
        <div><b>Stock:</b> {(p.Stock !== undefined && p.Stock !== null) ? p.Stock : '-'}</div>
        <div><b>MSQ:</b> {(p.MSQ !== undefined && p.MSQ !== null) ? p.MSQ : '-'}</div>
        <div><b>Ecotax:</b> {fmt(p.Ecotax)}</div>
      </div>
    );
  }

  const fmt = (val, decimals = 2) => {
    if (val === undefined || val === null || val === "") return "";
    let num = Number(val);
    if (isNaN(num)) return val;
    return num.toFixed(decimals);
  };

  // Excel export macro-style
  function downloadExcel() {
    if (!products.length) return;
    const columnsArr = columns.map(c => c.label);
    const dataRows = products.map((p, idx) => {
      const mpp = (p.proposal && p.Cost) ? ((p.proposal - p.Cost) / p.proposal) * 100 : 0;
      return [
        p.SKU,
        p.amount,
        p.SUPPLIER_REFERENCE,
        p.Name,
        p.Price !== undefined ? Number(p.Price) : "",
        p.Discount !== undefined ? Number(p.Discount) : "",
        p["Discount%"] !== undefined ? Number(p["Discount%"]) : "",
        p.Cost !== undefined ? Number(p.Cost) : "",
        p["M€"] !== undefined ? Number(p["M€"]) : "",
        p["M%"] !== undefined ? Number(p["M%"]) : "",
        p.proposal !== undefined ? Number(p.proposal) : "",
        mpp
      ];
    });
    const totalRows = [
      [],
      ["Totalen"],
      ["Current Price", totals.currentPrice],
      ["New Price", totals.newPrice],
      ["Current Margin %", totals.currentMarginPct],
      ["New Margin %", totals.newMarginPct],
      ["Current Profit", totals.currentProfit],
      ["New Profit", totals.newProfit],
      ["CDC", totals.cdc],
      ["€ Discount", totals.discountEuro],
      ["% Discount", totals.discountPct]
    ];
    const sheetData = [
      ["KLIUM OFFERTES"],
      [],
      columnsArr,
      ...dataRows,
      ...totalRows
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [
      { wch: 10 }, { wch: 7 }, { wch: 20 }, { wch: 50 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 14 }, { wch: 8 }
    ];
    ws['A1'].s = {
      font: { bold: true, sz: 18 },
      alignment: { horizontal: "center" }
    };
    columnsArr.forEach((col, idx) => {
      const cell = ws[XLSX.utils.encode_cell({ r: 2, c: idx })];
      if (cell) {
        cell.s = {
          font: { bold: true },
          alignment: { horizontal: "center" },
          fill: { fgColor: { rgb: "EAEAEA" } },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
          }
        };
      }
    });
    for (let r = 3; r < 3 + dataRows.length; r++) {
      for (let c = 0; c < columnsArr.length; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell) {
          cell.s = {
            fill: { fgColor: { rgb: (r % 2 === 0) ? "FFFFFF" : "F7F7F7" } },
            border: {
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" }
            },
            alignment: { horizontal: c === 3 ? "left" : "center" }
          };
        }
      }
    }
    for (let i = 3 + dataRows.length + 2; i < sheetData.length; i++) {
      const cellLabel = ws[XLSX.utils.encode_cell({ r: i, c: 0 })];
      const cellValue = ws[XLSX.utils.encode_cell({ r: i, c: 1 })];
      if (cellLabel) {
        cellLabel.s = {
          font: { bold: true },
          alignment: { horizontal: "right" },
          border: { top: { style: "medium" } }
        };
      }
      if (cellValue) {
        let label = sheetData[i][0] || "";
        let euroRows = ["Current Price", "New Price", "Current Profit", "New Profit", "CDC", "€ Discount"];
        let percRows = ["Current Margin %", "New Margin %", "% Discount"];
        if (euroRows.includes(label)) {
          cellValue.s = {
            font: { bold: true },
            alignment: { horizontal: "right" },
            numFmt: "€ #,##0.00",
            border: { top: { style: "medium" } }
          };
        } else if (percRows.includes(label)) {
          cellValue.s = {
            font: { bold: true },
            alignment: { horizontal: "right" },
            numFmt: "0.00%",
            border: { top: { style: "medium" } }
          };
        } else {
          cellValue.s = {
            font: { bold: true },
            alignment: { horizontal: "right" },
            border: { top: { style: "medium" } }
          };
        }
      }
    }
    ws['!freeze'] = { xSplit: 0, ySplit: 3 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Offerte");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "offerte.xlsx");
  }

  // --- UI ---
  return (
    <div style={{padding: 32, color: "white"}}>
      <h1>Offerte Tool</h1>
      {/* Batch import block */}
      <div style={{marginBottom: 25}}>
        <b>Batch invoer:</b><br />
        <textarea
          placeholder="SKU, aantal per regel: 02067726,10\n02691478;5\n12345678 2"
          value={batchInput}
          onChange={e => setBatchInput(e.target.value)}
          rows={4}
          style={{ width: 320, marginTop: 10, marginRight: 16, borderRadius: 6, fontSize: '1rem', padding: 8 }}
        />
        <button style={{marginRight:16, padding:'8px 18px', borderRadius:6}} onClick={handleBatchImport}>Batch toevoegen</button>
      </div>
      {/* SupRef search block */}
      <div style={{marginBottom: 25}}>
        <b>Zoek op leveranciersreferentie (SupRef):</b><br />
        <input
          placeholder="SupRef, bijvoorbeeld DF330DWE"
          value={supRefInput}
          onChange={e => setSupRefInput(e.target.value)}
          style={{ width: 280, marginTop: 10, marginRight: 8, padding:8, borderRadius:6 }}
        />
        <button style={{marginRight:16, padding:'8px 18px', borderRadius:6}} onClick={handleSupRefSearch} disabled={loadingSupRef}>Zoek en voeg toe</button>
        {supRefSearchResults.length > 0 && (
          <div style={{marginTop: 6, background:'#222', padding:12, borderRadius:8, color:'white', maxWidth:440}}>
            <b>Gevonden producten:</b>
            <ul>
              {supRefSearchResults.map(r =>
                <li key={r.sku} style={{marginBottom:6}}>
                  <span style={{fontWeight:700}}>{r.sku}</span> - {r.supref} - {r.name}
                  <button style={{marginLeft:10, padding:'2px 8px', fontSize:'0.95em', borderRadius:6}} onClick={() => handleAddSupRefRow(r.sku)}>
                    Toevoegen
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      {/* Bestaande invoer */}
      <b>SKUs en aantallen invoeren:</b>
      <div>
        {rows.map((row, idx) => (
          <div key={idx} style={{display:"flex",gap:16,marginBottom:10}}>
            <input
              value={row.sku}
              onChange={e => updateRow(idx, "sku", e.target.value)}
              style={{width:160,padding:"8px 12px",borderRadius:6}}
              placeholder="SKU"
            />
            <input
              type="number"
              min={1}
              value={row.amount}
              onChange={e => updateRow(idx, "amount", Number(e.target.value))}
              style={{width:80,padding:"8px 12px",borderRadius:6}}
            />
            {rows.length > 1 && (
              <button onClick={() => removeRow(idx)} style={{padding:"8px 18px",borderRadius:6}}>
                Verwijder
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={addRow} style={{padding:"10px 28px",borderRadius:7,marginTop:10}}>
        Toevoegen
      </button>
      <div style={{marginTop:32, marginBottom:32}}>
        <button
          onClick={fetchProducts}
          disabled={loading}
          style={{
            padding: "16px 36px",
            borderRadius: 12,
            border: "none",
            background: "#222",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "1.1rem"
          }}
        >
          Offerte maken
        </button>
        <button
          onClick={downloadExcel}
          style={{
            padding: "12px 30px",
            borderRadius: 8,
            marginLeft: 18,
            background: "#0077cc",
            color: "#fff",
            fontWeight: 700,
            border: "none",
            fontSize: "1rem",
            cursor: "pointer"
          }}
        >
          Download als Excel
        </button>
      </div>
      {products.length > 0 && (
        <>
          <table style={{width:"100%",background:"#222",borderRadius:10}}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} style={{padding:"10px",color:"#fff"}}>{col.label}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i}>
                  {columns.map(col => {
                    if (col.key === "amount") {
                      return <td key={col.key} style={{padding:"8px",color:"#eee"}}>{p.amount}</td>;
                    }
                    if (col.key === "proposal") {
                      return (
                        <td key={col.key} style={{padding:"8px",color:"#eee"}}>
                          <input
                            ref={el => proposalRefs.current[p.SKU] = el}
                            type="number"
                            step="1"
                            value={proposalInputBuffer[p.SKU] !== undefined ? proposalInputBuffer[p.SKU] : fmt(p.proposal)}
                            onChange={e => handleProposalInput(p.SKU, e.target.value)}
                            onBlur={e => confirmProposal(p.SKU, e.target.value)}
                            onKeyDown={e => handleProposalKeyDown(e, p.SKU)}
                            style={{width:80,padding:"6px 8px",borderRadius:4,border:"1px solid #aaa"}}
                          />
                        </td>
                      );
                    }
                    if (col.key === "mpp") {
                      let proposalVal = proposalInputBuffer[p.SKU] !== undefined && !isNaN(Number(proposalInputBuffer[p.SKU]))
                        ? Number(proposalInputBuffer[p.SKU])
                        : p.proposal;
                      let mpp = (proposalVal && p.Cost) ? ((proposalVal - p.Cost) / proposalVal) * 100 : 0;
                      return <td key={col.key} style={{padding:"8px",color:"#eee"}}>{fmt(mpp)}%</td>;
                    }
                    return (
                      <td key={col.key} style={{padding:"8px",color:"#eee"}}>
                        {typeof p[col.key] === "number"
                          ? fmt(p[col.key])
                          : p[col.key]}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "center", position: "relative" }}>
                    <span
                      style={{
                        cursor: "pointer",
                        fontSize: "1.2em",
                        marginLeft: 4
                      }}
                      onMouseEnter={e => {
                        setHoveredRow(i);
                        setTooltipPosition({ x: e.clientX + 12, y: e.clientY + 24 });
                      }}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      ℹ️
                    </span>
                    {hoveredRow === i && (
                      <div
                        style={{
                          position: "fixed",
                          left: tooltipPosition.x,
                          top: tooltipPosition.y,
                          minWidth: 220,
                          maxWidth: 350,
                          background: "#222",
                          color: "#fff",
                          borderRadius: 10,
                          padding: "16px 20px",
                          boxShadow: "0 2px 14px rgba(0,0,0,0.22)",
                          zIndex: 9999,
                          fontSize: "1.05em",
                          textAlign: "left",
                          pointerEvents: "none"
                        }}
                      >
                        {extraInfo(p)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 style={{ marginTop: 36 }}>Totalen/offerte</h3>
          <div style={{
            background: "#fff",
            boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
            borderRadius: 16,
            padding: 26,
            maxWidth: 500,
            margin: "auto",
            border: "1px solid #eee",
            fontSize: "1.06rem",
            color: "#222"
          }}>
            <div style={{ marginBottom: 10 }}>
              <b>Current Price:</b> € {fmt(totals.currentPrice)}
            </div>
            <div style={{ marginBottom: 10 }}>
              <b>New Price:</b> € {fmt(totals.newPrice)}
            </div>
            <div style={{ marginBottom: 10 }}>
              <b>Current Margin %:</b> {fmt(totals.currentMarginPct, 2)}%
            </div>
            <div style={{ marginBottom: 10 }}>
              <b>New Margin %:</b> {fmt(totals.newMarginPct, 2)}%
            </div>
            <div style={{ marginBottom: 10 }}>
              <b>Current Profit:</b> € {fmt(totals.currentProfit)}
            </div>
            <div style={{ marginBottom: 10 }}>
              <b>New Profit:</b> € {fmt(totals.newProfit)}
            </div>
            <div style={{ marginBottom: 10 }}>
              <b>CDC:</b> € {fmt(totals.cdc)}
            </div>
            <div style={{ marginBottom: 10 }}>
              <b>€ Discount:</b> € {fmt(totals.discountEuro)}
            </div>
            <div style={{ marginBottom: 10 }}>
              <b>% Discount:</b> {fmt(totals.discountPct, 2)}%
            </div>
          </div>
        </>
      )}
    </div>
  );
}
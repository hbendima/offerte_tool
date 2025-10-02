import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function QuotationTool({ onOfferteSaved, offerteData }) {
  // --- Customer data state ---
  const [customerData, setCustomerData] = useState({
    naam: "",
    bedrijf: "",
    btw: "",
    adres: "",
    postcode: "",
    gemeente: "",
    land: "",
    email: ""
  });
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
      let parts = line.split(/[\t,; ]+/).map(x => x.trim()).filter(Boolean);
      // Filter het 'leef' veld eruit als deze voorkomt
      parts = parts.filter(p => p.toLowerCase() !== 'leef');
      // Sla regels over zonder geldige SKU
      if (parts.length >= 2 && parts[0]) {
        const sku = parts[0];
        const amount = Number(parts[1]) || 1;
        if (sku) newRows.push({ sku, amount });
      } else if (parts.length === 1 && parts[0]) {
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
      discountPct = 0,
      cdcDetails = [];
    products.forEach(p => {
      const amt = p.amount || 1;
      const stock = Number(p.Stock) || 0;
      const inStock = Math.min(stock, amt);
      const backOrder = Math.max(amt - stock, 0);
      currentPrice += (p.Price || 0) * amt;
      newPrice += (p.proposal || 0) * amt;
      currentCost += (p.Cost || 0) * amt;
      currentProfit += (p["M€"] || 0) * amt;
      newProfit += ((p.proposal || 0) - (p.Cost || 0)) * amt;
      // CDC: -5.33 per regel, splits op voorraad/backorder
      if (inStock > 0) {
        cdc += -5.33;
        cdcDetails.push(`${p.SKU}: ${inStock} uit voorraad`);
      }
      if (backOrder > 0) {
        cdc += -5.33;
        cdcDetails.push(`${p.SKU}: ${backOrder} backorder`);
      }
    });
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
      discountPct,
      cdcDetails
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

  // --- PDF export testfunctie ---
  async function downloadPDF() {
    if (!window.pdfMake) {
      alert('pdfMake is niet geladen. Voeg de CDN scripts toe aan index.html!');
      return;
    }
  // Base64 van het logo 
  const kliumLogoBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAgEAlgCWAAD//gASTEVBRFRPT0xTIHYyMC4wAP/bAIQABQUFCAUIDAcHDAwJCQkMDQwMDAwNDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQEFCAgKBwoMBwcMDQwKDA0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0N/8QBogAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoLAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+hEAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8AAEQgAZwE2AwERAAIRAQMRAf/aAAwDAQACEQMRAD8A+y6ACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAqvfW8TFHljVh1BdQR9QTmg2VKpJXjCTT6qLt+Q3+0bX/ntF/wB/F/xpD9jV/wCfc/8AwF/5EsN1DOSInRyOoVg2PrgmmRKnOGs4yj6pr8yegzCgCCW6htyBK6Rk9AzBc/TJFBpGnOesIyduyb/Ii/tG1/57Rf8Afxf8aRfsav8Az7n/AOAv/IP7Rtf+e0X/AH8X/GgPY1f+fc//AAF/5FmOVJVDxsGU9CpBB/EcUzKUXB8sk010ejKZ1WzU4M8II4I8xOD/AN9U7Eif2tZf8/EP/f1P/iqLMCzBcxXI3QukgHBKMGAP4E0tgJ6ACgAoAKAIJ7qG1AM0iRA9N7Bc/TJFAFb+1rL/AJ+If+/qf/FU7MBV1SzYhVnhJPAAkTJPoBmiwF+kBVmvre2bZNLHG2M4d1U49cEg0AQ/2tZf8/EP/f1P/iqdgJItRtZmCRTROx6Ksikn6AHNFgLlIAoAa7rGpZyFUckk4AHuT0oAo/2tZf8APxB/39T/AOKp2AP7Wsv+fiD/AL+p/wDFUWYFyKZJ1DxMroejKQQfxHFIBs1xFbLvmdY16Zdgo/MkCgCr/a1l/wA/EH/f1P8A4qnZgH9rWQ/5eIP+/qf/ABVFmBeR1kUMhDKRkEHII9QRSAdQAUAFAFRr+2jJVpY1YcEF1BH1BPFI2VKo1dQk09mou35Cf2ja/wDPaL/v4v8AjTH7Gr/z7n/4C/8AIcl9byHCSxsR2Dqf5GgTpVI7wkvWLX6Hxz8Q2YeIb3DMP3nQMQK5pbs/csnS+oUNF8PZHGb3/vP/AN9GpPdsuy+5Ht/wOZjfXmSx/dJ1JP8AF71rA/P+KUlQoWSXvy2Vuh9KVsflRzfijxPaeFbNry7PPSOMfekfsqj+Z7Cpb5T1cDgauY1lQoLzlLpFdW/0PjrX/EN54ku3vrt2DNwiKSFjXsoA/U965276n7jhMHRwFJYehFWW8mleT6tmLvf+8/8A30f8aR32XZfcj0DwH4IufF1x5krSR2ER/ePuYeYR/wAs0/qe1XGN/Q+bzbNKeV0+SCjLESXuxsvd/vS/RH1vb2cVhbC2t1CRRJtVR2AH866FpofidWpKtOVWo7yk7t+Z+Z+rO4vrr53/AOPiX+Nv75969BbHIURI/wDff/vtv8aoD6//AGcSTpF1klv9J7knsfWuSrui4n0XWBYUAFABQB8zftIsVsrHaWX9+fukjt7V0Ut2RI+TvMf++/8A323+NdJBseHHf+1bL53/AOPqH+Nv7496T2YH6YL0/CvPNj4p/aDdl8SRhWZR9lTgMQOp7CuunsZyPDfMf++//fbf41sSen/Bp2PiyzBZyMScFiR909qzn8LGtz77riNQoA5Px3xoF/jj/RpOnB6VUd0Jn5vRyPtHzyf99t/jXoGQ7zH/AL7/APfbf40gPvH4IEnwnaZJJzJyTk/fPc1x1PiZotjB/aFJXw4uCV/0iPoSD19qdPcJbHxaZH/vv/323+NdZmIXc8b3/wC+2/xoA+tfgJ48N7AfDl8+6e3Be2Zjy8XdMnqUPT2rmqRt7yLi+h9LVzlhQByHjbxPH4V02S7JBmYbIV7tIen4DqaluyPbyvAyzHERor4F7032it/m+h8YT3U1zI880jtJKxZjuPJPJrmP3iNOFOKp04xUYpJKy2RFvf8AvP8A99H/ABoKsuy+5Ha+BWb7XNlmP7kdWP8AfFXE8HNUvZQ0Xxvov5SP4if8jFe/9dKUt2PJ/wDcKH+E4ypPePcPgb/x/Xn/AFyT/wBCrWHU/P8Ain+BQ/xy/I948Q+IbTwzaNe3jbVUfKo+87dlUep/StW7bn51g8HVx9VUKCu3u+kV1bPjjxN4luvFV415dnCjIiiB+WNOwHv6muZu5+5YHBUstpKhRWv259ZP/LsjnqR6Z2/gjwTceMLnHMdlER50vr/sJ6k9/SrirngZpmdPK6d9HXkvch2/vS8kfYGm6bb6TbpaWiCOGIYVR/M+pPc1va2iPxCtWniakq1aTlOTu2/62Lcn3T9D/Kmc5+Ymrf8AH/df9fEv/oZr0VsjEoCmI+wv2cP+QRdf9fP9DXJV3RpE+i6wLCgAoAKAPmX9pL/jysf+u5/lXRS3ZEj5MrqINnw5/wAhay/6+of/AEMVL2YH6Zr0/CvPNj4m/aE/5GSP/r1T+Zrrp/CZyPDK3IPUPgz/AMjbZ/ST/wBBNZT+FlLc+/a4jUKAOS8ef8gC/wD+vaT+VVHdCZ+bkf3RXoGI+gZ95fBD/kU7T6yf+hmuKfxM0Wxg/tDf8i4v/XxH/OnT+IJbHxYa6zMSmBf0rVLjRLuHUbNik9s4dCO+Oqn2YcUmrqwbH6L+D/E9v4u0uHU7Yj96o3r3SQcOp+h6e1cDXK7GqOld1jUsxCqoJJPAAHUmpKSbaSV29Ej45+IfitvFGpMYz/olqTHCOxI4Z/xNc8nc/csnwCy7DJSX76paU327R+RwVQfRhQB23gT/AI+5v+uI/wDQxVxPAzX+FD/G/wD0kZ8RP+Rivf8ArpSlux5P/uFD/CcZUnvHrXwo1q28Pvf314wSOOFcerHPCqO5NaRdrs+Mz/DVMasNh6CvKU36JW3fkcb4s8V3Xi27NzcZWJciGLPCL6kd2Pc1Ldz3cvwFLLKXsaWs38c+sn/kuiOXqT1jsPBvg658X3Xkx5jtoyDPNjgD+6vq5/SqirniZlmNPK6XPKzqy/hw7vu+yR9h6RpNtodsllZoI4oxgAdT6k+pPUmuhK2iPw/EYipi6kq9eXNOT+7yXkjSpnIMk+630P8AKgD8xNW/4/7r/r4l/wDQzXorZGJQFMR9hfs4f8gi6/6+f6GuSrujSJ9F1gWFABQAUAfMv7SX/HlY/wDXc/yropbsiR8mV1EGz4c/5C1l/wBfUP8A6GKl7MD9M16fhXnmx8TftCf8jJH/ANeqfzNddP4TOR4ZW5B6h8Gf+Rts/pJ/6Cayn8LKW59+1xGoUAcl48/5AF//ANe0n8qqO6Ez83I/uivQMR9Az7y+CH/Ip2n1k/8AQzXFP4maLYwf2hv+RcX/AK+I/wCdOn8QS2Piw11mYlAgpgez/Bbx1/wiuqf2ddNix1BgvPSOborewboaxnG6ut0WnY+gfi74sbSbNdMtSRNeg7mH8MXfB9W6fSvPk7aH33DuXrE1XjKtnTotWXefTTstz5fAxwO1YH64FABQB23gT/j7m/64j/0MVcTwM1/hQ/xv/wBJGfET/kYr3/rpSlux5P8A7hQ/wnGVJ7we3agAoA6jwn4UufFl2LaD5IU5nmP3Y178/wB4joKpK+h5GYZhSyyl7aprN/BDrJ/5LqfXXhaz02wsUt9IZHt4iVLoQdzrwxYjq2etdNuXQ/DcViqmNqyxFeV5N/JLsuyR0dBxBQAyT7rfQ/yoA/MTVv8Aj/uv+viX/wBDNeitkYlAUxH2F+zh/wAgi6/6+f6GuSrujSJ9F1gWFABQAUAfMv7SX/HlY/8AXc/yropbsiR8mV1EGz4c/wCQtZf9fUP/AKGKl7MD9M16fhXnmx8TftCf8jJH/wBeqfzNddP4TOR4ZW5B6h8Gf+Rts/pJ/wCgmsp/CylufftcRqFAHJePP+QBf/8AXtJ/KqjuhM/NyP7or0DEfQM+8vgh/wAinafWT/0M1xT+Jmi2MH9ob/kXF/6+I/506fxBLY+LDXWZjoozK6xL96RlQfViAP1NAFvU9NuNHuZLG8QxzwnDKffkEeoI6GhO+q2DYokenB6gjqCOhHuDTA+pfDt8vxT8NGymI/tnSF+Un70iAfKfUhgNp9/rXn1YW2PqclzF5fiFzv8AdTtGa7X2l8jyNgUJDjaykhgexHBH51xH7mrOzi7p6p909i3eafPYCI3C7PtCCRAepQ9CR2zTtYwp1oVnNUnfklyy7c3Yp0jc7bwJ/wAfc3/XEf8AoYq4ngZr/Ch/jf8A6SM+In/IxXv/AF0pS3Y8n/3Ch/hOMqT3goA6Hwz4ZuvFV4LO0GFHMsp+7Gvck/3vQU0r6I8zHY2lltJ16z1+xDrJ/wCXdnS/EHxza+E7M+EvCzAMo23l2vXJ+8qsOrn+I/wjgV6NOnbVn4VjcbVx9WVes9XsukV0SOc+C3j/AP4RTUP7LvXI0++bALHIimPRsnoHP3vetZx5ldbo81O2h9wggjI5BrjNBaAGSfdb6H+VAH5iat/x/wB1/wBfEv8A6Ga9FbIxKApiPsL9nD/kEXX/AF8/0NclXdGkT6LrAsKACgAoA+Zf2kv+PKx/67n+VdFLdkSPkyuog2fDn/IWsv8Ar6h/9DFS9mB+ma9PwrzzY+Jv2hP+Rkj/AOvVP5muunsZyPDK3IPT/gzx4ts/pJ/6Cayn8LKW59/VxGoUAcl48/5AF/8A9e0n8qqO6Ez83I/uivQMR9Az7z+CAx4TtPrJ/wChmuKfxM0WxgftDf8AIuL/ANfEf86dP4glsfFhrrMyez/4+If+u0X/AKGtAH1h8bvAJ1Sxj8RWKbrq1iUXCqOZIdo+b3ZP5VzU5WfKW11PkcHIyOhrqIOn8HeKJ/B2qw6pbk4Q7Zk7PEfvA+4HI96iS5lYadj6qn+H1r4r1W212xZTpV4onmVT1cc7QP8AaP3vQg15jh7x+h4XPnh8BLDyu68fdpS/uvq/OPQ474xxrFrUSIAqrbIFA6ADoBUS3PpuG25YOcpat1ZNvzZ5PWZ9kdt4E/4+5v8AriP/AEMVcTwM1/hQ/wAb/wDSRnxE/wCRivf+ulKW7Hk/+4UP8JxlSe8bnh7w9d+JrtbGyX5jy7n7sad2Y+voO5ppX0PPxmMpZfSeIrvT7Mesn2X6nufjjSL3wH4VeLwyo3j/AI+5wP32w8PIuO/X/dHSu2nFJ2Z+GY/HVcxquvWf+GPSK7L9T4oBzzkndySeSSeSSfU967zxQIyMf5HuPpQM+0/gj8Qv+Eisv7Hv3zf2SgKT1lhHCt7svQ1x1I8rutjRM96rEoZJ91vof5UAfmJq3/H/AHX/AF8S/wDoZr0VsjEoimI+wf2cP+QPdf8AXz/Q1yVd0aRPousCwoAKACgD5l/aS/48rH/ruf5V0Ut2RI+TK6iDZ8Of8hay/wCvqH/0MVL2YH6Zr0FeebHxx+0XZNFq9pdEfLNAUB91P/166qWzRnI+eq6CTpfButDw5rVnqTcJBMN/+43ysfoAc1MldNAtD9Ira4ju4knhYPHIoZWHIKsMgivP2NiagDyP40+I4tC8Ozwlh598PIiTPJ3feOPQDqa1pq79CXofBoG0AeldpmI52qT6A0AfoV8J7FtP8MWMTjBMW/8A77Jb+tcM/iZqtji/2hv+RcX/AK+I/wCdVT3FLY+LDXWZk9n/AMfEP/XaL/0NaAP06hiWa2WNwGR4lVlPQgqAQfqK882Pgv4q+Bm8Fas3kqfsF4Wkt27KTy0WfY/dHpXZCXMvNGTVjzqysptSuI7O1UyTzuERR3JOPyHetHpqI/RPwH4WHg/R4NL3GR413OxOfnblgPRQeAK4ZPmdzVKx4L8Z/wDkOJ/17r/M1yz3P2Thr/cpf9fGeS1mfZnbeBP+Pub/AK4j/wBDFXE8DNf4UP8AG/8A0kZ8RP8AkYr3/rpSlux5P/uFD/CYWh6JdeIbtLGyXdI55b+FF7sx7AfrSSvoj0sViqWBpSxGIdorZdZPokfYvhLwna+ErMWtsN0jcyyn70jdyT6egroS5dEfhuYZhVzKq61V2itIQ6Rj/n3Z000KXCNFIAyOCrKeQQRggj0Iqjxz4C+KfgR/BGqsIlP2C7Je3bspPLRE+q9vau2EuZeZk1Y8zrQRqaJrNz4evodTsmKz27Bh/tL/ABIfUMOKTV1Zhsfol4Q8UW3i/TYtTtCMSKA6d45B95D9D09q4ZLldjVHSSfdb6H+VSM/MTVv+P8Auv8Ar4l/9DNeitkYlCmI9I8FfFDUvAltJZ2EUMqTP5hMgOQemBgjis5QUtWUnY7T/honX/8An3tfyb/4qo9kvMfMH/DROv8A/Pva/k3/AMVR7JBzB/w0Tr//AD72v5N/8VR7JeYcx7N8IviNqHj03Y1COKL7Ls2eVnndnOck+lYzio7FJ3OQ/aS/48rH/ruf5VdLdilsfJldRBs+HP8AkLWX/X1D/wChipezA/TNegrzzY8N+PXhl9a0MX0ClptOfzcDr5Z4fH04NbU3Z27ktHxKCGGR0NdhmFAHqPg34t614NiFpGVu7RfuxS5ynsjdQPY1lKCfqNOx6Bc/tIX7R4t7CNJMfed8qD9Bio9ku4+Y8O8SeKNR8WXX23VJTLIOEUcJGvoi9vr1NbJKOiJOfpiNrw5okviPUrfTIAWa4kUNjsgOXJ9tuaTfKrjP0psbRLC3jtY+EhRUX6KAP6V55seIftDf8i4v/XxH/OtqfxEy2Piw11mZPZ/8fEP/AF2i/wDQ1oA/T20/1Mf+4v8A6CK842OT8eeEIPGmlS6fMAJMF4H7pKOVIPoeh9jVxfK7iaueP/BT4ZXGiTS6zrMXl3SM0NvGw+6oOGlH+/8Aw+1aTlfSOxKVtz6UrAs+VPjP/wAhxP8Ar3X+ZrCe5+x8Nf7lL/r4zyWsz7M7bwJ/x9zf9cR/6GKuJ4Ga/wAKH+N/+kl7xdpVzrfiu6srJC80koA9FHdmPYChq8rI58uxFPCZXRxFd8sIw+bfZebPo/wZ4OtvCFoIY8PcSAGaU9Wb0Hoo7CtkuU/LMyzKpmdXnlpTjpCHRL/N9Tsqo8MKAOO8c+ELfxppcunTgByC0MneOUfdYe2eD6iqi+V3E10Pzx1LTbjRrqWwvFMdxbOUdT7dGHsw5BrvWuqMtijigD1n4SePW8F6mILlj/Z16wSUHpG54WQeno3tWc48y80NOx93eYssW9CGVlyCOhBGQR9RXEan5kasP9Puv+viX/0M16K2RiUKYCUCCgAoAXFAz6h/Zr4bUvrF/Wuar0LiaP7SX/HlY/8AXc/ypUt2Ej5NxXUQbHhz/kLWX/X1D/6GKl7P0A/TNegrzzYjnhS4jaKUBkdSrKehBGCD9RQB8NfFD4V3Xg+4e+sEafSpWLAqCWtyTkq4HOz+61dkJ82j3M2rHjgIPI5+lbEhQIKBhQBPa20t9Mttao080hAWNBuYk/Tp9TiltqB9rfCH4XnwdCdS1IBtSuFxgciBDzsB/vH+I/hXJOXNotjRKx7hWJR4N+0N/wAi4v8A18R/zranuS9j4sI5rsMyezH+kQ/9dov/AENaQH6e2n+pj/3F/wDQRXnGxYoAKACgD5V+M/8AyHE/691/mawnufsfDX+5S/6+M8kxWZ9mdt4F4u5v+uI/9DFVE8DNf4UP8b/9JZ9Z6d4ftNNuri/iXNxePukkPXHZR6KPSui1tT8YrYyrXpU8NN/u6StGK282/M3KZ54UAFABQB5H48+EGneObtL95HtLhF2O0YB8xf4d2e69jWsZuOhLVzhf+GbNP/5/rj/vlav2r7C5RD+zXp5GDfXGP91aPavsHKe4+FdAk8OabHpklw94IQVSSQAPs7KcdcdvasW7u+xR4tdfs52FzPJOb6cGaRpCAq4BYk4H0rb2rXQnlIP+GbNP/wCf64/75Wj2r7Byh/wzZp//AD/XH/fK0e1fYOUP+GbNP/5/rj/vlaPavsHKH/DNmn/8/wBcf98rR7V9g5Q/4Zs0/wD5/rj/AL5Wj2r7BynpPw8+Glv8PTcG3nkuPtW3O8AbduemPXNZylzFJWLHxC+HcHxAhhguJpLYW7lwUAJOR0OaUZcgNXPLv+GbNP8A+f64/wC+VrX2r7E8pb0/9new0+6hu1vZ2NvKkgUquCUOcH2NL2j2sHKfRYGOKwLCgBkkSTKY5FDIwwVYAgg9iDwaAPGvEvwM8P667T26tYTMckw8Jn/c6VqqjRNkeXXn7N16jH7Jfo69vMTB/StfarqieUoJ+zlrOfmvLcD2Vv8ACn7Vdg5TptL/AGboVIbUr55AOqRIFB/4F1qHV7IfKe4eF/AWjeEFxpluqSY5lb5pT/wM8/lisXJy3KSsdlUjCgDiPHngqHx3p402eV7dRIsm5ACcr25q4y5XcTVzyD/hmzT/APn+uP8Avla19q+xPKPi/ZwsIpEkF9cExurgbV/hIOP0o9q+wcp9IRR+UioOdqhfyGK5yx9ABQAUAeZeLvhpb+Lb0X0s8kLLGI9qgEYHfmocbn1uXZ3Uyyi8PCnGScnK7b6nLf8ACjLP/n7m/wC+VqeQ9f8A1prf8+IfezY0T4SWuiyvMlzK5dNmCBxznNNRscOJ4hq4qKhKlBWd9G+1j16tD4kKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgD/2Q=='
    // Klantgegevens
    const klant = [
      { image: 'kliumLogo', width: 120, margin: [0,0,0,12] },
      { text: 'Offerte', fontSize: 18, bold: true, margin: [0,0,0,12] },
      { text: `Datum: ${new Date().toLocaleDateString()}`, margin: [0,0,0,4] },
      { text: `Naam: ${customerData.naam || '-'}` },
      { text: `Bedrijf: ${customerData.bedrijf || '-'}` },
      { text: `Adres: ${customerData.adres || '-'}, ${customerData.postcode || '-'} ${customerData.gemeente || '-'}` },
      { text: `Land: ${customerData.land || '-'}` },
      { text: `E-mail: ${customerData.email || '-'}` },
      { text: `BTW-nummer: ${customerData.btw || '-'}`, margin: [0,0,0,12] }
    ];
    // Producttabel (alleen SKU, Naam, Aantal, Prijs incl. btw)
    const productTable = {
      table: {
        headerRows: 1,
        widths: ['auto', '*', 'auto', 'auto'],
        body: [
          ['SKU', 'Naam', 'Aantal', 'Prijs (€ incl. btw)'],
          ...products.map(p => [
            p.SKU,
            p.Name,
            p.amount,
            p.proposal !== undefined ? (Number(p.proposal) * 1.21).toFixed(2) : ''
          ])
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0,0,0,12]
    };
    // Totalen berekenen
    const totaalExcl = products.reduce((sum, p) => sum + (p.proposal !== undefined ? Number(p.proposal) * p.amount : 0), 0);
    const btw = totaalExcl * 0.21;
    const totaalIncl = totaalExcl + btw;
    const totalen = [
      { text: `Totaal excl. btw: € ${totaalExcl.toFixed(2)}` },
      { text: `BTW 21%: € ${btw.toFixed(2)}` },
      { text: `Totaal incl. btw: € ${totaalIncl.toFixed(2)}`, bold: true }
    ];
    const docDefinition = {
      content: [
        ...klant,
        productTable,
        { text: 'Totalen', fontSize: 14, bold: true, margin: [0,8,0,4] },
        ...totalen
      ],
      images: {
        kliumLogo: kliumLogoBase64
      },
      defaultStyle: { fontSize: 11 }
    };
    window.pdfMake.createPdf(docDefinition).download('offerte.pdf');
  }

  // --- Offerte opslaan status ---
  const [saveStatus, setSaveStatus] = useState("");

  // --- Offerte opslaan functie ---
  async function handleSaveQuotation() {
    setSaveStatus("");
    if (!customerData.naam || !customerData.email || products.length === 0) {
      setSaveStatus("Vul klantgegevens en producten in.");
      return;
    }
    const offerte = {
      klant: customerData.naam,
      bedrijf: customerData.bedrijf,
      btw: customerData.btw,
      adres: customerData.adres,
      postcode: customerData.postcode,
      gemeente: customerData.gemeente,
      land: customerData.land,
      email: customerData.email,
      producten: products.map(p => ({
        sku: p.SKU,
        naam: p.Name,
        aantal: p.amount,
        prijs: p.proposal
      })),
      totaal: totals.newPrice,
      datum: new Date().toISOString().slice(0, 10)
    };
    try {
      const res = await fetch("http://localhost:3000/api/offerte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offerte)
      });
      if (res.ok) {
        setSaveStatus("Offerte succesvol opgeslagen!");
        if (onOfferteSaved) onOfferteSaved();
      } else {
        setSaveStatus("Fout bij opslaan offerte.");
      }
    } catch (e) {
      setSaveStatus("Netwerkfout bij opslaan offerte.");
    }
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
        <button
          onClick={downloadPDF}
          style={{
            padding: "12px 30px",
            borderRadius: 8,
            marginLeft: 18,
            background: "#e53935",
            color: "#fff",
            fontWeight: 700,
            border: "none",
            fontSize: "1rem",
            cursor: "pointer"
          }}
        >
          Download als PDF
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i}>
                  {columns.map(col => {
                    if (col.key === "amount") {
                      return (
                        <td key={col.key} style={{padding:"8px",color:"#eee", display: "flex", alignItems: "center", gap: 6}}>
                          <button
                            style={{padding: "2px 8px", borderRadius: 4, background: "#333", color: "#fff", border: "none", fontWeight: "bold", fontSize: "1.1em", cursor: "pointer"}}
                            onClick={() => {
                              const newAmount = Math.max(1, p.amount - 1);
                              setProducts(products => products.map((prod, idx) => idx === i ? { ...prod, amount: newAmount } : prod));
                            }}
                          >-</button>
                          <span style={{minWidth: 32, textAlign: "center"}}>{p.amount}</span>
                          <button
                            style={{padding: "2px 8px", borderRadius: 4, background: "#333", color: "#fff", border: "none", fontWeight: "bold", fontSize: "1.1em", cursor: "pointer"}}
                            onClick={() => {
                              const newAmount = p.amount + 1;
                              setProducts(products => products.map((prod, idx) => idx === i ? { ...prod, amount: newAmount } : prod));
                            }}
                          >+</button>
                        </td>
                      );
                    }
                    if (col.key === "proposal") {
                      return (
                        <td key={col.key} style={{padding:"8px",color:"#eee", minWidth: "100px", maxWidth: "140px"}}>
                          <input
                            ref={el => proposalRefs.current[p.SKU] = el}
                            type="number"
                            step="1"
                            value={proposalInputBuffer[p.SKU] !== undefined ? proposalInputBuffer[p.SKU] : fmt(p.proposal)}
                            onChange={e => handleProposalInput(p.SKU, e.target.value)}
                            onBlur={e => confirmProposal(p.SKU, e.target.value)}
                            onKeyDown={e => handleProposalKeyDown(e, p.SKU)}
                            style={{width:100,padding:"6px 8px",borderRadius:4,border:"1px solid #aaa"}}
                          />
                        </td>
                      );
                    }
                    if (col.key === "Price") {
                      return (
                        <td key={col.key} style={{padding:"8px",color:"#eee", minWidth: "100px", maxWidth: "140px", textAlign: "right", whiteSpace: "nowrap"}}>
                          {typeof p[col.key] === "number" ? `€ ${fmt(p[col.key])}` : p[col.key]}
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
                  <td style={{ textAlign: "center" }}>
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        color: "#e53935",
                        fontSize: "1.3em",
                        cursor: "pointer"
                      }}
                      title="Verwijder regel"
                      onClick={() => {
                        setProducts(products => products.filter((_, idx) => idx !== i));
                      }}
                    >
                      &#10060;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 style={{ marginTop: 36 }}>Totalen/offerte</h3>
          <div style={{ display: "flex", gap: 32, alignItems: "flex-start", marginTop: 0 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-start" }}>
              <div style={{
                background: "#f6f8fa",
                boxShadow: "0 4px 18px rgba(0,0,0,0.13)",
                borderRadius: 24,
                padding: 32,
                maxWidth: 520,
                border: "1px solid #e3e8ee",
                fontSize: "1.12rem",
                color: "#222",
                minHeight: 370,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0px 18px"
              }}>
                {/* Verbeterde totalenkaart */}
                {/* Hoofdtotalen */}
                {/* Excel-style hoofdtotalen met pijltje tussen Current en New */}
                <div style={{ gridColumn: "1 / span 2", marginBottom: 18, display: "flex", gap: "32px", justifyContent: "center", width: "100%" }}>
                  <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "none", border: "1px solid #e3e8ee", padding: "24px 32px", minWidth: "220px", textAlign: "center", boxSizing: "border-box" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 2 }}>Current Price</div>
                    <div style={{ fontWeight: 700, fontSize: "2.1rem", color: "#222" }}>
                      € {fmt(totals.currentPrice)}
                    </div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "none", border: "1px solid #e3e8ee", padding: "24px 32px", minWidth: "220px", textAlign: "center", boxSizing: "border-box" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 2 }}>New Price</div>
                    <div style={{ fontWeight: 700, fontSize: "2.1rem", color: "#222" }}>
                      € {fmt(totals.newPrice)}
                    </div>
                  </div>
                </div>
                <div style={{ gridColumn: "1 / span 2", marginBottom: 18, display: "flex", gap: "32px", justifyContent: "center", width: "100%" }}>
                  <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "none", border: "1px solid #e3e8ee", padding: "24px 32px", minWidth: "220px", textAlign: "center", boxSizing: "border-box" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 2 }}>Current Profit</div>
                    <div style={{ fontWeight: 700, fontSize: "2.1rem", color: "#222" }}>
                      € {fmt(totals.currentProfit)}
                    </div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "none", border: "1px solid #e3e8ee", padding: "24px 32px", minWidth: "220px", textAlign: "center", boxSizing: "border-box" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 2 }}>New Profit</div>
                    <div style={{ fontWeight: 700, fontSize: "2.1rem", color: "#222" }}>
                      € {fmt(totals.newProfit)}
                    </div>
                  </div>
                </div>
                {/* Subtotalen zonder kleuraccenten */}
                <div style={{ gridColumn: "1 / span 2", margin: "12px 0 0 0" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0px 18px" }}>
                    <div style={{ padding: "10px 0", borderBottom: "1px solid #e3e8ee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600 }}>Current Margin</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: "1.1rem" }}>%</span>
                        <span>{fmt(totals.currentMarginPct, 2)}</span>
                      </span>
                    </div>
                    <div style={{ padding: "10px 0", borderBottom: "1px solid #e3e8ee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600 }}>New Margin</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                        <span style={{ fontSize: "1.1rem" }}>%</span>
                        <span style={{ fontWeight: 700 }}>{fmt(totals.newMarginPct, 2)}</span>
                      </span>
                    </div>
                    <div style={{ padding: "10px 0", borderBottom: "1px solid #e3e8ee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600 }}>€ Discount</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: "1.1rem" }}>€</span>
                        <span>{fmt(totals.discountEuro)}</span>
                      </span>
                    </div>
                    <div style={{ padding: "10px 0", borderBottom: "1px solid #e3e8ee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600 }}>% Discount</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                        <span style={{ fontSize: "1.1rem" }}>%</span>
                        <span style={{ fontWeight: 700 }}>{fmt(totals.discountPct, 2)}</span>
                      </span>
                    </div>
                    <div style={{ padding: "10px 0", borderBottom: "1px solid #e3e8ee", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                      <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        CDC
                        <span
                          style={{ cursor: "pointer", fontSize: "1.1em", marginLeft: 2, verticalAlign: "middle" }}
                          onMouseEnter={e => {
                            setHoveredRow("cdc-uitleg");
                            const rect = e.target.getBoundingClientRect();
                            setTooltipPosition({ x: rect.right + 10, y: rect.top });
                          }}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <span style={{ fontSize: "1em", background: "#e3e8ee", borderRadius: "50%", padding: "2px 6px", color: "#1976d2" }}>i</span>
                        </span>
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: "1.1rem" }}>€</span>
                        <span>{fmt(totals.cdc)}</span>
                      </span>
                      {hoveredRow === "cdc-uitleg" && (
                        <div
                          style={{
                            position: "fixed",
                            left: tooltipPosition.x,
                            top: tooltipPosition.y,
                            minWidth: 220,
                            maxWidth: 400,
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
                          CDC wordt per regel berekend: -5.33€ per lijn.<br />
                          {totals.cdcDetails && totals.cdcDetails.length > 0 && (
                            <ul style={{ marginTop: 6, paddingLeft: 0 }}>
                              {totals.cdcDetails.map((d, i) => {
                                const isBackorder = d.includes('backorder');
                                const isVoorraad = d.includes('uit voorraad');
                                if (isBackorder && i > 0 && totals.cdcDetails[i-1].includes(d.split(':')[0])) {
                                  return (
                                    <ul key={i} style={{ marginLeft: 24, paddingLeft: 16 }}>
                                      <li style={{ fontStyle: 'italic' }}>{d}</li>
                                    </ul>
                                  );
                                }
                                return (
                                  <li key={i} style={{ fontWeight: isVoorraad ? 600 : 400 }}>
                                    {d}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 320 }}>
              <h3 style={{ margin: 0, padding: 0, color: '#222' }}>  Klantgegevens</h3>
              <form style={{ background: "#ffffffff", boxShadow: "0 2px 10px rgba(0,0,0,0.10)", borderRadius: 16, padding: 26, border: "1px solid #eee", fontSize: "1.06rem", color: "#222", minHeight: 370, display: "flex", flexDirection: "column", justifyContent: "flex-start", marginTop: 0 }}>
                <div style={{ marginBottom: 12 }}>
                  <label><b>Naam:</b></label><br />
                  <input type="text" value={customerData.naam} onChange={e => setCustomerData({ ...customerData, naam: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label><b>Bedrijf:</b></label><br />
                  <input type="text" value={customerData.bedrijf} onChange={e => setCustomerData({ ...customerData, bedrijf: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label><b>BTW-nummer:</b></label><br />
                  <input type="text" value={customerData.btw} onChange={e => setCustomerData({ ...customerData, btw: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                </div>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 2 }}>
                    <label><b>Adres:</b></label><br />
                    <input type="text" value={customerData.adres} onChange={e => setCustomerData({ ...customerData, adres: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label><b>Postcode:</b></label><br />
                    <input type="text" value={customerData.postcode} onChange={e => setCustomerData({ ...customerData, postcode: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label><b>Gemeente:</b></label><br />
                    <input type="text" value={customerData.gemeente} onChange={e => setCustomerData({ ...customerData, gemeente: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label><b>Land:</b></label><br />
                  <input type="text" value={customerData.land} onChange={e => setCustomerData({ ...customerData, land: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label><b>E-mail:</b></label><br />
                  <input type="email" value={customerData.email} onChange={e => setCustomerData({ ...customerData, email: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                </div>
                <button
                  type="button"
                  style={{
                    marginTop: 18,
                    padding: "14px 32px",
                    borderRadius: 8,
                    background: "#43a047",
                    color: "#fff",
                    fontWeight: 700,
                    border: "none",
                    fontSize: "1.08rem",
                    cursor: "pointer"
                  }}
                  onClick={handleSaveQuotation}
                >
                  Offerte opslaan
                </button>
                {saveStatus && (
                  <div style={{ marginTop: 12, color: saveStatus.includes("succes") ? "#43a047" : "#e53935", fontWeight: 600 }}>
                    {saveStatus}
                  </div>
                )}
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
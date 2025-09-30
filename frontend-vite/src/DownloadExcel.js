import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export function downloadExcel(products, totals) {
  const columns = [
    "SKU", "Aantal", "SupRef", "Naam", "Prijs (€)", "Korting (€)", "Korting (%)", "Kost (€)", "Marge (€)", "Marge (%)", "Proposal (€)", "M%P"
  ];

  // Data
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

  // Totalenblok
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

  // Koptekst/logo
  const sheetData = [
    ["KLIUM OFFERTES"], // Titel, bold/groot
    [],
    columns,
    ...dataRows,
    ...totalRows
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Kolombreedtes
  ws['!cols'] = [
    { wch: 10 }, { wch: 7 }, { wch: 20 }, { wch: 50 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 14 }, { wch: 8 }
  ];

  // Titel styling
  ws['A1'].s = {
    font: { bold: true, sz: 18 },
    alignment: { horizontal: "center" }
  };

  // Header styling
  columns.forEach((col, idx) => {
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

  // Data rows: alternating fill + borders
  for (let r = 3; r < 3 + dataRows.length; r++) {
    for (let c = 0; c < columns.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        cell.s = {
          fill: { fgColor: { rgb: (r % 2 === 0) ? "FFFFFF" : "F7F7F7" } },
          border: {
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
          },
          alignment: { horizontal: c === 3 ? "left" : "center" } // Naam links
        };
      }
    }
  }

  // Totalenblok: dikke bovenlijn, bold
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

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 3 };

  // Workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Offerte");

  // Download
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
  saveAs(new Blob([wbout], { type: "application/octet-stream" }), "offerte.xlsx");
}
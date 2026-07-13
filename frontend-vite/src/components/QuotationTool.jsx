import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// Vertalingen voor de offerte-documenten (PDF/Excel) in NL/FR/EN
const I18N = {
  nl: {
    fileName: "offerte", title: "OFFERTE", reference: "Referentie",
    deliveryAddress: "Afleveradres", invoiceAddress: "Factuuradres",
    document: "Document", date: "Datum", vatNumber: "Btw-nummer",
    colRef: "Referentie", colProduct: "Product", colVat: "Btw-tarief", colDelivery: "Levertijd",
    colUnit: "Stukprijs (excl. btw)", colQty: "Aantal", colLineTotal: "Totaal (excl. btw)",
    totalProducts: "Totaal producten", shipping: "Verzendkosten", freeShipping: "Gratis verzending",
    totalExcl: "Totaal (excl. btw)", vat: "BTW", total: "Totaal",
    intracom: "Intracommunautaire levering — btw verlegd naar de afnemer (0%).",
    customer: "Klant", company: "Bedrijf", email: "E-mail", price: "Prijs (excl. btw)"
  },
  fr: {
    fileName: "devis", title: "DEVIS", reference: "Référence",
    deliveryAddress: "Adresse de livraison", invoiceAddress: "Adresse de facturation",
    document: "Document", date: "Date", vatNumber: "N° TVA",
    colRef: "Référence", colProduct: "Produit", colVat: "Taux TVA", colDelivery: "Délai",
    colUnit: "Prix unit. (hors TVA)", colQty: "Quantité", colLineTotal: "Total (hors TVA)",
    totalProducts: "Total produits", shipping: "Frais de livraison", freeShipping: "Livraison gratuite",
    totalExcl: "Total (hors TVA)", vat: "TVA", total: "Total",
    intracom: "Livraison intracommunautaire — autoliquidation de la TVA (0%).",
    customer: "Client", company: "Société", email: "E-mail", price: "Prix (hors TVA)"
  },
  en: {
    fileName: "quotation", title: "QUOTATION", reference: "Reference",
    deliveryAddress: "Delivery address", invoiceAddress: "Invoice address",
    document: "Document", date: "Date", vatNumber: "VAT number",
    colRef: "Reference", colProduct: "Product", colVat: "VAT rate", colDelivery: "Lead time",
    colUnit: "Unit price (excl. VAT)", colQty: "Qty", colLineTotal: "Total (excl. VAT)",
    totalProducts: "Total products", shipping: "Shipping", freeShipping: "Free shipping",
    totalExcl: "Total (excl. VAT)", vat: "VAT", total: "Total",
    intracom: "Intra-community supply — VAT reverse charged (0%).",
    customer: "Customer", company: "Company", email: "Email", price: "Price (excl. VAT)"
  }
};

// EU-landen met hun standaard btw-tarief (peil 2025/2026 — pas aan indien tarieven wijzigen),
// plus enkele niet-EU landen (export, 0% btw). Namen in NL/FR/EN voor het document.
const COUNTRIES = [
  { code: "BE", nl: "België", fr: "Belgique", en: "Belgium", eu: true, vat: 21 },
  { code: "NL", nl: "Nederland", fr: "Pays-Bas", en: "Netherlands", eu: true, vat: 21 },
  { code: "FR", nl: "Frankrijk", fr: "France", en: "France", eu: true, vat: 20 },
  { code: "DE", nl: "Duitsland", fr: "Allemagne", en: "Germany", eu: true, vat: 19 },
  { code: "LU", nl: "Luxemburg", fr: "Luxembourg", en: "Luxembourg", eu: true, vat: 17 },
  { code: "AT", nl: "Oostenrijk", fr: "Autriche", en: "Austria", eu: true, vat: 20 },
  { code: "BG", nl: "Bulgarije", fr: "Bulgarie", en: "Bulgaria", eu: true, vat: 20 },
  { code: "HR", nl: "Kroatië", fr: "Croatie", en: "Croatia", eu: true, vat: 25 },
  { code: "CY", nl: "Cyprus", fr: "Chypre", en: "Cyprus", eu: true, vat: 19 },
  { code: "CZ", nl: "Tsjechië", fr: "Tchéquie", en: "Czechia", eu: true, vat: 21 },
  { code: "DK", nl: "Denemarken", fr: "Danemark", en: "Denmark", eu: true, vat: 25 },
  { code: "EE", nl: "Estland", fr: "Estonie", en: "Estonia", eu: true, vat: 22 },
  { code: "FI", nl: "Finland", fr: "Finlande", en: "Finland", eu: true, vat: 25.5 },
  { code: "GR", nl: "Griekenland", fr: "Grèce", en: "Greece", eu: true, vat: 24 },
  { code: "HU", nl: "Hongarije", fr: "Hongrie", en: "Hungary", eu: true, vat: 27 },
  { code: "IE", nl: "Ierland", fr: "Irlande", en: "Ireland", eu: true, vat: 23 },
  { code: "IT", nl: "Italië", fr: "Italie", en: "Italy", eu: true, vat: 22 },
  { code: "LV", nl: "Letland", fr: "Lettonie", en: "Latvia", eu: true, vat: 21 },
  { code: "LT", nl: "Litouwen", fr: "Lituanie", en: "Lithuania", eu: true, vat: 21 },
  { code: "MT", nl: "Malta", fr: "Malte", en: "Malta", eu: true, vat: 18 },
  { code: "PL", nl: "Polen", fr: "Pologne", en: "Poland", eu: true, vat: 23 },
  { code: "PT", nl: "Portugal", fr: "Portugal", en: "Portugal", eu: true, vat: 23 },
  { code: "RO", nl: "Roemenië", fr: "Roumanie", en: "Romania", eu: true, vat: 21 },
  { code: "SK", nl: "Slovakije", fr: "Slovaquie", en: "Slovakia", eu: true, vat: 23 },
  { code: "SI", nl: "Slovenië", fr: "Slovénie", en: "Slovenia", eu: true, vat: 22 },
  { code: "ES", nl: "Spanje", fr: "Espagne", en: "Spain", eu: true, vat: 21 },
  { code: "SE", nl: "Zweden", fr: "Suède", en: "Sweden", eu: true, vat: 25 },
  { code: "GB", nl: "Verenigd Koninkrijk", fr: "Royaume-Uni", en: "United Kingdom", eu: false, vat: 0 },
  { code: "CH", nl: "Zwitserland", fr: "Suisse", en: "Switzerland", eu: false, vat: 0 },
  { code: "NO", nl: "Noorwegen", fr: "Norvège", en: "Norway", eu: false, vat: 0 },
  { code: "US", nl: "Verenigde Staten", fr: "États-Unis", en: "United States", eu: false, vat: 0 },
  { code: "OTHER", nl: "Ander land (buiten EU)", fr: "Autre pays (hors UE)", en: "Other country (non-EU)", eu: false, vat: 0 }
];
const COUNTRY_BY_CODE = {};
const COUNTRY_BY_NAME = {};
COUNTRIES.forEach(c => {
  COUNTRY_BY_CODE[c.code] = c;
  [c.nl, c.fr, c.en].forEach(n => { COUNTRY_BY_NAME[n.toUpperCase()] = c.code; });
});
// Enkele veelvoorkomende aliassen uit vrije tekst
Object.assign(COUNTRY_BY_NAME, {
  "BELGIE": "BE", "BELGIUM": "BE", "BELGIQUE": "BE",
  "HOLLAND": "NL", "THE NETHERLANDS": "NL",
  "DEUTSCHLAND": "DE", "ALLEMAGNE": "DE",
  "UK": "GB", "GREAT BRITAIN": "GB", "ENGLAND": "GB",
  "USA": "US", "UNITED STATES OF AMERICA": "US"
});

// Zet vrije tekst of code om naar een landcode ('BE', 'NL', ...); leeg indien onbekend.
function countryCode(input) {
  if (!input) return "";
  const s = String(input).trim().toUpperCase();
  if (COUNTRY_BY_CODE[s]) return s;
  if (COUNTRY_BY_NAME[s]) return COUNTRY_BY_NAME[s];
  return "";
}
// Landnaam in de gekozen taal.
function countryName(input, lang) {
  const code = countryCode(input);
  const c = COUNTRY_BY_CODE[code];
  if (!c) return input || "";
  return c[lang] || c.nl || code;
}
// Bouw één adresregel uit straat + nummer + bus.
function streetLine(d) {
  if (!d) return "";
  const s = [d.straat, d.nummer].filter(Boolean).join(" ");
  if (d.bus) return s ? `${s} bus ${d.bus}` : `bus ${d.bus}`;
  return s || d.adres || "";
}

export default function QuotationTool({ onOfferteSaved, offerteData }) {
  const CDC_LINE_COST = 5.33;
  const fmt = (val, decimals = 2) => {
    if (val === undefined || val === null || val === "") return "";
    let num = Number(val);
    if (isNaN(num)) return val;
    return num.toFixed(decimals);
  };

  function toNumOrNull(v) {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function parseDateOrNull(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addBusinessDays(date, days) {
    const out = new Date(date);
    let left = Math.max(0, Math.floor(Number(days) || 0));
    while (left > 0) {
      out.setDate(out.getDate() + 1);
      const wd = out.getDay();
      if (wd !== 0 && wd !== 6) left -= 1;
    }
    return out;
  }

  function diffCalendarDays(fromDate, toDate) {
    const from = startOfDay(fromDate).getTime();
    const to = startOfDay(toDate).getTime();
    return Math.ceil((to - from) / (1000 * 60 * 60 * 24));
  }

  function fmtDateBE(date) {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function backorderDateFromSchema(p) {
    const today = startOfDay(new Date());
    const normalizeDays = (v) => {
      const n = toNumOrNull(v);
      if (n === null || n <= 0) return null;
      return Math.ceil(n);
    };
    const customerDays = normalizeDays(p.CustomerLeadTimeDays);
    const theoreticalDays = normalizeDays(p.TheoreticalLeadTimeDays);
    const avgErpDays = normalizeDays(p.AvgErpLeadTimeDays);
    const lastActualDays = normalizeDays(p.LastActualLeadTimeDays);
    const leadDays = customerDays ?? theoreticalDays ?? avgErpDays ?? lastActualDays;
    const kliumDate = parseDateOrNull(p.KliumLeadTimeDate);

    if (!kliumDate) {
      if (leadDays === null) return null;
      return addBusinessDays(today, leadDays);
    }
    if (leadDays === null) return kliumDate;
    const kliumDiff = diffCalendarDays(today, kliumDate);
    if (kliumDiff <= leadDays) return addBusinessDays(today, leadDays);
    return kliumDate;
  }

  function deliveryInfo(p) {
    const amount = Math.max(1, Math.floor(toNumOrNull(p.amount) ?? 1));
    const stock = Math.max(0, Math.floor(toNumOrNull(p.Stock) ?? 0));
    const inStock = Math.min(stock, amount);
    const backOrder = Math.max(amount - stock, 0);
    const boDate = backOrder > 0 ? backorderDateFromSchema(p) : null;
    const boDateStr = boDate ? fmtDateBE(boDate) : null;

    if (backOrder <= 0) {
      return {
        short: "Uit voorraad",
        pdf: "Uit voorraad",
        full: "Uit voorraad",
        badge: { bg: "#173d20", fg: "#7ee08a", text: "Voorraad" },
        inStockOnly: true,
        backOrderDate: null,
        amount,
        stock,
        inStock,
        backOrder
      };
    }

    if (inStock > 0) {
      const compact = boDateStr
        ? `${inStock} vrd + ${backOrder} best. (${boDateStr})`
        : `${inStock} vrd + ${backOrder} best.`;
      const full = boDateStr
        ? `${inStock} uit voorraad, ${backOrder} op bestelling vanaf ${boDateStr}`
        : `${inStock} uit voorraad, ${backOrder} op bestelling`;
      return {
        short: compact,
        pdf: full,
        full,
        badge: { bg: "#3d3413", fg: "#ffd166", text: "Split" },
        inStockOnly: false,
        backOrderDate: boDate,
        amount,
        stock,
        inStock,
        backOrder
      };
    }

    const compact = boDateStr ? `Op best. (${boDateStr})` : "Op bestelling";
    const full = boDateStr ? `Op bestelling: bezorgd vanaf ${boDateStr}` : "Op bestelling";
    return {
      short: compact,
      pdf: full,
      full,
      badge: { bg: "#3d1717", fg: "#ffb4b4", text: "Bestelling" },
      inStockOnly: false,
      backOrderDate: boDate,
      amount,
      stock,
      inStock,
      backOrder
    };
  }

  // BTW-regeling bepalen op basis van (leverings)land + btw-nummer van de klant.
  // - BE (of onbekend land = binnenlands): 21% btw
  // - EU niet-BE MET btw-nr: intracommunautair, 0% (btw verlegd)
  // - EU niet-BE ZONDER btw-nr (particulier): btw-tarief van het bestemmingsland (OSS)
  // - buiten EU: export, 0% btw
  function computeVat(btw, countryInput) {
    const code = countryCode(countryInput);
    const country = COUNTRY_BY_CODE[code];
    const btwRaw = (btw || "").replace(/[\s.\-]/g, "").toUpperCase();
    const hasVat = btwRaw.length >= 8 && /\d/.test(btwRaw);
    if (code === "BE" || !code) {
      return { pct: 21, code: code || "BE", hasVat, intracommunautair: false, isExport: false, label: "Incl. 21% btw (BE)" };
    }
    if (country && country.eu && hasVat) {
      return { pct: 0, code, hasVat, intracommunautair: true, isExport: false, label: `Intracommunautair — btw verlegd (0%) · ${code}` };
    }
    if (country && country.eu) {
      return { pct: country.vat, code, hasVat, intracommunautair: false, isExport: false, label: `Incl. ${country.vat}% btw (${code})` };
    }
    return { pct: 0, code, hasVat, intracommunautair: false, isExport: true, label: `Export buiten EU (0%) · ${code}` };
  }

  // STATES
  const [recentOffertes, setRecentOffertes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const OFFERTES_PER_PAGE = 10;
  const [missingSkus, setMissingSkus] = useState([]);
  const [hasFetchedProducts, setHasFetchedProducts] = useState(false);
  const [customerData, setCustomerData] = useState({
    naam: "",
    bedrijf: "",
    btw: "",
    straat: "",
    nummer: "",
    bus: "",
    postcode: "",
    gemeente: "",
    land: "BE",
    email: ""
  });
  const [sameDelivery, setSameDelivery] = useState(true);
  const [deliveryData, setDeliveryData] = useState({
    naam: "",
    bedrijf: "",
    straat: "",
    nummer: "",
    bus: "",
    postcode: "",
    gemeente: "",
    land: "BE"
  });
  const [rows, setRows] = useState([{ sku: "", amount: 1 }]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({});
  const [hoveredRow, setHoveredRow] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [cdcTooltipTimer, setCdcTooltipTimer] = useState(null);
  const [proposals, setProposals] = useState({});
  const [proposalInputBuffer, setProposalInputBuffer] = useState({});
  const proposalRefs = useRef({});
  const batchRef = useRef(null);
  const gutterRef = useRef(null);
  const [batchInput, setBatchInput] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [tooManyResults, setTooManyResults] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [skuNames, setSkuNames] = useState({}); // sku -> naam | null (niet gevonden) | false (bezig)
  const [discountValue, setDiscountValue] = useState("");
  const [discountMode, setDiscountMode] = useState("pct"); // 'pct' | 'eur'
  const [discountNote, setDiscountNote] = useState("");
  const [docLang, setDocLang] = useState("nl"); // taal voor PDF/Excel: 'nl' | 'fr' | 'en'

  function getSafeTooltipPosition(clientX, clientY, opts = {}) {
    const margin = 12;
    const offset = opts.offset ?? 14;
    const tipWidth = opts.width ?? 360;
    const tipHeight = opts.height ?? 340;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1400;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;

    let x = clientX + offset;
    let y = clientY + offset;

    if (x + tipWidth > vw - margin) {
      x = Math.max(margin, vw - tipWidth - margin);
    }
    if (y + tipHeight > vh - margin) {
      y = clientY - tipHeight - offset;
    }
    if (y < margin) {
      y = margin;
    }

    return { x, y };
  }

  // COLUMNS
  const columns = [
    { key: "SKU", label: "SKU" },
    { key: "amount", label: "Aantal" },
    { key: "SUPPLIER_REFERENCE", label: "SupRef" },
    { key: "Name", label: "Naam" },
    { key: "LeadTimeLabel", label: "Levertijd" },
    { key: "Price", label: "Prijs (€)" },
    { key: "Discount", label: "Korting (€)" },
    { key: "Discount%", label: "Korting (%)" },
    { key: "Cost", label: "Kost (€)" },
    { key: "M€", label: "Marge (€)" },
    { key: "M%", label: "Marge (%)" },
    { key: "proposal", label: "Proposal (€)" },
    { key: "mpp", label: "M%P" },
    { key: "givenDiscount", label: "Geg. korting (%)" }
  ];

  const colWidths = {
    SKU: "6%",
    amount: "7%",
    SUPPLIER_REFERENCE: "8%",
    Name: "20%",
    LeadTimeLabel: "9%",
    Price: "5%",
    Discount: "5%",
    "Discount%": "5%",
    Cost: "5%",
    "M€": "5%",
    "M%": "5%",
    proposal: "8%",
    mpp: "4%",
    givenDiscount: "4%"
  };

  // FETCH RECENT OFFERTES
  useEffect(() => {
    async function fetchRecentOffertes() {
      try {
        const res = await fetch("http://localhost:3000/api/offertes");
        const data = await res.json();
        setRecentOffertes(Array.isArray(data.offertes) ? data.offertes : []);
      } catch {
        setRecentOffertes([]);
      }
    }
    fetchRecentOffertes();
  }, [onOfferteSaved]);

  // PREFILL FROM OFFERTE
  useEffect(() => {
    async function prefillFromOfferte() {
      if (offerteData && offerteData.id) {
        setCustomerData({
          naam: offerteData.customer || '',
          bedrijf: offerteData.bedrijf || '',
          btw: offerteData.btw || '',
          straat: offerteData.straat || offerteData.adres || '',
          nummer: offerteData.nummer || '',
          bus: offerteData.bus || '',
          postcode: offerteData.postcode || '',
          gemeente: offerteData.gemeente || '',
          land: countryCode(offerteData.land) || 'BE',
          email: offerteData.email || ''
        });
        const skus = Array.isArray(offerteData.producten) ? offerteData.producten.map(p => p.sku).join(",") : "";
        if (skus) {
          try {
            const res = await fetch(`http://localhost:3000/api/products?skus=${skus}`);
            const data = await res.json();
            const prodMap = {};
            offerteData.producten.forEach(p => { prodMap[p.sku] = p; });
            const merged = (data.products || []).map(p => {
              const o = prodMap[p.SKU] || {};
              return {
                ...p,
                amount: o.aantal ?? 1,
                proposal: o.prijs ?? p.Price,
                Name: o.naam ?? p.Name
              };
            });
            setProducts(merged);
          } catch {
            setProducts(
              offerteData.producten.map(p => ({
                SKU: p.sku,
                Name: p.naam,
                amount: p.aantal,
                proposal: p.prijs
              }))
            );
          }
        } else {
          setProducts([]);
        }
      }
    }
    prefillFromOfferte();
  }, [offerteData]);

  // NIEUWE OFFERTE — reset alle invoer en resultaten voor een verse start
  function startNewOfferte() {
    if (products.length > 0 || rows.some(r => r.sku) || batchInput.trim()) {
      if (!window.confirm("Huidige offerte wissen en opnieuw beginnen?")) return;
    }
    setCustomerData({ naam: "", bedrijf: "", btw: "", straat: "", nummer: "", bus: "", postcode: "", gemeente: "", land: "BE", email: "" });
    setSameDelivery(true);
    setDeliveryData({ naam: "", bedrijf: "", straat: "", nummer: "", bus: "", postcode: "", gemeente: "", land: "BE" });
    setRows([{ sku: "", amount: 1 }]);
    setProducts([]);
    setProposals({});
    setProposalInputBuffer({});
    setTotals({});
    setMissingSkus([]);
    setHasFetchedProducts(false);
    setBatchInput("");
    setImportResult(null);
    setSearchInput("");
    setSearchResults([]);
    setTooManyResults(false);
    setSaveStatus("");
    setSkuNames({});
    setDiscountValue("");
    setDiscountMode("pct");
    setDiscountNote("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // BATCH IMPORT
  function handleBatchImport() {
    const lines = batchInput.split(/\n/);
    const newRows = [];
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      let parts = line.split(/[\t,; ]+/).map(x => x.trim()).filter(Boolean);
      parts = parts.filter(p => p.toLowerCase() !== 'leef');
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

  // SLIMME IMPORT — herkent artikelnummers (art. 12345) en aantallen (1x, 2x ...) uit geplakte tekst
  // Voorbewerking: bij een proforma-cart (uit PDF) splitst het plakken één rij vaak over
  // meerdere regels. We voegen vervolgregels weer samen bij de rij die met een SKU begint,
  // zodat naam + aantal op één logische regel staan. Gewone lijsten blijven ongewijzigd.
  function preprocessLines(text) {
    const raw = text.split(/\r?\n/);
    const startsNewItem = l =>
      /^\s*\d{8}\b/.test(l) ||            // 8-cijferige SKU vooraan
      /^\s*\d+\s*[x×]\s+/i.test(l) ||     // "2x ..."
      /^\s*[-–—•*]\s/.test(l) ||          // opsommingsteken
      /\bart(?:ikel|\.)/i.test(l);        // "art." referentie
    const skuLineCount = raw.filter(l => /^\s*\d{8}\b/.test(l)).length;
    const out = [];
    if (skuLineCount < 2) {
      // Geen proforma-patroon: elke regel blijft een aparte rij.
      raw.forEach((l, i) => out.push({ text: l, line: i }));
      return out;
    }
    raw.forEach((l, i) => {
      if (startsNewItem(l) || out.length === 0) {
        out.push({ text: l, line: i });
      } else if (l.trim()) {
        out[out.length - 1].text += ' ' + l.trim();
      }
    });
    return out;
  }

  function parseSmartLines(text) {
    const rows = preprocessLines(text);
    const items = [];
    rows.forEach(({ text: rawLine, line: idx }) => {
      const line = rawLine.trim();
      if (!line) return;

      // ----- Referentie bepalen -----
      let ref = null;
      const artMatch = line.match(/art(?:ikel|\.?nr|\.|:)?\.?\s*[:.]?\s*([0-9][0-9A-Za-z\-./]{2,})/i);
      if (artMatch) ref = artMatch[1].replace(/[.\-/]+$/, "");
      if (!ref) {
        const skuMatch = line.match(/\b(\d{8})\b/);
        if (skuMatch) ref = skuMatch[1];
      }
      let amountFromParts = null;
      if (!ref) {
        // "SKU,aantal" — enkel als het eerste token een plausibele SKU is (6-8 cijfers)
        const parts = line.split(/[\t,;]+/).map(s => s.trim()).filter(Boolean);
        const first = parts.length ? parts[0].split(/\s+/)[0] : "";
        if (/^\d{6,8}$/.test(first)) {
          ref = first;
          if (parts.length >= 2 && /^\d+$/.test(parts[1])) amountFromParts = Number(parts[1]);
        }
      }
      // Fallback: numerieke leveranciersreferentie die geen 8-cijferige SKU is
      // (bv. een 10-cijferige Milwaukee-code zoals 4932430483). Wordt via de
      // leveranciersreferentie opgezocht.
      if (!ref) {
        const numMatch = line.match(/\b(\d{6,14})\b/);
        if (numMatch && numMatch[1].length !== 8) ref = numMatch[1];
      }
      // Fallback: alfanumerieke leveranciersreferentie/modelcode die zowel letters als
      // cijfers bevat, bv. "41/KIT360", "MFT/3", "SYS3". Wordt via LIKE + scoring opgezocht.
      if (!ref) {
        const codeTokens = (line.match(/[A-Za-z0-9][A-Za-z0-9/.\-]{3,}/g) || [])
          .filter(t => /[A-Za-z]/.test(t) && /\d/.test(t));
        if (codeTokens.length) {
          ref = codeTokens.sort((a, b) => b.length - a.length)[0].replace(/[.\-/]+$/, "");
        }
      }

      // ----- Aantal bepalen (meerdere formaten) -----
      let amount = 1;
      const isRefNum = n => ref && String(n) === String(ref);
      let m =
        line.match(/€\s*[\d.,]+\s+(\d{1,5})\s+€\s*[\d.,]+/) ||                       // proforma: stukprijs  Aantal  totaal
        line.match(/^\s*(\d{1,5})\s*[x×]\s+/i) ||                                    // "2x ..."
        line.match(/\b(?:pcs?|pieces?|stuks?|stk?|qty|aantal|ea)\.?\s*[:.]?\s*(\d{1,5})\b/i) || // "Pcs. 350"
        line.match(/\b(\d{1,5})\s*(?:pcs?|pieces?|stuks?|stk?|x)\b/i) ||             // "350 pcs"
        line.match(/^[\s\-–—•*]*(\d{1,4})\s+\D/);                                    // "- 350 borstels"
      if (m && !isRefNum(m[1])) amount = Number(m[1]) || 1;
      else if (amountFromParts && !isRefNum(amountFromParts)) amount = amountFromParts;

      // ----- Merk (hulp bij keuze; scoring op backend is leidend) -----
      let head = line.replace(/^[\s\-–—•*]*/, "");
      head = head.replace(/^(?:pcs?|pieces?|stuks?|stk?|qty|aantal|ea)\.?\s*[:.]?\s*/i, "");
      head = head.replace(/^\d[\d.,/xX]*\s*/, "");
      head = head.replace(/^(?:pcs?|pieces?|stuks?|stk?)\.?\s*/i, "");
      let brand = "";
      const brandMatch = head.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.&'-]{1,}/);
      if (brandMatch) brand = brandMatch[0].replace(/[.'&-]+$/, "");

      items.push({ line: idx, raw: line, ref, amount, brand, text: line, recognized: !!ref });
    });
    return items;
  }

  async function handleSmartImport() {
    const parsed = parseSmartLines(batchInput);
    if (!parsed.length) {
      alert("Geen herkenbare regels gevonden in de tekst.");
      return;
    }
    const recognized = parsed.filter(i => i.recognized);
    const unrecognized = parsed.filter(i => !i.recognized);
    setImportLoading(true);
    setImportResult(null);
    try {
      let data = { resolved: [], ambiguous: [], unresolved: [] };
      if (recognized.length) {
        const res = await fetch("http://localhost:3000/api/products/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: recognized.map(i => ({ ref: i.ref, amount: i.amount, line: i.line, brand: i.brand, text: i.text }))
          })
        });
        data = await res.json();
      }
      setImportResult({
        resolved: data.resolved || [],
        ambiguous: data.ambiguous || [],
        unresolved: data.unresolved || [],
        unrecognized: unrecognized.map(i => ({ line: i.line, raw: i.raw, amount: i.amount })),
        parsedCount: parsed.length,
        truncated: !!data.truncated
      });
    } catch {
      alert("Fout bij slimme import.");
    }
    setImportLoading(false);
  }

  // Markeer/selecteer de originele invoerregel in het tekstvak (klik op regelverwijzing)
  function highlightInputLine(lineNo) {
    const ta = batchRef.current;
    if (!ta || lineNo === null || lineNo === undefined) return;
    const lines = batchInput.split(/\r?\n/);
    let start = 0;
    for (let i = 0; i < lineNo && i < lines.length; i++) start += lines[i].length + 1;
    const end = start + (lines[lineNo] ? lines[lineNo].length : 0);
    ta.focus();
    ta.setSelectionRange(start, end);
    // Benader scrollen naar de regel
    const lineHeight = 22;
    ta.scrollTop = Math.max(0, lineNo * lineHeight - ta.clientHeight / 2);
  }

  // Klikbaar knopje dat naar de originele invoerregel springt en die selecteert
  function renderLineRef(lineNo) {
    if (lineNo === null || lineNo === undefined) return null;
    return (
      <button
        onClick={() => highlightInputLine(lineNo)}
        title="Toon deze regel in de invoer"
        style={{ background:'#0077cc', color:'white', border:'none', borderRadius:5, padding:'1px 8px', fontSize:'0.8em', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}
      >
        regel {lineNo + 1}
      </button>
    );
  }

  function appendRows(newRows) {
    if (!newRows.length) return;
    setRows(r => {
      const base = r.length === 1 && !r[0].sku ? [] : r;
      return [...base, ...newRows];
    });
  }

  // Zoek de naam van een ingevoerde SKU op (op blur), zodat de gebruiker ziet welk product het is.
  async function lookupSkuName(rawSku) {
    const key = (rawSku || "").trim();
    if (!key || !/^\d{5,8}$/.test(key)) return;
    if (Object.prototype.hasOwnProperty.call(skuNames, key)) return;
    setSkuNames(prev => ({ ...prev, [key]: false }));
    try {
      const res = await fetch(`http://localhost:3000/api/products?skus=${key}`);
      const data = await res.json();
      const norm = s => String(s).replace(/^0+/, "");
      const prod = (data.products || []).find(p => norm(p.SKU) === norm(key)) || (data.products || [])[0];
      setSkuNames(prev => ({ ...prev, [key]: prod ? (prod.Name || null) : null }));
    } catch {
      setSkuNames(prev => { const c = { ...prev }; delete c[key]; return c; });
    }
  }

  function addResolvedRows() {
    if (!importResult) return;
    // Namen uit de import meteen cachen zodat ze naast de rijen verschijnen.
    setSkuNames(prev => {
      const next = { ...prev };
      importResult.resolved.forEach(r => { if (r.sku) next[String(r.sku).replace(/^0+/, "")] = r.name || null; next[r.sku] = r.name || null; });
      return next;
    });
    appendRows(importResult.resolved.map(r => ({ sku: r.sku, amount: r.amount })));
    setBatchInput("");
    setImportResult(null);
  }

  function addCandidateRow(sku, amount, name) {
    if (name !== undefined) {
      setSkuNames(prev => ({ ...prev, [sku]: name || null, [String(sku).replace(/^0+/, "")]: name || null }));
    }
    appendRows([{ sku, amount: amount || 1 }]);
    setImportResult(prev => prev ? {
      ...prev,
      ambiguous: prev.ambiguous.filter(a => !a.candidates.some(c => c.sku === sku))
    } : prev);
  }

  // PRODUCT SEARCH
  async function handleProductSearch() {
    const queries = searchInput.split(/[\t,; ]+/).map(x => x.trim()).filter(Boolean);
    if (!queries.length) return;
    setSearchResults([]);
    setLoadingSearch(true);
    try {
      // Stuur alle queries in één keer naar de batch-search endpoint
      const res = await fetch('http://localhost:3000/api/products/batch-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suprefs: queries, names: queries })
      });
      const data = await res.json();
      let found = [];
      if (data.products && data.products.length) {
        found = data.products.map(p => ({
          sku: p.SKU,
          supref: p.SUPPLIER_REFERENCE,
          name: p["PRODUCT_NAME_H1.nl_BE"] || p.Name
        }));
      }
      const unique = {};
      found.forEach(p => { unique[p.sku] = p; });
      let resultsArr = Object.values(unique);
      const queryLower = searchInput.trim().toLowerCase();
      const exactMatches = resultsArr.filter(p =>
        p.sku.toLowerCase() === queryLower ||
        (p.supref && p.supref.toLowerCase() === queryLower) ||
        (p.name && p.name.toLowerCase() === queryLower)
      );
      const containsMatches = resultsArr.filter(p =>
        !exactMatches.includes(p) && (
          p.sku.toLowerCase().includes(queryLower) ||
          (p.supref && p.supref.toLowerCase().includes(queryLower)) ||
          (p.name && p.name.toLowerCase().includes(queryLower))
        )
      );
      const fuzzyMatches = resultsArr.filter(p =>
        !exactMatches.includes(p) && !containsMatches.includes(p)
      );
      resultsArr = [...exactMatches, ...containsMatches, ...fuzzyMatches].slice(0, 20);
      setSearchResults(resultsArr);
      setTooManyResults(exactMatches.length + containsMatches.length + fuzzyMatches.length > 20);
    } catch {
      alert("Fout bij zoeken naar product");
    }
    setLoadingSearch(false);
  }

  function handleAddSearchRow(sku) {
    setRows(r => [...r, { sku, amount: 1 }]);
    setSearchResults(searchResults.filter(r => r.sku !== sku));
  }

  // ROWS
  const addRow = () => setRows([...rows, { sku: "", amount: 1 }]);  const removeRow = idx => setRows(rows.filter((_, i) => i !== idx));
  const updateRow = (idx, field, value) => {
    const newRows = [...rows];
    newRows[idx][field] = value;
    setRows(newRows);
  };

  // FETCH PRODUCTS
  const fetchProducts = async () => {
    setLoading(true);
    setHasFetchedProducts(true);
    try {
      const inputSkus = rows.map(r => r.sku).filter(Boolean);
      const skuString = inputSkus.join(",");
      const res = await fetch(`http://localhost:3000/api/products?skus=${skuString}`);
      const data = await res.json();
      const skuAmounts = rows.reduce((acc, r) => {
        if (!r.sku) return acc;
        acc[r.sku] = (acc[r.sku] || 0) + (Number(r.amount) || 1);
        return acc;
      }, {});
      const enriched = (data.products || []).map(p => {
        const sku = p.SKU;
        let defaultProposal = p.Price ? Number(p.Price).toFixed(2) : "0.00";
        let proposalVal = proposals[sku] !== undefined ? proposals[sku] : defaultProposal;
        return {
          ...p,
          amount: skuAmounts[sku] ?? 1,
          proposal: Number(proposalVal)
        };
      });
      setProducts(enriched);
      const foundSkus = new Set((data.products || []).map(p => p.SKU));
      const missing = inputSkus.filter(sku => !foundSkus.has(sku));
      setMissingSkus(missing);
    } catch {
      alert("Fout bij ophalen producten");
    }
    setLoading(false);
  };

  // PROPOSAL INPUT
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

  // GLOBALE KORTING — verdeeld naar rato van de marge (hoogste marge draagt meest).
  // Elk product verliest dezelfde fractie van zijn marge, zodat de prijs nooit onder kostprijs zakt.
  function applyGlobalDiscount() {
    const val = Number(discountValue);
    if (!val || val <= 0) { setDiscountNote("Geef een korting groter dan 0 in."); return; }
    if (!products.length) { setDiscountNote("Maak eerst de offerte (voeg producten toe)."); return; }
    const totalExcl = products.reduce((s, p) => s + (Number(p.proposal) || 0) * (p.amount || 1), 0);
    const totalMargin = products.reduce((s, p) => s + ((Number(p.proposal) || 0) - (Number(p.Cost) || 0)) * (p.amount || 1), 0);
    let target = discountMode === "pct" ? (val / 100) * totalExcl : val;
    let note = "";
    if (target > totalMargin) {
      target = Math.max(0, totalMargin);
      note = "Korting begrensd tot de totale marge (prijzen kunnen niet onder kostprijs).";
    }
    const ratio = totalMargin > 0 ? target / totalMargin : 0;
    const updated = products.map(p => {
      const cost = Number(p.Cost) || 0;
      const prop = Number(p.proposal) || 0;
      const newProp = Math.round((cost + (prop - cost) * (1 - ratio)) * 100) / 100;
      return { ...p, proposal: newProp };
    });
    const newProposals = {};
    updated.forEach(p => { newProposals[p.SKU] = Number(p.proposal).toFixed(2); });
    setProducts(updated);
    setProposals(newProposals);
    setDiscountNote(note);
  }

  // Zet alle prijzen terug naar de catalogusprijs.
  function resetPrices() {
    setDiscountNote("");
    setDiscountValue("");
    setProposals({});
    setProposalInputBuffer({});
    setProducts(products => products.map(p => ({ ...p, proposal: Number(p.Price) || 0 })));
  }

  // TOTALS
  useEffect(() => {
    if (!products.length) {
      setTotals({});
      return;
    }
    let currentPrice = 0, newPrice = 0, currentProfit = 0, newProfit = 0, currentCost = 0, cdc = 0, discountEuro = 0, discountPct = 0;
    const cdcRows = [];
    let voorraadLines = 0;
    let backorderLines = 0;

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

      const cdcLines = (inStock > 0 ? 1 : 0) + (backOrder > 0 ? 1 : 0);
      const cdcValue = -CDC_LINE_COST * cdcLines;
      if (inStock > 0) {
        voorraadLines += 1;
      }
      if (backOrder > 0) {
        backorderLines += 1;
      }
      if (cdcLines > 0) {
        cdc += cdcValue;
        cdcRows.push({
          sku: p.SKU,
          name: p.Name || "",
          amount: amt,
          stock,
          inStock,
          backOrder,
          cdcLines,
          cdcValue
        });
      }
    });

    cdcRows.sort((a, b) => {
      if (b.cdcLines !== a.cdcLines) return b.cdcLines - a.cdcLines;
      return a.sku.localeCompare(b.sku);
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
      cdcRows,
      cdcSummary: {
        skuCount: cdcRows.length,
        voorraadLines,
        backorderLines,
        lineCost: CDC_LINE_COST
      },
      exclBtw: newPrice ? (newPrice / 1.21).toFixed(2) : '',
      btw: newPrice ? (newPrice - (newPrice / 1.21)).toFixed(2) : ''
    });
  }, [products]);

  // EXTRA INFO
  function extraInfo(p) {
    const d = deliveryInfo(p);
    return (
      <div>
        <div><b>Voor Sale:</b> {p["Voor Sale"]}</div>
        <div><b>Op BE:</b> {p["Op BE"]}</div>
        <div><b>Op NL:</b> {p["Op NL"]}</div>
        <div><b>Op COM:</b> {p["Op COM"]}</div>
        <div><b>Stock:</b> {(p.Stock !== undefined && p.Stock !== null) ? p.Stock : '-'}</div>
        <div><b>Levertijd:</b> {d.full}</div>
        <div><b>Gevraagd:</b> {d.amount} · <b>Voorraad:</b> {d.stock} · <b>Backorder:</b> {d.backOrder}</div>
        {!d.inStockOnly && <div><b>ETA datum:</b> {d.backOrderDate ? fmtDateBE(d.backOrderDate) : '-'}</div>}
        <div><b>MSQ:</b> {(p.MSQ !== undefined && p.MSQ !== null) ? p.MSQ : '-'}</div>
        <div><b>Ecotax:</b> {fmt(p.Ecotax)}</div>
      </div>
    );
  }

  // EXCEL EXPORT
  async function downloadExcel() {
    if (!window.XLSX) {
      alert('SheetJS (XLSX) is niet geladen. Voeg de CDN toe aan index.html!');
      return;
    }
    const t = I18N[docLang] || I18N.nl;
    const prodName = p => p[`Name_${docLang}`] || p.Name || "";
    const wsData = [
      [t.customer, customerData.naam],
      [t.company, customerData.bedrijf],
      [t.email, customerData.email],
      [t.date, new Date().toISOString().slice(0, 10)],
      [],
      [t.colRef, t.colProduct, t.colQty, t.price],
      ...products.map(p => [p.SKU, prodName(p), p.amount, p.proposal])
    ];
    const ws = window.XLSX.utils.aoa_to_sheet(wsData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, t.title);
    window.XLSX.writeFile(wb, `${t.fileName}_${customerData.naam || 'klant'}.xlsx`);
  }

  // PDF EXPORT HERSTELD
  async function downloadPDF() {
    if (!window.pdfMake) {
      alert('pdfMake is niet geladen. Voeg de CDN scripts toe aan index.html!');
      return;
    }
    // Base64 van het logo
    const logoBase64 = 'data:image/jpeg;base64,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'
    // Klantgegevens
    const t = I18N[docLang] || I18N.nl;
    const destCountry = sameDelivery ? customerData.land : deliveryData.land;
    const vat = computeVat(customerData.btw, destCountry);
    const prodName = p => p[`Name_${docLang}`] || p.Name || "";
    const locale = docLang === "fr" ? "fr-BE" : docLang === "en" ? "en-GB" : "nl-BE";
    const euro = n => "€ " + Number(n || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dateStr = new Date().toLocaleDateString(locale);
    const quoteNr = "OFF-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(1000 + Math.random() * 9000);

    const addrBlock = d => [
      d.bedrijf,
      d.naam,
      streetLine(d),
      `${d.postcode || ""} ${d.gemeente || ""}`.trim(),
      countryName(d.land, docLang)
    ].filter(Boolean).map(l => ({ text: l, fontSize: 10 }));
    const factuurLines = addrBlock(customerData);
    const leveringLines = addrBlock(sameDelivery ? customerData : deliveryData);

    const th = (txt, align) => ({ text: txt, bold: true, fontSize: 9, color: "#20264b", fillColor: "#f0f1f5", alignment: align || "left", margin: [2, 5, 2, 5] });
    const td = (txt, align) => ({ text: txt, fontSize: 9, alignment: align || "left", margin: [2, 4, 2, 4] });

    const productBody = [
      [th(t.colRef), th(t.colProduct), th(t.colDelivery), th(t.colVat, "center"), th(t.colUnit, "right"), th(t.colQty, "center"), th(t.colLineTotal, "right")],
      ...products.map(p => [
        td(p.SKU),
        td(prodName(p)),
        td(deliveryInfo(p).pdf),
        td(`${vat.pct} %`, "center"),
        td(euro(p.proposal), "right"),
        td(String(p.amount), "center"),
        td(euro((Number(p.proposal) || 0) * (p.amount || 1)), "right")
      ])
    ];

    const totaalExcl = products.reduce((sum, p) => sum + (Number(p.proposal) || 0) * (p.amount || 1), 0);
    const btw = totaalExcl * vat.pct / 100;
    const totaalIncl = totaalExcl + btw;

    const totLbl = (txt, bold) => ({ text: txt, fontSize: bold ? 11 : 10, bold: !!bold, alignment: "left", margin: [0, 3, 16, 3], border: [false, false, false, false] });
    const totVal = (txt, bold) => ({ text: txt, fontSize: bold ? 11 : 10, bold: !!bold, alignment: "right", margin: [0, 3, 0, 3], border: [false, false, false, false] });

    const totalsRows = [
      [totLbl(t.totalProducts), totVal(euro(totaalExcl))],
      [totLbl(t.shipping), totVal(t.freeShipping)],
      [totLbl(t.totalExcl), totVal(euro(totaalExcl))],
      vat.intracommunautair
        ? [totLbl(`${t.vat} (0%)`), totVal("—")]
        : [totLbl(`${t.vat} ${vat.pct}%`), totVal(euro(btw))],
      [totLbl(t.total, true), totVal(euro(totaalIncl), true)]
    ];

    const tableLayout = {
      hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.8 : 0.4,
      vLineWidth: () => 0,
      hLineColor: () => "#d5d8e0",
      paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 4, paddingBottom: () => 4
    };
    const infoLayout = {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.8 : 0.4,
      vLineWidth: () => 0, hLineColor: () => "#d5d8e0",
      paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 4, paddingBottom: () => 4
    };

    const docDefinition = {
      pageMargins: [40, 40, 40, 60],
      content: [
        {
          columns: [
            { image: "logo", width: 130 },
            {
              width: "*",
              stack: [
                { text: t.title, fontSize: 22, bold: true, color: "#20264b", alignment: "right" },
                { text: `${t.reference}: ${quoteNr}`, color: "#777", alignment: "right", margin: [0, 3, 0, 0] },
                { text: dateStr, color: "#777", alignment: "right" }
              ]
            }
          ],
          margin: [0, 0, 0, 26]
        },
        {
          columns: [
            { width: "50%", stack: [{ text: t.deliveryAddress, bold: true, fontSize: 12, margin: [0, 0, 0, 5] }, ...leveringLines] },
            { width: "50%", stack: [{ text: t.invoiceAddress, bold: true, fontSize: 12, margin: [0, 0, 0, 5] }, ...factuurLines] }
          ],
          margin: [0, 0, 0, 22]
        },
        {
          table: {
            headerRows: 1, widths: ["*", "*", "*"],
            body: [
              [th(t.document), th(t.date), th(t.vatNumber)],
              [td(quoteNr), td(dateStr), td(customerData.btw || "-")]
            ]
          },
          layout: infoLayout, margin: [0, 0, 0, 22]
        },
        {
          table: { headerRows: 1, widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto"], body: productBody },
          layout: tableLayout, margin: [0, 0, 0, 18]
        },
        {
          columns: [
            { width: "*", text: "" },
            { width: "auto", table: { body: totalsRows }, layout: "noBorders" }
          ]
        },
        vat.intracommunautair
          ? { text: t.intracom, italics: true, color: "#2e7d32", fontSize: 9, margin: [0, 16, 0, 0] }
          : { text: "" }
      ],
      images: { logo: logoBase64 },
      defaultStyle: { fontSize: 10, color: "#222" },
      footer: () => ({ text: "Klium N.V. · Ekkelgaarden 26 · 3500 Hasselt · België", alignment: "center", fontSize: 8, color: "#999", margin: [0, 20, 0, 0] })
    };
    window.pdfMake.createPdf(docDefinition).download(`${t.fileName}_${customerData.naam || "klant"}.pdf`);
  }

  // SAVE OFFERTE
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
      straat: customerData.straat,
      nummer: customerData.nummer,
      bus: customerData.bus,
      adres: streetLine(customerData),
      postcode: customerData.postcode,
      gemeente: customerData.gemeente,
      land: customerData.land,
      email: customerData.email,
      levering: sameDelivery ? null : {
        naam: deliveryData.naam,
        bedrijf: deliveryData.bedrijf,
        adres: streetLine(deliveryData),
        postcode: deliveryData.postcode,
        gemeente: deliveryData.gemeente,
        land: deliveryData.land
      },
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
    } catch {
      setSaveStatus("Netwerkfout bij opslaan offerte.");
    }
  }

  // UI
  const destCountry = sameDelivery ? customerData.land : deliveryData.land;
  const vat = computeVat(customerData.btw, destCountry);
  const customerExcl = totals.newPrice || 0;
  const customerBtw = customerExcl * vat.pct / 100;
  const customerIncl = customerExcl + customerBtw;
  return (
    <div style={{padding: 24, color: "white", width: "100%", maxWidth: 1700, margin: "0 auto", boxSizing: "border-box"}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
        <h1 style={{margin:0}}>Offerte Tool</h1>
        <button
          onClick={startNewOfferte}
          title="Wis alles en begin een nieuwe offerte"
          style={{padding:'10px 22px', borderRadius:8, border:'2px solid #0077cc', background:'#0077cc', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'1rem'}}
        >
          + Nieuwe offerte
        </button>
      </div>
      {/* Slimme import block */}
      <div style={{marginBottom: 25}}>
        <b>Slimme invoer (plak een offerteaanvraag):</b><br />
        <div style={{color:'#aaa', fontSize:'0.85em', margin:'4px 0 8px'}}>
          Herkent automatisch artikelnummers (bv. <code>art. 577743</code>), 8-cijferige SKU's en aantallen (bv. <code>2x</code>). Ook <code>SKU,aantal</code> per regel werkt.
        </div>
        <div style={{ display:'flex', border:'1px solid #444', borderRadius:6, overflow:'hidden', width:640, height:170, maxWidth:'100%', minWidth:340, minHeight:110, resize:'both', background:'#1a1a1a', marginTop:4 }}>
          <div
            ref={gutterRef}
            style={{ padding:'8px 6px', textAlign:'right', color:'#666', background:'#141414', fontSize:'1rem', lineHeight:'22px', fontFamily:'monospace', userSelect:'none', overflow:'hidden', minWidth:34, whiteSpace:'pre' }}
          >
            {Array.from({ length: Math.max(batchInput.split(/\n/).length, 1) }, (_, i) => i + 1).join('\n')}
          </div>
          <textarea
            placeholder={"Plak hier de volledige aanvraag, bijvoorbeeld:\n1x Festool TSV 60 KEBQ-Plus-FS (art. 577743)\n2x Festool FSV/2 – Verbindingsstukken (art. 577043)\n08103692, 5"}
            value={batchInput}
            ref={batchRef}
            onChange={e => setBatchInput(e.target.value)}
            onScroll={e => { if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop; }}
            wrap="off"
            style={{ flex:1, height:'100%', border:'none', outline:'none', resize:'none', background:'transparent', color:'white', fontSize:'1rem', lineHeight:'22px', padding:8, whiteSpace:'pre', overflow:'auto', fontFamily:'inherit' }}
          />
        </div>
        <div style={{color:'#888', fontSize:'0.8em', marginTop:4}}>
          Tip: sleep de rechteronderhoek om het vak groter te maken. Lange regels uit een PDF kan je zo volledig zien.
        </div>
        <div style={{marginTop:10, display:'flex', gap:12, flexWrap:'wrap'}}>
          <button style={{padding:'8px 18px', borderRadius:6, background:'#0077cc', color:'white', border:'none', fontWeight:600, cursor:'pointer'}} onClick={handleSmartImport} disabled={importLoading}>
            {importLoading ? 'Bezig met herkennen…' : 'Slim herkennen'}
          </button>
          <button style={{padding:'8px 18px', borderRadius:6}} onClick={handleBatchImport} title="Voeg regels toe zonder opzoeken (SKU,aantal)">Direct toevoegen</button>
        </div>

        {importResult && (
          <div style={{marginTop: 14, background:'#1e1e1e', padding:18, borderRadius:12, maxWidth:900, boxShadow:'0 2px 18px #000a'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
              <b style={{fontSize:'1.05em'}}>Resultaat slimme import</b>
              <button onClick={() => setImportResult(null)} style={{background:'none', border:'none', color:'white', fontSize:'1.3em', cursor:'pointer'}} title="Sluiten">&#10005;</button>
            </div>

            {/* Samenvattingsbalk */}
            <div style={{display:'flex', gap:10, flexWrap:'wrap', marginBottom:16}}>
              <span style={{background:'#173d20', color:'#7ee08a', border:'1px solid #2e7d32', borderRadius:20, padding:'5px 14px', fontWeight:700, fontSize:'0.9em'}}>
                ✓ {importResult.resolved.length} herkend
              </span>
              <span style={{background:'#3d3413', color:'#ffd166', border:'1px solid #b8860b', borderRadius:20, padding:'5px 14px', fontWeight:700, fontSize:'0.9em', opacity: importResult.ambiguous.length ? 1 : 0.4}}>
                ⚠ {importResult.ambiguous.length} keuze nodig
              </span>
              <span style={{background:'#3d1717', color:'#ff9b9b', border:'1px solid #c0392b', borderRadius:20, padding:'5px 14px', fontWeight:700, fontSize:'0.9em', opacity: importResult.unresolved.length ? 1 : 0.4}}>
                ✗ {importResult.unresolved.length} niet gevonden
              </span>
              {importResult.unrecognized.length > 0 && (
                <span style={{background:'#2a2a2a', color:'#bbb', border:'1px solid #555', borderRadius:20, padding:'5px 14px', fontWeight:700, fontSize:'0.9em'}}>
                  ? {importResult.unrecognized.length} geen referentie
                </span>
              )}
              <span style={{color:'#888', fontSize:'0.9em', alignSelf:'center'}}>
                ({importResult.parsedCount} regels geplakt)
              </span>
            </div>

            {importResult.truncated && (
              <div style={{background:'#3d3413', color:'#ffd166', border:'1px solid #b8860b', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:'0.9em'}}>
                ⚠ Te veel regels in één keer — enkel de eerste 300 referenties zijn verwerkt. Splits de lijst op en importeer in delen.
              </div>
            )}

            {importResult.resolved.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{color:'#7ee08a', fontWeight:700, marginBottom:6}}>✓ Herkend</div>
                <ul style={{listStyle:'none', padding:0, margin:0}}>
                  {importResult.resolved.map((r, i) => {
                    const conf = typeof r.confidence === 'number' ? r.confidence : 100;
                    const confColor = conf >= 90 ? '#7ee08a' : conf >= 75 ? '#ffd166' : '#ff9b9b';
                    const confBg = conf >= 90 ? '#173d20' : conf >= 75 ? '#3d3413' : '#3d1717';
                    return (
                    <li key={r.sku + i} style={{display:'grid', gridTemplateColumns:'46px 92px 130px 1fr 58px', gap:10, alignItems:'center', padding:'7px 0', borderBottom:'1px solid #2a2a2a'}}>
                      <span style={{color:'#7ee08a', fontWeight:700}}>{r.amount}×</span>
                      <span style={{fontWeight:700}}>{r.sku}</span>
                      <span style={{background:'#2a2a2a', color:'#aaa', borderRadius:5, padding:'2px 8px', fontSize:'0.82em', textAlign:'center', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={`Gezocht op: ${r.ref}`}>{r.matchType === 'sku' ? 'via SKU' : `art. ${r.ref}`}</span>
                      <span style={{overflowWrap:'anywhere'}}>{r.name || <em style={{color:'#888'}}>geen naam</em>}</span>
                      <span
                        style={{background:confBg, color:confColor, borderRadius:20, padding:'2px 6px', fontSize:'0.8em', fontWeight:700, textAlign:'center'}}
                        title={conf === 100 ? 'Exacte match op SKU of leveranciersreferentie' : 'Slimme match op basis van referentie en omschrijving — controleer bij twijfel'}
                      >
                        {conf}%
                      </span>
                    </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {importResult.ambiguous.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{color:'#ffd166', fontWeight:700, marginBottom:6}}>⚠ Keuze nodig — meerdere producten matchen deze referentie</div>
                {importResult.ambiguous.map((a, i) =>
                  <div key={a.ref + i} style={{marginBottom:10, padding:'8px 10px', background:'#241f10', borderRadius:8}}>
                    <div style={{color:'#ffd166', marginBottom:6, fontWeight:600, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                      <span>{a.amount}× &nbsp;referentie “{a.ref}”</span>
                      {a.brand && <span style={{color:'#aaa', fontWeight:400, fontSize:'0.85em'}}>merk gevraagd: {a.brand}</span>}
                      {renderLineRef(a.line)}
                    </div>
                    {a.candidates.map(c =>
                      <div key={c.sku} style={{display:'grid', gridTemplateColumns:'100px 1fr 80px', gap:10, alignItems:'center', padding:'4px 0', background: c.recommended ? '#1c2e14' : 'transparent', borderRadius:6}}>
                        <span style={{fontWeight:700, paddingLeft: c.recommended ? 6 : 0}}>{c.sku}</span>
                        <span style={{overflowWrap:'anywhere'}}>
                          {c.name}
                          {c.recommended && <span style={{color:'#7ee08a', fontSize:'0.8em', marginLeft:8, fontWeight:700}}>✓ merk match</span>}
                        </span>
                        <button style={{padding:'3px 10px', borderRadius:6, border: c.recommended ? '2px solid #4caf50' : '2px solid #0077cc', background:'white', color: c.recommended ? '#2e7d32' : '#0077cc', fontWeight:600, cursor:'pointer'}} onClick={() => addCandidateRow(c.sku, a.amount, c.name)}>Kies</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {importResult.unresolved.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{color:'#ff9b9b', fontWeight:700, marginBottom:6}}>✗ Niet gevonden — geen product met deze referentie (handmatig nakijken)</div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  {importResult.unresolved.map((u, i) =>
                    <span key={u.ref + i} style={{background:'#3d1717', color:'#ff9b9b', border:'1px solid #c0392b', borderRadius:6, padding:'4px 10px', fontSize:'0.9em', display:'inline-flex', alignItems:'center', gap:8}}>
                      {u.amount}× {u.ref} {renderLineRef(u.line)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {importResult.unrecognized.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{color:'#bbb', fontWeight:700, marginBottom:6}}>? Geen referentie herkend — geen artikelnummer of SKU in deze regel</div>
                <div style={{display:'flex', flexDirection:'column', gap:6}}>
                  {importResult.unrecognized.map((u, i) =>
                    <span key={i} style={{background:'#242424', color:'#ccc', border:'1px solid #555', borderRadius:6, padding:'5px 10px', fontSize:'0.9em', display:'inline-flex', alignItems:'center', gap:10, justifyContent:'space-between'}}>
                      <span style={{overflowWrap:'anywhere'}}>{u.raw}</span>
                      {renderLineRef(u.line)}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', borderTop:'1px solid #333', paddingTop:14}}>
              {importResult.resolved.length > 0 ? (
                <button onClick={addResolvedRows} style={{padding:'10px 22px', borderRadius:7, background:'#4caf50', color:'white', border:'none', fontWeight:700, cursor:'pointer'}}>
                  ✓ {importResult.resolved.length} herkend product(en) toevoegen
                </button>
              ) : (
                <span style={{color:'#888'}}>Geen producten om toe te voegen — maak eerst een keuze hierboven.</span>
              )}
              <button onClick={() => setImportResult(null)} style={{padding:'10px 18px', borderRadius:7, background:'none', border:'1px solid #555', color:'#ccc', cursor:'pointer'}}>
                Sluiten
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Product search block */}
      <div style={{marginBottom: 25}}>
        <b>Zoek op product (SupRef of Naam):</b><br />
        <input
          placeholder="SupRef of Naam"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{ width: 280, marginTop: 10, marginRight: 8, padding:8, borderRadius:6 }}
        />
        <button style={{marginRight:16, padding:'8px 18px', borderRadius:6}} onClick={handleProductSearch} disabled={loadingSearch}>Zoek en voeg toe</button>
        {searchResults.length > 0 && (
          <div style={{marginTop: 6, background:'#222', padding:20, borderRadius:14, color:'white', maxWidth:900, minWidth:600, position:'relative', boxShadow:'0 2px 18px #000a'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
              <b>Gevonden producten:</b>
              <button
                onClick={() => { setSearchResults([]); setTooManyResults(false); }}
                style={{background:'none', border:'none', color:'white', fontSize:'1.4em', fontWeight:'bold', cursor:'pointer', padding:'0 8px'}}
                title="Sluit suggestielijst"
              >
                &#10005;
              </button>
            </div>
            {tooManyResults && (
              <div style={{color:'#ffb300', fontWeight:600, marginBottom:8}}>
                Te veel resultaten (max. 20), verfijn je zoekactie en probeer opnieuw.
              </div>
            )}
            <ul style={{paddingLeft:0, margin:0}}>
              {searchResults.map(r =>
                <li key={r.sku} style={{marginBottom:8, listStyle:'none', display:'grid', gridTemplateColumns:'110px 140px 1fr 110px', alignItems:'start', gap:'10px', padding:'10px 0', borderBottom:'1px solid #333'}}>
                  <span style={{fontWeight:700, minWidth:90, wordBreak:'break-word'}}>{r.sku}</span>
                  <span style={{minWidth:90, wordBreak:'break-word'}}>{r.supref}</span>
                  <span style={{whiteSpace:'pre-line', wordBreak:'break-word', lineHeight:'1.3', maxWidth:600, overflowWrap:'anywhere', minHeight:'1em'}}>{r.name}</span>
                  <button style={{padding:'2px 12px', fontSize:'0.95em', borderRadius:6, border:'2px solid #0077cc', background:'white', color:'#0077cc', fontWeight:600, cursor:'pointer', height:'fit-content'}} onClick={() => handleAddSearchRow(r.sku)}>
                    Toevoegen
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      {/* SKU/amount row input block */}
      <b>SKUs en aantallen invoeren:</b>
      <div>
        {rows.map((row, idx) => {
          const nameKey = (row.sku || "").trim();
          const nameVal = skuNames[nameKey];
          return (
          <div key={idx} style={{display:"flex",gap:16,marginBottom:10, alignItems:"center", flexWrap:"wrap"}}>
            <input
              value={row.sku}
              onChange={e => updateRow(idx, "sku", e.target.value)}
              onBlur={e => lookupSkuName(e.target.value)}
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
            <span style={{fontSize:"0.9em", minWidth:200, flex:1}}>
              {nameVal === false && <span style={{color:"#888"}}>zoeken…</span>}
              {nameVal === null && <span style={{color:"#e57373"}}>SKU niet gevonden</span>}
              {typeof nameVal === "string" && <span style={{color:"#81c784"}}>{nameVal}</span>}
            </span>
          </div>
          );
        })}
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
        <span style={{ marginLeft: 18, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#ccc", fontSize: "0.95rem" }}>Taal document:</span>
          <select
            value={docLang}
            onChange={e => setDocLang(e.target.value)}
            title="Taal van de offerte (PDF/Excel)"
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #555", background: "#222", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            <option value="nl">Nederlands</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </span>
      </div>
      {hasFetchedProducts && missingSkus.length > 0 && (
        <div style={{color: "#e53935", fontWeight: 600, margin: "18px 0"}}>
          Niet gevonden: {missingSkus.join(", ")}. Controleer je invoer.
        </div>
      )}
      {hasFetchedProducts && products.length === 0 && (
        <div style={{color: "#e53935", fontWeight: 600, margin: "18px 0"}}>
          Geen producten gevonden voor de opgegeven SKU(s). Controleer je invoer.
        </div>
      )}
      {/* Offerte producten en totalen */}
      {products.length > 0 && (
        <>
          <div style={{width: "100%"}}>
            <table className="quote-products-table" style={{width:"100%",background:"#161b25",borderRadius:10, tableLayout:"fixed", border:"1px solid #2c3240"}}>
            <colgroup>
              {columns.map(col => (
                <col key={col.key} style={{ width: colWidths[col.key] || "auto" }} />
              ))}
              <col style={{ width: "76px" }} />
            </colgroup>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} style={{padding:"8px 6px",color:"#fff",fontSize:"0.9rem",whiteSpace:"normal",textAlign:["Price","Discount","Discount%","Cost","M€","M%","mpp","givenDiscount"].includes(col.key)?"right":"left",borderTop:"1px solid #2c3240",borderBottom:"1px solid #2c3240"}}>{col.label}</th>
                ))}
                <th style={{borderTop:"1px solid #2c3240",borderBottom:"1px solid #2c3240"}}></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i}>
                  {columns.map(col => {
                    if (col.key === "amount") {
                      return (
                        <td key={col.key} style={{padding:"6px",color:"#eee", textAlign:"center"}}>
                          <input
                            type="number"
                            min={1}
                            value={p.amount}
                            onChange={e => {
                              const val = e.target.value;
                              setProducts(products => products.map((prod, idx) => idx === i ? { ...prod, amount: val === "" ? "" : Math.max(1, Math.floor(Number(val)) || 1) } : prod));
                            }}
                            onBlur={e => {
                              const num = Math.max(1, Math.floor(Number(e.target.value)) || 1);
                              setProducts(products => products.map((prod, idx) => idx === i ? { ...prod, amount: num } : prod));
                            }}
                            style={{width: 56, textAlign: "center", padding: "4px 6px", borderRadius: 4, border: "1px solid #aaa"}}
                          />
                        </td>
                      );
                    }
                    if (col.key === "proposal") {
                      return (
                        <td key={col.key} style={{padding:"5px",color:"#eee", textAlign:"right"}}>
                          <input
                            ref={el => proposalRefs.current[p.SKU] = el}
                            type="number"
                            step="1"
                            value={proposalInputBuffer[p.SKU] !== undefined ? proposalInputBuffer[p.SKU] : fmt(p.proposal)}
                            onChange={e => handleProposalInput(p.SKU, e.target.value)}
                            onBlur={e => confirmProposal(p.SKU, e.target.value)}
                            onKeyDown={e => handleProposalKeyDown(e, p.SKU)}
                            style={{width:86,padding:"4px 6px",borderRadius:4,border:"1px solid #aaa",fontSize:"0.9em"}}
                          />
                        </td>
                      );
                    }
                    if (col.key === "Price") {
                      return (
                        <td key={col.key} style={{padding:"5px",color:"#eee", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric:"tabular-nums", fontSize:"0.92em"}}>
                          {typeof p[col.key] === "number" ? `€ ${fmt(p[col.key])}` : p[col.key]}
                        </td>
                      );
                    }
                    if (col.key === "LeadTimeLabel") {
                      const d = deliveryInfo(p);
                      return (
                        <td key={col.key} style={{padding:"6px",color:"#eee", fontSize: "0.82em", lineHeight: 1.2, verticalAlign:"top"}}>
                          <div style={{display:'flex', flexDirection:'column', gap:4}}>
                            <span style={{display:'inline-block', alignSelf:'flex-start', background:d.badge.bg, color:d.badge.fg, border:'1px solid #555', borderRadius:12, padding:'1px 8px', fontSize:'0.78em', fontWeight:700}}>{d.badge.text}</span>
                            <span>{d.short}</span>
                          </div>
                        </td>
                      );
                    }
                    if (col.key === "mpp") {
                      let proposalVal = proposalInputBuffer[p.SKU] !== undefined && !isNaN(Number(proposalInputBuffer[p.SKU]))
                        ? Number(proposalInputBuffer[p.SKU])
                        : p.proposal;
                      let mpp = (proposalVal && p.Cost) ? ((proposalVal - p.Cost) / proposalVal) * 100 : 0;
                      return <td key={col.key} style={{padding:"5px",color:"#eee", textAlign:"right", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums", fontSize:"0.92em"}}>{fmt(mpp)}%</td>;
                    }
                    if (col.key === "givenDiscount") {
                      let proposalVal = proposalInputBuffer[p.SKU] !== undefined && !isNaN(Number(proposalInputBuffer[p.SKU]))
                        ? Number(proposalInputBuffer[p.SKU])
                        : p.proposal;
                      const price = Number(p.Price) || 0;
                      const given = price > 0 ? ((price - Number(proposalVal)) / price) * 100 : 0;
                      const color = given > 0.001 ? "#ffb74d" : given < -0.001 ? "#81c784" : "#eee";
                      return <td key={col.key} style={{padding:"5px", color, fontWeight: Math.abs(given) > 0.001 ? 700 : 400, whiteSpace:"nowrap", textAlign:"right", fontVariantNumeric:"tabular-nums", fontSize:"0.92em"}}>{fmt(given)}%</td>;
                    }
                    if (col.key === "Name") {
                      return (
                        <td key={col.key} style={{padding:"5px",color:"#eee", fontSize:"0.92em", lineHeight:1.2, verticalAlign:"top"}}>
                          <div style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            overflowWrap: "anywhere"
                          }} className="quote-name-cell" title={p[col.key] || ""}>
                            {p[col.key]}
                            <span className="quote-name-tooltip">{p[col.key] || ""}</span>
                          </div>
                        </td>
                      );
                    }
                    if (["Discount","Discount%","Cost","M€","M%"].includes(col.key)) {
                      const val = typeof p[col.key] === "number" ? fmt(p[col.key]) : p[col.key];
                      return (
                        <td key={col.key} style={{padding:"5px",color:"#eee", textAlign:"right", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums", fontSize:"0.92em"}}>
                          {val}
                        </td>
                      );
                    }
                    return (
                      <td key={col.key} style={{padding:"6px",color:"#eee", fontSize:"0.9em"}}>
                        {typeof p[col.key] === "number"
                          ? fmt(p[col.key])
                          : p[col.key]}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "center", position: "relative", padding:"4px", width:76 }}>
                    <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:8}}>
                      <span
                        style={{
                          cursor: "pointer",
                          fontSize: "1.2em",
                          marginLeft: 0
                        }}
                        onMouseEnter={e => {
                          setHoveredRow(i);
                          setTooltipPosition(getSafeTooltipPosition(e.clientX, e.clientY, { width: 360, height: 340 }));
                        }}
                        onMouseLeave={() => setHoveredRow(null)}
                        title="Info"
                      >
                        ℹ️
                      </span>
                      <button
                        style={{
                          background: "none",
                          border: "none",
                          color: "#e53935",
                          fontSize: "1.55em",
                          lineHeight: 1,
                          width: 28,
                          height: 28,
                          cursor: "pointer",
                          padding: 0
                        }}
                        title="Verwijder regel"
                        onClick={() => {
                          setProducts(products => products.filter((_, idx) => idx !== i));
                        }}
                      >
                        &#10060;
                      </button>
                    </div>
                    {hoveredRow === i && (
                      <div
                        style={{
                          position: "fixed",
                          left: tooltipPosition.x,
                          top: tooltipPosition.y,
                          minWidth: 220,
                          maxWidth: 350,
                          maxHeight: 340,
                          overflowY: "auto",
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
          </div>
          {/* Totalen/offerte */}
          <h3 style={{ marginTop: 36 }}>Totalen/offerte</h3>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:24, margin:'0 0 24px', width:'100%'}}>
            {/* Globale korting */}
            <div style={{background:'#fff', border:'1px solid #e3e8ee', borderRadius:16, padding:20, color:'#222', minWidth:0}}>
              <div style={{fontWeight:700, marginBottom:10}}>Globale korting</div>
              <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                <input type="number" min={0} step="0.5" value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  placeholder="bv. 5"
                  style={{width:90, padding:'8px 10px', borderRadius:6, border:'1px solid #ccc'}} />
                <select value={discountMode} onChange={e => setDiscountMode(e.target.value)}
                  style={{padding:'8px 10px', borderRadius:6, border:'1px solid #ccc'}}>
                  <option value="pct">%</option>
                  <option value="eur">€ totaal</option>
                </select>
                <button onClick={applyGlobalDiscount} style={{padding:'8px 16px', borderRadius:6, background:'#0077cc', color:'#fff', border:'none', fontWeight:700, cursor:'pointer'}}>Toepassen</button>
                <button onClick={resetPrices} style={{padding:'8px 16px', borderRadius:6, background:'#eee', color:'#333', border:'1px solid #ccc', cursor:'pointer'}}>Reset prijzen</button>
              </div>
              <div style={{fontSize:'0.85em', color:'#666', marginTop:8}}>
                Verdeeld naar rato van de marge: producten met de hoogste marge dragen het meeste van de korting. Marge blijft altijd ≥ 0.
              </div>
              {discountNote && <div style={{color:'#e57373', fontSize:'0.85em', marginTop:6}}>{discountNote}</div>}
            </div>
            {/* Klanttotaal met btw */}
            <div style={{background:'#fff', border:'1px solid #e3e8ee', borderRadius:16, padding:20, color:'#222', minWidth:0}}>
              <div style={{fontWeight:700, marginBottom:10}}>Offertetotaal (klant)</div>
              <div style={{display:'flex', justifyContent:'space-between', padding:'4px 0'}}><span>Totaal excl. btw</span><b>€ {fmt(customerExcl)}</b></div>
              <div style={{display:'flex', justifyContent:'space-between', padding:'4px 0'}}><span>BTW ({vat.pct}%)</span><b>€ {fmt(customerBtw)}</b></div>
              <div style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderTop:'1px solid #e3e8ee', fontSize:'1.1em'}}><span>Totaal</span><b>€ {fmt(customerIncl)}</b></div>
              <div style={{fontSize:'0.85em', color: vat.intracommunautair ? '#2e7d32' : '#666', marginTop:8}}>{vat.label}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 24, alignItems: "stretch", marginTop: 0, width: "100%" }}>
            <div style={{ minWidth: 0, display: "flex", alignItems: "stretch" }}>
              <div style={{
                background: "#f6f8fa",
                boxShadow: "0 4px 18px rgba(0,0,0,0.13)",
                borderRadius: 24,
                padding: 32,
                width: "100%",
                border: "1px solid #e3e8ee",
                fontSize: "1.12rem",
                color: "#222",
                minHeight: 370,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0px 18px"
              }}>
                <div style={{ gridColumn: "1 / span 2", marginBottom: 18, display: "flex", gap: "16px", justifyContent: "center", width: "100%", flexWrap: "wrap" }}>
                  <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "none", border: "1px solid #e3e8ee", padding: "24px 24px", minWidth: "200px", flex: 1, textAlign: "center", boxSizing: "border-box" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 2 }}>Current Price</div>
                    <div style={{ fontWeight: 700, fontSize: "2.1rem", color: "#222" }}>
                      € {fmt(totals.currentPrice)}
                    </div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "none", border: "1px solid #e3e8ee", padding: "24px 24px", minWidth: "200px", flex: 1, textAlign: "center", boxSizing: "border-box" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 2 }}>New Price</div>
                    <div style={{ fontWeight: 700, fontSize: "2.1rem", color: "#222" }}>
                      € {fmt(totals.newPrice)}
                    </div>
                  </div>
                </div>
                <div style={{ gridColumn: "1 / span 2", marginBottom: 18, display: "flex", gap: "16px", justifyContent: "center", width: "100%", flexWrap: "wrap" }}>
                  <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "none", border: "1px solid #e3e8ee", padding: "24px 24px", minWidth: "200px", flex: 1, textAlign: "center", boxSizing: "border-box" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 2 }}>Current Profit</div>
                    <div style={{ fontWeight: 700, fontSize: "2.1rem", color: "#222" }}>
                      € {fmt(totals.currentProfit)}
                    </div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "none", border: "1px solid #e3e8ee", padding: "24px 24px", minWidth: "200px", flex: 1, textAlign: "center", boxSizing: "border-box" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 2 }}>New Profit</div>
                    <div style={{ fontWeight: 700, fontSize: "2.1rem", color: "#222" }}>
                      € {fmt(totals.newProfit)}
                    </div>
                  </div>
                </div>
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
                            if (cdcTooltipTimer) clearTimeout(cdcTooltipTimer);
                            setHoveredRow("cdc-uitleg");
                            const rect = e.target.getBoundingClientRect();
                            setTooltipPosition(getSafeTooltipPosition(rect.right, rect.top, { width: 420, height: 340, offset: 10 }));
                          }}
                          onMouseLeave={e => {
                            const timer = setTimeout(() => setHoveredRow(null), 200);
                            setCdcTooltipTimer(timer);
                          }}
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
                          className="cdc-tooltip"
                          style={{
                            position: "fixed",
                            left: tooltipPosition.x,
                            top: tooltipPosition.y,
                            minWidth: 220,
                            maxWidth: 400,
                            maxHeight: 340,
                            overflowY: "auto",
                            background: "#222",
                            color: "#fff",
                            borderRadius: 10,
                            padding: "16px 20px",
                            boxShadow: "0 2px 14px rgba(0,0,0,0.22)",
                            zIndex: 9999,
                            fontSize: "1.05em",
                            textAlign: "left",
                            pointerEvents: "auto"
                          }}
                          onMouseEnter={() => {
                            if (cdcTooltipTimer) clearTimeout(cdcTooltipTimer);
                            setHoveredRow("cdc-uitleg");
                          }}
                          onMouseLeave={() => {
                            const timer = setTimeout(() => setHoveredRow(null), 200);
                            setCdcTooltipTimer(timer);
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>
                            CDC per regel: -{fmt(totals?.cdcSummary?.lineCost || 5.33)} euro
                          </div>
                          {totals.cdcSummary && (
                            <div style={{ marginBottom: 8, color: "#d5d8e0", fontSize: "0.95em" }}>
                              {totals.cdcSummary.skuCount} SKU(s) met CDC · {totals.cdcSummary.voorraadLines} voorraadlijn(en) · {totals.cdcSummary.backorderLines} backorderlijn(en)
                            </div>
                          )}
                          {totals.cdcRows && totals.cdcRows.length > 0 && (
                            <div style={{ border: "1px solid #3b3f56", borderRadius: 8, overflow: "hidden" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "86px 1fr 84px 98px", background: "#2d3146", fontWeight: 700, fontSize: "0.9em", padding: "7px 10px" }}>
                                <span>SKU</span>
                                <span>Verdeling</span>
                                <span style={{ textAlign: "center" }}>Lijnen</span>
                                <span style={{ textAlign: "right" }}>CDC</span>
                              </div>
                              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                                {totals.cdcRows.map((r, i) => (
                                  <div key={r.sku + i} style={{ display: "grid", gridTemplateColumns: "86px 1fr 84px 98px", padding: "7px 10px", borderTop: i === 0 ? "none" : "1px solid #33374d", fontSize: "0.92em", alignItems: "center" }}>
                                    <span style={{ fontWeight: 700 }}>{r.sku}</span>
                                    <span>
                                      {r.inStock > 0 && <span style={{ color: "#81c784" }}>{r.inStock} voorraad</span>}
                                      {r.inStock > 0 && r.backOrder > 0 && <span style={{ color: "#aaa" }}> + </span>}
                                      {r.backOrder > 0 && <span style={{ color: "#ffcc80" }}>{r.backOrder} backorder</span>}
                                    </span>
                                    <span style={{ textAlign: "center" }}>{r.cdcLines}</span>
                                    <span style={{ textAlign: "right", fontWeight: 700 }}>{fmt(r.cdcValue)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, padding: 0, color: '#222' }}>Klantgegevens</h3>
              <form style={{ background: "#ffffffff", boxShadow: "0 2px 10px rgba(0,0,0,0.10)", borderRadius: 16, padding: 26, border: "1px solid #eee", fontSize: "1.06rem", color: "#222", display: "flex", flexDirection: "column", justifyContent: "flex-start", marginTop: 0 }}>
                <div style={{ fontWeight: 700, color: "#20264b", marginBottom: 10, fontSize: "1.05rem" }}>Factuurgegevens</div>
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
                  <input type="text" value={customerData.btw} onChange={e => setCustomerData({ ...customerData, btw: e.target.value })} placeholder="bv. BE0123456789" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                </div>
                <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 3 }}>
                    <label><b>Straat:</b></label><br />
                    <input type="text" value={customerData.straat} onChange={e => setCustomerData({ ...customerData, straat: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label><b>Nr:</b></label><br />
                    <input type="text" value={customerData.nummer} onChange={e => setCustomerData({ ...customerData, nummer: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label><b>Bus:</b></label><br />
                    <input type="text" value={customerData.bus} onChange={e => setCustomerData({ ...customerData, bus: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
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
                  <select value={customerData.land} onChange={e => setCustomerData({ ...customerData, land: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc", background: "#fff", color: "#222" }}>
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code} style={{ color: "#222", background: "#fff" }}>{c.nl}{c.eu ? ` — ${c.vat}%` : " — buiten EU"}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label><b>E-mail:</b></label><br />
                  <input type="email" value={customerData.email} onChange={e => setCustomerData({ ...customerData, email: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                </div>
                <div style={{ background: vat.intracommunautair || vat.isExport ? "#e8f5e9" : "#eef1f8", border: "1px solid " + (vat.intracommunautair || vat.isExport ? "#a5d6a7" : "#c5cbe0"), borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: "0.92rem" }}>
                  <b>BTW-regeling:</b>{" "}
                  {vat.intracommunautair
                    ? "0% — intracommunautaire levering (btw verlegd)"
                    : vat.isExport
                      ? "0% — export buiten EU"
                      : `${vat.pct}% btw (${vat.code})`}
                  {!sameDelivery && <span style={{ color: "#666" }}> · o.b.v. leveringsland</span>}
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: sameDelivery ? 6 : 12, cursor: "pointer", fontWeight: 600 }}>
                  <input type="checkbox" checked={!sameDelivery} onChange={e => setSameDelivery(!e.target.checked)} style={{ width: 18, height: 18 }} />
                  Ander leveradres
                </label>

                {!sameDelivery && (
                  <div style={{ borderTop: "1px dashed #ddd", paddingTop: 14, marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, color: "#20264b", marginBottom: 10, fontSize: "1.05rem" }}>Leveringsadres</div>
                    <div style={{ marginBottom: 12 }}>
                      <label><b>Naam / t.a.v.:</b></label><br />
                      <input type="text" value={deliveryData.naam} onChange={e => setDeliveryData({ ...deliveryData, naam: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label><b>Bedrijf:</b></label><br />
                      <input type="text" value={deliveryData.bedrijf} onChange={e => setDeliveryData({ ...deliveryData, bedrijf: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                    </div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 3 }}>
                        <label><b>Straat:</b></label><br />
                        <input type="text" value={deliveryData.straat} onChange={e => setDeliveryData({ ...deliveryData, straat: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label><b>Nr:</b></label><br />
                        <input type="text" value={deliveryData.nummer} onChange={e => setDeliveryData({ ...deliveryData, nummer: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label><b>Bus:</b></label><br />
                        <input type="text" value={deliveryData.bus} onChange={e => setDeliveryData({ ...deliveryData, bus: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1 }}>
                        <label><b>Postcode:</b></label><br />
                        <input type="text" value={deliveryData.postcode} onChange={e => setDeliveryData({ ...deliveryData, postcode: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                      </div>
                      <div style={{ flex: 2 }}>
                        <label><b>Gemeente:</b></label><br />
                        <input type="text" value={deliveryData.gemeente} onChange={e => setDeliveryData({ ...deliveryData, gemeente: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <label><b>Land:</b></label><br />
                      <select value={deliveryData.land} onChange={e => setDeliveryData({ ...deliveryData, land: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc", background: "#fff", color: "#222" }}>
                        {COUNTRIES.map(c => (
                          <option key={c.code} value={c.code} style={{ color: "#222", background: "#fff" }}>{c.nl}{c.eu ? ` — ${c.vat}%` : " — buiten EU"}</option>
                        ))}
                      </select>
                      <div style={{ color: "#666", fontSize: "0.82rem", marginTop: 4 }}>Het btw-tarief wordt bepaald op basis van het leveringsland.</div>
                    </div>
                  </div>
                )}

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
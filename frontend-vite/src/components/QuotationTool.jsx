import React, { useState, useEffect, useMemo, useRef } from "react";
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
    customer: "Klant", company: "Bedrijf", email: "E-mail", price: "Prijs (excl. btw)",
    remark: "Opmerking"
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
    customer: "Client", company: "Société", email: "E-mail", price: "Prix (hors TVA)",
    remark: "Remarque"
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
    customer: "Customer", company: "Company", email: "Email", price: "Price (excl. VAT)",
    remark: "Remark"
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

function splitAddressLine(address) {
  const raw = String(address || "").trim();
  if (!raw) return { straat: "", nummer: "", bus: "" };

  const busMatch = raw.match(/\b(?:bus|bte|box)\s+(.+)$/i);
  const bus = busMatch ? busMatch[1].trim() : "";
  const core = busMatch ? raw.slice(0, busMatch.index).trim() : raw;

  const numberMatch = core.match(/^(.*?)(?:\s+(\d+[A-Za-z]?|\d+\/\d+[A-Za-z]?))$/);
  if (!numberMatch || !numberMatch[1].trim()) {
    return { straat: core, nummer: "", bus };
  }

  return {
    straat: numberMatch[1].trim(),
    nummer: numberMatch[2].trim(),
    bus
  };
}

function splitInternalSections(text) {
  const raw = String(text || '').trim();
  if (!raw) return { manual: '', generated: '' };
  const markers = ['\n\nSlimme import opvolging:', '\n\nOpen importregels bij opslaan:'];
  let cutIndex = raw.length;
  for (const marker of markers) {
    const idx = raw.indexOf(marker);
    if (idx >= 0) cutIndex = Math.min(cutIndex, idx);
  }
  if (cutIndex === raw.length) {
    if (raw.startsWith('Slimme import opvolging:') || raw.startsWith('Open importregels bij opslaan:')) {
      return {
        manual: '',
        generated: raw.includes('[object Object]') ? '' : raw
      };
    }
    return { manual: raw, generated: '' };
  }
  const generated = raw.slice(cutIndex).trim();
  return {
    manual: raw.slice(0, cutIndex).trim(),
    generated: generated.includes('[object Object]') ? '' : generated
  };
}

export default function QuotationTool({ onOfferteSaved, offerteData, onOffertePrefillDone }) {
  const CDC_LINE_COST = 5.33;
  const PCT_ZERO_EPSILON = 0.015;
  const fmt = (val, decimals = 2) => {
    if (val === undefined || val === null || val === "") return "";
    let num = Number(val);
    if (isNaN(num)) return val;
    return num.toFixed(decimals);
  };

  const normalizePct = (val, epsilon = PCT_ZERO_EPSILON) => {
    const num = Number(val);
    if (!Number.isFinite(num)) return val;
    return Math.abs(num) < epsilon ? 0 : num;
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
  const prefillDoneCallbackRef = useRef(onOffertePrefillDone);
  const batchRef = useRef(null);
  const gutterRef = useRef(null);
  const [batchInput, setBatchInput] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [showOnlyOpenImport, setShowOnlyOpenImport] = useState(false);
  const [openManualSku, setOpenManualSku] = useState({});
  const [openItemSuggestions, setOpenItemSuggestions] = useState({});
  const [openItemSuggestionStatus, setOpenItemSuggestionStatus] = useState({});
  const [importAuditNotes, setImportAuditNotes] = useState([]);
  const [internalComment, setInternalComment] = useState("");
  const [zichtbareNota, setZichtbareNota] = useState("");
  const [shippingCost, setShippingCost] = useState(""); // verzendkosten (excl. btw)
  const [savedGeneratedComment, setSavedGeneratedComment] = useState("");
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
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [tableMode, setTableMode] = useState("compact");
  const [articleSearch, setArticleSearch] = useState("");
  const [articleStatusFilter, setArticleStatusFilter] = useState("all");
  const [articleSortBy, setArticleSortBy] = useState("input-order");
  const [quickAddSku, setQuickAddSku] = useState("");
  const [quickAddAmount, setQuickAddAmount] = useState(1);
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  useEffect(() => {
    prefillDoneCallbackRef.current = onOffertePrefillDone;
  }, [onOffertePrefillDone]);

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

  const compactHiddenColumns = new Set(["Discount", "Discount%", "Cost", "M€", "M%"]);
  const visibleColumns = useMemo(
    () => columns.filter((col) => tableMode === "extended" || !compactHiddenColumns.has(col.key)),
    [tableMode]
  );

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

  const compactColWidths = {
    SKU: "8%",
    amount: "7%",
    SUPPLIER_REFERENCE: "10%",
    Name: "36%",
    LeadTimeLabel: "12%",
    Price: "7%",
    proposal: "8%",
    mpp: "6%",
    givenDiscount: "8%"
  };

  const getColumnWidth = (key) => {
    if (tableMode === "compact" && compactColWidths[key]) {
      return compactColWidths[key];
    }
    return colWidths[key] || "auto";
  };

  const getColumnLabel = (col) => {
    if (tableMode === "compact" && col.key === "givenDiscount") {
      return "Geg. kort. (%)";
    }
    return col.label;
  };

  const visibleProductIndices = useMemo(() => {
    const term = articleSearch.trim().toLowerCase();

    let items = products.map((product, index) => {
      const amount = Math.max(1, Math.floor(toNumOrNull(product.amount) ?? 1));
      const stock = Math.max(0, Math.floor(toNumOrNull(product.Stock) ?? 0));
      const inStock = Math.min(stock, amount);
      const backOrder = Math.max(amount - stock, 0);

      const proposalVal = proposalInputBuffer[product.SKU] !== undefined && !Number.isNaN(Number(proposalInputBuffer[product.SKU]))
        ? Number(proposalInputBuffer[product.SKU])
        : Number(product.proposal) || 0;
      const price = Number(product.Price) || 0;
      const mpp = proposalVal > 0 && Number(product.Cost)
        ? ((proposalVal - Number(product.Cost)) / proposalVal) * 100
        : 0;

      return { index, product, inStock, backOrder, price, proposalVal, mpp };
    });

    if (term) {
      items = items.filter(({ product }) => {
        const haystack = [
          product.SKU,
          product.SUPPLIER_REFERENCE,
          product.Name,
          product.LeadTimeLabel,
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(term);
      });
    }

    if (articleStatusFilter !== "all") {
      items = items.filter((item) => {
        if (articleStatusFilter === "stock") return item.backOrder === 0;
        if (articleStatusFilter === "order") return item.backOrder > 0;
        if (articleStatusFilter === "split") return item.inStock > 0 && item.backOrder > 0;
        return true;
      });
    }

    const sorted = [...items].sort((a, b) => {
      switch (articleSortBy) {
        case "name-asc":
          return String(a.product.Name || "").localeCompare(String(b.product.Name || ""), "nl", { sensitivity: "base" });
        case "sku-asc":
          return String(a.product.SKU || "").localeCompare(String(b.product.SKU || ""), "nl", { sensitivity: "base" });
        case "price-desc":
          return b.price - a.price;
        case "proposal-desc":
          return b.proposalVal - a.proposalVal;
        case "mpp-desc":
          return b.mpp - a.mpp;
        case "input-order":
        default:
          return a.index - b.index;
      }
    });

    return sorted.map((item) => item.index);
  }, [products, articleSearch, articleStatusFilter, articleSortBy, proposalInputBuffer]);

  // FETCH RECENT OFFERTES
  useEffect(() => {
    async function fetchRecentOffertes() {
      try {
        const res = await fetch("/api/offertes");
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
        setPrefillLoading(true);
        try {
          const internalSections = splitInternalSections(offerteData.interneOpmerking || '');
          const addressSource = offerteData.straat || offerteData.adres || '';
          const addressParts = (!offerteData.nummer && !offerteData.bus)
            ? splitAddressLine(addressSource)
            : { straat: offerteData.straat || '', nummer: offerteData.nummer || '', bus: offerteData.bus || '' };
          setCustomerData({
            naam: offerteData.customer || '',
            bedrijf: offerteData.bedrijf || '',
            btw: offerteData.btw || '',
            straat: addressParts.straat,
            nummer: addressParts.nummer,
            bus: addressParts.bus,
            postcode: offerteData.postcode || '',
            gemeente: offerteData.gemeente || '',
            land: countryCode(offerteData.land) || 'BE',
            email: offerteData.email || ''
          });
          setInternalComment(internalSections.manual);
          setZichtbareNota(offerteData.zichtbareNota || '');
          setShippingCost(offerteData.shippingCost ? String(offerteData.shippingCost) : '');
          setSavedGeneratedComment(internalSections.generated);
          setArticleSearch("");
          setArticleStatusFilter("all");
          setArticleSortBy("input-order");

          const skus = Array.isArray(offerteData.producten) ? offerteData.producten.map(p => p.sku).join(",") : "";
          if (skus) {
            try {
              const res = await fetch(`/api/products?skus=${skus}`);
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
        } finally {
          setPrefillLoading(false);
          if (typeof prefillDoneCallbackRef.current === "function") {
            prefillDoneCallbackRef.current(offerteData.id);
          }
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
    setShowOnlyOpenImport(false);
    setOpenManualSku({});
    setOpenItemSuggestions({});
    setOpenItemSuggestionStatus({});
    setImportAuditNotes([]);
    setInternalComment("");
    setZichtbareNota("");
    setShippingCost("");
    setSavedGeneratedComment("");
    setSearchInput("");
    setSearchResults([]);
    setTooManyResults(false);
    setSaveStatus("");
    setSkuNames({});
    setDiscountValue("");
    setDiscountMode("pct");
    setDiscountNote("");
    setArticleSearch("");
    setArticleStatusFilter("all");
    setArticleSortBy("input-order");
    setTableMode("compact");
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
    
    // Detecteer tab-gescheiden tabelformat
    const tabLines = raw.filter(l => l.includes('\t'));
    const isTableFormat = tabLines.length > 2; // Meerdere regels met tabs = waarschijnlijk tabel
    
    if (isTableFormat) {
      // Parse tabel: identificeer kolommen via header-rij
      const headerCandidates = raw.slice(0, Math.min(3, raw.length))
        .map((l, idx) => ({ line: l, index: idx, parts: l.split('\t').map(p => p.trim()) }))
        .filter(h => h.parts.length >= 2);
      
      let headerIdx = -1;
      let refColIdx = -1;
      let qtyColIdx = -1;
      let descColIdx = -1;
      
      for (const hc of headerCandidates) {
        const lowerParts = hc.parts.map(p => p.toLowerCase());
        const isLikelyHeader = lowerParts.some(p => 
          /omschrijving|description|product|artikel|artikelnummer|supplier|reference|qty|aantal|quantity/.test(p)
        );
        
        if (isLikelyHeader) {
          headerIdx = hc.index;
          // Zoek kolom-indices
          for (let i = 0; i < lowerParts.length; i++) {
            const p = lowerParts[i];
            if (/artikel|referentie|supplier|art\.?nr|sku/.test(p) && refColIdx === -1) refColIdx = i;
            if (/qty|aantal|quantity|hoeveelheid/.test(p) && qtyColIdx === -1) qtyColIdx = i;
            if (/omschrijving|description|product|naam/.test(p) && descColIdx === -1) descColIdx = i;
          }
          break;
        }
      }
      
      if (headerIdx >= 0) {
        // Filter header en lege rijen, parse data
        const out = [];
        raw.forEach((l, lineIdx) => {
          if (lineIdx <= headerIdx || !l.trim()) return;
          
          const cols = l.split('\t').map(c => c.trim()).filter(Boolean);
          if (cols.length < 2) return;
          
          // Reconstruct regel: beschrijving | merk | referentie | hoeveelheid
          const desc = descColIdx >= 0 && cols[descColIdx] ? cols[descColIdx] : '';
          const ref = refColIdx >= 0 && cols[refColIdx] ? cols[refColIdx] : '';
          const qty = qtyColIdx >= 0 && cols[qtyColIdx] ? cols[qtyColIdx] : '1';
          
          // Fallback: als ref niet gevonden, neem de langste kolom (waarschijnlijk referentie)
          const refFinal = ref || cols.reduce((a, b) => a.length > b.length ? a : b, '');
          
          // Reconstitueer de regel als: "Qty× Omschrijving Referentie"
          // Altijd de qty prefix plaatsen (ook bij 1) zodat parseSmartLines
          // de hoeveelheid betrouwbaar van het begin pakt en niet uit de
          // productnaam (bv. "202X" in "FID2-202X" zou anders als 202 herkend worden).
          const reconstructed = `${qty}× ${desc} ${refFinal}`.trim();
          
          out.push({ text: reconstructed, line: lineIdx });
        });
        return out;
      }
    }
    
    // Niet-tabel format: standaard verwerking
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
    const looksLikeMeasurement = (value) => {
      const v = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
      return /^(?:\d+(?:[.,]\d+)?)(?:mm|cm|dm|m|km|kg|g|gr|ml|cl|l|bar|v|w|hz)$/.test(v);
    };
    const normalizeImportLine = (value) => String(value || '')
      .replace(/[\u2022*☐]/g, ' ')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
    const cleanRefCandidate = (value) => String(value || '')
      .replace(/^[^A-Za-z0-9]+/, '')
      .replace(/[.,;:!?)\]"']+$/, '')
      .trim();
    const isGroupedNumericRef = (value) => {
      const candidate = cleanRefCandidate(value);
      if (!candidate) return false;
      if (!/^\d{1,4}(?:[.,/\- ]\d{1,4})+$/.test(candidate)) return false;
      const digitsOnly = candidate.replace(/\D+/g, '');
      return digitsOnly.length >= 6;
    };
    const isTooGenericModelPhrase = (value) => {
      const normalized = cleanRefCandidate(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (!normalized) return false;
      return new Set([
        'm18double',
        'm12fuel',
        'm4fuel',
        'shockwave12',
        'holedozerquiklok'
      ]).has(normalized);
    };
    const isWeakRefCandidate = (value) => {
      const candidate = cleanRefCandidate(value);
      if (!candidate) return true;
      if (/^\d{6,14}$/.test(candidate)) return false;
      if (isGroupedNumericRef(candidate)) return false;
      if (isTooGenericModelPhrase(candidate)) return true;
      if (looksLikeMeasurement(candidate)) return true;
      if (/^\d+(?:[.,]\d+)?$/.test(candidate)) return true;
      if (/^\d+(?:\/\d+)+$/.test(candidate)) return true;
      return false;
    };
    const extractModelPhrase = (value) => {
      const source = String(value || '');
      const patterns = [
        /\b((?:M(?:12|18|4)|MXF)\s+FORGE\s+FB\d{1,3})\b/i,
        /\b((?:M(?:12|18|4)|MXF)\s+TRUEVIEW\s+\d{3,5})\b/i,
        /\b((?:MILWAUKEE\s+)?ROLL-ON\s+\d{3,5}(?:\/\d{3,5})?)\b/i,
        /\b((?:M(?:12|18|4)|MXF)\s+[A-Z0-9]+(?:[./-][A-Z0-9]+)+)\b/i,
        /\b((?:M(?:12|18|4)|MXF)\s+(?:FORGE|FUEL)\b(?:[^\dA-Za-z]+\b\d\/\d\b)?)\b/i,
        /\b((?:M(?:12|18|4)|MXF)\s+[A-Z]{1,10}\d*[A-Z0-9]*)\b/i,
        /\b(HOLE\s+DOZER\s+QUIK-LOK)\b/i,
        /\b(SHOCKWAVE\s+1\/2)\b/i
      ];
      for (const pattern of patterns) {
        const match = source.match(pattern);
        if (!match) continue;
        const candidate = cleanRefCandidate(match[1]);
        if (candidate) return candidate;
      }
      return '';
    };

    const rows = preprocessLines(text);
    const items = [];
    rows.forEach(({ text: rawLine, line: idx }) => {
      const line = normalizeImportLine(rawLine);
      if (!line) return;
      const strippedLine = line.replace(/^[\-\s]+/, '').trim();
      const leadingQtyMatch = strippedLine.match(/^(\d{1,5})\s*[x×]\s+(.*)$/i);
      const contentLine = leadingQtyMatch ? leadingQtyMatch[2].trim() : strippedLine;

      // ----- Referentie bepalen -----
      let ref = null;
      const artMatch = contentLine.match(/(?:art(?:ikel|\.?nr|\.|:)?|ref(?:erence)?|ref\.)\.?\s*[:.]?\s*([0-9][0-9A-Za-z\-./]{2,})/i);
      if (artMatch) ref = artMatch[1].replace(/[.\-/]+$/, "");
      if (!ref) {
        const skuMatch = contentLine.match(/\b(\d{8})\b/);
        if (skuMatch) ref = skuMatch[1];
      }
      // PRIORITEIT: Zoek naar 10-cijferige leverancierscodes (Milwaukee, FACOM, etc.)
      // Deze zijn zeer betrouwbaar voor opzoeken in database
      if (!ref) {
        const supplierCodeMatch = contentLine.match(/\b(\d{10})\b/);
        if (supplierCodeMatch) ref = supplierCodeMatch[1];
      }
      // Fallback: andere langere numerieke codes (6-14 cijfers, niet 8)
      if (!ref) {
        const numericCodeMatch = contentLine.match(/\b(\d{6,14})\b/);
        if (numericCodeMatch && numericCodeMatch[1].length !== 8 && numericCodeMatch[1].length !== 10) {
          ref = numericCodeMatch[1];
        }
      }
      if (!ref) {
        const modelPhrase = extractModelPhrase(contentLine);
        if (modelPhrase) ref = modelPhrase;
      }
      // Fallback: leveranciersreferentie met gescheiden groepen,
      // bv. "98 00 12" of "117.23.13".
      if (!ref) {
        const lineNoLeadingQty = contentLine
          .replace(/^\s*\d{1,5}\s+/, '');
        // Kolomvorm: "aantal merk referentie omschrijving" (bv. "1 FACOM S.12H Dop 1/2 12mm").
        const qtyBrandRefMatch = contentLine.match(/^\s*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.&'-]{1,}\s+([A-Za-z0-9]+(?:[./-][A-Za-z0-9]+)+|[A-Za-z]{1,4}\d+[A-Za-z0-9./-]*|\d+[A-Za-z][A-Za-z0-9./-]*)\b/i);
        if (qtyBrandRefMatch) {
          const candidate = qtyBrandRefMatch[1].replace(/[./-]+$/, '').trim();
          if (!looksLikeMeasurement(candidate)) {
            ref = candidate;
          }
        }
        // Pattern zoals "BAHCO 9072 P" of "9072 P" (code met losse suffix-letter).
        const splitSuffixRefMatch = !ref ? lineNoLeadingQty.match(/^(?:[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.&'-]{1,}\s+)?(\d{3,10}\s+[A-Za-z]{1,3})\b/) : null;
        if (!ref && splitSuffixRefMatch) {
          const candidate = splitSuffixRefMatch[1].replace(/\s+/g, ' ').trim();
          if (!looksLikeMeasurement(candidate)) {
            ref = candidate;
          }
        }
        // Referentie met numerieke groepen en separators, bv. "110.400", "98 00 12".
        if (!ref) {
          const numericGroupedMatch = lineNoLeadingQty.match(/\b(\d{1,4}(?:[ ./-]\d{1,4}){1,4})\b/);
          if (numericGroupedMatch) {
            const candidate = numericGroupedMatch[1].replace(/\s+/g, ' ').trim();
            if (!looksLikeMeasurement(candidate)) {
              ref = candidate;
            }
          }
        }
        // Token met letters+cijfers zonder scheiding, bv. "9072P" of "44A10X11".
        // Let op: niet afkappen als er direct nog een code-deel volgt zoals "177A.18".
        if (!ref) {
          const compactAlphaNumMatch = lineNoLeadingQty.match(/\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{4,}\b(?![./-]\d)/);
          if (compactAlphaNumMatch) {
            const candidate = compactAlphaNumMatch[0].replace(/[./-]+$/, '');
            if (!looksLikeMeasurement(candidate)) {
              ref = candidate;
            }
          }
        }
        // Eerst codes binnen één token (bv. ETS.104, BLDDRC-402C).
        const tokenCodeMatch = !ref ? lineNoLeadingQty.match(/\b(?=[A-Za-z0-9./-]*\d)[A-Za-z0-9]+(?:[./-][A-Za-z0-9]+)+\b/) : null;
        if (!ref && tokenCodeMatch) {
          ref = tokenCodeMatch[0].replace(/[./-]+$/, "");
        }
      }
      // Laatste fallback voor supplier refs zonder vast patroon: neem na hoeveelheid
      // en merk de eerstvolgende code-achtige token(s).
      if (!ref) {
        const tail = contentLine
          .replace(/^\s*\d{1,5}\s+/, '')
          .replace(/^\s*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.&'-]{1,}\s+/, '')
          .trim();
        const tokens = tail
          .split(/\s+/)
          .map(t => cleanRefCandidate(t))
          .filter(Boolean);
        if (tokens.length) {
          const candidates = tokens.filter(t => /[A-Za-z]/.test(t) && /\d/.test(t) && !looksLikeMeasurement(t));
          if (candidates.length) ref = candidates.sort((a, b) => b.length - a.length)[0];
        }
      }
      let amountFromParts = null;
      if (!ref) {
        // "SKU,aantal" — enkel als het eerste token een plausibele SKU is (6-8 cijfers)
        const parts = contentLine.split(/[\t,;]+/).map(s => s.trim()).filter(Boolean);
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
        const numMatch = contentLine.match(/\b(\d{6,14})\b/);
        if (numMatch && numMatch[1].length !== 8) ref = numMatch[1];
      }
      // Fallback: alfanumerieke leveranciersreferentie/modelcode die zowel letters als
      // cijfers bevat, bv. "41/KIT360", "MFT/3", "SYS3". Wordt via LIKE + scoring opgezocht.
      if (!ref) {
        const codeTokens = (contentLine.match(/[A-Za-z0-9][A-Za-z0-9/.\-]{3,}/g) || [])
          .filter(t => /[A-Za-z]/.test(t) && /\d/.test(t));
        if (codeTokens.length) {
          ref = codeTokens.sort((a, b) => b.length - a.length)[0].replace(/[.\-/]+$/, "");
        }
      }
      if (isWeakRefCandidate(ref)) ref = null;

      // ----- Aantal bepalen (meerdere formaten) -----
      let amount = leadingQtyMatch ? (Number(leadingQtyMatch[1]) || 1) : 1;
      const isRefNum = n => ref && String(n) === String(ref);
      let m =
        line.match(/€\s*[\d.,]+\s+(\d{1,5})\s+€\s*[\d.,]+/) ||                       // proforma: stukprijs  Aantal  totaal
        line.match(/\b(?:pcs?|pieces?|stuks?|stk?|qty|aantal|ea)\.?\s*[:.]?\s*(\d{1,5})\b/i) || // "Pcs. 350"
        line.match(/\b(\d{1,5})\s*(?:pcs?|pieces?|stuks?|stk?)\b/i) ||               // "350 pcs" (geen x!)
        line.match(/^[\s\-–—•*]*(\d{1,4})\s+\D/);                                    // "- 350 borstels"
      if (m && !isRefNum(m[1])) amount = Number(m[1]) || 1;
      else if (amountFromParts && !isRefNum(amountFromParts)) amount = amountFromParts;

      // ----- Merk (hulp bij keuze; scoring op backend is leidend) -----
      let head = strippedLine;
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
    setShowOnlyOpenImport(false);
    setImportResult(null);
    setOpenItemSuggestions({});
    setOpenItemSuggestionStatus({});
    setSavedGeneratedComment("");
    try {
      let data = { resolved: [], ambiguous: [], unresolved: [] };
      if (recognized.length) {
        const res = await fetch("/api/products/resolve", {
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
        addedResolved: 0,
        truncated: !!data.truncated
      });
      fetchSuggestionsForOpenItems('unresolved', data.unresolved || []);
      fetchSuggestionsForOpenItems('unrecognized', unrecognized.map(i => ({ line: i.line, raw: i.raw, amount: i.amount })));
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
  function getInputLineValue(lineNo) {
    if (lineNo === null || lineNo === undefined) return "";
    const lines = batchInput.split(/\r?\n/);
    return String(lines[lineNo] || '').trim();
  }

  function renderLineRef(lineNo, lineValue = "") {
    if (lineNo === null || lineNo === undefined) return null;
    const preview = String(lineValue || getInputLineValue(lineNo) || '').trim();
    const title = preview
      ? `Toon deze regel in de invoer\nWaarde: ${preview}`
      : 'Toon deze regel in de invoer';
    return (
      <button
        onClick={() => highlightInputLine(lineNo)}
        title={title}
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
      const res = await fetch(`/api/products?skus=${key}`);
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
    const addedNow = importResult.resolved.length;
    // Namen uit de import meteen cachen zodat ze naast de rijen verschijnen.
    setSkuNames(prev => {
      const next = { ...prev };
      importResult.resolved.forEach(r => { if (r.sku) next[String(r.sku).replace(/^0+/, "")] = r.name || null; next[r.sku] = r.name || null; });
      return next;
    });
    appendRows(importResult.resolved.map(r => ({ sku: r.sku, amount: r.amount })));
    setImportResult(prev => prev ? {
      ...prev,
      resolved: [],
      addedResolved: Number(prev.addedResolved || 0) + addedNow
    } : prev);
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

  function closeImportResult() {
    setImportResult(null);
    setShowOnlyOpenImport(false);
    setOpenManualSku({});
    setOpenItemSuggestions({});
    setOpenItemSuggestionStatus({});
  }

  function importLineText(item) {
    if (!item) return "";
    return String(item.text || item.raw || getInputLineValue(item.line) || item.ref || '').trim();
  }

  function openItemKey(kind, index, item) {
    const linePart = Number.isInteger(item && item.line) ? String(item.line) : String(index);
    const textPart = String((item && (item.raw || item.text || item.ref)) || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .slice(0, 80);
    return `${kind}-${linePart}-${textPart}`;
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function extractSuggestionTerms(rawLine, ref = '') {
    const source = normalizeSearchText(rawLine)
      .replace(/[()\[\]{}]/g, ' ')
      .replace(/["'`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!source) return [];

    const terms = new Set();
    const modelPatterns = [
      /\b((?:m(?:12|18|4)|mxf)\s+forge\s+fb\d{1,3})\b/g,
      /\b((?:m(?:12|18|4)|mxf)\s+trueview\s+\d{3,5})\b/g,
      /\b((?:m(?:12|18|4)|mxf)\s+[a-z0-9]+(?:[./-][a-z0-9]+)+)\b/g,
      /\b((?:milwaukee\s+)?roll-on\s+\d{3,5}(?:\/\d{3,5})?)\b/g,
      /\b(\d{8,12})\b/g
    ];

    for (const pattern of modelPatterns) {
      let match;
      while ((match = pattern.exec(source)) !== null) {
        terms.add(match[1].trim());
      }
    }

    const stopWords = new Set([
      'super', 'chargeur', 'coffret', 'jeu', 'de', 'des', 'avec', 'pour', 'sur',
      'double', 'courtes', 'longues', 'lampe', 'pompe', 'foret', 'etage', 'milwaukee',
      'fuel', 'forge', 'station', 'portable', 'energie', 'scies', 'cloches'
    ]);
    const tokens = source.match(/[a-z0-9][a-z0-9./-]{2,}/g) || [];
    tokens.forEach(token => {
      if (stopWords.has(token)) return;
      if (/^\d+(?:[.,]\d+)?$/.test(token)) return;
      if (/^\d+(?:\/\d+)+$/.test(token)) return;
      const shortCodeLike = token.length >= 3 && token.length <= 4 && /[a-z]/.test(token) && /\d/.test(token);
      if (token.length < 4 && !shortCodeLike) return;
      terms.add(token);
    });

    // Korte modelcodes (bv. FB8, FB12) en compacte referentie-token expliciet meenemen.
    const compactCodeTokens = source.match(/\b[a-z]{1,3}\d{1,4}\b/g) || [];
    compactCodeTokens.forEach(token => terms.add(token));

    const compactRef = source.replace(/[^a-z0-9]+/g, '');
    if (compactRef.length >= 5 && /[a-z]/.test(compactRef) && /\d/.test(compactRef)) {
      terms.add(compactRef);
    }

    const refNorm = normalizeSearchText(ref).replace(/[^a-z0-9./-]+/g, '').trim();
    if (refNorm && refNorm.length >= 4) terms.add(refNorm);
    terms.add(source);
    return Array.from(terms).slice(0, 6);
  }

  function scoreSuggestion(item, product) {
    const line = normalizeSearchText(item && item.ref ? item.ref : importLineText(item));
    const name = normalizeSearchText(product && (product["PRODUCT_NAME_H1.nl_BE"] || product.Name || ''));
    const supref = normalizeSearchText(product && product.SUPPLIER_REFERENCE);
    const suprefNoBrand = normalizeSearchText(product && product.SUPPLIER_REF_NO_BRAND);
    if (!line || (!name && !supref && !suprefNoBrand)) return { score: 0, reasons: [] };

    const weakTokens = new Set([
      'milwaukee', 'makita', 'dewalt', 'facom', 'knipex', 'bahco', 'wera', 'wiha', 'fluke', 'stanley',
      'fuel', 'forge', 'm18', 'm12', 'm4', 'mxf', 'tool', 'set', 'jeu', 'coffret'
    ]);

    let score = 0;
    const reasons = [];
    let matchedTokenCount = 0;
    let hasHardSignal = false;
    const combined = `${suprefNoBrand} ${supref} ${name}`;
    const combinedCompact = combined.replace(/[^a-z0-9]+/g, '');
    const combinedTokens = new Set((combined.match(/[a-z0-9]+/g) || []).filter(Boolean));

    const refNorm = normalizeSearchText(item && item.ref ? item.ref : '').replace(/[^a-z0-9]+/g, '');
    if (refNorm && refNorm.length >= 4 && combinedCompact.includes(refNorm)) {
      score += 18;
      hasHardSignal = true;
      reasons.push('ref match');
    }

    const refPartTokens = String(item && item.ref ? item.ref : '')
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9./-]{1,}/g) || [];
    const meaningfulRefParts = refPartTokens.filter(token => token.length >= 3 && !/^\d+$/.test(token));
    if (meaningfulRefParts.length >= 2) {
      const covered = meaningfulRefParts.filter(token => combinedTokens.has(token)).length;
      if (covered >= 2) {
        score += 10;
        hasHardSignal = true;
        reasons.push('ref tokens aanwezig');
      }
    }

    const modelTokens = line.match(/(?:m(?:12|18|4)|mxf)[\s-]*[a-z0-9]+(?:[./-][a-z0-9]+)*/g) || [];
    modelTokens.forEach(token => {
      const normalizedToken = token.replace(/\s+/g, ' ').trim();
      if (normalizedToken && combined.includes(normalizedToken)) {
        score += 9;
        hasHardSignal = true;
        matchedTokenCount += 1;
        reasons.push(`model ${normalizedToken}`);
      }
    });

    const strongTokens = (line.match(/[a-z0-9][a-z0-9./-]{2,}/g) || [])
      .filter(token => token.length >= 3)
      .filter(token => !weakTokens.has(token))
      .filter(token => !/^\d+(?:[.,]\d+)?$/.test(token))
      .filter(token => !/^\d+(?:\/\d+)+$/.test(token));
    strongTokens.forEach((token) => {
      if (/^\d+(?:\/\d+)+$/.test(token)) return;
      if (!combined.includes(token)) return;
      matchedTokenCount += 1;
      const tokenWeight = /\d/.test(token) ? 6 : 3;
      score += tokenWeight;
      if (reasons.length < 3) reasons.push(`token ${token}`);

      if (token.length >= 3 && token.length <= 6 && /[a-z]/.test(token) && /\d/.test(token)) {
        score += 6;
        hasHardSignal = true;
        if (reasons.length < 3) reasons.push(`code ${token}`);
      }
    });

    if (supref && line && supref.includes(line)) {
      score += 10;
      hasHardSignal = true;
      reasons.push('supref bevat zin');
    }
    if (name && line && name.includes(line)) {
      score += 7;
      reasons.push('naam bevat zin');
    }

    const hasRefAnchor = refPartTokens.some(token =>
      token.length >= 3 &&
      /[a-z]/.test(token) &&
      /\d/.test(token) &&
      combined.includes(token)
    );

    if (!hasHardSignal && matchedTokenCount < 2 && !hasRefAnchor) {
      return { score: 0, reasons: [] };
    }

    if (hasRefAnchor) {
      score += 8;
      hasHardSignal = true;
      if (reasons.length < 3) reasons.push('ref anker');
    }

    return { score, reasons: reasons.slice(0, 3) };
  }

  function meetsSuggestionThreshold(kind, suggestion) {
    if (!suggestion || !Number.isFinite(suggestion.score)) return false;
    if (kind === 'unresolved') return suggestion.score >= 12;
    return suggestion.score >= 8;
  }

  async function fetchSuggestionsForOpenItems(kind, openItems) {
    const items = Array.isArray(openItems) ? openItems : [];
    if (!items.length) {
      return;
    }

    const loadingPatch = {};
    items.forEach((item, index) => {
      loadingPatch[openItemKey(kind, index, item)] = 'loading';
    });
    setOpenItemSuggestionStatus(prev => ({ ...prev, ...loadingPatch }));

    try {
      const termSet = new Set();
      items.forEach(item => {
        extractSuggestionTerms(item.raw || item.text || '', item.ref || '').forEach(term => termSet.add(term));
      });
      const terms = Array.from(termSet).slice(0, 40);
      if (!terms.length) {
        setOpenItemSuggestionStatus(prev => {
          const next = { ...prev };
          items.forEach((item, index) => {
            next[openItemKey(kind, index, item)] = 'ready';
          });
          return next;
        });
        return;
      }

      const res = await fetch('/api/products/batch-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suprefs: terms, names: terms })
      });
      const data = await res.json();
      const products = Array.isArray(data.products) ? data.products : [];

      const byItemPatch = {};
      const statusPatch = {};
      items.forEach((item, index) => {
        const key = openItemKey(kind, index, item);
        const rankedBase = products
          .map(p => {
            const scored = scoreSuggestion(item, p);
            return {
              sku: p.SKU,
              supref: p.SUPPLIER_REFERENCE || '',
              name: p["PRODUCT_NAME_H1.nl_BE"] || p.Name || '',
              score: scored.score,
              reasons: scored.reasons || []
            };
          });

        let ranked = rankedBase
          .filter(s => meetsSuggestionThreshold(kind, s))
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return String(a.sku).localeCompare(String(b.sku));
          });

        if (!ranked.length && kind === 'unresolved') {
          const refAnchors = normalizeSearchText(item && item.ref ? item.ref : '')
            .match(/[a-z0-9][a-z0-9./-]{1,}/g) || [];
          const meaningfulAnchors = Array.from(new Set(refAnchors.filter(token =>
            token.length >= 3 && (/[a-z]/.test(token) || /\d/.test(token))
          )));

          if (meaningfulAnchors.length) {
            ranked = rankedBase
              .map(s => {
                const combined = normalizeSearchText(`${s.supref} ${s.name}`);
                const anchorHits = meaningfulAnchors.filter(token => combined.includes(token)).length;
                return {
                  ...s,
                  anchorHits
                };
              })
              .filter(s => s.anchorHits >= 1)
              .sort((a, b) => {
                if (b.anchorHits !== a.anchorHits) return b.anchorHits - a.anchorHits;
                if (b.score !== a.score) return b.score - a.score;
                return String(a.sku).localeCompare(String(b.sku));
              })
              .slice(0, 5)
              .map(s => ({
                sku: s.sku,
                supref: s.supref,
                name: s.name,
                score: Math.max(Number(s.score) || 0, 7 + (s.anchorHits * 3)),
                reasons: [...(s.reasons || []), `fallback ${s.anchorHits} ref-token(s)`].slice(0, 3)
              }));
          }
        }

        const unique = [];
        const seen = new Set();
        ranked.forEach(s => {
          const sku = String(s.sku || '');
          if (!sku || seen.has(sku)) return;
          seen.add(sku);
          unique.push(s);
        });

        byItemPatch[key] = unique.slice(0, 3);
        statusPatch[key] = 'ready';
      });

      setOpenItemSuggestions(prev => ({ ...prev, ...byItemPatch }));
      setOpenItemSuggestionStatus(prev => ({ ...prev, ...statusPatch }));
    } catch {
      setOpenItemSuggestionStatus(prev => {
        const next = { ...prev };
        items.forEach((item, index) => {
          next[openItemKey(kind, index, item)] = 'error';
        });
        return next;
      });
    }
  }

  function suggestionStrengthLabel(score) {
    if (score >= 16) return 'sterke match';
    if (score >= 9) return 'mogelijke match';
    return 'voorbeeld-SKU';
  }

  function formatImportAuditNote(note) {
    if (!note) return '';
    if (typeof note === 'string') return note.trim();
    const lineLabel = Number.isInteger(note.line) ? `regel ${note.line + 1}` : 'regel onbekend';
    const sourceText = importLineText(note);
    if (note.type === 'manual-sku') {
      return `${lineLabel}: handmatig toegevoegd als SKU ${note.sku} (bron: ${sourceText}).`;
    }
    if (note.type === 'not-in-range') {
      return `${lineLabel}: niet in assortiment gemarkeerd (bron: ${sourceText}).`;
    }
    return String(note.text || '').trim();
  }

  function pushImportAuditNote(note) {
    const txt = formatImportAuditNote(note);
    if (!txt) return;
    setImportAuditNotes(prev => [...prev, note]);
  }

  function removeUnresolvedAt(index) {
    setImportResult(prev => {
      if (!prev) return prev;
      return { ...prev, unresolved: prev.unresolved.filter((_, i) => i !== index) };
    });
  }

  function removeUnrecognizedAt(index) {
    setImportResult(prev => {
      if (!prev) return prev;
      return { ...prev, unrecognized: prev.unrecognized.filter((_, i) => i !== index) };
    });
  }

  function setManualSkuValue(key, value) {
    setOpenManualSku(prev => ({ ...prev, [key]: value }));
  }

  function addManualSkuFromOpen(kind, index, item) {
    const key = `${kind}-${index}`;
    const skuRaw = String(openManualSku[key] || '').trim();
    if (!/^\d{5,8}$/.test(skuRaw)) {
      alert('Geef een geldige SKU in (5-8 cijfers).');
      return;
    }
    appendRows([{ sku: skuRaw, amount: Number(item.amount) || 1 }]);
    lookupSkuName(skuRaw);
    if (kind === 'unresolved') removeUnresolvedAt(index);
    if (kind === 'unrecognized') removeUnrecognizedAt(index);
    setOpenManualSku(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const suggestionKey = openItemKey(kind, index, item);
    setOpenItemSuggestions(prev => {
      const next = { ...prev };
      delete next[suggestionKey];
      return next;
    });
    setOpenItemSuggestionStatus(prev => {
      const next = { ...prev };
      delete next[suggestionKey];
      return next;
    });
    pushImportAuditNote({ ...item, type: 'manual-sku', sku: skuRaw });
  }

  function addSuggestionSkuFromOpen(kind, index, item, suggestion) {
    const sku = String((suggestion && suggestion.sku) || '').trim();
    if (!/^\d{5,8}$/.test(sku)) return;
    appendRows([{ sku, amount: Number(item.amount) || 1 }]);
    setSkuNames(prev => ({
      ...prev,
      [sku]: suggestion.name || null,
      [String(sku).replace(/^0+/, '')]: suggestion.name || null
    }));
    if (kind === 'unrecognized') removeUnrecognizedAt(index);
    if (kind === 'unresolved') removeUnresolvedAt(index);

    const suggestionKey = openItemKey(kind, index, item);
    setOpenItemSuggestions(prev => {
      const next = { ...prev };
      delete next[suggestionKey];
      return next;
    });
    setOpenItemSuggestionStatus(prev => {
      const next = { ...prev };
      delete next[suggestionKey];
      return next;
    });

    pushImportAuditNote({ ...item, type: 'manual-sku', sku, text: `${importLineText(item)} (suggestie)` });
  }

  function ignoreOpenItem(kind, index, item) {
    if (kind === 'unresolved') removeUnresolvedAt(index);
    if (kind === 'unrecognized') removeUnrecognizedAt(index);
    setOpenManualSku(prev => {
      const next = { ...prev };
      delete next[`${kind}-${index}`];
      return next;
    });
    const suggestionKey = openItemKey(kind, index, item);
    setOpenItemSuggestions(prev => {
      const next = { ...prev };
      delete next[suggestionKey];
      return next;
    });
    setOpenItemSuggestionStatus(prev => {
      const next = { ...prev };
      delete next[suggestionKey];
      return next;
    });
    pushImportAuditNote({ ...item, type: 'not-in-range' });
  }

  // PRODUCT SEARCH
  async function handleProductSearch() {
    const queries = searchInput.split(/[\t,; ]+/).map(x => x.trim()).filter(Boolean);
    if (!queries.length) return;
    setSearchResults([]);
    setLoadingSearch(true);
    try {
      // Stuur alle queries in één keer naar de batch-search endpoint
      const res = await fetch('/api/products/batch-search', {
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
      const res = await fetch(`/api/products?skus=${skuString}`);
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

  // QUICK ADD ARTIKEL AAN OFFERTE (vanuit tabel)
  const handleQuickAddArticle = async () => {
    const skuRaw = (quickAddSku || "").trim();
    if (!skuRaw || !/^\d{5,8}$/.test(skuRaw)) {
      alert("Geef een geldige SKU in (5-8 cijfers).");
      return;
    }
    
    const amount = Math.max(1, Math.floor(Number(quickAddAmount) || 1));
    setQuickAddLoading(true);
    
    try {
      const res = await fetch(`/api/products?skus=${skuRaw}`);
      const data = await res.json();
      
      if (!data.products || data.products.length === 0) {
        alert(`Artikel met SKU ${skuRaw} niet gevonden.`);
        setQuickAddLoading(false);
        return;
      }
      
      const product = data.products[0];
      const defaultProposal = product.Price ? Number(product.Price).toFixed(2) : "0.00";
      const proposalVal = proposals[product.SKU] !== undefined ? proposals[product.SKU] : defaultProposal;
      
      // Voeg toe aan bestaande producten (merge als SKU al bestaat)
      setProducts(prev => {
        const existing = prev.findIndex(p => p.SKU === product.SKU);
        if (existing >= 0) {
          // SKU bestaat al, voeg aantal toe
          return prev.map((p, i) => 
            i === existing ? { ...p, amount: (p.amount || 1) + amount } : p
          );
        } else {
          // Nieuwe SKU, voeg toe
          return [...prev, {
            ...product,
            amount,
            proposal: Number(proposalVal)
          }];
        }
      });
      
      // Cache de naam
      setSkuNames(prev => ({ 
        ...prev, 
        [skuRaw]: product["PRODUCT_NAME_H1.nl_BE"] || product.Name || null,
        [String(skuRaw).replace(/^0+/, "")]: product["PRODUCT_NAME_H1.nl_BE"] || product.Name || null
      }));
      
      // Reset inputs
      setQuickAddSku("");
      setQuickAddAmount(1);
    } catch {
      alert("Fout bij ophalen artikel. Controleer je verbinding.");
    }
    
    setQuickAddLoading(false);
  };

  // GLOBALE KORTING — 2 fasen:
  // 1) Eerst op producten met marge boven 12% (tot ze richting 12% zakken).
  // 2) Is er daarna nog korting over, dan verdelen over alle resterende marge.
  // Prijzen gaan nooit onder kostprijs.
  function applyGlobalDiscount() {
    const val = Number(discountValue);
    if (!val || val <= 0) { setDiscountNote("Geef een korting groter dan 0 in."); return; }
    if (!products.length) { setDiscountNote("Maak eerst de offerte (voeg producten toe)."); return; }
    const TARGET_MARGIN = 0.12;
    const totalExcl = products.reduce((s, p) => s + (Number(p.proposal) || 0) * (p.amount || 1), 0);
    const totalMargin = products.reduce((s, p) => s + ((Number(p.proposal) || 0) - (Number(p.Cost) || 0)) * (p.amount || 1), 0);
    let target = discountMode === "pct" ? (val / 100) * totalExcl : val;
    let note = "";
    if (target > totalMargin) {
      target = Math.max(0, totalMargin);
      note = "Korting begrensd tot de totale marge (prijzen kunnen niet onder kostprijs).";
    }

    const base = products.map((p, idx) => {
      const amount = Math.max(1, Number(p.amount) || 1);
      const cost = Number(p.Cost) || 0;
      const prop = Number(p.proposal) || 0;
      const marginPerUnit = Math.max(0, prop - cost);
      const marginValue = marginPerUnit * amount;
      const priceAt12 = cost / (1 - TARGET_MARGIN);
      const excessPerUnit = Math.max(0, prop - priceAt12);
      const excessValue = excessPerUnit * amount;
      return { idx, amount, cost, prop, marginPerUnit, marginValue, excessValue, discountValue: 0 };
    });

    // Fase 1: alles boven 12% krijgt voorrang.
    let remaining = target;
    const phase1Pool = base.reduce((s, x) => s + x.excessValue, 0);
    if (phase1Pool > 0 && remaining > 0) {
      const take = Math.min(remaining, phase1Pool);
      base.forEach(x => {
        if (x.excessValue > 0) x.discountValue += (x.excessValue / phase1Pool) * take;
      });
      remaining -= take;
    }

    // Fase 2: als er nog korting over is, verdeel over alle resterende marge.
    if (remaining > 0) {
      const phase2Pool = base.reduce((s, x) => {
        const left = Math.max(0, x.marginValue - x.discountValue);
        return s + left;
      }, 0);
      if (phase2Pool > 0) {
        const take = Math.min(remaining, phase2Pool);
        base.forEach(x => {
          const left = Math.max(0, x.marginValue - x.discountValue);
          if (left > 0) x.discountValue += (left / phase2Pool) * take;
        });
        remaining -= take;
      }
    }

    if (remaining > 0.01) {
      note = (note ? `${note} ` : "") + "Niet alle gevraagde korting kon verdeeld worden zonder onder kostprijs te gaan.";
    }

    const updated = products.map((p, i) => {
      const x = base[i];
      const unitDiscount = x.discountValue / x.amount;
      const rawProposal = x.prop - unitDiscount;
      const boundedProposal = Math.max(x.cost, rawProposal);
      const rounded = Math.round(boundedProposal * 100) / 100;
      return { ...p, proposal: rounded };
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
    const quoteNrXlsx = "OFF-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(1000 + Math.random() * 9000);
    const buildFileName = (ext) => {
      const ref = quoteNrXlsx ? `(${quoteNrXlsx}) ` : '';
      const klant = (customerData.bedrijf || customerData.naam)
        ? `_${(customerData.bedrijf || customerData.naam).replace(/[\/\\:*?"<>|]/g, '-').trim()}`
        : '';
      return `KLIUM ${ref}${t.fileName}${klant}.${ext}`;
    };
    window.XLSX.writeFile(wb, buildFileName('xlsx'));
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
    const normalizePdfText = s => String(s || "").replace(/[\u00A0\u202F]/g, " ");
    const euro = n => "€ " + normalizePdfText(Number(n || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
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
    const td = (txt, align, opts = {}) => ({ text: txt, fontSize: opts.fontSize ?? 8.6, alignment: align || "left", margin: [2, 3, 2, 3], noWrap: !!opts.noWrap, lineHeight: opts.lineHeight ?? 1.08 });
    const clampTwoLines = (txt, charsPerLine = 34) => {
      const clean = String(txt || "").replace(/\s+/g, " ").trim();
      if (!clean) return "";
      const maxChars = charsPerLine * 2;
      if (clean.length <= maxChars) return clean;
      return clean.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…";
    };
    const tdProduct = txt => {
      const clean = String(txt || "").replace(/\s+/g, " ").trim();
      const clamped = clampTwoLines(clean, 34);
      const compact = clean.length > 50;
      return td(clamped, "left", { fontSize: compact ? 8 : 9, lineHeight: 1.05 });
    };
    const translatedLeadForPdf = p => {
      const d = deliveryInfo(p);
      if (d.inStockOnly) {
        if (docLang === "fr") return "En stock";
        if (docLang === "en") return "In stock";
        return "Uit voorraad";
      }
      const date = d.backOrderDate ? fmtDateBE(d.backOrderDate) : "";
      if (d.inStock > 0) {
        if (docLang === "fr") return `${d.inStock} en stock + ${d.backOrder} sur commande${date ? ` a partir du ${date}` : ""}`;
        if (docLang === "en") return `${d.inStock} in stock + ${d.backOrder} to order${date ? ` from ${date}` : ""}`;
        return `${d.inStock} uit voorraad + ${d.backOrder} op bestelling${date ? ` vanaf ${date}` : ""}`;
      }
      if (docLang === "fr") return date ? `Sur commande: livre a partir du ${date}` : "Sur commande";
      if (docLang === "en") return date ? `To order: delivered from ${date}` : "To order";
      return date ? `Op bestelling: bezorgd vanaf ${date}` : "Op bestelling";
    };
    const tdProductWithLead = p => {
      const clean = String(prodName(p) || "").replace(/\s+/g, " ").trim();
      const clampedName = clampTwoLines(clean, 34);
      const compact = clean.length > 50;
      return {
        stack: [
          { text: clampedName, fontSize: compact ? 8 : 8.8, lineHeight: 1.04 },
          { text: translatedLeadForPdf(p), fontSize: 7.7, color: "#5f6672", italics: true, margin: [0, 1, 0, 0], lineHeight: 1.02 }
        ],
        margin: [2, 3, 2, 3]
      };
    };

    const productBody = [
      [th(t.colRef), th(t.colProduct), th(t.colVat, "center"), th(t.colUnit, "right"), th(t.colQty, "center"), th(t.colLineTotal, "right")],
      ...products.map(p => [
        td(p.SKU, "left", { noWrap: true }),
        tdProductWithLead(p),
        td(`${vat.pct} %`, "center", { noWrap: true, fontSize: 8.4 }),
        td(euro(p.proposal), "right", { noWrap: true, fontSize: 8.4 }),
        td(String(p.amount), "center", { noWrap: true, fontSize: 8.4 }),
        td(euro((Number(p.proposal) || 0) * (p.amount || 1)), "right", { noWrap: true, fontSize: 8.4 })
      ])
    ];

    const totaalExcl = products.reduce((sum, p) => sum + (Number(p.proposal) || 0) * (p.amount || 1), 0);
    const shippingExcl = Number(shippingCost) || 0;
    const subtotalExcl = totaalExcl + shippingExcl;
    const btw = subtotalExcl * vat.pct / 100;
    const totaalIncl = subtotalExcl + btw;

    const totLbl = (txt, bold) => ({ text: txt, fontSize: bold ? 11 : 10, bold: !!bold, alignment: "left", margin: [0, 3, 16, 3], border: [false, false, false, false] });
    const totVal = (txt, bold) => ({ text: txt, fontSize: bold ? 11 : 10, bold: !!bold, alignment: "right", margin: [0, 3, 0, 3], border: [false, false, false, false] });

    const totalsRows = [
      [totLbl(t.totalProducts), totVal(euro(totaalExcl))],
      ...(shippingExcl > 0 ? [[totLbl(t.shipping), totVal(euro(shippingExcl))]] : [[totLbl(t.shipping), totVal(t.freeShipping)]]),
      [totLbl(t.totalExcl), totVal(euro(subtotalExcl))],
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
          table: {
            headerRows: 1,
            widths: [52, "*", 38, 62, 30, 68],
            body: productBody,
            dontBreakRows: true,
            keepWithHeaderRows: 1
          },
          layout: tableLayout, margin: [0, 0, 0, 18]
        },
        {
          columns: [
            {
              width: "*",
              stack: [
                ...(vat.intracommunautair ? [{ text: t.intracom, italics: true, color: "#2e7d32", fontSize: 9, margin: [0, 10, 0, 0] }] : [{ text: '', margin: [0, 10, 0, 0] }]),
                ...(zichtbareNota.trim() ? [
                  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 340, y2: 0, lineWidth: 1, lineColor: '#d0d7e2' }], margin: [0, 10, 0, 0] },
                  { text: t.remark, fontSize: 8.5, bold: true, color: '#2563eb', margin: [0, 8, 0, 2] },
                  { text: normalizePdfText(zichtbareNota.trim()), fontSize: 9.5, color: '#1e293b', lineHeight: 1.45 }
                ] : [])
              ]
            },
            { width: "auto", table: { body: totalsRows }, layout: "noBorders" }
          ],
          columnGap: 16,
          unbreakable: true
        },
      ],
      images: { logo: logoBase64 },
      defaultStyle: { fontSize: 10, color: "#222" },
      footer: () => ({ text: "Klium N.V. · Ekkelgaarden 26 · 3500 Hasselt · België", alignment: "center", fontSize: 8, color: "#999", margin: [0, 20, 0, 0] })
    };
    const buildFileName = (ext) => {
      const ref = quoteNr ? `(${quoteNr}) ` : '';
      const klant = (customerData.bedrijf || customerData.naam)
        ? `_${(customerData.bedrijf || customerData.naam).replace(/[\/\\:*?"<>|]/g, '-').trim()}`
        : '';
      return `KLIUM ${ref}${t.fileName}${klant}.${ext}`;
    };
    window.pdfMake.createPdf(docDefinition).download(buildFileName('pdf'));
  }

  // SAVE OFFERTE
  async function handleSaveQuotation() {
    setSaveStatus("");
    if (!customerData.naam || !customerData.email || products.length === 0) {
      setSaveStatus("Vul klantgegevens en producten in.");
      return;
    }
    const internalLines = [];
    if (internalComment.trim()) internalLines.push(internalComment.trim());
    if (importAuditNotes.length > 0) {
      internalLines.push(
        [
          'Slimme import opvolging:',
          ...importAuditNotes.map(n => `- ${formatImportAuditNote(n)}`)
        ].join('\n')
      );
    }
    if (openImportSummary.length > 0) {
      internalLines.push(
        [
          'Open importregels bij opslaan:',
          ...openImportSummary.map(n => `- ${n}`)
        ].join('\n')
      );
    }
    const interneOpmerking = internalLines.join('\n\n').trim();
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
      interneOpmerking,
      zichtbareNota: zichtbareNota.trim(),
      shippingCost: shippingCost ? Number(shippingCost) : 0,
      totaal: totals.newPrice,
      datum: new Date().toISOString().slice(0, 10)
    };
    try {
      const res = await fetch("/api/offerte", {
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
  const shippingExcl = Number(shippingCost) || 0;
  const customerExcl = (totals.newPrice || 0) + shippingExcl;
  const customerBtw = customerExcl * vat.pct / 100;
  const customerIncl = customerExcl + customerBtw;
  const pendingImportCount = importResult
    ? importResult.ambiguous.length + importResult.unresolved.length + importResult.unrecognized.length
    : 0;
  const openImportSummary = importResult
    ? [
      ...importResult.ambiguous.map(a => `keuze nodig: ${importLineText(a)}${Number.isInteger(a.line) ? ` (regel ${a.line + 1})` : ''}`),
      ...importResult.unresolved.map(u => `niet gevonden: ${importLineText(u)}${Number.isInteger(u.line) ? ` (regel ${u.line + 1})` : ''}`),
      ...importResult.unrecognized.map(u => `geen referentie: ${importLineText(u)}${Number.isInteger(u.line) ? ` (regel ${u.line + 1})` : ''}`)
    ]
    : [];
  const autoImportNoteSections = [];
  if (importAuditNotes.length > 0) {
    autoImportNoteSections.push([
      'Slimme import opvolging:',
      ...importAuditNotes.map(n => `- ${formatImportAuditNote(n)}`)
    ].join('\n'));
  }
  if (openImportSummary.length > 0) {
    autoImportNoteSections.push([
      'Open importregels bij opslaan:',
      ...openImportSummary.map(n => `- ${n}`)
    ].join('\n'));
  }
  const generatedPreview = autoImportNoteSections.length ? autoImportNoteSections.join('\n\n') : savedGeneratedComment;
  const internalSavePreview = [internalComment.trim(), generatedPreview].filter(Boolean).join('\n\n');
  return (
    <div className="quotation-page" style={{width: "100%", maxWidth: 1700, margin: "0 auto", boxSizing: "border-box"}}>
      <div className="quote-page-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
        <h1 style={{margin:0}}>Offerte Tool</h1>
        <button
          onClick={startNewOfferte}
          title="Wis alles en begin een nieuwe offerte"
          style={{padding:'10px 22px', borderRadius:8, border:'2px solid #0077cc', background:'#0077cc', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'1rem'}}
        >
          + Nieuwe offerte
        </button>
      </div>
      {prefillLoading && (
        <div className="quote-prefill-banner" role="status" aria-live="polite">
          <span className="quote-prefill-spinner" aria-hidden="true"></span>
          <span>Offerte wordt geladen... even geduld.</span>
        </div>
      )}
      {/* Slimme import block */}
      <div style={{marginBottom: 25}}>
        <b>Slimme invoer (plak een offerteaanvraag):</b><br />
        <div style={{color:'#aaa', fontSize:'0.85em', margin:'4px 0 8px'}}>
          Herkent automatisch artikelnummers (bv. <code>art. 577743</code>), 8-cijferige SKU's en aantallen (bv. <code>2x</code>). Ook <code>SKU,aantal</code> per regel werkt.
        </div>
        <div style={{color:'#999', fontSize:'0.8em', marginBottom:12, background:'#2a2a2a', padding:'10px 12px', borderRadius:6, lineHeight:'1.5'}}>
          💡 <strong>Hoe slim herkennen gebruiken:</strong> Plak de volledige aanvraag, mail of offerte direct hier in. De tool zoekt automatisch SKU's en aantallen. Ambigue regels verschijnen dan apart voor handmatige verificatie. Perfecte aanvulling bij import uit PDF of e-mail.
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
          <div style={{marginTop: 14, background:'#1e1e1e', color:'#e5e7eb', padding:18, borderRadius:12, width:'100%', maxWidth:'min(1240px, 96vw)', boxShadow:'0 2px 18px #000a'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
              <b style={{fontSize:'1.05em'}}>Resultaat slimme import</b>
              <button onClick={closeImportResult} style={{background:'none', border:'none', color:'white', fontSize:'1.3em', cursor:'pointer'}} title="Sluiten">&#10005;</button>
            </div>

            {/* Samenvattingsbalk */}
            <div style={{display:'flex', gap:10, flexWrap:'wrap', marginBottom:16}}>
              {Number(importResult.addedResolved || 0) > 0 && (
                <span style={{background:'#16304a', color:'#8ecbff', border:'1px solid #2d6fa8', borderRadius:20, padding:'5px 14px', fontWeight:700, fontSize:'0.9em'}}>
                  + {importResult.addedResolved} toegevoegd
                </span>
              )}
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

            {pendingImportCount > 0 && (
              <div style={{display:'flex', gap:10, marginBottom:12, flexWrap:'wrap'}}>
                <button
                  onClick={() => setShowOnlyOpenImport(v => !v)}
                  style={{padding:'7px 12px', borderRadius:7, border:'1px solid #2d6fa8', background: showOnlyOpenImport ? '#2d6fa8' : '#16304a', color:'#d5ecff', fontWeight:700, cursor:'pointer'}}
                >
                  {showOnlyOpenImport ? 'Toon volledig overzicht' : `Toon alleen nog open regels (${pendingImportCount})`}
                </button>
              </div>
            )}

            {showOnlyOpenImport && pendingImportCount === 0 && (
              <div style={{background:'#173d20', color:'#7ee08a', border:'1px solid #2e7d32', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:'0.9em'}}>
                Alle open regels zijn verwerkt.
              </div>
            )}

            {!showOnlyOpenImport && importResult.resolved.length > 0 && (
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
                <div style={{color:'#b9c3d4', fontSize:'0.85em', marginBottom:8}}>Groene rij = aanbevolen keuze op basis van beste score.</div>
                {importResult.ambiguous.map((a, i) =>
                  <div key={a.ref + i} style={{marginBottom:10, padding:'8px 10px', background:'#241f10', borderRadius:8}}>
                    <div style={{color:'#ffd166', marginBottom:6, fontWeight:600, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                      <span>{a.amount}× &nbsp;referentie “{a.ref}”</span>
                      {a.brand && <span style={{color:'#aaa', fontWeight:400, fontSize:'0.85em'}}>merk gevraagd: {a.brand}</span>}
                      {renderLineRef(a.line, a.text)}
                    </div>
                    {a.candidates.map(c =>
                      <div key={c.sku} style={{display:'grid', gridTemplateColumns:'100px 1fr 80px', gap:10, alignItems:'center', padding:'4px 0', background: c.recommended ? '#1c2e14' : 'transparent', borderRadius:6, color:'#e5e7eb'}}>
                        <span style={{fontWeight:700, paddingLeft: c.recommended ? 6 : 0}}>{c.sku}</span>
                        <span style={{overflowWrap:'anywhere'}}>
                          {c.name}
                          {c.exactMatch && <span style={{background:'#1f5f39', color:'#d9ffe7', border:'1px solid #4caf50', borderRadius:11, padding:'1px 7px', fontSize:'0.74em', marginLeft:8, fontWeight:700}}>✓ exact match</span>}
                          {c.brandMatch && <span style={{color:'#7ee08a', fontSize:'0.8em', marginLeft:8, fontWeight:700}}>✓ merk match</span>}
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
                <div style={{color:'#ff9b9b', fontWeight:700, marginBottom:6}}>✗ Niet gevonden — voeg manueel een SKU toe of markeer met X</div>
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  {importResult.unresolved.map((u, i) => {
                    const k = `unresolved-${i}`;
                    const suggestionKey = openItemKey('unresolved', i, u);
                    const suggestionStatus = openItemSuggestionStatus[suggestionKey] || 'idle';
                    const suggestions = openItemSuggestions[suggestionKey] || [];
                    return (
                    <div key={u.ref + i} style={{background: u.inactive ? '#2a1f00' : '#3d1717', color: u.inactive ? '#ffd580' : '#ff9b9b', border: `1px solid ${u.inactive ? '#b8860b' : '#c0392b'}`, borderRadius:6, padding:'7px 10px', fontSize:'0.9em', display:'flex', alignItems:'center', gap:10, justifyContent:'space-between', flexWrap:'wrap'}}>
                      <span style={{display:'inline-flex', alignItems:'center', gap:8, flexWrap:'wrap', flex:1, minWidth:230}}>
                        <span>{u.amount}× {u.ref || u.raw}</span>
                        {u.inactive && <span title={`SKU: ${u.inactiveSku}`} style={{background:'#5c3d00', color:'#ffd580', borderRadius:4, padding:'1px 6px', fontSize:'0.85em', fontWeight:700}}>⚠ Inactief artikel</span>}
                        {renderLineRef(u.line, u.text)}
                        {suggestionStatus === 'loading' && (
                          <span style={{color:'#8ecbff', fontSize:'0.82em'}}>Suggesties ophalen...</span>
                        )}
                        {suggestionStatus === 'error' && (
                          <span style={{color:'#ffd1d1', fontSize:'0.82em'}}>Suggesties laden mislukte.</span>
                        )}
                        {suggestionStatus === 'ready' && suggestions.length > 0 && (
                          <span style={{display:'flex', flexDirection:'column', gap:5, width:'100%', marginTop:4}}>
                            {suggestions.map((s, si) => (
                              <span key={`${s.sku}-${si}`} style={{display:'grid', gridTemplateColumns:'90px 1fr auto auto', gap:8, alignItems:'center', background:'#2a1111', border:'1px solid #5b2a2a', borderRadius:6, padding:'4px 6px'}}>
                                <span style={{fontWeight:700, color:'#ffd9d9'}}>{s.sku}</span>
                                <span style={{overflowWrap:'anywhere'}}>
                                  {s.name || <em style={{color:'#cc9999'}}>geen naam</em>}
                                  {!!(s.reasons && s.reasons.length) && (
                                    <span style={{display:'block', color:'#e7bebe', fontSize:'0.78em'}}>{s.reasons.join(' · ')}</span>
                                  )}
                                </span>
                                <span style={{fontSize:'0.78em', borderRadius:10, padding:'1px 7px', background:'#5b2020', color:'#ffd3d3', fontWeight:700}}>{suggestionStrengthLabel(s.score)}</span>
                                <button onClick={() => addSuggestionSkuFromOpen('unresolved', i, u, s)} style={{padding:'3px 8px', borderRadius:6, border:'1px solid #4caf50', background:'#1c2e14', color:'#7ee08a', cursor:'pointer', fontWeight:700}}>
                                  Kies
                                </button>
                              </span>
                            ))}
                          </span>
                        )}
                        {suggestionStatus === 'ready' && suggestions.length === 0 && (
                          <span style={{color:'#f7b0b0', fontSize:'0.82em'}}>Geen bruikbare suggestie gevonden voor deze regel.</span>
                        )}
                      </span>
                      <span style={{display:'inline-flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                        <input
                          value={openManualSku[k] || ''}
                          onChange={e => setManualSkuValue(k, e.target.value)}
                          placeholder="SKU"
                          style={{width:90, padding:'4px 8px', borderRadius:6, border:'1px solid #666', background:'#1e1e1e', color:'#fff'}}
                        />
                        <button onClick={() => addManualSkuFromOpen('unresolved', i, u)} style={{padding:'4px 9px', borderRadius:6, border:'1px solid #4caf50', background:'#1c2e14', color:'#7ee08a', cursor:'pointer', fontWeight:700}}>
                          Toevoegen
                        </button>
                        <button onClick={() => ignoreOpenItem('unresolved', i, u)} title="Niet in assortiment" style={{padding:'4px 9px', borderRadius:6, border:'1px solid #a94442', background:'#2b1414', color:'#ffb4b4', cursor:'pointer', fontWeight:700}}>
                          X
                        </button>
                      </span>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {importResult.unrecognized.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{color:'#bbb', fontWeight:700, marginBottom:6}}>? Geen referentie herkend — voeg manueel SKU toe of markeer met X</div>
                <div style={{display:'flex', flexDirection:'column', gap:6}}>
                  {importResult.unrecognized.map((u, i) => {
                    const k = `unrecognized-${i}`;
                    const suggestionKey = openItemKey('unrecognized', i, u);
                    const suggestionStatus = openItemSuggestionStatus[suggestionKey] || 'idle';
                    const suggestions = openItemSuggestions[suggestionKey] || [];
                    return (
                    <div key={i} style={{background:'#242424', color:'#ccc', border:'1px solid #555', borderRadius:6, padding:'6px 10px', fontSize:'0.9em', display:'flex', alignItems:'center', gap:10, justifyContent:'space-between', flexWrap:'wrap'}}>
                      <span style={{overflowWrap:'anywhere', flex:1, minWidth:220}}>
                        <div>{u.raw}</div>
                        {suggestionStatus === 'loading' && (
                          <div style={{marginTop:4, color:'#8ecbff', fontSize:'0.82em'}}>Suggesties ophalen...</div>
                        )}
                        {suggestionStatus === 'error' && (
                          <div style={{marginTop:4, color:'#ff9b9b', fontSize:'0.82em'}}>Suggesties laden mislukte. Voeg manueel SKU toe.</div>
                        )}
                        {suggestionStatus === 'ready' && suggestions.length > 0 && (
                          <div style={{marginTop:6, display:'flex', flexDirection:'column', gap:5}}>
                            {suggestions.map((s, si) => (
                              <div key={`${s.sku}-${si}`} style={{display:'grid', gridTemplateColumns:'90px 1fr auto auto', gap:8, alignItems:'center', background:'#1f1f1f', border:'1px solid #444', borderRadius:6, padding:'4px 6px'}}>
                                <span style={{fontWeight:700, color:'#d6e5ff'}}>{s.sku}</span>
                                <span style={{overflowWrap:'anywhere'}}>
                                  {s.name || <em style={{color:'#888'}}>geen naam</em>}
                                  {!!(s.reasons && s.reasons.length) && (
                                    <span style={{display:'block', color:'#94a3b8', fontSize:'0.78em'}}>{s.reasons.join(' · ')}</span>
                                  )}
                                </span>
                                <span style={{fontSize:'0.78em', borderRadius:10, padding:'1px 7px', background:'#143048', color:'#8ecbff', fontWeight:700}}>{suggestionStrengthLabel(s.score)}</span>
                                <button onClick={() => addSuggestionSkuFromOpen('unrecognized', i, u, s)} style={{padding:'3px 8px', borderRadius:6, border:'1px solid #4caf50', background:'#1c2e14', color:'#7ee08a', cursor:'pointer', fontWeight:700}}>
                                  Kies
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {suggestionStatus === 'ready' && suggestions.length === 0 && (
                          <div style={{marginTop:4, color:'#9ca3af', fontSize:'0.82em'}}>Geen bruikbare suggestie gevonden voor deze regel.</div>
                        )}
                      </span>
                      <span style={{display:'inline-flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                        {renderLineRef(u.line, u.raw)}
                        <input
                          value={openManualSku[k] || ''}
                          onChange={e => setManualSkuValue(k, e.target.value)}
                          placeholder="SKU"
                          style={{width:90, padding:'4px 8px', borderRadius:6, border:'1px solid #666', background:'#1e1e1e', color:'#fff'}}
                        />
                        <button onClick={() => addManualSkuFromOpen('unrecognized', i, u)} style={{padding:'4px 9px', borderRadius:6, border:'1px solid #4caf50', background:'#1c2e14', color:'#7ee08a', cursor:'pointer', fontWeight:700}}>
                          Toevoegen
                        </button>
                        <button onClick={() => ignoreOpenItem('unrecognized', i, u)} title="Niet in assortiment" style={{padding:'4px 9px', borderRadius:6, border:'1px solid #666', background:'#151515', color:'#ddd', cursor:'pointer', fontWeight:700}}>
                          X
                        </button>
                      </span>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', borderTop:'1px solid #333', paddingTop:14}}>
              {importResult.resolved.length > 0 ? (
                <button onClick={addResolvedRows} style={{padding:'10px 22px', borderRadius:7, background:'#4caf50', color:'white', border:'none', fontWeight:700, cursor:'pointer'}}>
                  ✓ {importResult.resolved.length} herkend product(en) toevoegen
                </button>
              ) : (
                <span style={{color:'#888'}}>
                  Geen extra herkende producten om toe te voegen.
                  {(importResult.ambiguous.length + importResult.unresolved.length + importResult.unrecognized.length) > 0
                    ? ` Nog open: ${importResult.ambiguous.length + importResult.unresolved.length + importResult.unrecognized.length} regel(s) voor manuele opvolging.`
                    : ' Alles uit deze import is verwerkt.'}
                </span>
              )}
              <button onClick={closeImportResult} style={{padding:'10px 18px', borderRadius:7, background:'none', border:'1px solid #555', color:'#ccc', cursor:'pointer'}}>
                Sluiten
              </button>
            </div>
            {importAuditNotes.length > 0 && (
              <div style={{marginTop:10, color:'#8ecbff', fontSize:'0.85em'}}>
                Interne opvolgnotities: {importAuditNotes.length}
              </div>
            )}
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
      {hasFetchedProducts && !loading && missingSkus.length > 0 && (
        <div style={{color: "#e53935", fontWeight: 600, margin: "18px 0"}}>
          Niet gevonden: {missingSkus.join(", ")}. Controleer je invoer.
        </div>
      )}
      {hasFetchedProducts && !loading && products.length === 0 && (
        <div style={{color: "#e53935", fontWeight: 600, margin: "18px 0"}}>
          Geen producten gevonden voor de opgegeven SKU(s). Controleer je invoer.
        </div>
      )}
      {/* Offerte producten en totalen */}
      {products.length > 0 && (
        <>
          <div className="quote-table-toolbar">
            <div className="quote-table-toolbar__group">
              <span className="quote-table-toolbar__label">Weergave</span>
              <div className="quote-view-toggle" role="tablist" aria-label="Artikeltabel weergave">
                <button
                  type="button"
                  className={`quote-view-toggle__btn ${tableMode === "compact" ? "is-active" : ""}`}
                  onClick={() => setTableMode("compact")}
                >
                  Compact
                </button>
                <button
                  type="button"
                  className={`quote-view-toggle__btn ${tableMode === "extended" ? "is-active" : ""}`}
                  onClick={() => setTableMode("extended")}
                >
                  Uitgebreid
                </button>
              </div>
            </div>

            <div className="quote-table-toolbar__group quote-table-toolbar__group--grow">
              <label className="quote-table-toolbar__field quote-table-toolbar__field--grow">
                <span>Filter</span>
                <input
                  type="search"
                  value={articleSearch}
                  onChange={(e) => setArticleSearch(e.target.value)}
                  placeholder="Zoek op SKU, SupRef, naam..."
                />
              </label>

              <label className="quote-table-toolbar__field">
                <span>Status</span>
                <select value={articleStatusFilter} onChange={(e) => setArticleStatusFilter(e.target.value)}>
                  <option value="all">Alle</option>
                  <option value="stock">Uit voorraad</option>
                  <option value="order">Met bestelling</option>
                  <option value="split">Split levering</option>
                </select>
              </label>

              <label className="quote-table-toolbar__field">
                <span>Sorteren</span>
                <select value={articleSortBy} onChange={(e) => setArticleSortBy(e.target.value)}>
                  <option value="input-order">Ingevoerde volgorde</option>
                  <option value="name-asc">Naam A-Z</option>
                  <option value="sku-asc">SKU A-Z</option>
                  <option value="price-desc">Prijs hoog-laag</option>
                  <option value="proposal-desc">Proposal hoog-laag</option>
                  <option value="mpp-desc">M%P hoog-laag</option>
                </select>
              </label>

              <label className="quote-table-toolbar__field" style={{display:'flex', alignItems:'center', gap:6}}>
                <span style={{whiteSpace:'nowrap'}}>+ Artikel</span>
                <input
                  type="text"
                  placeholder="SKU"
                  value={quickAddSku}
                  onChange={e => setQuickAddSku(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleQuickAddArticle()}
                  style={{width:70, padding:'6px 8px', borderRadius:4, border:'1px solid #555', background:'#1a1f2e', color:'#fff', fontSize:'0.9em'}}
                />
                <input
                  type="number"
                  min={1}
                  value={quickAddAmount}
                  onChange={e => setQuickAddAmount(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
                  onKeyDown={e => e.key === "Enter" && handleQuickAddArticle()}
                  style={{width:50, padding:'6px 8px', borderRadius:4, border:'1px solid #555', background:'#1a1f2e', color:'#fff', fontSize:'0.9em', textAlign:'center'}}
                  title="Aantal"
                />
                <button
                  onClick={handleQuickAddArticle}
                  disabled={quickAddLoading}
                  style={{padding:'6px 12px', borderRadius:4, border:'1px solid #0077cc', background:'#0077cc', color:'white', fontWeight:600, cursor:quickAddLoading?'wait':'pointer', fontSize:'0.9em', whiteSpace:'nowrap'}}
                  title="Voeg artikel toe aan offerte"
                >
                  {quickAddLoading ? '⏳' : '✓'}
                </button>
              </label>
            </div>

            <div className="quote-table-toolbar__meta">
              {visibleProductIndices.length} / {products.length} artikelen
            </div>
          </div>

          <div className="quote-table-shell" style={{width: "100%"}}>
            <table className="quote-products-table" style={{width:"100%",background:"#161b25",borderRadius:10, tableLayout:"fixed", border:"1px solid #2c3240"}}>
            <colgroup>
              {visibleColumns.map(col => (
                <col key={col.key} style={{ width: getColumnWidth(col.key) }} />
              ))}
              <col style={{ width: "76px" }} />
            </colgroup>
            <thead>
              <tr>
                {visibleColumns.map(col => (
                  <th key={col.key} style={{padding:"8px 6px",color:"#fff",fontSize:"0.9rem",whiteSpace:"normal",textAlign:["Price","Discount","Discount%","Cost","M€","M%","mpp","givenDiscount"].includes(col.key)?"right":"left",borderTop:"1px solid #2c3240",borderBottom:"1px solid #2c3240"}}>{getColumnLabel(col)}</th>
                ))}
                <th style={{borderTop:"1px solid #2c3240",borderBottom:"1px solid #2c3240"}}></th>
              </tr>
            </thead>
            <tbody>
              {visibleProductIndices.map((i) => {
                const p = products[i];
                return (
                <tr key={i}>
                  {visibleColumns.map(col => {
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
                      const rawGiven = price > 0 ? ((price - Number(proposalVal)) / price) * 100 : 0;
                      const given = normalizePct(rawGiven);
                      const color = given > 0 ? "#ffb74d" : given < 0 ? "#81c784" : "#eee";
                      return <td key={col.key} style={{padding:"5px", color, fontWeight: given !== 0 ? 700 : 400, whiteSpace:"nowrap", textAlign:"right", fontVariantNumeric:"tabular-nums", fontSize:"0.92em"}}>{fmt(given)}%</td>;
                    }
                    if (col.key === "Name") {
                      const productName = p[col.key] || "";
                      return (
                        <td key={col.key} style={{padding:"5px",color:"#eee", fontSize:"0.92em", lineHeight:1.2, verticalAlign:"top"}}>
                          <div
                            className="quote-name-cell"
                            title={productName}
                            data-full-name={productName}
                          >
                            <span className="quote-name-cell__text">{productName}</span>
                            <span className="quote-name-tooltip">{productName}</span>
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
                          setHoveredRow(`row-${i}`);
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
                    {hoveredRow === `row-${i}` && (
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
              );
              })}
            </tbody>
            </table>
          </div>
          {/* Totalen/offerte */}
          <h3 style={{ marginTop: 36 }}>Totalen/offerte</h3>
          <div className="quote-overview-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:24, margin:'0 0 24px', width:'100%'}}>
            {/* Globale korting */}
              <div className="quote-panel quote-panel--discount" style={{background:'#fff', border:'1px solid #e3e8ee', borderRadius:16, padding:20, color:'#222', minWidth:0}}>
                <div className="quote-panel__title">Globale korting</div>
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
              <div className="quote-panel__note" style={{fontSize:'0.85em', color:'#666', marginTop:8}}>
                Eerst op marge boven 12%, daarna eventueel over alle producten. Prijs gaat nooit onder kostprijs.
              </div>
              {discountNote && <div style={{color:'#e57373', fontSize:'0.85em', marginTop:6}}>{discountNote}</div>}
            </div>
            {/* Klanttotaal met btw */}
            <div className="quote-panel quote-panel--totals quote-summary-card" style={{background:'#fff', border:'1px solid #e3e8ee', borderRadius:16, padding:20, color:'#222', minWidth:0}}>
              <div className="quote-panel__title">Offertetotaal (klant)</div>
              <div className="quote-total-line"><span>Totaal excl. btw</span><b>€ {fmt(customerExcl)}</b></div>
              <div className="quote-total-line"><span>BTW ({vat.pct}%)</span><b>€ {fmt(customerBtw)}</b></div>
              <div className="quote-total-line quote-total-line--highlight"><span>Totaal</span><b>€ {fmt(customerIncl)}</b></div>
              <div className="quote-panel__note quote-panel__note--vat" style={{fontSize:'0.85em', color: vat.intracommunautair ? '#2e7d32' : '#666', marginTop:8}}>{vat.label}</div>
            </div>
            {/* Verzendkosten */}
            <div className="quote-panel quote-panel--shipping" style={{background:'#fff', border:'1px solid #e3e8ee', borderRadius:16, padding:20, color:'#222', minWidth:0}}>
              <div className="quote-panel__title" style={{marginBottom:12}}>Verzendkosten (excl. btw)</div>
              <div style={{display:'flex', gap:12, alignItems:'center'}}>
                <input
                  type="number"
                  value={shippingCost}
                  onChange={e => setShippingCost(e.target.value)}
                  placeholder="0"
                  step="0.01"
                  min="0"
                  className="quote-input"
                  style={{flex:1, padding:'8px 12px', borderRadius:8, border:'1px solid #b0c4d8', fontSize:'1em'}}
                />
                <span style={{fontSize:'1.1em', fontWeight:600, minWidth:'60px'}}>€</span>
              </div>
              <div className="quote-panel__note" style={{fontSize:'0.82em', color:'#666', marginTop:8}}>
                Optioneel. Laat leeg voor gratis verzending. Bedrag excl. btw — btw wordt automatisch berekend.
              </div>
            </div>
              <div className="quote-panel quote-panel--notes" style={{background:'#fff', border:'1px solid #e3e8ee', borderRadius:16, padding:20, color:'#222', minWidth:0}}>
              <div className="quote-panel__title" style={{marginBottom:8}}>Zichtbare nota (verschijnt in PDF/Excel)</div>
              <textarea
                value={zichtbareNota}
                onChange={e => setZichtbareNota(e.target.value)}
                placeholder="Bijv. leveringstermijn, speciale voorwaarden, opmerkingen voor de klant..."
                className="quote-textarea"
                style={{width:'100%', minHeight:72, borderRadius:8, border:'1px solid #b0c4d8', padding:10, resize:'vertical', background:'#f0f7ff'}}
              />
            </div>
            <div className="quote-panel quote-panel--notes" style={{background:'#fff', border:'1px solid #e3e8ee', borderRadius:16, padding:20, color:'#222', minWidth:0}}>
              <div className="quote-panel__title">Interne opmerkingen (niet in PDF/Excel)</div>
              <textarea
                value={internalComment}
                onChange={e => setInternalComment(e.target.value)}
                placeholder="Interne nota voor opvolging..."
                className="quote-textarea"
                style={{width:'100%', minHeight:96, borderRadius:8, border:'1px solid #ccc', padding:10, resize:'vertical'}}
              />
              <div className="quote-panel__label" style={{marginTop:10, fontSize:'0.82em', color:'#5f6b76', fontWeight:700}}>
                Wat wordt opgeslagen
              </div>
              <div className="quote-note-preview" style={{marginTop:6, border:'1px solid #d7dee7', borderRadius:8, background:'#f7f9fc', padding:'10px 12px', minHeight:84, whiteSpace:'pre-wrap', fontSize:'0.82em', color:'#2f3a44'}}>
                {internalSavePreview || 'Nog geen interne notities.'}
              </div>
              {importAuditNotes.length > 0 && (
                <div style={{marginTop:8, fontSize:'0.85em', color:'#4a5d70'}}>
                  Slimme import opvolging wordt automatisch intern mee opgeslagen ({importAuditNotes.length} notitie(s)).
                </div>
              )}
              {openImportSummary.length > 0 && (
                <div style={{marginTop:6, fontSize:'0.85em', color:'#7a4d4d'}}>
                  Nog open importregels worden ook intern gelogd bij opslaan.
                </div>
              )}
            </div>
          </div>
          <div className="quote-insight-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 24, alignItems: "stretch", marginTop: 0, width: "100%" }}>
            <div style={{ minWidth: 0, display: "flex", alignItems: "stretch" }}>
              <div className="quote-insight-card quote-insight-card--metrics">
                <div className="quote-metrics-grid">
                  <div className="quote-stat-card quote-metric-card quote-metric-card--price-current">
                    <div className="quote-metric-card__label">Huidige prijs</div>
                    <div className="quote-metric-card__value">€ {fmt(totals.currentPrice)}</div>
                  </div>
                  <div className="quote-stat-card quote-metric-card quote-metric-card--price-new">
                    <div className="quote-metric-card__label">Nieuwe prijs</div>
                    <div className="quote-metric-card__value">€ {fmt(totals.newPrice)}</div>
                  </div>
                  <div className="quote-stat-card quote-metric-card quote-metric-card--profit-current">
                    <div className="quote-metric-card__label">Huidige winst</div>
                    <div className="quote-metric-card__value">€ {fmt(totals.currentProfit)}</div>
                  </div>
                  <div className="quote-stat-card quote-metric-card quote-metric-card--profit-new">
                    <div className="quote-metric-card__label">Nieuwe winst</div>
                    <div className="quote-metric-card__value">€ {fmt(totals.newProfit)}</div>
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
                            setTooltipPosition(getSafeTooltipPosition(rect.right, rect.top, { width: 620, height: 420, offset: 12 }));
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
                            width: "clamp(520px, 58vw, 760px)",
                            minWidth: 520,
                            maxWidth: 760,
                            maxHeight: 420,
                            overflowY: "auto",
                            background: "#222",
                            color: "#fff",
                            borderRadius: 14,
                            padding: "18px 20px",
                            boxShadow: "0 2px 14px rgba(0,0,0,0.22)",
                            zIndex: 9999,
                            fontSize: "0.98rem",
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
                              <div style={{ display: "grid", gridTemplateColumns: "132px 1fr 88px 120px", background: "#2d3146", fontWeight: 700, fontSize: "0.9em", padding: "8px 12px" }}>
                                <span>SKU</span>
                                <span>Verdeling</span>
                                <span style={{ textAlign: "center" }}>Lijnen</span>
                                <span style={{ textAlign: "right" }}>CDC</span>
                              </div>
                              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                                {totals.cdcRows.map((r, i) => (
                                  <div key={r.sku + i} style={{ display: "grid", gridTemplateColumns: "132px 1fr 88px 120px", padding: "8px 12px", borderTop: i === 0 ? "none" : "1px solid #33374d", fontSize: "0.92em", alignItems: "center", columnGap: 8 }}>
                                    <span style={{ fontWeight: 700 }}>{r.sku}</span>
                                    <span>
                                      {r.inStock > 0 && <span style={{ color: "#81c784" }}>{r.inStock} voorraad</span>}
                                      {r.inStock > 0 && r.backOrder > 0 && <span style={{ color: "#aaa" }}> + </span>}
                                      {r.backOrder > 0 && <span style={{ color: "#ffcc80" }}>{r.backOrder} backorder</span>}
                                    </span>
                                    <span style={{ textAlign: "center" }}>{r.cdcLines}</span>
                                    <span style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmt(r.cdcValue)}</span>
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
              <h3 className="quote-section-title" style={{ margin: 0, padding: 0, color: '#222' }}>Klantgegevens</h3>
              <form className="quote-form-card" style={{ background: "#ffffffff", boxShadow: "0 2px 10px rgba(0,0,0,0.10)", borderRadius: 16, padding: 26, border: "1px solid #eee", fontSize: "1.06rem", color: "#222", display: "flex", flexDirection: "column", justifyContent: "flex-start", marginTop: 0 }}>
                <div className="quote-panel__title">Factuurgegevens</div>
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
                <div className={`quote-vat-regime ${vat.intracommunautair || vat.isExport ? "quote-vat-regime--zero" : "quote-vat-regime--local"}`}>
                  <b>BTW-regeling:</b>{" "}
                  {vat.intracommunautair
                    ? "0% — intracommunautaire levering (btw verlegd)"
                    : vat.isExport
                      ? "0% — export buiten EU"
                      : `${vat.pct}% btw (${vat.code})`}
                  {!sameDelivery && <span className="quote-vat-regime__hint"> · o.b.v. leveringsland</span>}
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
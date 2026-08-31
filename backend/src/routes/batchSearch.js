// Utility: Maak alles JSON-safe (BigInt naar string)
function safeJson(obj) {
  if (Array.isArray(obj))
    return obj.map(safeJson);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'bigint') out[k] = v.toString();
      else out[k] = safeJson(v);
    }
    return out;
  }
  return obj;
}
// Nieuwe batch search endpoint voor SupRef/naam LIKE queries
const express = require('express');
const odbc = require('odbc');
const router = express.Router();

const ODBC_DSN = process.env.ODBC_DSN || 'Elastic UAT';
const ODBC_DATABASE = process.env.ODBC_DATABASE || 'de02157346244195ac7c0474dce38008';
const ODBC_CONNECTION_STRING = `DSN=${ODBC_DSN};DATABASE=${ODBC_DATABASE};`;

const FIELDS = [
  "SKU",
  "SUPPLIER_REFERENCE",
  "SUPPLIER_REF_NO_BRAND",
  "PRODUCT_NAME_H1.nl_BE",
  "PRICE",
  "DISCOUNT",
  "DISCOUNT_PCT_INT",
  "ECOTAX",
  "COST",
  "MARGIN",
  "MARGIN_PCT",
  "ACTIVE",
  "VISIBILITY_BE",
  "VISIBILITY_NL",
  "VISIBILITY_COM"
];

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

// POST /products/batch-search
router.post('/products/batch-search', async (req, res) => {
  try {
    // Verzamel en dedupliceer alle zoektermen
    let { suprefs = [], names = [] } = req.body;
    let allTerms = [...suprefs, ...names].map(s => (s || '').trim()).filter(Boolean);
    allTerms = Array.from(new Set(allTerms));

    // Splits in mogelijke SKU's (8 cijfers) en teksttermen
    const skuRegex = /^\d{8}$/;
    const skus = allTerms.filter(t => skuRegex.test(t));
    // Teksttermen: minimaal 3 tekens, geen SKU's
    const textTerms = allTerms.filter(t => !skuRegex.test(t) && t.length >= 3);

    if (skus.length === 0 && textTerms.length === 0) {
      return res.status(400).json({ error: 'No valid search terms provided' });
    }

    const fieldList = FIELDS.map(quoteIdentifier).join(',');
    let results = [];
    const connection = await odbc.connect(ODBC_CONNECTION_STRING);

    // Query 1: Exacte SKU's
    if (skus.length > 0) {
      const skuList = skus.map(s => `'${s}'`).join(',');
      const sqlSku = `SELECT ${fieldList} FROM business WHERE ${quoteIdentifier('ACTIVE')} = '1' AND ${quoteIdentifier('SKU')} IN (${skuList})`;
      console.log('ODBC SKU QUERY:', sqlSku);
      const skuResult = await connection.query(sqlSku);
      results = results.concat(safeJson(skuResult));
    }

    // Query 2: LIKE op teksttermen
    if (textTerms.length > 0) {
      // Unieke LIKE-termen
      const likeTerms = Array.from(new Set(textTerms));
      const likeTermVariants = Array.from(new Set(
        likeTerms.flatMap((raw) => {
          const v = String(raw || '').trim();
          if (!v) return [];
          const upper = v.toUpperCase();
          return upper !== v ? [v, upper] : [v];
        })
      ));
      let likeClauses = [];
      likeClauses.push(...likeTermVariants.map(s => `${quoteIdentifier('SUPPLIER_REFERENCE')} LIKE '%${s.replace(/'/g, "''") }%'`));
      likeClauses.push(...likeTermVariants.map(s => `${quoteIdentifier('SUPPLIER_REF_NO_BRAND')} LIKE '%${s.replace(/'/g, "''") }%'`));
      likeClauses.push(...likeTermVariants.map(n => `${quoteIdentifier('PRODUCT_NAME_H1.nl_BE')} LIKE '%${n.replace(/'/g, "''") }%'`));
      const whereLike = [`${quoteIdentifier('ACTIVE')} = '1'`, `(${likeClauses.join(' OR ')})`].join(' AND ');
      const sqlLike = `SELECT ${fieldList} FROM business WHERE ${whereLike}`;
      console.log('ODBC LIKE QUERY:', sqlLike);
      const likeResult = await connection.query(sqlLike);
      results = results.concat(safeJson(likeResult));
    }

    await connection.close();

    // Combineer resultaten zonder dubbels (op SKU)
    const unique = {};
    for (const p of results) {
      if (p.SKU) unique[p.SKU] = p;
    }
    res.json({ products: Object.values(unique) });
  } catch (err) {
    console.error('ODBC Error', err);
    res.status(500).json({ error: 'ODBC batch search failed', details: err.message });
  }
});

// POST /products/resolve
// Slimme import: los een lijst van referenties op naar producten.
// Een referentie is ofwel een 8-cijferige SKU, ofwel een leveranciersreferentie (art.nr).
// Body: { items: [{ ref, amount }, ...] }
// Antwoord: { resolved: [...], ambiguous: [...], unresolved: [...] }
router.post('/products/resolve', async (req, res) => {
  try {
    let { items = [] } = req.body;
    if (!Array.isArray(items)) items = [];

    const norm = items
      .map(it => ({
        ref: String(it && it.ref !== undefined ? it.ref : '').trim(),
        amount: Number(it && it.amount) > 0 ? Number(it.amount) : 1,
        line: Number.isInteger(it && it.line) ? it.line : null,
        brand: String(it && it.brand ? it.brand : '').trim(),
        text: String(it && it.text ? it.text : '').trim()
      }))
      .filter(it => it.ref);
    console.log(`[smart-import] resolve aanvraag: ${norm.length} referenties → ${norm.map(n => n.ref).join(', ')}`);

    if (norm.length === 0) {
      return res.json({ resolved: [], ambiguous: [], unresolved: [] });
    }

    // Veiligheidslimiet: verwerk nooit meer dan MAX_ITEMS referenties per import,
    // zodat één plakactie de database niet kan overbelasten.
    const MAX_ITEMS = 300;
    let truncated = false;
    if (norm.length > MAX_ITEMS) {
      norm.length = MAX_ITEMS;
      truncated = true;
    }

    // Sta enkel karakters toe die in een SKU/leveranciersreferentie kunnen voorkomen.
    const sanitize = s => String(s).replace(/[^0-9A-Za-z._/\- ]/g, '').trim();
    const normalizeRef = s => sanitize(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
    const extractReferenceTokens = s => {
      const tokens = String(s || '').match(/[A-Za-z0-9][A-Za-z0-9./-]{1,}/g) || [];
      const seen = new Set();
      const out = [];
      for (const token of tokens) {
        const norm = normalizeRef(token);
        if (!norm || !/\d/.test(norm) || seen.has(norm)) continue;
        seen.add(norm);
        out.push(norm);
      }
      return out;
    };
    const addUniqueProduct = (map, key, product) => {
      if (!key) return;
      if (!map[key]) map[key] = [];
      if (!map[key].some(x => String(x.SKU) === String(product.SKU))) {
        map[key].push(product);
      }
    };
    const skuRegex = /^\d{8}$/;

    const uniqueRefs = Array.from(new Set(norm.map(n => n.ref)));
    // Een 8-cijferig getal kan een Klium-SKU zijn, maar ook een leveranciersreferentie
    // (bv. een PFERD-code). Daarom proberen we elke referentie als leveranciersreferentie,
    // en 8-cijferige extra als SKU. De SKU-match krijgt voorrang in de verwerking hieronder.
    const skuRefs = uniqueRefs.filter(r => skuRegex.test(r));
    const supRefs = Array.from(new Set(
      uniqueRefs.map(sanitize).filter(Boolean)
    ));
    const buildNumericRefVariants = (value) => {
      const compactDigits = String(value || '').replace(/\D+/g, '');
      if (!/^\d{6,12}$/.test(compactDigits)) return [];

      const groups = [];
      let rest = compactDigits;
      while (rest.length > 3) {
        groups.push(rest.slice(0, 2));
        rest = rest.slice(2);
      }
      groups.push(rest);

      const space = groups.join(' ');
      const dash = groups.join('-');
      const dot = groups.join('.');
      return [space, dash, dot].filter(v => v && v !== String(value || '').trim());
    };
    const supRefLookupTerms = Array.from(new Set(
      supRefs.flatMap((r) => [r, ...buildNumericRefVariants(r)])
    ));
    const supRefNorms = Array.from(new Set(
      supRefs.map(normalizeRef).filter(Boolean)
    ));

    const fieldList = FIELDS.map(quoteIdentifier).join(',');
    const connection = await odbc.connect(ODBC_CONNECTION_STRING);

    const bySku = {};      // sku -> product
    const bySupExact = {}; // supref(lower) -> [products]
    const bySupNormalized = {}; // supref(genormaliseerd) -> [products]

    if (skuRefs.length > 0) {
      const list = skuRefs.map(s => `'${s}'`).join(',');
      const sql = `SELECT ${fieldList} FROM business WHERE ${quoteIdentifier('ACTIVE')} = '1' AND ${quoteIdentifier('SKU')} IN (${list})`;
      const rows = safeJson(await connection.query(sql));
      rows.forEach(p => { if (p.SKU) bySku[String(p.SKU)] = p; });
    }

    if (supRefs.length > 0) {
      const matchedSupRefNorms = new Set();
      const supRefNormSet = new Set(supRefNorms);
      const CHUNK_SIZE = 20;

      for (let offset = 0; offset < supRefLookupTerms.length; offset += CHUNK_SIZE) {
        const chunk = supRefLookupTerms.slice(offset, offset + CHUNK_SIZE);
        const list = chunk.map(r => `'${r.replace(/'/g, "''")}'`).join(',');
        if (!list) continue;

        const sql = `SELECT ${fieldList} FROM business WHERE ${quoteIdentifier('ACTIVE')} = '1' AND ${quoteIdentifier('SUPPLIER_REF_NO_BRAND')} IN (${list})`;
        const rows = safeJson(await connection.query(sql));

        rows.forEach(p => {
          const rawNoBrandRef = String(p.SUPPLIER_REF_NO_BRAND || '');
          const exactKey = rawNoBrandRef.toLowerCase();
          addUniqueProduct(bySupExact, exactKey, p);

          const normKey = normalizeRef(rawNoBrandRef);
          if (normKey) {
            addUniqueProduct(bySupNormalized, normKey, p);
            if (supRefNormSet.has(normKey)) matchedSupRefNorms.add(normKey);
          }
        });
      }

      for (let offset = 0; offset < supRefs.length; offset += CHUNK_SIZE) {
        const chunk = supRefs.slice(offset, offset + CHUNK_SIZE);
        const likeClauses = chunk.map(r => {
          const esc = r.replace(/'/g, "''");
          return `${quoteIdentifier('SUPPLIER_REFERENCE')} LIKE '%${esc}%'`;
        });
        if (!likeClauses.length) continue;

        const sql = `SELECT ${fieldList} FROM business WHERE ${quoteIdentifier('ACTIVE')} = '1' AND (${likeClauses.join(' OR ')})`;
        const rows = safeJson(await connection.query(sql));

        rows.forEach(p => {
          const rawNoBrandRef = String(p.SUPPLIER_REF_NO_BRAND || '');
          const noBrandExactKey = rawNoBrandRef.toLowerCase();
          addUniqueProduct(bySupExact, noBrandExactKey, p);

          const noBrandNormKey = normalizeRef(rawNoBrandRef);
          if (noBrandNormKey) {
            addUniqueProduct(bySupNormalized, noBrandNormKey, p);
            if (supRefNormSet.has(noBrandNormKey)) matchedSupRefNorms.add(noBrandNormKey);
          }

          const rawSupRef = String(p.SUPPLIER_REFERENCE || '');
          const exactKey = rawSupRef.toLowerCase();
          addUniqueProduct(bySupExact, exactKey, p);

          const normKey = normalizeRef(rawSupRef);
          if (normKey) {
            addUniqueProduct(bySupNormalized, normKey, p);
            if (supRefNormSet.has(normKey)) matchedSupRefNorms.add(normKey);
          }

          extractReferenceTokens(rawSupRef).forEach(tokenNorm => {
            if (!supRefNormSet.has(tokenNorm)) return;
            matchedSupRefNorms.add(tokenNorm);
            addUniqueProduct(bySupNormalized, tokenNorm, p);
          });
        });
      }

      console.log(`[smart-import] SUPPLIER_REF_NO_BRAND/SUPPLIER_REFERENCE exacte match: ${matchedSupRefNorms.size}/${supRefs.length} gevonden`);
    }

    // Extra match op genormaliseerde leveranciersreferentie:
    // spaties/punten/streepjes/slashes worden genegeerd.
    if (supRefNorms.length > 0) {
      const list = supRefNorms.map(s => `'${s.replace(/'/g, "''")}'`).join(',');
      const supRefNormalizedExpr =
        `LOWER(REPLACE(REPLACE(REPLACE(REPLACE(${quoteIdentifier('SUPPLIER_REFERENCE')}, ' ', ''), '-', ''), '.', ''), '/', ''))`;
      const supRefNoBrandNormalizedExpr =
        `LOWER(REPLACE(REPLACE(REPLACE(REPLACE(${quoteIdentifier('SUPPLIER_REF_NO_BRAND')}, ' ', ''), '-', ''), '.', ''), '/', ''))`;
      const sql = `SELECT ${fieldList} FROM business WHERE ${quoteIdentifier('ACTIVE')} = '1' AND (${supRefNormalizedExpr} IN (${list}) OR ${supRefNoBrandNormalizedExpr} IN (${list}))`;
      try {
        const rows = safeJson(await connection.query(sql));
        rows.forEach(p => {
          const normKeys = Array.from(new Set([
            normalizeRef(p.SUPPLIER_REFERENCE || ''),
            normalizeRef(p.SUPPLIER_REF_NO_BRAND || '')
          ].filter(Boolean)));
          normKeys.forEach((normKey) => {
            if (!bySupNormalized[normKey]) bySupNormalized[normKey] = [];
            if (!bySupNormalized[normKey].some(x => String(x.SKU) === String(p.SKU))) {
              bySupNormalized[normKey].push(p);
            }
          });
        });
      } catch (e) { /* negeer normalize-query fouten */ }
    }

    // Fallback: voor leveranciersreferenties zonder exacte match, probeer LIKE.
    // Guard: enkel voor termen die op een echte referentie lijken (>= 4 tekens en
    // minstens 1 cijfer), zodat we geen 'domme' brede zoekopdrachten sturen.
    // Alle overige termen gaan in ÉÉN gecombineerde query (OR), zodat een import nooit
    // meer dan 3 database-queries kost, ongeacht het aantal regels.
    const looksLikeRef = r => {
      const v = String(r || '').trim();
      if (!v) return false;

      const compact = v.toLowerCase().replace(/\s+/g, '');
      const isMeasurement = /^(?:\d+(?:[.,]\d+)?)(?:mm|cm|dm|m|km|kg|g|gr|ml|cl|l|bar|v|w|hz)$/.test(compact);
      if (isMeasurement) return false;

      const hasDigit = /\d/.test(v);
      const hasLetter = /[A-Za-z]/.test(v);
      const normalized = normalizeRef(v);

      // Korte alfanumerieke referenties zoals "R.7", "R.8", "S.12H" mogen door.
      if (hasLetter && hasDigit) {
        return normalized.length >= 4 && /^[A-Za-z0-9./\- ]{2,}$/.test(v);
      }

      return (v.length >= 4 && hasDigit) || /^\d{2,5}$/.test(v);
    };
    const tokenizeRefForFallback = r => {
      const tokens = String(r || '').toLowerCase().match(/[a-z0-9]+/g) || [];
      const stop = new Set(['milwaukee', 'fuel', 'forge', 'trueview', 'packout']);
      return tokens.filter(t => {
        if (!t) return false;
        if (stop.has(t)) return false;
        if (/^\d+(?:[.,]\d+)?$/.test(t) && t.length < 4) return false;
        return t.length >= 2;
      });
    };
    const isSpecificCodeRef = r => {
      const value = String(r || '').trim();
      if (!value) return false;
      const compact = value.replace(/[^a-zA-Z0-9]/g, '');
      if (/^\d{6,}$/.test(compact)) return true;
      if (/[a-zA-Z]/.test(compact) && /\d/.test(compact) && compact.length >= 5) return true;
      return false;
    };
    const containsExactToken = (text, token) => {
      const hay = String(text || '').toLowerCase();
      const needle = String(token || '').toLowerCase();
      if (!hay || !needle) return false;
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(hay);
    };
    const productMatchesRef = (refValue, product) => {
      const rl = String(refValue || '').toLowerCase();
      const rn = normalizeRef(refValue);
      const sup = String(product && product.SUPPLIER_REFERENCE ? product.SUPPLIER_REFERENCE : '');
      const name = String(product && product['PRODUCT_NAME_H1.nl_BE'] ? product['PRODUCT_NAME_H1.nl_BE'] : '');
      const supNorm = normalizeRef(sup);
      const nameNorm = normalizeRef(name);

      if (!rl && !rn) return false;

      if (isSpecificCodeRef(refValue)) {
        if (rn && (supNorm === rn || nameNorm === rn)) return true;
        if (rn && extractReferenceTokens(sup).includes(rn)) return true;
        if (containsExactToken(sup, rl) || containsExactToken(name, rl)) return true;
        return false;
      }

      return (
        String(sup).toLowerCase().includes(rl) ||
        (rn && supNorm.includes(rn)) ||
        (rn && nameNorm.includes(rn)) ||
        String(name).toLowerCase().includes(rl)
      );
    };
    const bySupLike = {}; // ref(lower) -> [products]
    const supUnmatched = supRefs.filter(r => !bySupExact[r.toLowerCase()] && !bySupNormalized[normalizeRef(r)] && looksLikeRef(r));
    if (supUnmatched.length > 0) console.log(`[smart-import] LIKE fallback voor ${supUnmatched.length} refs: ${supUnmatched.join(', ')}`);
    if (supUnmatched.length > 0) {
      const normalizedSupExpr =
        `LOWER(REPLACE(REPLACE(REPLACE(REPLACE(${quoteIdentifier('SUPPLIER_REFERENCE')}, ' ', ''), '-', ''), '.', ''), '/', ''))`;
      const normalizedNameExpr =
        `LOWER(REPLACE(REPLACE(REPLACE(REPLACE(${quoteIdentifier('PRODUCT_NAME_H1.nl_BE')}, ' ', ''), '-', ''), '.', ''), '/', ''))`;
      // Gebruik chunks om te vermijden dat één enorme OR-query faalt bij lange imports.
      const CHUNK_SIZE = 20;
      let chunkFailures = 0;
      for (let offset = 0; offset < supUnmatched.length; offset += CHUNK_SIZE) {
        const chunk = supUnmatched.slice(offset, offset + CHUNK_SIZE);
        const appendLikeMatchesForRef = (refValue, rows) => {
          const key = String(refValue || '').toLowerCase();
          if (!key || !Array.isArray(rows) || !rows.length) return;
          if (!bySupLike[key]) bySupLike[key] = [];
          for (const p of rows) {
            if (!bySupLike[key].some(x => String(x.SKU) === String(p.SKU))) {
              bySupLike[key].push(p);
            }
          }
        };
        const assignMatches = (rows) => {
          for (const r of chunk) {
            const rl = r.toLowerCase();
            const matched = rows.filter(p => productMatchesRef(r, p));

            if (matched.length) {
              if (!bySupLike[rl]) bySupLike[rl] = [];
              for (const p of matched) {
                if (!bySupLike[rl].some(x => String(x.SKU) === String(p.SKU))) {
                  bySupLike[rl].push(p);
                }
              }
            }
          }
        };

        // Stap 1: directe LIKE (altijd uitvoeren — werkt voor refs zonder spaties)
        try {
          const basicClauses = [];
          for (const r of chunk) {
            const esc = r.replace(/'/g, "''");
            basicClauses.push(`${quoteIdentifier('SUPPLIER_REFERENCE')} LIKE '%${esc}%'`);
            basicClauses.push(`${quoteIdentifier('PRODUCT_NAME_H1.nl_BE')} LIKE '%${esc}%'`);
          }
          if (basicClauses.length) {
            const basicSql = `SELECT ${fieldList} FROM business WHERE ${quoteIdentifier('ACTIVE')} = '1' AND (${basicClauses.join(' OR ')})`;
            const rows = safeJson(await connection.query(basicSql));
            assignMatches(rows);
          }
        } catch { /* negeer */ }

        // Stap 2: genormaliseerde LIKE apart (voor refs met spaties/streepjes zoals "71 01 200")
        // Wordt apart uitgevoerd zodat falen hier de directe LIKE niet beïnvloedt.
        try {
          const normClauses = chunk.flatMap(r => {
            const rn = normalizeRef(r).replace(/'/g, "''");
            if (!rn) return [];
            return [
              `${normalizedSupExpr} LIKE '%${rn}%'`,
              `${normalizedNameExpr} LIKE '%${rn}%'`
            ];
          });
          if (normClauses.length) {
            const tokenSql = `SELECT ${fieldList} FROM business WHERE ${quoteIdentifier('ACTIVE')} = '1' AND (${normClauses.join(' OR ')})`;
            const rows = safeJson(await connection.query(tokenSql));
            assignMatches(rows);
          }
        } catch {
          chunkFailures += 1;
        }

        // Stap 3: token-AND fallback.
        // Voor modelcodes zoals "M18 FORGE FB8" of "ROLL-ON 3600/7200" volstaat
        // een volledige frase-LIKE vaak niet; hier eisen we dat meerdere tokens
        // voorkomen in naam/supplier-reference, ongeacht volgorde.
        for (const r of chunk) {
          const lowerRef = r.toLowerCase();
          if (bySupLike[lowerRef] && bySupLike[lowerRef].length > 0) continue;

          const tokens = tokenizeRefForFallback(r);
          if (tokens.length < 2) continue;

          const tokenClauses = tokens.slice(0, 6).map(token => {
            const esc = token.replace(/'/g, "''");
            return `(${quoteIdentifier('SUPPLIER_REFERENCE')} LIKE '%${esc}%' OR ${quoteIdentifier('PRODUCT_NAME_H1.nl_BE')} LIKE '%${esc}%')`;
          });
          if (!tokenClauses.length) continue;

          try {
            const tokenSql = `SELECT ${fieldList} FROM business WHERE ${quoteIdentifier('ACTIVE')} = '1' AND ${tokenClauses.join(' AND ')}`;
            const rows = safeJson(await connection.query(tokenSql));
            // Token-AND query is already scoped to this ref; keep those rows directly.
            appendLikeMatchesForRef(r, rows);
          } catch { /* negeer */ }
        }
      }

      if (chunkFailures > 0) {
        console.warn(`Resolve LIKE normalized query fallback active for ${chunkFailures} chunk(s).`);
      }
    }

    // Check voor inactive products vóór we de connectie sluiten
    let inactiveCheckResults = [];
    try {
      const allInputRefs = norm.map(n => n.ref);
      const likeClauses = allInputRefs.map(r => {
        const esc = r.replace(/'/g, "''");
        return `${quoteIdentifier('SUPPLIER_REFERENCE')} LIKE '%${esc}%' OR ${quoteIdentifier('SKU')} = '${esc}'`;
      });
      const inactiveSql = `SELECT ${quoteIdentifier('SKU')}, ${quoteIdentifier('SUPPLIER_REFERENCE')}, ${quoteIdentifier('SUPPLIER_REF_NO_BRAND')}, ${quoteIdentifier('ACTIVE')} FROM business WHERE (${likeClauses.join(' OR ')})`;
      inactiveCheckResults = safeJson(await connection.query(inactiveSql));
    } catch(e) { /* negeer */ }

    await connection.close();

    const nameOf = p => String(p['PRODUCT_NAME_H1.nl_BE'] || p.Name || '');
    const normalizeBrand = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const brandMatchesProduct = (brand, p) => {
      const b = normalizeBrand(brand);
      if (!b) return true;
      const name = normalizeBrand(nameOf(p));
      const sup = normalizeBrand(p.SUPPLIER_REFERENCE || '');
      if (!name && !sup) return false;
      return name.includes(b) || sup.includes(b);
    };
    const applyBrandFilter = (arr, brand) => {
      if (!brand) return arr;
      const filtered = arr.filter(p => brandMatchesProduct(brand, p));
      return filtered.length ? filtered : [];
    };
    const toResolved = (p, ref, amount, matchType, line, confidence = 100, text = '') => ({
      ref, amount, matchType, line, confidence, text,
      sku: String(p.SKU),
      supref: p.SUPPLIER_REFERENCE || '',
      name: nameOf(p),
      price: p.PRICE ?? 0
    });
    const hasExactCodeTokenInName = (ref, p) => {
      const refNorm = normalizeRef(ref);
      if (!refNorm) return false;
      const tokens = String(nameOf(p) || '').match(/[A-Za-z0-9][A-Za-z0-9./-]{2,}/g) || [];
      for (const token of tokens) {
        if (normalizeRef(token) === refNorm) {
          return true;
        }
      }
      return false;
    };
    const isExactSuprefMatch = (ref, p) => {
      const leftNorm = normalizeRef(ref);
      const rawNoBrandRef = p && p.SUPPLIER_REF_NO_BRAND ? p.SUPPLIER_REF_NO_BRAND : '';
      const noBrandNorm = normalizeRef(rawNoBrandRef);
      if (leftNorm && noBrandNorm && leftNorm === noBrandNorm) {
        return true;
      }
      const rawSupRef = p && p.SUPPLIER_REFERENCE ? p.SUPPLIER_REFERENCE : '';
      const rightNorm = normalizeRef(rawSupRef);
      if (leftNorm && rightNorm && leftNorm === rightNorm) {
        return true;
      }
      if (leftNorm && extractReferenceTokens(rawSupRef).includes(leftNorm)) {
        return true;
      }
      // Fallback: soms staat de referentie enkel als exact token in de productnaam.
      if (hasExactCodeTokenInName(ref, p)) {
        return true;
      }
      return false;
    };
    const toCandidate = (p, ref, brand) => ({
      sku: String(p.SKU),
      supref: p.SUPPLIER_REFERENCE || '',
      name: nameOf(p),
      exactMatch: isExactSuprefMatch(ref, p),
      brandMatch: brand ? brandMatchesProduct(brand, p) : false,
      recommended: false
    });
    // Score een kandidaat op woord-overlap met de volledige invoerregel.
    // Zo herkennen we het juiste product op merk, maat én type (bv. PFERD-borstel
    // i.p.v. een SNICKERS-jas die toevallig hetzelfde referentienummer bevat).
    const tokenize = s => (String(s).toLowerCase().match(/[a-z0-9]+/g) || []);
    const scoreCandidate = (p, text, brand) => {
      const name = nameOf(p).toLowerCase();
      if (!name) return 0;
      let score = 0;
      const toks = Array.from(new Set(tokenize(text))).filter(t => t.length >= 2);
      for (const t of toks) if (name.includes(t)) score++;
      if (brand && name.includes(brand.toLowerCase())) score += 2;
      return score;
    };
    // Kies uit meerdere matches de kandidaat met de hoogste score. Bij een duidelijke
    // winnaar lossen we automatisch op; anders tonen we de keuze met de beste aanbevolen.
    const pickFromMany = (arr, ref, amount, brand, text, line, matchType, resolved, ambiguous) => {
      const scored = arr.map(p => ({ p, score: scoreCandidate(p, text, brand) }));
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      const second = scored[1];
      if (best.score > 0 && (!second || best.score > second.score)) {
        const total = best.score + (second ? second.score : 0);
        let confidence = total > 0 ? Math.round((best.score / total) * 100) : 70;
        confidence = Math.min(97, Math.max(55, confidence));
        resolved.push(toResolved(best.p, ref, amount, matchType + '-match', line, confidence, text));
        return;
      }
      // Markeer exact één aanbevolen kandidaat: eerst exacte ref-match, dan hoogste score.
      const ranked = arr
        .map(p => ({
          p,
          score: scoreCandidate(p, text, brand),
          exact: isExactSuprefMatch(ref, p)
        }))
        .sort((a, b) => {
          if (a.exact !== b.exact) return a.exact ? -1 : 1;
          if (b.score !== a.score) return b.score - a.score;
          return String(a.p.SKU || '').localeCompare(String(b.p.SKU || ''));
        });

      const recommendedSku = ranked.length ? String(ranked[0].p.SKU || '') : '';
      const candidates = ranked.slice(0, 10).map(({ p }) => {
        const c = toCandidate(p, ref, brand);
        c.recommended = recommendedSku && String(c.sku) === recommendedSku;
        return c;
      });
      ambiguous.push({ ref, amount, line, brand, text, candidates });
    };

    const resolved = [], ambiguous = [], unresolved = [];
    for (const { ref, amount, line, brand, text } of norm) {
      if (skuRegex.test(ref) && bySku[ref]) {
        if (brand && !brandMatchesProduct(brand, bySku[ref])) {
          unresolved.push({ ref, amount, line, brand, text, reason: 'brand-mismatch' });
          continue;
        }
        resolved.push(toResolved(bySku[ref], ref, amount, 'sku', line, 100, text));
        continue;
      }
      const key = sanitize(ref).toLowerCase();
      const normKey = normalizeRef(ref);
      if (bySupExact[key]) {
        const arr = applyBrandFilter(bySupExact[key], brand);
        if (!arr.length) {
          unresolved.push({ ref, amount, line, brand, text, reason: 'brand-mismatch' });
          continue;
        }
        if (arr.length === 1) resolved.push(toResolved(arr[0], ref, amount, 'supref', line, 100, text));
        else pickFromMany(arr, ref, amount, brand, text, line, 'supref', resolved, ambiguous);
        continue;
      }
      if (normKey && bySupNormalized[normKey]) {
        const arr = applyBrandFilter(bySupNormalized[normKey], brand);
        if (!arr.length) {
          unresolved.push({ ref, amount, line, brand, text, reason: 'brand-mismatch' });
          continue;
        }
        if (arr.length === 1) resolved.push(toResolved(arr[0], ref, amount, 'supref-normalized', line, 95, text));
        else pickFromMany(arr, ref, amount, brand, text, line, 'supref-normalized', resolved, ambiguous);
        continue;
      }
      if (bySupLike[key]) {
        const arr = applyBrandFilter(bySupLike[key], brand);
        if (!arr.length) {
          // Enkel bij vage teksttermen mag een brand-mismatch nog door.
          // Voor code-achtige refs (bv. 7101200, FB8) leidt dit meestal tot verkeerde matches.
          if (isSpecificCodeRef(ref)) {
            unresolved.push({ ref, amount, line, brand, text, reason: 'brand-mismatch' });
            continue;
          }

          // LIKE match gevonden maar brand stemt niet overeen → accepteer toch op basis van referentienummer
          const likeArr = bySupLike[key];
          if (likeArr.length === 1) {
            console.log(`[smart-import] ref ${ref}: brand-mismatch genegeerd (1 LIKE match)`);
            resolved.push(toResolved(likeArr[0], ref, amount, 'supref-like', line, 85, text));
          } else if (likeArr.length > 1) {
            pickFromMany(likeArr, ref, amount, brand, text, line, 'supref-like', resolved, ambiguous);
          } else {
            unresolved.push({ ref, amount, line, brand, text, reason: 'brand-mismatch' });
          }
          continue;
        }
        if (arr.length === 1) resolved.push(toResolved(arr[0], ref, amount, 'supref-like', line, 90, text));
        else pickFromMany(arr, ref, amount, brand, text, line, 'supref-like', resolved, ambiguous);
        continue;
      }
      unresolved.push({ ref, amount, line, text });
    }

    console.log(`[smart-import] resultaat: ✓ ${resolved.length} opgelost, ⚠ ${ambiguous.length} keuze, ✗ ${unresolved.length} niet gevonden`);
    if (unresolved.length > 0) {
      console.log(`[smart-import] niet gevonden: ${unresolved.map(u => u.ref).join(', ')}`);
      if (inactiveCheckResults.length > 0) {
        const unresolvedRefs = new Set(unresolved.map(u => u.ref));
        // Verrijk unresolved items met inactive info
        for (const item of unresolved) {
          const itemNorm = normalizeRef(item.ref || '');
          const strictCodeRef = isSpecificCodeRef(item.ref);
          const inactiveMatch = inactiveCheckResults.find(r =>
            (String(r.SKU || '') === String(item.ref || '')) ||
            (strictCodeRef
              ? (
                  (itemNorm && normalizeRef(r.SUPPLIER_REFERENCE || '') === itemNorm) ||
                  (itemNorm && normalizeRef(r.SUPPLIER_REF_NO_BRAND || '') === itemNorm) ||
                  containsExactToken(r.SUPPLIER_REFERENCE || '', item.ref || '')
                )
              : String(r.SUPPLIER_REFERENCE || '').includes(item.ref))
          );
          if (inactiveMatch && String(inactiveMatch.ACTIVE) !== '1') {
            item.inactive = true;
            item.inactiveSku = String(inactiveMatch.SKU);
            item.inactiveSupref = String(inactiveMatch.SUPPLIER_REFERENCE || '');
            console.warn(`[smart-import] ⚠ ref ${item.ref} bestaat in database maar is INACTIVE (SKU: ${inactiveMatch.SKU})`);
          }
        }
        const stillMissing = unresolved.filter(u => !u.inactive);
        if (stillMissing.length > 0) console.log(`[smart-import] echt niet in database: ${stillMissing.map(u => u.ref).join(', ')}`);
      }
    }

    res.json({ resolved, ambiguous, unresolved, truncated });
  } catch (err) {
    console.error('ODBC Resolve Error', err);
    res.status(500).json({ error: 'ODBC resolve failed', details: err.message });
  }
});

module.exports = router;

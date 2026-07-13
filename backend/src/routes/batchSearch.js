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
      let likeClauses = [];
      likeClauses.push(...likeTerms.map(s => `${quoteIdentifier('SUPPLIER_REFERENCE')} LIKE '%${s.replace(/'/g, "''")}%'`));
      likeClauses.push(...likeTerms.map(n => `${quoteIdentifier('PRODUCT_NAME_H1.nl_BE')} LIKE '%${n.replace(/'/g, "''")}%'`));
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
    const skuRegex = /^\d{8}$/;

    const uniqueRefs = Array.from(new Set(norm.map(n => n.ref)));
    // Een 8-cijferig getal kan een Klium-SKU zijn, maar ook een leveranciersreferentie
    // (bv. een PFERD-code). Daarom proberen we elke referentie als leveranciersreferentie,
    // en 8-cijferige extra als SKU. De SKU-match krijgt voorrang in de verwerking hieronder.
    const skuRefs = uniqueRefs.filter(r => skuRegex.test(r));
    const supRefs = Array.from(new Set(
      uniqueRefs.map(sanitize).filter(Boolean)
    ));

    const fieldList = FIELDS.map(quoteIdentifier).join(',');
    const connection = await odbc.connect(ODBC_CONNECTION_STRING);

    const bySku = {};      // sku -> product
    const bySupExact = {}; // supref(lower) -> [products]

    if (skuRefs.length > 0) {
      const list = skuRefs.map(s => `'${s}'`).join(',');
      const sql = `SELECT ${fieldList} FROM business WHERE ${quoteIdentifier('ACTIVE')} = '1' AND ${quoteIdentifier('SKU')} IN (${list})`;
      const rows = safeJson(await connection.query(sql));
      rows.forEach(p => { if (p.SKU) bySku[String(p.SKU)] = p; });
    }

    if (supRefs.length > 0) {
      const list = supRefs.map(s => `'${s.replace(/'/g, "''")}'`).join(',');
      const sql = `SELECT ${fieldList} FROM business WHERE ${quoteIdentifier('ACTIVE')} = '1' AND ${quoteIdentifier('SUPPLIER_REFERENCE')} IN (${list})`;
      const rows = safeJson(await connection.query(sql));
      rows.forEach(p => {
        const key = String(p.SUPPLIER_REFERENCE || '').toLowerCase();
        if (!bySupExact[key]) bySupExact[key] = [];
        bySupExact[key].push(p);
      });
    }

    // Fallback: voor leveranciersreferenties zonder exacte match, probeer LIKE.
    // Guard: enkel voor termen die op een echte referentie lijken (>= 4 tekens en
    // minstens 1 cijfer), zodat we geen 'domme' brede zoekopdrachten sturen.
    // Alle overige termen gaan in ÉÉN gecombineerde query (OR), zodat een import nooit
    // meer dan 3 database-queries kost, ongeacht het aantal regels.
    const looksLikeRef = r => r.length >= 4 && /\d/.test(r);
    const bySupLike = {}; // ref(lower) -> [products]
    const supUnmatched = supRefs.filter(r => !bySupExact[r.toLowerCase()] && looksLikeRef(r));
    if (supUnmatched.length > 0) {
      // Zoek per term zowel in de leveranciersreferentie als in de productnaam,
      // want model-/typecodes (bv. "BLDDRC-402C") staan vaak in de naam en niet
      // in de leveranciersreferentie.
      const likeClauses = [];
      for (const r of supUnmatched) {
        const esc = r.replace(/'/g, "''");
        likeClauses.push(`${quoteIdentifier('SUPPLIER_REFERENCE')} LIKE '%${esc}%'`);
        likeClauses.push(`${quoteIdentifier('PRODUCT_NAME_H1.nl_BE')} LIKE '%${esc}%'`);
      }
      const sql = `SELECT ${fieldList} FROM business WHERE ${quoteIdentifier('ACTIVE')} = '1' AND (${likeClauses.join(' OR ')})`;
      try {
        const rows = safeJson(await connection.query(sql));
        // Wijs elk gevonden product toe aan de term(en) die het matcht (referentie of naam).
        for (const r of supUnmatched) {
          const rl = r.toLowerCase();
          const matched = rows.filter(p =>
            String(p.SUPPLIER_REFERENCE || '').toLowerCase().includes(rl) ||
            String(p['PRODUCT_NAME_H1.nl_BE'] || '').toLowerCase().includes(rl)
          );
          if (matched.length) bySupLike[rl] = matched;
        }
      } catch (e) { /* negeer LIKE-fouten */ }
    }

    await connection.close();

    const nameOf = p => String(p['PRODUCT_NAME_H1.nl_BE'] || p.Name || '');
    const toResolved = (p, ref, amount, matchType, line, confidence = 100) => ({
      ref, amount, matchType, line, confidence,
      sku: String(p.SKU),
      supref: p.SUPPLIER_REFERENCE || '',
      name: nameOf(p),
      price: p.PRICE ?? 0
    });
    const toCandidate = (p, brand) => ({
      sku: String(p.SKU),
      supref: p.SUPPLIER_REFERENCE || '',
      name: nameOf(p),
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
        resolved.push(toResolved(best.p, ref, amount, matchType + '-match', line, confidence));
        return;
      }
      const topScore = best.score;
      const candidates = arr.slice(0, 10).map(p => {
        const c = toCandidate(p, brand);
        c.recommended = topScore > 0 && scoreCandidate(p, text, brand) === topScore;
        return c;
      });
      ambiguous.push({ ref, amount, line, brand, candidates });
    };

    const resolved = [], ambiguous = [], unresolved = [];
    for (const { ref, amount, line, brand, text } of norm) {
      if (skuRegex.test(ref) && bySku[ref]) {
        resolved.push(toResolved(bySku[ref], ref, amount, 'sku', line, 100));
        continue;
      }
      const key = sanitize(ref).toLowerCase();
      if (bySupExact[key]) {
        const arr = bySupExact[key];
        if (arr.length === 1) resolved.push(toResolved(arr[0], ref, amount, 'supref', line, 100));
        else pickFromMany(arr, ref, amount, brand, text, line, 'supref', resolved, ambiguous);
        continue;
      }
      if (bySupLike[key]) {
        const arr = bySupLike[key];
        if (arr.length === 1) resolved.push(toResolved(arr[0], ref, amount, 'supref-like', line, 90));
        else pickFromMany(arr, ref, amount, brand, text, line, 'supref-like', resolved, ambiguous);
        continue;
      }
      unresolved.push({ ref, amount, line });
    }

    res.json({ resolved, ambiguous, unresolved, truncated });
  } catch (err) {
    console.error('ODBC Resolve Error', err);
    res.status(500).json({ error: 'ODBC resolve failed', details: err.message });
  }
});

module.exports = router;

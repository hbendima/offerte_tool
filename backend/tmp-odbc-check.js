const odbc = require('odbc');

const conn = 'DSN=Elastic UAT;DATABASE=de02157346244195ac7c0474dce38008;';

(async () => {
  const c = await odbc.connect(conn);
  const ref = '4933459637';
  const queries = [
    ['eq', `SELECT "SKU", "SUPPLIER_REFERENCE" FROM business WHERE "ACTIVE"='1' AND "SUPPLIER_REFERENCE"='${ref}'`],
    ['trim', `SELECT "SKU", "SUPPLIER_REFERENCE" FROM business WHERE "ACTIVE"='1' AND TRIM("SUPPLIER_REFERENCE")='${ref}'`],
    ['like', `SELECT "SKU", "SUPPLIER_REFERENCE" FROM business WHERE "ACTIVE"='1' AND "SUPPLIER_REFERENCE" LIKE '%${ref}%'`],
    ['normalized', `SELECT "SKU", "SUPPLIER_REFERENCE" FROM business WHERE "ACTIVE"='1' AND LOWER(REPLACE(REPLACE(REPLACE(REPLACE("SUPPLIER_REFERENCE", ' ', ''), '-', ''), '.', ''), '/', ''))='${ref}'`]
  ];

  for (const [name, sql] of queries) {
    try {
      const rows = await c.query(sql);
      console.log(name, rows.length, JSON.stringify(rows.slice(0, 5)));
    } catch (e) {
      console.log(name, 'ERR', e.message);
    }
  }

  await c.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});

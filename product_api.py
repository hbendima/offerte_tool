from flask import Flask, request, jsonify
import pyodbc

app = Flask(__name__)

DSN = 'Elastic PRD'
DB = 'af18a173ef024c099dccaa12408ad127'
FIELDS = [
    "SKU", "SUPPLIER_REFERENCE", "PRODUCT_NAME_H1.nl_BE", "PRICE", "DISCOUNT", "DISCOUNT_PCT_INT",
    "ECOTAX", "COST", "MARGIN", "MARGIN_PCT", "ACTIVE", "VISIBILITY_BE", "VISIBILITY_NL", "VISIBILITY_COM"
]

@app.route('/products', methods=['GET'])
def get_products():
    skus = request.args.get('skus', '')
    sku_list = [s.strip() for s in skus.split(',') if s.strip()]
    if not sku_list:
        return jsonify({"error": "No SKUs provided"}), 400

    conn_str = f'DSN={DSN};DATABASE={DB};'
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()

    # Product data
    placeholders = ','.join(['?'] * len(sku_list))
    sql = f"SELECT {','.join(FIELDS)} FROM business WHERE SKU IN ({placeholders})"
    cursor.execute(sql, sku_list)
    products = cursor.fetchall()
    product_dict = {row.SKU: {field: getattr(row, field, None) for field in FIELDS} for row in products}

    # Stock
    sql_stock = f"SELECT SKU, LAST_STATE@IMH_HAS FROM storage_stock_update WHERE SKU IN ({placeholders})"
    cursor.execute(sql_stock, sku_list)
    for row in cursor.fetchall():
        if row.SKU in product_dict:
            product_dict[row.SKU]["stock"] = row[1]
        else:
            product_dict[row.SKU] = {"stock": row[1]}

    # UOM
    sql_uom = f"SELECT SKU, SALES_QUANTITY, UOM FROM storage_article_price WHERE SKU IN ({placeholders})"
    cursor.execute(sql_uom, sku_list)
    for row in cursor.fetchall():
        if row.SKU in product_dict:
            product_dict[row.SKU]["MSQ"] = row[1]
            product_dict[row.SKU]["UOM"] = row[2]
        else:
            product_dict[row.SKU] = {"MSQ": row[1], "UOM": row[2]}

    conn.close()
    results = [data for data in product_dict.values()]
    return jsonify(results)

if __name__ == '__main__':
    app.run(port=5000)
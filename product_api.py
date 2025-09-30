from flask import Flask, request, jsonify
import pyodbc
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DSN = 'Elastic PRD'
DB = 'af18a173ef024c099dccaa12408ad127'
FIELDS = [
    "SKU", "SUPPLIER_REFERENCE", "PRODUCT_NAME_H1.nl_BE", "PRICE", "DISCOUNT", "DISCOUNT_PCT_INT",
    "ECOTAX", "COST", "MARGIN", "MARGIN_PCT", "ACTIVE", "VISIBILITY_BE", "VISIBILITY_NL", "VISIBILITY_COM"
]

def yesno(val):
    # Explicitly treat 1 as Yes, everything else as No
    return "Yes" if val == 1 else "No"

def rename_fields(product):
    return {
        "SKU": product.get("SKU"),
        "Name": product.get("PRODUCT_NAME_H1.nl_BE"),
        "Price": product.get("PRICE"),
        "Discount": product.get("DISCOUNT"),
        "Discount%": product.get("DISCOUNT_PCT_INT"),
        "Cost": product.get("COST"),
        "M€": product.get("MARGIN"),
        "M%": product.get("MARGIN_PCT"),
        "Voor Sale": yesno(product.get("ACTIVE")),
        "Op BE": yesno(product.get("VISIBILITY_BE")),
        "Op NL": yesno(product.get("VISIBILITY_NL")),
        "Op COM": yesno(product.get("VISIBILITY_COM")),
        "Stock": product.get("Stock"),
        "MSQ": product.get("MSQ"),
        "UOM": product.get("UOM"),
        "Ecotax": product.get("ECOTAX"),
        "SUPPLIER_REFERENCE": product.get("SUPPLIER_REFERENCE")
    }

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
    product_dict = {row[0]: {field: row[idx] if idx < len(row) else None for idx, field in enumerate(FIELDS)} for row in products}
    for sku in product_dict:
        product_dict[sku]["Stock"] = 0
        product_dict[sku]["MSQ"] = 0
        product_dict[sku]["UOM"] = ""

    # Stock (LAST_STATE@IMH_HAS)
    sql_stock = f"SELECT SKU, LAST_STATE@IMH_HAS FROM storage_stock_update WHERE SKU IN ({placeholders})"
    cursor.execute(sql_stock, sku_list)
    for row in cursor.fetchall():
        sku = row[0]
        value = row[1]
        if sku in product_dict:
            product_dict[sku]["Stock"] = value if value is not None else 0

    # UOM (SALES_QUANTITY, UOM)
    sql_uom = f"SELECT SKU, SALES_QUANTITY, UOM FROM storage_article_price WHERE SKU IN ({placeholders})"
    cursor.execute(sql_uom, sku_list)
    for row in cursor.fetchall():
        sku = row[0]
        msq = row[1]
        uom = row[2]
        if sku in product_dict:
            product_dict[sku]["MSQ"] = msq if msq is not None else 0
            product_dict[sku]["UOM"] = uom if uom is not None else ""

    conn.close()
    results = [rename_fields(data) for data in product_dict.values()]
    return jsonify({"products": results})

if __name__ == '__main__':
    app.run(port=5000)
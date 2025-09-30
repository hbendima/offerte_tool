import pyodbc
dsn = 'Elastic PRD'
sku = '02067726'
conn = pyodbc.connect(f'DSN={dsn}')
cursor = conn.cursor()

# Product info
cursor.execute(f"SELECT SKU, PRICE FROM business WHERE SKU = '{sku}'")
for row in cursor:
    print('Product:', row)

# Stock
cursor.execute(f"SELECT LAST_STATE@IMH_HAS FROM storage_stock_update WHERE SKU = '{sku}'")
for row in cursor:
    print('Stock:', row[0])

# MSQ
cursor.execute(f"SELECT SALES_QUANTITY FROM storage_article_price WHERE SKU = '{sku}'")
for row in cursor:
    print('MSQ:', row[0])

conn.close()
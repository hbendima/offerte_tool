import pyodbc
dsn = 'Elastic PRD'
db = 'af18a173ef024c099dccaa12408ad127'
table = 'business'
sku = '02067726'
conn = pyodbc.connect(f'DSN={dsn}')
cursor = conn.cursor()
cursor.execute(f"SELECT SKU, PRICE FROM business WHERE SKU = '{sku}'")
for row in cursor:
    print(row)
conn.close()
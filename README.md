# Offerte Tool

Deze tool is een moderne vervanger voor de oude Excel-macro offerteflow.  
Hiermee kun je snel productdata ophalen, marges berekenen en resultaten tonen in een webinterface.

---

## **Architectuur & Servers**

De tool bestaat uit drie onderdelen die als aparte servers draaien:

### 1. **Python API Server (`product_api.py`)**
- **Doel:** Haalt productinformatie, voorraad en UOM direct uit Elastic PRD via ODBC.
- **Uitvoering:**  
  - **Maak en activeer een virtual environment (venv):**
    ```sh
    python -m venv .venv
    .venv\Scripts\activate
    ```
  - **Installeer dependencies:**
    ```sh
    pip install -r requirements.txt
    ```
    *(Of: `pip install flask flask-cors pyodbc` als er geen requirements.txt is)*
  - **Start de server vanuit de juiste map:**
    ```sh
    python product_api.py
    ```
  - Luistert standaard op poort `5000`.

### 2. **Backend Server (Node.js/Express)**
- **Doel:** Verwerkt frontend requests, berekent marges/kortingen en communiceert met de Python API.
- **Uitvoering:**  
  - Ga naar de backend-directory:
    ```sh
    npm install
    npm start
    ```
  - Luistert meestal op poort `3001` (pas aan indien gewenst).

### 3. **Frontend Server (React/Vite)**
- **Doel:** Webinterface voor invoer SKUs/aantallen en tonen van het eindresultaat.
- **Uitvoering:**  
  - **Let op Node.js versie:** Gebruik minimaal Node.js 22.12.0 (LTS) voor compatibiliteit met Vite.
  - Ga naar de frontend-directory:
    ```sh
    npm install
    npm run dev
    ```
  - Bereikbaar via `http://localhost:3000`.

---

## **Workflow**

1. Start **eerst** de Python API (`product_api.py`), dan de backend, dan de frontend.
2. Open een browser en navigeer naar `http://localhost:3000`.
3. Vul SKUs en hoeveelheden in, klik op 'Continue' en bekijk de berekende tabel.

---

## **Tip voor samenwerking en deployment**

- Gebruik een `.gitignore` zodat de `venv/`, `node_modules/` en andere tijdelijke/binary files niet meegecommit worden.
- Leg alle dependencies vast in `requirements.txt` (Python) en `package.json` (Node).
- Bij werken op een nieuwe PC:
  - Installeer eerst alle dependencies.
  - Maak een nieuwe venv en activeer deze vóór je Python dependencies installeert of de API start.
  - Controleer je Node.js versie en upgrade indien nodig.
  - Start de servers zoals hierboven.

---

## **Vervolgdocumentatie**

- Uitleg over API endpoints
- Uitleg over berekeningen en logica
- Exportmogelijkheden (Excel/PDF)
- FAQ: veelvoorkomende fouten en oplossingen

---
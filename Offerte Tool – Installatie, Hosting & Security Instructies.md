# Offerte Tool – Installatie, Hosting & Security Instructies

Dit document bevat alle informatie voor het installeren, hosten en beveiligen van de Offerte Tool binnen het interne bedrijfsnetwerk.

---

## Overzicht

De Offerte Tool bestaat uit drie onderdelen:
1. **Python API** (`product_api.py`)
2. **Node.js Backend** (Express)
3. **Frontend** (React/Vite)

Deze servers communiceren met elkaar en tonen gevoelige prijsinformatie.  
Het is essentieel dat de tool alleen intern toegankelijk is en goed beveiligd wordt.

---

## Benodigdheden

- **Windows Server** (Linux kan ook, pas paden/commando’s aan)
- **Python 3.11+**
- **Node.js 22.12.0 (LTS) of hoger**
- **Git**
- **ODBC-driver** voor Elastic PRD (voor Python API)
- **Toegang tot Elastic PRD database**
- **Poorten openzetten**: standaard 5000 (API), 3001 (backend), 3000 (frontend)

---

## Installatie stappen

### 1. **Clone de repository**
```sh
git clone <repo-url>
cd <project-map>
```

### 2. **Python API installeren**
```sh
cd offerte_tool
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```
- Controleer of de **Elasticsearch ODBC-driver** geïnstalleerd is.
- Vul `.env` aan met database credentials indien nodig.

### 3. **Node.js Backend installeren**
```sh
cd backend
npm install
```
- Vul `.env` aan met API endpoint en andere settings.

### 4. **Frontend installeren**
```sh
cd frontend-vite
npm install
```
- Pas eventueel de API URL aan in de frontend config.

---

## Servers starten

- **Python API**  
  ```
  cd offerte_tool
  .venv\Scripts\activate
  python product_api.py
  ```
  *(Standaard poort: 5000)*

- **Node.js Backend**  
  ```
  cd backend
  npm start
  ```
  *(Standaard poort: 3001)*

- **Frontend**  
  ```
  cd frontend-vite
  npm run build
  npm run preview
  ```
  *(Standaard poort: 3000, of serve als statische site via IIS/NGINX/Apache)*

---

## Productie deployment (advies)

- Gebruik **process managers** zoals [pm2](https://pm2.keymetrics.io/) voor Node.js en [waitress](https://docs.pylonsproject.org/projects/waitress/en/latest/) voor Python.
- Zet de frontend als **statische site** achter een webserver (IIS/NGINX/Apache).
- Zorg dat alle servers automatisch herstarten bij een reboot.
- Zet de servers op interne IP’s en stel een reverse proxy in voor één centrale URL (bijvoorbeeld: `https://offertetool.klium.local`).
- Beveilig de API en backend met firewalls en eventueel authenticatie.

---

## Security Checklist

### 1. **Netwerk & Toegankelijkheid**
- Host alle servers uitsluitend op het interne bedrijfsnetwerk.
- Zorg dat de servers niet bereikbaar zijn vanaf het publieke internet.
- Zet firewalls in om toegang te beperken tot vertrouwde IP-adressen.
- Gebruik interne DNS of een intern webadres.

### 2. **Authenticatie & Autorisatie**
- Beperk toegang tot de frontend tot medewerkers (bijvoorbeeld via Windows AD, SSO, of bedrijfslogin).
- Overweeg authenticatie voor de API en backend.

### 3. **API & Backend Security**
- Zorg dat de API alleen benaderbaar is door de backend/server, niet direct door eindgebruikers.
- Overweeg IP-whitelisting of interne API keys.
- Controleer en valideer alle inkomende requests.

### 4. **Gevoelige Data**
- Sla geen gevoelige prijsinformatie op in logbestanden, foutmeldingen of front-end code.
- Gebruik `.env` bestanden voor wachtwoorden, API keys en databasegegevens.
- Zorg dat `.env` en andere gevoelige configuratiebestanden niet in git staan.

### 5. **Communicatie & Encryptie**
- Gebruik HTTPS/TLS voor alle interne communicatie.
- Installeer een geldig intern SSL-certificaat.

### 6. **Updates & Onderhoud**
- Houd alle software, dependencies en servers up-to-date.
- Voer regelmatig security updates uit.
- Monitor logbestanden op verdachte activiteiten.

### 7. **Toegang & Beheer**
- Beperk servertoegang tot alleen bevoegde IT-medewerkers.
- Gebruik sterke wachtwoorden en/of SSH keys.

### 8. **Backup & Recovery**
- Maak regelmatig backups van configuratiebestanden en (indien van toepassing) data.
- Test recovery procedures periodiek.

---

## Toegankelijk maken voor medewerkers

- Geef de centrale web-URL door (bijvoorbeeld: `https://offertetool.klium.local`).
- Medewerkers hoeven niets te installeren, alleen de URL te openen in hun browser.

---

## Onderhoud & updates

- Updates uitvoeren via `git pull` en opnieuw builden/starten.
- Dependencies updaten via `pip install -r requirements.txt` en `npm install`.
- Logbestanden monitoren voor fouten.

---

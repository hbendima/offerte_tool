# IT Handover - Hosting Offerte Tool

Dit document is bedoeld voor company IT om de Offerte Tool van lokale dev-opzet naar een bedrijfsserver te brengen zonder extra context.

---

## 1. Doel en scope

De Offerte Tool bestaat uit:
- Frontend: React/Vite webapp (statische files na build)
- Backend: Node.js/Express API
- Databron: ODBC naar Elastic database (business + stock + article price tabellen)

Doel:
- Centrale hosting op bedrijfsserver
- Interne URL voor gebruikers
- Beheerbare, veilige productie-opzet (HTTPS, logging, restart)

Niet in scope:
- Python API (legacy)
- Vite dev server in productie

---

## 2. Huidige technische parameters (uit code)

Backend:
- Startcommando: `node src/app.js`
- Default poort: `3000` (kan via `PORT` env var)
- Health endpoint: `GET /api/health`

Frontend:
- Build output: `frontend-vite/dist`
- Dev proxy nu lokaal: `/api -> http://localhost:3000`

ODBC:
- Env var `ODBC_DSN` (default: `Elastic UAT`)
- Env var `ODBC_DATABASE` (default: `de02157346244195ac7c0474dce38008`)
- Verbinding wordt opgebouwd als: `DSN=<ODBC_DSN>;DATABASE=<ODBC_DATABASE>;`

Belangrijk:
- Queries naar `storage_stock_update` werken met `LAST_STATE@IMH_HAS` zonder brackets in deze omgeving.

---

## 3. Vereisten voor productiehosting

## 3.1 Server en software

Minimaal:
- 1 VM (Windows Server of Linux)
- Node.js LTS geinstalleerd
- ODBC driver geinstalleerd die met Elastic compatibel is
- DSN geconfigureerd op server (system DSN, niet user DSN)

Aanbevolen:
- Aparte omgevingen: TEST en PROD
- Service account voor applicatie (least privilege)

## 3.2 Netwerk en toegang

Nodig:
- Server -> Elastic endpoint outbound toegestaan
- DNS naamresolutie naar databron
- Firewall regels voor:
  - Inbound 443 naar reverse proxy
  - Geen directe backend-publicatie naar buiten

## 3.3 Security

Nodig:
- HTTPS certificaat (intern PKI of publiek)
- Reverse proxy met TLS terminatie (IIS/Nginx/Apache)
- CORS beperken tot bedrijfsdomein(en)
- Secrets/config via environment variables
- Geen credentials hardcoded in code

---

## 4. Pre-deployment checklist

IT kan onderstaande checklist letterlijk afvinken.

1. Server voorbereid
- [ ] Node.js LTS geinstalleerd
- [ ] ODBC driver geinstalleerd
- [ ] System DSN aangemaakt en getest
- [ ] Service account aangemaakt

2. Applicatie geplaatst
- [ ] Repo/code op server gezet
- [ ] `npm install` in root uitgevoerd
- [ ] `npm --prefix backend install` en `npm --prefix frontend-vite install` gelukt

3. Config ingesteld
- [ ] `PORT` ingesteld (bijv. 3000 intern)
- [ ] `ODBC_DSN` ingesteld (bijv. Elastic PROD)
- [ ] `ODBC_DATABASE` ingesteld
- [ ] `NODE_ENV=production`

4. Build en run
- [ ] Frontend build gemaakt (`npm --prefix frontend-vite run build`)
- [ ] Backend als service gestart
- [ ] Reverse proxy routeert `/api` naar backend
- [ ] Reverse proxy serveert frontend static files

5. Validatie
- [ ] `GET /api/health` geeft status ok
- [ ] Product-opzoeking werkt
- [ ] Resolve flow werkt
- [ ] ODBC stock query werkt
- [ ] HTTPS certificaat correct

---

## 5. Aanbevolen productie-architectuur

Browser (internal users)
-> HTTPS reverse proxy (IIS/Nginx)
-> static frontend (dist)
-> `/api/*` proxy naar Node backend service
-> backend via ODBC naar Elastic

Praktisch:
- Frontend en backend kunnen op dezelfde VM
- Backend enkel intern bereikbaar (localhost of private interface)
- Externe toegang alleen via proxy op 443

---

## 6. Concrete deployment-stappen (Windows voorbeeld)

## 6.1 Build

In project root:

```powershell
npm install
npm --prefix frontend-vite run build
```

## 6.2 Backend als service

Optie A (PM2):

```powershell
npm --prefix backend install
npm install -g pm2
pm2 start backend/src/app.js --name offerte-backend
pm2 save
pm2 startup
```

Optie B (NSSM):
- Maak Windows service die `node` start met argument `src/app.js` in working directory `backend`.

## 6.3 Reverse proxy (IIS conceptueel)

- Site root: `frontend-vite/dist`
- Rewrite/proxy regel:
  - `/api/*` -> `http://localhost:3000/api/*`
- HTTPS binding op 443 met certificaat

---

## 7. Environment variabelen (verplicht)

Minimaal:

```text
NODE_ENV=production
PORT=3000
ODBC_DSN=<system dsn name on server>
ODBC_DATABASE=<elastic database id>
```

Aanbevolen extra:

```text
CORS_ORIGIN=https://offerte-tool.<company-domain>
LOG_LEVEL=info
```

Opmerking:
- `ODBC_DSN` op server moet exact overeenkomen met de DSN-naam die in ODBC Data Sources is aangemaakt.
- Als IT een andere DSN naam gebruikt dan lokaal, enkel env var aanpassen; codewijziging is niet nodig.

---

## 8. Validatieplan na go-live

Functioneel:
1. Login pagina opent
2. SKU query geeft productnaam + prijs
3. Smart resolve werkt op mix van SKU + supplier ref
4. Stock/MSQ/UOM komen terug
5. PDF/Excel export werkt

Technisch:
1. `GET /api/health` = 200
2. ODBC connectie stabiel onder load
3. Geen CORS fouten in browser console
4. Restart test: service komt automatisch terug na reboot

---

## 9. Monitoring en support

Nodig:
- Applicatielogs met rotatie (dagelijks of op grootte)
- Error alerts op backend process exit
- Basis metriek: request count, error rate, response time

Support runbook (minimum):
1. Check service status
2. Check health endpoint
3. Check ODBC DSN beschikbaarheid
4. Check laatste backend logs
5. Herstart service indien nodig

---

## 10. Bekende aandachtspunten voor IT

1. Huidige loginroute gebruikt nog hardcoded demo-users.
- Voor productie: koppelen aan company SSO/AD of minstens veilige user store met gehashte wachtwoorden.

2. CORS staat nu open in code.
- Voor productie beperken tot bedrijfsdomein(en).

3. SQL wordt momenteel via stringopbouw gedaan.
- Functioneel werkt dit nu, maar hardening met parameterized queries is aanbevolen.

4. Scheiding DEV/TEST/PROD DSN en database is essentieel.

---

## 11. Benodigde info van IT terug naar business/dev

Graag bevestigen:
1. Definitieve URL (bijv. https://offerte-tool.company.local)
2. Gekozen server/omgeving (TEST/PROD)
3. Definitieve DSN naam en database id
4. Logging locatie
5. Support contactpunt en change-procedure

---

## 12. Copy/paste aanvraag naar IT

Onderstaande tekst kan rechtstreeks in ticket/mail:

```text
We request production-style hosting for the Offerte Tool.

Application components:
- Static frontend (React build)
- Node.js backend API
- ODBC connection to Elastic datasource

Required from IT:
1) Server/VM with Node LTS
2) ODBC driver + System DSN configured
3) Network access from app server to Elastic datasource
4) Reverse proxy with HTTPS (TLS cert)
5) Backend as managed service with auto restart
6) Environment variables configured:
   - NODE_ENV=production
   - PORT=3000
   - ODBC_DSN=<agreed DSN name>
   - ODBC_DATABASE=<agreed database id>
7) Logging and basic monitoring enabled

Acceptance checks:
- /api/health returns 200
- Product lookup and smart resolve work
- Stock query from storage_stock_update works
- App reachable via internal HTTPS URL
```

---

Einde document.

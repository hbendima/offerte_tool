# Offerte Tool Routemap & Objectieven

## Doel
Dit document beschrijft de roadmap, functionele wensen en openstaande punten voor de Offerte Tool.

---

## Huidige Situatie
- Moderne webtool ter vervanging van Excel-macro offerteflow
- Bestaat uit Python API, Node.js backend, React/Vite frontend

---

## Roadmap & Objectieven

### 1. Bugfixes
- [ ] CDC info mouseover toont alle SKU’s (bug: incomplete info bij mouseover)

### 2. Verbeteringen
- [ ] Toon totaal aantal producten boven kolom “Aantal”
- [ ] Sorteren op Marge, Proposal, M%P (kolommen sorteerbaar maken)

### 3. Nieuwe Features
- [ ] Globale korting toepassen op alle producten
    - [ ] Keuze: korting als bedrag of percentage
    - [ ] Reset-knop om originele prijzen te herstellen

---

## Toelichting Gevraagde Punten

1. **CDC info mouseover**
   - Mouseover bij CDC-info moet ALLE relevante SKU’s tonen, niet slechts één of enkele.

2. **Totaal aantal producten**
   - Boven de kolom “Aantal” moet het totaal aantal producten zichtbaar zijn.

3. **Sorteren**
   - Kolommen Marge, Proposal en M%P moeten klikbaar zijn voor sortering (oplopend/aflopend).

4. **Globale korting**
   - Mogelijkheid om een korting toe te passen op alle producten tegelijk.
   - Keuze tussen korting als vast bedrag of als percentage.
   - Reset-knop om alle kortingen terug te zetten naar de originele waarde.

---

## Status
- 23-02-2026: Roadmap opgesteld, wijzigingen van vandaag worden teruggedraaid.

---

## Volgende Stappen
- Code terugzetten naar stabiele versie vóór 23-02-2026
- Roadmap bespreken en prioriteren
- Features gefaseerd implementeren

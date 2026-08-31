Aanpassingen die moeten gebeuren aan de offerte tool om deze beter te maken:

## ✅ Opmerking vertaling (AFGEWERKT)
- **Status:** AFGEWERKT
- **Beschrijving:** "Opmerking" wordt nu correct vertaald in alle talen (NL/FR/EN) in PDF exports
- **Details:** 
  - Nederlands: "Opmerking"
  - Frans: "Remarque"
  - Engels: "Remark"
  - Label in PDF uses `t.remark` voor correct language support

## ✅ Verzendkosten feature (AFGEWERKT)
- **Status:** AFGEWERKT
- **Beschrijving:** Mogelijkheid om verzendkosten (excl. btw) in te voeren — wordt correct berekend en weergegeven in PDF/Excel
- **Details:**
  - Nieuw inputveld in UI tussen "Offertetotaal" en "Zichtbare nota"
  - Bedrag wordt ingegeven als excl. btw (btw wordt automatisch berekend)
  - BTW wordt correct berekend en getoond in PDF
  - Verzendkosten verschijnen in PDF tussen "Totaal producten" en "Totaal (excl. btw)"
  - Laat leeg = "Gratis verzending"
  - Wordt automatisch opgeslagen in offerte data
  - Klant totaal in UI wordt automatisch bijgewerkt

## ✅ Slim herkennen beter documenteren (AFGEWERKT)
- **Status:** AFGEWERKT
- **Beschrijving:** Duidelijke uitleg en tips voor hoe "slim herkennen" feature te gebruiken
- **Details:**
  - Added info box met duidelijke instructies
  - Uitleg: "Plak de volledige aanvraag, mail of offerte direct hier in. De tool zoekt automatisch SKU's en aantallen."
  - Vermelding dat ambigue regels apart verschijnen voor handmatige verificatie
  - Tip dat dit perfect werkt bij import uit PDF of e-mail
# DifferenzierungsEngine

Adaptives Mathe-Trainingstool für Klasse 5–12 (Oberstufe mit GK + LK).

> **Hinweis:** Dieses Tool wurde mit KI-Unterstützung erstellt (Anthropic Claude) — Aufgaben, Engine und QA; fachlich geprüft (adversariale Nachrechnung + Wolfram-Numerik).

**103 Themen, 3708 Aufgaben** von Arithmetik/Geometrie der Unterstufe bis Analysis, Analytische Geometrie und Stochastik.

## Bedienung

- `index.html` öffnen
- Thema wählen
- Aufgaben lösen — die Engine passt das Schwierigkeitsniveau (Level 1–6) automatisch an
- Fortschritt wird im Browser gespeichert (localStorage)

## Tastatur

- **Enter** — Antwort prüfen
- **→** — nächste Aufgabe
- **T** — Tipp anzeigen
- **1–4** — bei MC-Aufgaben

## Struktur

```
index.html              Startseite
spirale-engine.js       Lern-Logik
spirale.css             Styling
trainer/                33 Themen-HTMLs
```

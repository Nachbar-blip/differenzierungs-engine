// Zahlenstrahl-Spiel "Stelle die Zahl" - Aufgabenkatalog (5 Stufen x 8 Aufgaben).
// Kuratierte Fallen-Positionen = dokumentierte Fehlvorstellungen (Diagnose-Kern).
// WICHTIG: Datei ist komplett ASCII-only (Projekt-Regel, siehe _test_logik.js).
// Kommas in Anzeigen als KaTeX "{,}", Brueche als \tfrac.
'use strict';

// Fehlvorstellungs-Muster -> Trainer-Empfehlungen (Links relativ zu spiele/)
const EMPFEHLUNGEN = {
  "stellenwert": [
    "../trainer/5-zahlen-stellenwert.html",
    "../trainer/5-dezimalbrueche.html",
    "../trainer/6-dezimalbrueche-rechnen.html"
  ],
  "komma-trennt": [
    "../trainer/5-zahlen-stellenwert.html",
    "../trainer/5-dezimalbrueche.html"
  ],
  "laengere-zahl": [
    "../trainer/5-zahlen-stellenwert.html",
    "../trainer/5-dezimalbrueche.html"
  ],
  "bruch-als-paar": [
    "../trainer/5-brueche-anteile.html"
  ],
  "skala": [
    "../trainer/5-zahlen-stellenwert.html"
  ]
};

const STUFEN = [
  // ---------- Stufe 1: Natuerliche Zahlen, wechselnde Skalen ----------
  { nr: 1, name: "Zahlen bis 1000", aufgaben: [
    { id: "s1-01", stufe: 1, zahl: 7, anzeige: "7",
      strahl: { min: 0, max: 20, tick: 1, beschriftet: [0, 10, 20] },
      fallen: [
        { pos: 13, muster: "skala",
          text: "Z\u00e4hle vom Nullpunkt aus nach rechts, nicht von der 20 zur\u00fcck. Die 7 liegt links von der 10." }
      ],
      hilfe: { typ: "natuerlich", unterteile: 1 } },
    { id: "s1-02", stufe: 1, zahl: 14, anzeige: "14",
      strahl: { min: 0, max: 20, tick: 2, beschriftet: [0, 10, 20] },
      fallen: [
        { pos: 7, muster: "skala",
          text: "Schau genau: Ein Strich ist hier 2 wert, nicht 1. Der 7. Strich ist also die 14." }
      ],
      hilfe: { typ: "natuerlich", unterteile: 2 } },
    { id: "s1-03", stufe: 1, zahl: 30, anzeige: "30",
      strahl: { min: 0, max: 100, tick: 10, beschriftet: [0, 50, 100] },
      fallen: [
        { pos: 3, muster: "skala",
          text: "Ein Strich ist hier 10 wert. Der 3. Strich ist die 30, nicht die 3." }
      ],
      hilfe: { typ: "natuerlich", unterteile: 10 } },
    { id: "s1-04", stufe: 1, zahl: 65, anzeige: "65",
      strahl: { min: 0, max: 100, tick: 5, beschriftet: [0, 50, 100] },
      fallen: [
        { pos: 13, muster: "skala",
          text: "Ein Strich ist hier 5 wert. Die 65 liegt beim 13. Strich - kurz hinter der Mitte." }
      ],
      hilfe: { typ: "natuerlich", unterteile: 5 } },
    { id: "s1-05", stufe: 1, zahl: 350, anzeige: "350",
      strahl: { min: 0, max: 1000, tick: 50, beschriftet: [0, 500, 1000] },
      fallen: [
        { pos: 175, muster: "skala",
          text: "Ein Strich ist hier 50 wert, nicht 100. F\u00fcr 350 brauchst du 7 Striche." }
      ],
      hilfe: { typ: "natuerlich", unterteile: 50 } },
    { id: "s1-06", stufe: 1, zahl: 800, anzeige: "800",
      strahl: { min: 0, max: 1000, tick: 50, beschriftet: [0, 500, 1000] },
      fallen: [
        { pos: 400, muster: "skala",
          text: "Vorsicht: Ein Strich ist 50 wert. 800 liegt beim 16. Strich, weit rechts von der Mitte." }
      ],
      hilfe: { typ: "natuerlich", unterteile: 50 } },
    { id: "s1-07", stufe: 1, zahl: 12, anzeige: "12",
      strahl: { min: 0, max: 20, tick: 1, beschriftet: [0, 10, 20] },
      fallen: [
        { pos: 8, muster: "skala",
          text: "Die 12 ist gr\u00f6\u00dfer als 10, sie liegt also rechts von der Mitte. Z\u00e4hle von 0 aus." }
      ],
      hilfe: { typ: "natuerlich", unterteile: 1 } },
    { id: "s1-08", stufe: 1, zahl: 90, anzeige: "90",
      strahl: { min: 0, max: 100, tick: 10, beschriftet: [0, 50, 100] },
      fallen: [
        { pos: 9, muster: "skala",
          text: "Ein Strich ist 10 wert. Die 90 ist fast am rechten Ende, nicht beim 9." }
      ],
      hilfe: { typ: "natuerlich", unterteile: 10 } }
  ] },

  // ---------- Stufe 2: Dezimalzahlen mit 1 Nachkommastelle ----------
  { nr: 2, name: "Dezimalzahlen (Zehntel)", aufgaben: [
    { id: "s2-01", stufe: 2, zahl: 0.5, anzeige: "0{,}5",
      strahl: { min: 0, max: 1, tick: 0.1, beschriftet: [0, 1] },
      fallen: [
        { pos: 0.05, muster: "stellenwert",
          text: "0,5 sind 5 Zehntel - genau die Mitte zwischen 0 und 1. Nicht 5 Hundertstel!" }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.1 } },
    { id: "s2-02", stufe: 2, zahl: 0.8, anzeige: "0{,}8",
      strahl: { min: 0, max: 1, tick: 0.1, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.08, muster: "stellenwert",
          text: "0,8 sind 8 Zehntel - fast eine ganze 1. Ein Zehntel ist ein gro\u00dfes St\u00fcck!" }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.1 } },
    { id: "s2-03", stufe: 2, zahl: 1.5, anzeige: "1{,}5",
      strahl: { min: 0, max: 2, tick: 0.1, beschriftet: [0, 1, 2] },
      fallen: [
        { pos: 1.05, muster: "stellenwert",
          text: "1,5 ist 1 und 5 Zehntel - genau zwischen 1 und 2. Nicht nur ein kleines St\u00fcck hinter der 1." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.1 } },
    { id: "s2-04", stufe: 2, zahl: 2.3, anzeige: "2{,}3",
      strahl: { min: 0, max: 5, tick: 0.5, beschriftet: [0, 1, 2, 3, 4, 5] },
      fallen: [
        { pos: 1.15, muster: "skala",
          text: "Ein Strich ist hier ein Halbes (0,5) wert. 2,3 liegt kurz hinter der 2." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.5 } },
    { id: "s2-05", stufe: 2, zahl: 0.9, anzeige: "0{,}9",
      strahl: { min: 0, max: 2, tick: 0.1, beschriftet: [0, 1, 2] },
      fallen: [
        { pos: 0.09, muster: "stellenwert",
          text: "0,9 sind 9 Zehntel - fast bei der 1. Nicht 9 Hundertstel direkt an der 0." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.1 } },
    { id: "s2-06", stufe: 2, zahl: 4.5, anzeige: "4{,}5",
      strahl: { min: 0, max: 5, tick: 0.5, beschriftet: [0, 1, 2, 3, 4, 5] },
      fallen: [
        { pos: 2.25, muster: "skala",
          text: "Schau, was ein Strich wert ist: hier 0,5. 4,5 liegt zwischen 4 und 5, fast am Ende." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.5 } },
    { id: "s2-07", stufe: 2, zahl: 0.3, anzeige: "0{,}3",
      strahl: { min: 0, max: 1, tick: 0.1, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.03, muster: "stellenwert",
          text: "0,3 sind 3 Zehntel. Teile den Strahl in 10 Teile und nimm 3 davon." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.1 } },
    { id: "s2-08", stufe: 2, zahl: 1.2, anzeige: "1{,}2",
      strahl: { min: 0, max: 2, tick: 0.2, beschriftet: [0, 1, 2] },
      fallen: [
        { pos: 1.02, muster: "stellenwert",
          text: "1,2 ist 1 und 2 Zehntel. Zwei Zehntel sind ein ordentliches St\u00fcck hinter der 1." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.1 } }
  ] },

  // ---------- Stufe 3: Dezimalzahlen 2-3 Stellen, Kern 0,7 / 0,70 / 0,07 ----------
  { nr: 3, name: "Dezimalzahlen (Hundertstel)", aufgaben: [
    { id: "s3-01", stufe: 3, zahl: 0.7, anzeige: "0{,}7",
      strahl: { min: 0, max: 1, tick: 0.1, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.07, muster: "stellenwert",
          text: "7 Zehntel sind nicht 7 Hundertstel. Ein Zehntel ist ein gro\u00dfes St\u00fcck!" },
        { pos: 0.17, muster: "komma-trennt",
          text: "Das Komma trennt keine zwei Zahlen. 0,7 ist EINE Zahl: 7 Zehntel." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.1 } },
    { id: "s3-02", stufe: 3, zahl: 0.7, anzeige: "0{,}70",
      strahl: { min: 0, max: 1, tick: 0.05, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.07, muster: "stellenwert",
          text: "70 Hundertstel sind genau 7 Zehntel. Die Null am Ende macht die Zahl nicht kleiner." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.1 } },
    { id: "s3-03", stufe: 3, zahl: 0.07, anzeige: "0{,}07",
      strahl: { min: 0, max: 1, tick: 0.05, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.7, muster: "stellenwert",
          text: "Nicht bei 7 Zehnteln! 0,07 sind nur 7 Hundertstel - ganz nah an der 0." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.05 } },
    { id: "s3-04", stufe: 3, zahl: 0.25, anzeige: "0{,}25",
      strahl: { min: 0, max: 1, tick: 0.05, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.52, muster: "komma-trennt",
          text: "0,25 ist EINE Zahl, kleiner als die H\u00e4lfte. Lies sie als 25 Hundertstel." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.05 } },
    { id: "s3-05", stufe: 3, zahl: 2.15, anzeige: "2{,}15",
      strahl: { min: 0, max: 3, tick: 0.25, beschriftet: [0, 1, 2, 3] },
      fallen: [
        { pos: 2.65, muster: "laengere-zahl",
          text: "2,15 hat mehr Ziffern als 2,5 - ist aber KLEINER. 15 Hundertstel sind weniger als 5 Zehntel." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.25 } },
    { id: "s3-06", stufe: 3, zahl: 0.375, anzeige: "0{,}375",
      strahl: { min: 0, max: 1, tick: 0.125, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.04, muster: "stellenwert",
          text: "0,375 ist mehr als ein Viertel und fast die H\u00e4lfte - nicht winzig klein an der 0." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.125 } },
    { id: "s3-07", stufe: 3, zahl: 1.05, anzeige: "1{,}05",
      strahl: { min: 0, max: 2, tick: 0.1, beschriftet: [0, 1, 2] },
      fallen: [
        { pos: 1.5, muster: "komma-trennt",
          text: "1,05 ist nicht 1,5! Die Null h\u00e4lt die Zehntel-Stelle frei: nur 5 Hundertstel hinter der 1." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.1 } },
    { id: "s3-08", stufe: 3, zahl: 0.09, anzeige: "0{,}09",
      strahl: { min: 0, max: 1, tick: 0.1, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.9, muster: "stellenwert",
          text: "0,09 sind 9 Hundertstel - noch nicht mal ein Zehntel. Ganz nah an der 0." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.05 } }
  ] },

  // ---------- Stufe 4: Einfache Brueche (auch >1 als gemischte Zahl) ----------
  { nr: 4, name: "Brueche", aufgaben: [
    { id: "s4-01", stufe: 4, zahl: 0.5, zaehler: 1, nenner: 2, anzeige: "\\tfrac{1}{2}",
      strahl: { min: 0, max: 3, tick: 0.25, beschriftet: [0, 1, 2, 3] },
      fallen: [
        { pos: 2, muster: "bruch-als-paar",
          text: "Ein Bruch ist EINE Zahl, nicht 1 und 2. Ein Halbes liegt zwischen 0 und 1." }
      ],
      hilfe: { typ: "bruch", unterteile: 0.5 } },
    { id: "s4-02", stufe: 4, zahl: 0.25, zaehler: 1, nenner: 4, anzeige: "\\tfrac{1}{4}",
      strahl: { min: 0, max: 5, tick: 0.25, beschriftet: [0, 1, 2, 3, 4, 5] },
      fallen: [
        { pos: 4, muster: "bruch-als-paar",
          text: "Ein Viertel ist nicht die 4! Es ist ein Teil von einem Ganzen - kleiner als 1." },
        { pos: 1.4, muster: "bruch-als-paar",
          text: "Ein Viertel ist auch nicht 1,4. Teile die Strecke von 0 bis 1 in 4 gleiche Teile." }
      ],
      hilfe: { typ: "bruch", unterteile: 0.25 } },
    { id: "s4-03", stufe: 4, zahl: 0.75, zaehler: 3, nenner: 4, anzeige: "\\tfrac{3}{4}",
      strahl: { min: 0, max: 4, tick: 0.25, beschriftet: [0, 1, 2, 3, 4] },
      fallen: [
        { pos: 3, muster: "bruch-als-paar",
          text: "Drei Viertel sind nicht die 3. Es sind 3 von 4 Teilen eines Ganzen - kurz vor der 1." },
        { pos: 3.4, muster: "bruch-als-paar",
          text: "Drei Viertel sind auch nicht 3,4. Der Bruchstrich ist kein Komma." }
      ],
      hilfe: { typ: "bruch", unterteile: 0.25 } },
    { id: "s4-04", stufe: 4, zahl: 0.2, zaehler: 1, nenner: 5, anzeige: "\\tfrac{1}{5}",
      strahl: { min: 0, max: 1, tick: 0.2, beschriftet: [0, 1] },
      fallen: [
        { pos: 0.5, muster: "bruch-als-paar",
          text: "Die 5 unten sagt: 5 gleiche Teile. Ein F\u00fcnftel ist KLEINER als ein Halbes." }
      ],
      hilfe: { typ: "bruch", unterteile: 0.2 } },
    { id: "s4-05", stufe: 4, zahl: 0.1, zaehler: 1, nenner: 10, anzeige: "\\tfrac{1}{10}",
      strahl: { min: 0, max: 1, tick: 0.1, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.9, muster: "bruch-als-paar",
          text: "Die 10 sieht gro\u00df aus, aber ein Zehntel ist klein: 1 von 10 Teilen, nah an der 0." }
      ],
      hilfe: { typ: "bruch", unterteile: 0.1 } },
    { id: "s4-06", stufe: 4, zahl: 1.5, ganze: 1, zaehler: 1, nenner: 2, anzeige: "1\\tfrac{1}{2}",
      strahl: { min: 0, max: 2, tick: 0.25, beschriftet: [0, 1, 2] },
      fallen: [
        { pos: 0.5, muster: "bruch-als-paar",
          text: "1 1/2 hei\u00dft: ein Ganzes UND ein Halbes. Starte bei der 1, nicht bei der 0." }
      ],
      hilfe: { typ: "bruch", unterteile: 0.5 } },
    { id: "s4-07", stufe: 4, zahl: 2.25, ganze: 2, zaehler: 1, nenner: 4, anzeige: "2\\tfrac{1}{4}",
      strahl: { min: 0, max: 3, tick: 0.25, beschriftet: [0, 1, 2, 3] },
      fallen: [
        { pos: 0.25, muster: "bruch-als-paar",
          text: "2 1/4 sind zwei Ganze und ein Viertel dazu - kurz hinter der 2." }
      ],
      hilfe: { typ: "bruch", unterteile: 0.25 } },
    { id: "s4-08", stufe: 4, zahl: 0.7, zaehler: 7, nenner: 10, anzeige: "\\tfrac{7}{10}",
      strahl: { min: 0, max: 1, tick: 0.1, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.07, muster: "stellenwert",
          text: "7 Zehntel sind 7 von 10 Teilen - mehr als die H\u00e4lfte, nicht winzig klein." }
      ],
      hilfe: { typ: "bruch", unterteile: 0.1 } }
  ] },

  // ---------- Stufe 5: Gemischt inkl. Bruch <-> Dezimal ----------
  { nr: 5, name: "Alles gemischt", aufgaben: [
    { id: "s5-01", stufe: 5, zahl: 0.5, anzeige: "0{,}5",
      strahl: { min: 0, max: 1, tick: 0.1, beschriftet: [0, 1] },
      fallen: [
        { pos: 0.05, muster: "stellenwert",
          text: "0,5 ist dasselbe wie ein Halbes - genau die Mitte." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.1 } },
    { id: "s5-02", stufe: 5, zahl: 0.75, zaehler: 3, nenner: 4, anzeige: "\\tfrac{3}{4}",
      strahl: { min: 0, max: 4, tick: 0.25, beschriftet: [0, 1, 2, 3, 4] },
      fallen: [
        { pos: 3, muster: "bruch-als-paar",
          text: "Drei Viertel sind EINE Zahl, kleiner als 1 - nicht die 3." },
        { pos: 3.4, muster: "bruch-als-paar",
          text: "Der Bruchstrich ist kein Komma: 3/4 ist nicht 3,4." }
      ],
      hilfe: { typ: "bruch", unterteile: 0.25 } },
    { id: "s5-03", stufe: 5, zahl: 1.25, anzeige: "1{,}25",
      strahl: { min: 0, max: 2, tick: 0.25, beschriftet: [0, 1, 2] },
      fallen: [
        { pos: 1.7, muster: "laengere-zahl",
          text: "1,25 hat mehr Ziffern als 1,5 - ist aber kleiner. 25 Hundertstel sind ein Viertel." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.25 } },
    { id: "s5-04", stufe: 5, zahl: 0.1, zaehler: 1, nenner: 10, anzeige: "\\tfrac{1}{10}",
      strahl: { min: 0, max: 1, tick: 0.05, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.9, muster: "bruch-als-paar",
          text: "Ein Zehntel = 0,1 - das ist wenig, nah an der 0. Die 10 macht den Bruch KLEIN." }
      ],
      hilfe: { typ: "bruch", unterteile: 0.1 } },
    { id: "s5-05", stufe: 5, zahl: 0.6, anzeige: "0{,}60",
      strahl: { min: 0, max: 1, tick: 0.05, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.06, muster: "stellenwert",
          text: "0,60 sind 60 Hundertstel = 6 Zehntel. Die End-Null \u00e4ndert nichts." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.1 } },
    { id: "s5-06", stufe: 5, zahl: 2.5, zaehler: 5, nenner: 2, anzeige: "\\tfrac{5}{2}",
      strahl: { min: 0, max: 3, tick: 0.5, beschriftet: [0, 1, 2, 3] },
      fallen: [
        { pos: 0.4, muster: "bruch-als-paar",
          text: "Br\u00fcche sind nicht immer klein! 5 Halbe sind 2 Ganze und ein Halbes: 2,5." }
      ],
      hilfe: { typ: "bruch", unterteile: 0.5 } },
    { id: "s5-07", stufe: 5, zahl: 0.2, anzeige: "0{,}20",
      strahl: { min: 0, max: 1, tick: 0.1, beschriftet: [0, 0.5, 1] },
      fallen: [
        { pos: 0.02, muster: "stellenwert",
          text: "0,20 sind 20 Hundertstel = 2 Zehntel = ein F\u00fcnftel. Nicht 2 Hundertstel!" }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.1 } },
    { id: "s5-08", stufe: 5, zahl: 3.05, anzeige: "3{,}05",
      strahl: { min: 0, max: 4, tick: 0.25, beschriftet: [0, 1, 2, 3, 4] },
      fallen: [
        { pos: 3.5, muster: "komma-trennt",
          text: "3,05 ist nicht 3,5! Die Null h\u00e4lt die Zehntel-Stelle frei: nur 5 Hundertstel hinter der 3." }
      ],
      hilfe: { typ: "dezimal", unterteile: 0.25 } }
  ] }
];

if (typeof module !== 'undefined') module.exports = { STUFEN, EMPFEHLUNGEN };

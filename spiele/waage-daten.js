// Gleichungs-Waage "Balance" - Aufgabenkatalog (5 Stufen x 6 Aufgaben).
// Kuratierte Fehl-Operationen (fallen_ops) = dokumentierte Fehlvorstellungen.
// WICHTIG: Datei ist komplett ASCII-only (Projekt-Regel, siehe _test_waage_logik.js);
// Umlaute in schuelersichtbaren Texten als \u-Escapes.
// Distraktor-Arten add_c/mul werden nie angewendet (wende_an -> unbekannte-art),
// sie existieren nur als Buttons + Diagnose-Muster.
'use strict';

// Diagnose-Muster -> Schuelersprache (fuer die Auswertung)
const MUSTER_TEXTE = {
  "einseitig": "Nur eine Seite ver\u00e4ndert - die Waage kippt!",
  "gegenoperation": "Gegenoperation verwechselt (plus statt minus, mal statt geteilt)",
  "teilen-vor-sammeln": "Geteilt, bevor alle x auf einer Seite gesammelt waren",
  "zu-frueh-teilen": "Zu fr\u00fch geteilt - erst die 1er-Gewichte wegnehmen"
};

// Diagnose-Muster -> Trainer-Empfehlungen (Links relativ zu spiele/)
const EMPFEHLUNGEN = {
  "einseitig": ["../trainer/7-gleichungen-linear.html"],
  "gegenoperation": ["../trainer/7-gleichungen-linear.html"],
  "teilen-vor-sammeln": ["../trainer/7-gleichungen-linear.html", "../trainer/7-terme-vereinfachen.html"],
  "zu-frueh-teilen": ["../trainer/7-gleichungen-linear.html", "../trainer/7-terme-vereinfachen.html"]
};

const STUFEN = [
  // ---------- Stufe 1: x + a = b (Wegnehmen) ----------
  { nr: 1, name: "Wegnehmen", aufgaben: [
    { id: "w1-01", stufe: 1, start: { xL: 1, cL: 2, xR: 0, cR: 5 }, anzeige: "x + 2 = 5", waage: true,
      fallen_ops: [
        { op: { art: "sub_c", wert: 2, seite: "links" }, muster: "einseitig",
          text: "Du hast nur links weggenommen - links wird leichter und die Waage kippt. Nimm auf BEIDEN Seiten 2 weg." }
      ],
      musterweg: [{ art: "sub_c", wert: 2, seite: "beide" }] },
    { id: "w1-02", stufe: 1, start: { xL: 1, cL: 3, xR: 0, cR: 7 }, anzeige: "x + 3 = 7", waage: true,
      fallen_ops: [
        { op: { art: "add_c", wert: 3, seite: "beide" }, muster: "gegenoperation",
          text: "Dazulegen macht es voller, nicht leerer. Die 3 steht als PLUS da - also auf beiden Seiten 3 WEGNEHMEN." }
      ],
      musterweg: [{ art: "sub_c", wert: 3, seite: "beide" }] },
    { id: "w1-03", stufe: 1, start: { xL: 1, cL: 4, xR: 0, cR: 9 }, anzeige: "x + 4 = 9", waage: true,
      fallen_ops: [
        { op: { art: "sub_c", wert: 4, seite: "links" }, muster: "einseitig",
          text: "Nur links wegnehmen bringt die Waage aus dem Gleichgewicht. Immer beide Seiten gleich behandeln." }
      ],
      musterweg: [{ art: "sub_c", wert: 4, seite: "beide" }] },
    { id: "w1-04", stufe: 1, start: { xL: 1, cL: 5, xR: 0, cR: 11 }, anzeige: "x + 5 = 11", waage: true,
      fallen_ops: [
        { op: { art: "add_c", wert: 5, seite: "beide" }, muster: "gegenoperation",
          text: "Mit +5 auf beiden Seiten bleibt die Waage zwar im Gleichgewicht, aber x wird nicht freier. Nimm die 5 WEG." }
      ],
      musterweg: [{ art: "sub_c", wert: 5, seite: "beide" }] },
    { id: "w1-05", stufe: 1, start: { xL: 1, cL: 1, xR: 0, cR: 8 }, anzeige: "x + 1 = 8", waage: true,
      fallen_ops: [
        { op: { art: "sub_c", wert: 1, seite: "rechts" }, muster: "einseitig",
          text: "Du hast nur rechts weggenommen - rechts wird leichter und die Waage kippt zur rechten Seite." }
      ],
      musterweg: [{ art: "sub_c", wert: 1, seite: "beide" }] },
    { id: "w1-06", stufe: 1, start: { xL: 1, cL: 6, xR: 0, cR: 10 }, anzeige: "x + 6 = 10", waage: true,
      fallen_ops: [
        { op: { art: "add_c", wert: 6, seite: "beide" }, muster: "gegenoperation",
          text: "Die 6 liegt schon bei x auf der Waage. Dazulegen hilft nicht - wegnehmen macht x frei." }
      ],
      musterweg: [{ art: "sub_c", wert: 6, seite: "beide" }] }
  ] },

  // ---------- Stufe 2: ax = b (Aufteilen) ----------
  { nr: 2, name: "Aufteilen", aufgaben: [
    { id: "w2-01", stufe: 2, start: { xL: 2, cL: 0, xR: 0, cR: 6 }, anzeige: "2x = 6", waage: true,
      fallen_ops: [
        { op: { art: "mul", wert: 2, seite: "beide" }, muster: "gegenoperation",
          text: "Mal 2 macht aus 2 Kisten 4 Kisten - noch mehr x! Teile stattdessen beide Seiten in 2 gleiche Portionen." }
      ],
      musterweg: [{ art: "div", wert: 2, seite: "beide" }] },
    { id: "w2-02", stufe: 2, start: { xL: 3, cL: 0, xR: 0, cR: 12 }, anzeige: "3x = 12", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 3, seite: "links" }, muster: "einseitig",
          text: "Nur links geteilt - links wird leichter und die Waage kippt. Teile BEIDE Seiten durch 3." }
      ],
      musterweg: [{ art: "div", wert: 3, seite: "beide" }] },
    { id: "w2-03", stufe: 2, start: { xL: 4, cL: 0, xR: 0, cR: 8 }, anzeige: "4x = 8", waage: true,
      fallen_ops: [
        { op: { art: "mul", wert: 4, seite: "beide" }, muster: "gegenoperation",
          text: "4x bedeutet 4 mal x. Das Gegenteil von mal 4 ist geteilt durch 4 - nicht noch einmal mal 4." }
      ],
      musterweg: [{ art: "div", wert: 4, seite: "beide" }] },
    { id: "w2-04", stufe: 2, start: { xL: 5, cL: 0, xR: 0, cR: 15 }, anzeige: "5x = 15", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 5, seite: "rechts" }, muster: "einseitig",
          text: "Nur rechts geteilt - rechts wird leichter und die Waage kippt nach rechts unten... nein: rechts hoch! Beide Seiten teilen." }
      ],
      musterweg: [{ art: "div", wert: 5, seite: "beide" }] },
    { id: "w2-05", stufe: 2, start: { xL: 6, cL: 0, xR: 0, cR: 12 }, anzeige: "6x = 12", waage: true,
      fallen_ops: [
        { op: { art: "mul", wert: 6, seite: "beide" }, muster: "gegenoperation",
          text: "Mal 6 vervielfacht alles. Du willst wissen, was EINE Kiste wiegt - also in 6 Portionen aufteilen." }
      ],
      musterweg: [{ art: "div", wert: 6, seite: "beide" }] },
    { id: "w2-06", stufe: 2, start: { xL: 3, cL: 0, xR: 0, cR: 9 }, anzeige: "3x = 9", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 3, seite: "links" }, muster: "einseitig",
          text: "Teilst du nur links, stimmt das Gleichgewicht nicht mehr. Beide Seiten durch 3 teilen." }
      ],
      musterweg: [{ art: "div", wert: 3, seite: "beide" }] }
  ] },

  // ---------- Stufe 3: ax + b = c (erst -b, dann :a) ----------
  { nr: 3, name: "Zwei Schritte", aufgaben: [
    { id: "w3-01", stufe: 3, start: { xL: 2, cL: 3, xR: 0, cR: 7 }, anzeige: "2x + 3 = 7", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 2, seite: "beide" }, muster: "zu-frueh-teilen",
          text: "Jetzt zu teilen zerlegt auch die 3 in Bruchst\u00fccke. Nimm ERST die 3 auf beiden Seiten weg, DANN teile." }
      ],
      musterweg: [{ art: "sub_c", wert: 3, seite: "beide" }, { art: "div", wert: 2, seite: "beide" }] },
    { id: "w3-02", stufe: 3, start: { xL: 3, cL: 2, xR: 0, cR: 8 }, anzeige: "3x + 2 = 8", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 3, seite: "beide" }, muster: "zu-frueh-teilen",
          text: "Die 2 l\u00e4sst sich nicht glatt durch 3 teilen - es entstehen Bruchst\u00fccke. Erst -2, dann :3." },
        { op: { art: "sub_c", wert: 2, seite: "links" }, muster: "einseitig",
          text: "Nur links weggenommen - die Waage kippt. Die 2 muss auf BEIDEN Seiten weg." }
      ],
      musterweg: [{ art: "sub_c", wert: 2, seite: "beide" }, { art: "div", wert: 3, seite: "beide" }] },
    { id: "w3-03", stufe: 3, start: { xL: 4, cL: 1, xR: 0, cR: 9 }, anzeige: "4x + 1 = 9", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 4, seite: "beide" }, muster: "zu-frueh-teilen",
          text: "Die 1 in 4 Teile zu zerlegen gibt krumme St\u00fccke. Erst die 1 wegnehmen, dann durch 4 teilen." }
      ],
      musterweg: [{ art: "sub_c", wert: 1, seite: "beide" }, { art: "div", wert: 4, seite: "beide" }] },
    { id: "w3-04", stufe: 3, start: { xL: 2, cL: 5, xR: 0, cR: 11 }, anzeige: "2x + 5 = 11", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 2, seite: "beide" }, muster: "zu-frueh-teilen",
          text: "5 durch 2 geht nicht glatt auf. Reihenfolge merken: erst Gewichte wegnehmen, dann aufteilen." },
        { op: { art: "sub_c", wert: 5, seite: "rechts" }, muster: "einseitig",
          text: "Nur rechts weggenommen - rechts wird leichter und die Waage kippt. Beide Seiten -5." }
      ],
      musterweg: [{ art: "sub_c", wert: 5, seite: "beide" }, { art: "div", wert: 2, seite: "beide" }] },
    { id: "w3-05", stufe: 3, start: { xL: 5, cL: 3, xR: 0, cR: 13 }, anzeige: "5x + 3 = 13", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 5, seite: "beide" }, muster: "zu-frueh-teilen",
          text: "3 und 13 lassen sich nicht glatt durch 5 teilen. Erst -3 auf beiden Seiten, dann :5." }
      ],
      musterweg: [{ art: "sub_c", wert: 3, seite: "beide" }, { art: "div", wert: 5, seite: "beide" }] },
    { id: "w3-06", stufe: 3, start: { xL: 3, cL: 4, xR: 0, cR: 13 }, anzeige: "3x + 4 = 13", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 3, seite: "beide" }, muster: "zu-frueh-teilen",
          text: "Die 4 zerbricht beim Teilen durch 3 in Bruchst\u00fccke. Nimm sie erst weg - dann geht alles glatt auf." }
      ],
      musterweg: [{ art: "sub_c", wert: 4, seite: "beide" }, { art: "div", wert: 3, seite: "beide" }] }
  ] },

  // ---------- Stufe 4: ax + b = cx + d (x beidseitig sammeln) ----------
  { nr: 4, name: "x auf beiden Seiten", aufgaben: [
    { id: "w4-01", stufe: 4, start: { xL: 3, cL: 2, xR: 1, cR: 8 }, anzeige: "3x + 2 = x + 8", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 3, seite: "beide" }, muster: "teilen-vor-sammeln",
          text: "Rechts steht auch ein x - teilst du jetzt, zerbrechen Kiste und Gewichte. Sammle ERST alle x auf einer Seite." }
      ],
      musterweg: [
        { art: "sub_x", wert: 1, seite: "beide" },
        { art: "sub_c", wert: 2, seite: "beide" },
        { art: "div", wert: 2, seite: "beide" }
      ] },
    { id: "w4-02", stufe: 4, start: { xL: 4, cL: 1, xR: 2, cR: 7 }, anzeige: "4x + 1 = 2x + 7", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 4, seite: "beide" }, muster: "teilen-vor-sammeln",
          text: "Erst die x-Kisten auf eine Seite bringen (-2x auf beiden Seiten), dann Gewichte, dann teilen." },
        { op: { art: "sub_x", wert: 2, seite: "links" }, muster: "einseitig",
          text: "Nur links Kisten weggenommen - die Waage kippt. Die 2 Kisten m\u00fcssen auf BEIDEN Seiten weg." }
      ],
      musterweg: [
        { art: "sub_x", wert: 2, seite: "beide" },
        { art: "sub_c", wert: 1, seite: "beide" },
        { art: "div", wert: 2, seite: "beide" }
      ] },
    { id: "w4-03", stufe: 4, start: { xL: 5, cL: 2, xR: 2, cR: 11 }, anzeige: "5x + 2 = 2x + 11", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 5, seite: "beide" }, muster: "teilen-vor-sammeln",
          text: "Durch 5 teilen geht erst, wenn links NUR noch x-Kisten stehen. Sammle zuerst: -2x, dann -2." }
      ],
      musterweg: [
        { art: "sub_x", wert: 2, seite: "beide" },
        { art: "sub_c", wert: 2, seite: "beide" },
        { art: "div", wert: 3, seite: "beide" }
      ] },
    { id: "w4-04", stufe: 4, start: { xL: 3, cL: 4, xR: 1, cR: 10 }, anzeige: "3x + 4 = x + 10", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 3, seite: "beide" }, muster: "teilen-vor-sammeln",
          text: "Rechts steht noch ein x und die 4 geht nicht glatt durch 3. Reihenfolge: x sammeln, Gewichte weg, teilen." }
      ],
      musterweg: [
        { art: "sub_x", wert: 1, seite: "beide" },
        { art: "sub_c", wert: 4, seite: "beide" },
        { art: "div", wert: 2, seite: "beide" }
      ] },
    { id: "w4-05", stufe: 4, start: { xL: 4, cL: 3, xR: 1, cR: 9 }, anzeige: "4x + 3 = x + 9", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 4, seite: "beide" }, muster: "teilen-vor-sammeln",
          text: "Noch sind die x auf beiden Seiten verteilt. Erst -x auf beiden Seiten, dann -3, dann :3." },
        { op: { art: "sub_c", wert: 3, seite: "links" }, muster: "einseitig",
          text: "Nur links weggenommen - links wird leichter und die Waage kippt. Beide Seiten gleich behandeln." }
      ],
      musterweg: [
        { art: "sub_x", wert: 1, seite: "beide" },
        { art: "sub_c", wert: 3, seite: "beide" },
        { art: "div", wert: 3, seite: "beide" }
      ] },
    { id: "w4-06", stufe: 4, start: { xL: 6, cL: 1, xR: 2, cR: 9 }, anzeige: "6x + 1 = 2x + 9", waage: true,
      fallen_ops: [
        { op: { art: "div", wert: 6, seite: "beide" }, muster: "teilen-vor-sammeln",
          text: "Teilen kommt zuletzt: erst die 2 Kisten rechts wegnehmen (auf beiden Seiten), dann die 1, dann :4." }
      ],
      musterweg: [
        { art: "sub_x", wert: 2, seite: "beide" },
        { art: "sub_c", wert: 1, seite: "beide" },
        { art: "div", wert: 4, seite: "beide" }
      ] }
  ] },

  // ---------- Stufe 5: Ohne Waage weiterdenken (negativ / Brueche) ----------
  { nr: 5, name: "Ohne Waage weiterdenken", aufgaben: [
    { id: "w5-01", stufe: 5, start: { xL: 1, cL: -3, xR: 0, cR: -1 }, anzeige: "x - 3 = -1", waage: false,
      fallen_ops: [
        { op: { art: "sub_c", wert: 1, seite: "rechts" }, muster: "einseitig",
          text: "Auch ohne Waage gilt die Regel: Was du rechts tust, musst du auch links tun - sonst stimmt die Gleichung nicht mehr." }
      ],
      musterweg: [{ art: "sub_c", wert: -3, seite: "beide" }] },
    { id: "w5-02", stufe: 5, start: { xL: 2, cL: 5, xR: 0, cR: 2 }, anzeige: "2x + 5 = 2", waage: false,
      fallen_ops: [
        { op: { art: "add_c", wert: 5, seite: "beide" }, muster: "gegenoperation",
          text: "Die 5 steht als PLUS bei x - also auf beiden Seiten 5 abziehen. Dass rechts dabei -3 herauskommt, ist hier erlaubt." }
      ],
      musterweg: [{ art: "sub_c", wert: 5, seite: "beide" }, { art: "div", wert: 2, seite: "beide" }] },
    { id: "w5-03", stufe: 5, start: { xL: 1, cL: 7, xR: 0, cR: 4 }, anzeige: "x + 7 = 4", waage: false,
      fallen_ops: [
        { op: { art: "sub_c", wert: 7, seite: "links" }, muster: "einseitig",
          text: "Nur links -7 ver\u00e4ndert den Wert der Gleichung. Die Regel bleibt: beide Seiten gleich behandeln." }
      ],
      musterweg: [{ art: "sub_c", wert: 7, seite: "beide" }] },
    { id: "w5-04", stufe: 5, start: { xL: 3, cL: 0, xR: 0, cR: -6 }, anzeige: "3x = -6", waage: false,
      fallen_ops: [
        { op: { art: "mul", wert: 3, seite: "beide" }, muster: "gegenoperation",
          text: "3x heisst 3 mal x. Das Gegenteil ist geteilt durch 3 - auch wenn rechts eine negative Zahl steht." }
      ],
      musterweg: [{ art: "div", wert: 3, seite: "beide" }] },
    { id: "w5-05", stufe: 5, start: { xL: 2, cL: -1, xR: 1, cR: -4 }, anzeige: "2x - 1 = x - 4", waage: false,
      fallen_ops: [
        { op: { art: "sub_x", wert: 1, seite: "links" }, muster: "einseitig",
          text: "Das x nur links wegzunehmen zerst\u00f6rt die Gleichheit. -x geh\u00f6rt auf BEIDE Seiten." }
      ],
      musterweg: [{ art: "sub_x", wert: 1, seite: "beide" }, { art: "sub_c", wert: -1, seite: "beide" }] },
    { id: "w5-06", stufe: 5, start: { xL: 4, cL: 2, xR: 0, cR: 1 }, anzeige: "4x + 2 = 1", waage: false,
      fallen_ops: [
        { op: { art: "add_c", wert: 2, seite: "beide" }, muster: "gegenoperation",
          text: "Erst die +2 mit MINUS 2 auf beiden Seiten entfernen. Dann :4 - die L\u00f6sung darf ein Bruch sein." }
      ],
      musterweg: [{ art: "sub_c", wert: 2, seite: "beide" }, { art: "div", wert: 4, seite: "beide" }] }
  ] }
];

if (typeof module !== 'undefined') {
  module.exports = { STUFEN, EMPFEHLUNGEN, MUSTER_TEXTE };
}

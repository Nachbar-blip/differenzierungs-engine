// Zahlenstrahl-Spiel - Kernlogik (reine Funktionen, Node-testbar).
// ASCII-only (Projekt-Regel).
'use strict';

// Toleranz fuer "richtig" und Fallen-Treffer: 1,5 % der Strahl-Spannweite
var TOLERANZ_ANTEIL = 0.015;

// Maximale Anzahl feiner Hilfsstriche pro Strahl. Gekoppelt an die
// Beschriftung "jeder 5. Strich bekommt ein Label" -> max. 6 Labels.
var MAX_HILFSSTRICHE = 25;

// Toleranz in Werteinheiten fuer einen Strahl
function toleranz(strahl) {
  return TOLERANZ_ANTEIL * (strahl.max - strahl.min);
}

// Wert auf dem Strahl -> relative Position [0,1], an den Raendern geklemmt
function wertZuPos(strahl, wert) {
  var p = (wert - strahl.min) / (strahl.max - strahl.min);
  return Math.min(1, Math.max(0, p));
}

// Relative Position [0,1] -> Wert auf dem Strahl, an den Raendern geklemmt
function posZuWert(strahl, pos) {
  var p = Math.min(1, Math.max(0, pos));
  return strahl.min + p * (strahl.max - strahl.min);
}

// Platzierten Wert klassifizieren: richtig hat Vorrang vor Falle.
// Rueckgabe: {ergebnis:"richtig"} | {ergebnis:"falle", muster, text}
//          | {ergebnis:"daneben", richtung:"links"|"rechts"}
function klassifiziere(aufgabe, wert) {
  var tol = toleranz(aufgabe.strahl);
  if (Math.abs(wert - aufgabe.zahl) <= tol) return { ergebnis: "richtig" };
  var fallen = aufgabe.fallen || [];
  for (var i = 0; i < fallen.length; i++) {
    if (Math.abs(wert - fallen[i].pos) <= tol) {
      return { ergebnis: "falle", muster: fallen[i].muster, text: fallen[i].text };
    }
  }
  return { ergebnis: "daneben", richtung: wert < aufgabe.zahl ? "links" : "rechts" };
}

if (typeof module !== 'undefined') {
  module.exports = { TOLERANZ_ANTEIL, MAX_HILFSSTRICHE, toleranz, wertZuPos, posZuWert, klassifiziere };
}

// Gleichungs-Waage - Kernlogik (reine Funktionen, Node-testbar).
// Zustand {xL, cL, xR, cR}: x-Kisten und 1er-Gewichte links/rechts,
// entspricht der Gleichung  xL*x + cL = xR*x + cR.
// ASCII-only (Projekt-Regel, siehe _test_waage_logik.js).
'use strict';

// Hilfsfunktion: wuerde die Op die veraenderte Seite leichter (-1) oder
// schwerer (+1) machen? Fuer die Was-waere-wenn-Kippanimation.
function macht_leichter(op) {
  if (op.art === 'div') return op.wert > 1;
  if (op.art === 'mul') return op.wert < 1;
  if (op.art === 'add_c' || op.art === 'add_x') return op.wert < 0;
  return op.wert > 0; // sub_c / sub_x
}

// Wendet eine Umformung an. op = {art: "sub_c"|"sub_x"|"div", wert, seite}.
// Rueckgabe: neuer Zustand ODER {fehler: "..."} (Zustand nie mutiert):
//  - einseitig:    seite !== "beide"; kippt = Seite, die leichter wuerde
//  - negativ:      sub_* wuerde Bestand unterschreiten (nur ohne erlaubeNegativ)
//  - nicht-teilbar: div ginge nicht ganzzahlig auf (nur ohne erlaubeNegativ)
//  - unbekannte-art: Distraktor-Arten (add_c, mul, ...) - werden nie angewendet,
//                    nur von klassifiziere_fehlop eingeordnet
function wende_an(z, op, erlaubeNegativ) {
  if (op.seite !== 'beide') {
    var leichter = macht_leichter(op);
    var kippt = leichter ? op.seite : (op.seite === 'links' ? 'rechts' : 'links');
    return { fehler: 'einseitig', kippt: kippt };
  }
  if (op.art === 'sub_c') {
    if (!erlaubeNegativ && (z.cL < op.wert || z.cR < op.wert)) return { fehler: 'negativ' };
    return { xL: z.xL, cL: z.cL - op.wert, xR: z.xR, cR: z.cR - op.wert };
  }
  if (op.art === 'sub_x') {
    if (!erlaubeNegativ && (z.xL < op.wert || z.xR < op.wert)) return { fehler: 'negativ' };
    return { xL: z.xL - op.wert, cL: z.cL, xR: z.xR - op.wert, cR: z.cR };
  }
  if (op.art === 'div') {
    if (!erlaubeNegativ) {
      var teilbar = [z.xL, z.cL, z.xR, z.cR].every(function (k) { return k % op.wert === 0; });
      if (!teilbar) return { fehler: 'nicht-teilbar' };
    }
    return { xL: z.xL / op.wert, cL: z.cL / op.wert, xR: z.xR / op.wert, cR: z.cR / op.wert };
  }
  return { fehler: 'unbekannte-art' };
}

// Ist x isoliert? {geloest, loesung} - symmetrisch fuer x links oder rechts.
function ist_geloest(z) {
  if (z.xL === 1 && z.xR === 0 && z.cL === 0) return { geloest: true, loesung: z.cR };
  if (z.xR === 1 && z.xL === 0 && z.cR === 0) return { geloest: true, loesung: z.cL };
  return { geloest: false, loesung: null };
}

// Endloesung einer Aufgabe ueber ihren Musterweg; wirft bei inkonsistentem Weg.
function loesung(aufgabe) {
  var erlaubeNegativ = aufgabe.stufe === 5;
  var z = aufgabe.start;
  for (var i = 0; i < aufgabe.musterweg.length; i++) {
    z = wende_an(z, aufgabe.musterweg[i], erlaubeNegativ);
    if (z.fehler) {
      throw new Error('Musterweg Schritt ' + (i + 1) + ' scheitert: ' + z.fehler);
    }
  }
  var g = ist_geloest(z);
  if (!g.geloest) throw new Error('Musterweg endet nicht bei isoliertem x');
  return g.loesung;
}

// Ordnet eine Fehl-Operation einem Diagnose-Muster zu (oder null bei korrekt/neutral):
// 1. exakter fallen_op-Treffer (art/wert/seite), ABER nur wenn die Op im aktuellen
//    Zustand nicht sauber anwendbar ist - dieselbe Op kann spaeter korrekt sein
//    (z.B. div 3 nach dem Wegnehmen der 1er-Gewichte).
// 2. sonst: einseitige Ops -> "einseitig".
// 3. sonst: null (korrekt oder neutral).
function klassifiziere_fehlop(aufgabe, zustand, op) {
  var erlaubeNegativ = aufgabe.stufe === 5;
  var fallen = aufgabe.fallen_ops || [];
  for (var i = 0; i < fallen.length; i++) {
    var f = fallen[i].op;
    if (f.art === op.art && f.wert === op.wert && f.seite === op.seite) {
      var probe = wende_an(zustand, op, erlaubeNegativ);
      if (probe.fehler) return fallen[i].muster;
      return null; // im aktuellen Zustand ein gueltiger Schritt
    }
  }
  if (op.seite !== 'beide') return 'einseitig';
  return null;
}

if (typeof module !== 'undefined') {
  module.exports = { wende_an, ist_geloest, loesung, klassifiziere_fehlop };
}

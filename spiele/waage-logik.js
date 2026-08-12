// Gleichungs-Waage - Kernlogik (reine Funktionen, Node-testbar).
// Zustand {xL, cL, xR, cR}: x-Kisten und 1er-Gewichte links/rechts,
// entspricht der Gleichung  xL*x + cL = xR*x + cR.
// Enthaelt neben wende_an/ist_geloest/loesung/klassifiziere_fehlop auch die
// Kandidaten-Erzeugung (standardOps/kandidaten_ops/naechsterSchritt), die
// Notation (opLabel/opTex/seiteTex/zustandTex/formatTex/formatHtml) und die
// Empfehlungs-Policy (empfehlungs_hrefs) - waage.js ist reiner Konsument.
// ASCII-only (Projekt-Regel, siehe _test_waage_logik.js).
'use strict';

// In Node die Daten-Konstanten laden; im Browser kommen EMPFEHLUNGEN und
// EMPFEHLUNGS_SCHWELLE als Globals aus waage-daten.js (laedt davor).
var _datenModul = (typeof module !== 'undefined') ? require('./waage-daten.js') : null;

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
// Kontrakt: die einseitig-Pruefung kommt VOR der Art-Pruefung - eine einseitige
// Op unbekannter Art liefert also "einseitig", nicht "unbekannte-art" (gewollt).
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

// ===== Operations-Kandidaten =====

function ggt(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }

// Deterministischer String-Hash (Button-Reihenfolge pro Aufgabe stabil mischen)
function hashStr(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

function opKey(op) { return op.art + '|' + op.wert + '|' + op.seite; }

// Korrekte beidseitige Ops aus dem Zustand, in Prioritaets-Reihenfolge:
// x sammeln -> Konstante raeumen -> aufteilen. naechsterSchritt nimmt genau
// die erste Op dieser Liste - Kandidaten und Hilfe-Schritt teilen sich damit
// eine einzige Prioritaetsliste (frueher zwei leicht abweichende Kopien mit
// unterschiedlichen x-Seiten-Kriterien: xL >= xR vs. xL > 0; nach dem
// x-Sammeln fallen beide zusammen, hier gilt einheitlich xL >= xR).
function standardOps(z, stufe) {
  var ops = [];
  var mx = Math.min(z.xL, z.xR);
  if (mx > 0) ops.push({ art: 'sub_x', wert: mx, seite: 'beide' });
  if (stufe === 5) {
    // x-Seite bestimmen und deren Konstante entfernen (darf negativ sein).
    // Tie xL === xR: links gewaehlt - harmlos, denn dann deckt sub_x (mx > 0)
    // den richtigen naechsten Schritt ab.
    var xsL = z.xL >= z.xR;
    var c5 = xsL ? z.cL : z.cR;
    if (c5 !== 0) ops.push({ art: 'sub_c', wert: c5, seite: 'beide' });
    // Teilen erst, wenn die x-Seite nur noch x-Kisten traegt
    var a5 = (z.xR === 0 && z.cL === 0) ? z.xL : ((z.xL === 0 && z.cR === 0) ? z.xR : 0);
    if (a5 > 1) ops.push({ art: 'div', wert: a5, seite: 'beide' });
  } else {
    var mc = Math.min(z.cL, z.cR);
    if (mc > 0) ops.push({ art: 'sub_c', wert: mc, seite: 'beide' });
    // div nur, wenn ALLES glatt aufgeht (ggT aller belegten Felder)
    var g = 0;
    [z.xL, z.cL, z.xR, z.cR].forEach(function (v) { if (v !== 0) g = ggt(g, Math.abs(v)); });
    if (g > 1) ops.push({ art: 'div', wert: g, seite: 'beide' });
  }
  return ops;
}

// Ein korrekter Loesungsschritt aus dem AKTUELLEN Zustand ("Zeig mir ..."):
// die erste beidseitige Op der standardOps-Prioritaetsliste (s. o.).
function naechsterSchritt(z, stufe) {
  var ops = standardOps(z, stufe);
  return ops.length > 0 ? ops[0] : null;
}

// Alle Buttons einer Aufgabe im gegebenen Zustand:
// Standard-Ops + kuratierte fallen_ops + (falls keine einseitige Op dabei ist)
// ein abgeleiteter einseitiger Distraktor; Dedup via opKey, deterministisch
// gemischt (Seed aus Aufgaben-id + Op-Schluessel).
function kandidaten_ops(aufgabe, zustand) {
  var ops = standardOps(zustand, aufgabe.stufe);
  var vorhanden = {};
  ops.forEach(function (o) { vorhanden[opKey(o)] = true; });
  (aufgabe.fallen_ops || []).forEach(function (f) {
    if (!vorhanden[opKey(f.op)]) { vorhanden[opKey(f.op)] = true; ops.push(f.op); }
  });
  // Einseitig-Diagnose ueberall: gibt es noch keinen einseitigen Button,
  // die erste Standard-Op als "nur links"-Variante anbieten (Dedup via opKey).
  // klassifiziere_fehlop liefert dafuer das Fallback-Muster "einseitig".
  var hatEinseitig = ops.some(function (o) { return o.seite !== 'beide'; });
  if (!hatEinseitig && ops.length > 0 && ops[0].seite === 'beide') {
    var eins = { art: ops[0].art, wert: ops[0].wert, seite: 'links' };
    if (!vorhanden[opKey(eins)]) { vorhanden[opKey(eins)] = true; ops.push(eins); }
  }
  ops.sort(function (a, b) {
    return hashStr(aufgabe.id + '#' + opKey(a)) - hashStr(aufgabe.id + '#' + opKey(b));
  });
  return ops;
}

// ===== Notation (KaTeX / HTML) =====

// Zahl fuer KaTeX: ganzzahlig direkt, sonst Dezimalkomma via {,}
function formatTex(v) {
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 1000) / 1000).replace('.', '{,}');
}

// Zahl fuer HTML-Text: Dezimalkomma, echtes Minus
function formatHtml(v) {
  var s = String(Math.round(v * 1000) / 1000).replace('.', ',');
  return s.replace('-', '&minus;');
}

function seiteTex(x, c) {
  var teile = [];
  if (x !== 0) teile.push((x === 1 ? '' : formatTex(x)) + 'x');
  if (c !== 0) {
    if (teile.length === 0) teile.push(formatTex(c));
    else teile.push((c > 0 ? '+ ' : '- ') + formatTex(Math.abs(c)));
  }
  if (teile.length === 0) return '0';
  return teile.join(' ');
}

function zustandTex(z) {
  return seiteTex(z.xL, z.cL) + ' = ' + seiteTex(z.xR, z.cR);
}

// Op-Notation fuer die Mitschrift (nur anwendbare Arten: sub_c, sub_x, div)
function opTex(op) {
  if (op.art === 'sub_c') return op.wert >= 0 ? '- ' + formatTex(op.wert) : '+ ' + formatTex(-op.wert);
  if (op.art === 'sub_x') return '- ' + (op.wert === 1 ? '' : formatTex(op.wert)) + 'x';
  if (op.art === 'div') return ': ' + formatTex(op.wert);
  return '';
}

// Button-Beschriftung (alle Arten inkl. Distraktoren); HTML mit Entities.
function opLabel(op) {
  var kern;
  if (op.art === 'sub_c') kern = op.wert >= 0 ? '&minus;' + op.wert : '+' + (-op.wert);
  else if (op.art === 'add_c') kern = op.wert >= 0 ? '+' + op.wert : '&minus;' + (-op.wert);
  else if (op.art === 'sub_x') kern = '&minus;' + (op.wert === 1 ? '' : op.wert) + 'x';
  else if (op.art === 'add_x') kern = '+' + (op.wert === 1 ? '' : op.wert) + 'x';
  else if (op.art === 'div') kern = ':' + op.wert;
  else if (op.art === 'mul') kern = '&middot;' + op.wert;
  else kern = '?';
  var wo = op.seite === 'beide' ? 'auf beiden Seiten'
    : (op.seite === 'links' ? 'nur links' : 'nur rechts');
  return kern + ' ' + wo;
}

// ===== Empfehlungs-Policy =====

// Trainer-Links zur Muster-Zaehlung einer Stufe (oder gesamt):
// Ein Muster empfiehlt nur, wenn es >= EMPFEHLUNGS_SCHWELLE mal vorkam ODER
// die Stufe nicht komplett selbst geloest wurde. ausschluss = hrefs, die
// schon woanders angezeigt werden (Dedup Stufen-/Gesamt-Block); Rueckgabe
// dedupliziert in Muster-Reihenfolge.
function empfehlungs_hrefs(zaehler, alleSelbst, ausschluss) {
  var EMP = _datenModul ? _datenModul.EMPFEHLUNGEN : EMPFEHLUNGEN;
  var schwelle = _datenModul ? _datenModul.EMPFEHLUNGS_SCHWELLE : EMPFEHLUNGS_SCHWELLE;
  var gesehen = {}, hrefs = [];
  (ausschluss || []).forEach(function (h) { gesehen[h] = true; });
  for (var m in zaehler) {
    if (!zaehler[m] || !EMP[m]) continue;
    if (zaehler[m] < schwelle && alleSelbst) continue;
    EMP[m].forEach(function (h) {
      if (!gesehen[h]) { gesehen[h] = true; hrefs.push(h); }
    });
  }
  return hrefs;
}

if (typeof module !== 'undefined') {
  module.exports = {
    wende_an, ist_geloest, loesung, klassifiziere_fehlop,
    standardOps, naechsterSchritt, kandidaten_ops, hashStr, opKey,
    formatTex, formatHtml, seiteTex, zustandTex, opTex, opLabel,
    empfehlungs_hrefs
  };
}

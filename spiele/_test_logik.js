// Node-Tests fuer Zahlenstrahl-Spiel: Kernlogik + Katalog-Lint.
// Aufruf: node spiele/_test_logik.js  (pures Node, kein Framework)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const daten = require(path.join(__dirname, 'zahlenstrahl-daten.js'));
const logik = require(path.join(__dirname, 'zahlenstrahl-logik.js'));
const { STUFEN, EMPFEHLUNGEN } = daten;
const { TOLERANZ_ANTEIL, wertZuPos, posZuWert, klassifiziere } = logik;

let anzahl = 0;
function test(name, fn) {
  anzahl++;
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; }
}

const EPS = 1e-9;
const alleAufgaben = [].concat(...STUFEN.map(s => s.aufgaben));

// ---------- Mapping ----------
test('TOLERANZ_ANTEIL ist 0.015', () => assert.strictEqual(TOLERANZ_ANTEIL, 0.015));

test('wertZuPos: lineare Abbildung auf [0,1]', () => {
  const s = { min: 0, max: 100, tick: 10 };
  assert.ok(Math.abs(wertZuPos(s, 0) - 0) < EPS);
  assert.ok(Math.abs(wertZuPos(s, 50) - 0.5) < EPS);
  assert.ok(Math.abs(wertZuPos(s, 100) - 1) < EPS);
  const s2 = { min: 2, max: 4 };
  assert.ok(Math.abs(wertZuPos(s2, 3) - 0.5) < EPS);
});

test('wertZuPos: klemmt an den Raendern', () => {
  const s = { min: 0, max: 10 };
  assert.strictEqual(wertZuPos(s, -5), 0);
  assert.strictEqual(wertZuPos(s, 25), 1);
});

test('posZuWert: klemmt an den Raendern', () => {
  const s = { min: 0, max: 10 };
  assert.strictEqual(posZuWert(s, -0.5), 0);
  assert.strictEqual(posZuWert(s, 1.5), 10);
});

test('posZuWert und wertZuPos sind invers', () => {
  const s = { min: 0, max: 1, tick: 0.1 };
  for (const w of [0, 0.07, 0.5, 0.99, 1]) {
    assert.ok(Math.abs(posZuWert(s, wertZuPos(s, w)) - w) < EPS);
  }
  const s2 = { min: 0, max: 1000 };
  for (const p of [0, 0.35, 1]) {
    assert.ok(Math.abs(wertZuPos(s2, posZuWert(s2, p)) - p) < EPS);
  }
});

// ---------- Klassifikation ----------
const beispiel = {
  id: 'x-01', stufe: 3, zahl: 0.7, anzeige: '0{,}7',
  strahl: { min: 0, max: 1, tick: 0.1, beschriftet: [0, 0.5, 1] },
  fallen: [
    { pos: 0.07, muster: 'stellenwert', text: 'Falle A' },
    { pos: 0.17, muster: 'komma-trennt', text: 'Falle B' }
  ],
  hilfe: { typ: 'dezimal', unterteile: 0.1 }
};

test('klassifiziere: exakt richtig', () => {
  assert.deepStrictEqual(klassifiziere(beispiel, 0.7), { ergebnis: 'richtig' });
});

test('klassifiziere: innerhalb Toleranz (1,5 % der Spannweite) richtig', () => {
  assert.deepStrictEqual(klassifiziere(beispiel, 0.7 + 0.014), { ergebnis: 'richtig' });
  assert.deepStrictEqual(klassifiziere(beispiel, 0.7 - 0.014), { ergebnis: 'richtig' });
});

test('klassifiziere: Falle mit Muster und Text', () => {
  const r = klassifiziere(beispiel, 0.07);
  assert.strictEqual(r.ergebnis, 'falle');
  assert.strictEqual(r.muster, 'stellenwert');
  assert.strictEqual(r.text, 'Falle A');
  const r2 = klassifiziere(beispiel, 0.17 + 0.01); // innerhalb Fallen-Toleranz
  assert.strictEqual(r2.ergebnis, 'falle');
  assert.strictEqual(r2.muster, 'komma-trennt');
});

test('klassifiziere: richtig hat Vorrang vor Falle', () => {
  const eng = { zahl: 0.5, strahl: { min: 0, max: 1 },
    fallen: [{ pos: 0.51, muster: 'stellenwert', text: 't' }] };
  // 0.505 liegt in beiden Toleranzen -> richtig gewinnt
  assert.deepStrictEqual(klassifiziere(eng, 0.505), { ergebnis: 'richtig' });
});

test('klassifiziere: daneben mit Richtung', () => {
  assert.deepStrictEqual(klassifiziere(beispiel, 0.4), { ergebnis: 'daneben', richtung: 'links' });
  assert.deepStrictEqual(klassifiziere(beispiel, 0.95), { ergebnis: 'daneben', richtung: 'rechts' });
});

// ---------- Katalog-Lint ----------
test('Katalog: 5 Stufen mit je 8 Aufgaben (40 gesamt)', () => {
  assert.strictEqual(STUFEN.length, 5);
  STUFEN.forEach((s, i) => {
    assert.strictEqual(s.nr, i + 1, 'Stufen-Nr ' + s.nr);
    assert.strictEqual(s.aufgaben.length, 8, 'Stufe ' + s.nr + ' hat ' + s.aufgaben.length + ' Aufgaben');
    s.aufgaben.forEach(a => assert.strictEqual(a.stufe, s.nr, a.id + ': stufe-Feld passt nicht'));
  });
  assert.strictEqual(alleAufgaben.length, 40);
});

test('Katalog: IDs eindeutig', () => {
  const ids = alleAufgaben.map(a => a.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('Katalog: min <= zahl <= max und min < max', () => {
  for (const a of alleAufgaben) {
    assert.ok(a.strahl.min < a.strahl.max, a.id + ': min < max verletzt');
    assert.ok(a.zahl >= a.strahl.min - EPS && a.zahl <= a.strahl.max + EPS,
      a.id + ': zahl ' + a.zahl + ' ausserhalb [' + a.strahl.min + ',' + a.strahl.max + ']');
  }
});

test('Katalog: tick teilt Spannweite (Epsilon-tolerant)', () => {
  for (const a of alleAufgaben) {
    const n = (a.strahl.max - a.strahl.min) / a.strahl.tick;
    assert.ok(Math.abs(n - Math.round(n)) < 1e-6, a.id + ': tick ' + a.strahl.tick + ' teilt Spannweite nicht');
  }
});

test('Katalog: beschriftete Werte liegen im Strahlbereich', () => {
  for (const a of alleAufgaben) {
    for (const b of a.strahl.beschriftet) {
      assert.ok(b >= a.strahl.min - EPS && b <= a.strahl.max + EPS, a.id + ': Beschriftung ' + b);
    }
  }
});

test('Katalog: jede Stufe hat min. 5 Aufgaben mit Fallen', () => {
  for (const s of STUFEN) {
    const mitFallen = s.aufgaben.filter(a => Array.isArray(a.fallen) && a.fallen.length > 0).length;
    assert.ok(mitFallen >= 5, 'Stufe ' + s.nr + ': nur ' + mitFallen + ' Aufgaben mit Fallen');
  }
});

test('Katalog: Fallen im Strahlbereich, mit Muster und Text', () => {
  for (const a of alleAufgaben) {
    for (const f of a.fallen || []) {
      assert.ok(f.pos >= a.strahl.min - EPS && f.pos <= a.strahl.max + EPS, a.id + ': Falle ' + f.pos + ' ausserhalb');
      assert.ok(EMPFEHLUNGEN[f.muster], a.id + ': Muster "' + f.muster + '" ohne Empfehlung');
      assert.ok(typeof f.text === 'string' && f.text.length >= 10, a.id + ': Fallen-Text fehlt/zu kurz');
    }
  }
});

test('Katalog: keine Falle innerhalb 2x Toleranz der Loesung', () => {
  for (const a of alleAufgaben) {
    const tol = (a.strahl.max - a.strahl.min) * TOLERANZ_ANTEIL;
    for (const f of a.fallen || []) {
      assert.ok(Math.abs(f.pos - a.zahl) > 2 * tol,
        a.id + ': Falle ' + f.pos + ' zu nah an Loesung ' + a.zahl);
    }
  }
});

test('Katalog: hilfe gueltig (typ, unterteile teilt Spannweite, max. 25 Striche)', () => {
  const TYPEN = ['natuerlich', 'dezimal', 'bruch'];
  for (const a of alleAufgaben) {
    assert.ok(TYPEN.indexOf(a.hilfe.typ) !== -1, a.id + ': hilfe.typ ungueltig: ' + a.hilfe.typ);
    assert.ok(a.hilfe.unterteile > 0, a.id + ': hilfe.unterteile <= 0');
    const n = (a.strahl.max - a.strahl.min) / a.hilfe.unterteile;
    assert.ok(Math.abs(n - Math.round(n)) < 1e-6, a.id + ': unterteile ' + a.hilfe.unterteile + ' teilt Spannweite nicht');
    assert.ok(Math.round(n) <= 25, a.id + ': ' + Math.round(n) + ' Hilfsstriche (> 25, unlesbar)');
  }
});

test('Katalog: Bruch-Aufgaben zeigen \\tfrac oder \\frac', () => {
  const brueche = alleAufgaben.filter(a => a.hilfe.typ === 'bruch');
  assert.ok(brueche.length >= 8, 'zu wenige Bruch-Aufgaben: ' + brueche.length);
  for (const a of brueche) {
    assert.ok(/\\t?frac/.test(a.anzeige), a.id + ': anzeige ohne frac: ' + a.anzeige);
  }
});

test('EMPFEHLUNGEN: jede Zieldatei existiert', () => {
  const muster = Object.keys(EMPFEHLUNGEN);
  assert.ok(muster.length >= 5, 'zu wenige Muster: ' + muster.join(', '));
  for (const m of muster) {
    const links = EMPFEHLUNGEN[m];
    assert.ok(Array.isArray(links) && links.length > 0, m + ': keine Links');
    for (const l of links) {
      const ziel = path.resolve(__dirname, l); // Links relativ zu spiele/
      assert.ok(fs.existsSync(ziel), m + ': Ziel fehlt: ' + l);
    }
  }
});

test('ASCII-only: Datendatei und Logikdatei ohne Nicht-ASCII-Zeichen', () => {
  for (const f of ['zahlenstrahl-daten.js', 'zahlenstrahl-logik.js']) {
    const inhalt = fs.readFileSync(path.join(__dirname, f), 'utf8');
    const m = inhalt.match(/[^\x00-\x7F]/);
    assert.ok(!m, f + ': Nicht-ASCII-Zeichen gefunden: ' + JSON.stringify(m && m[0]));
  }
});

console.log('\n' + anzahl + ' Tests, exitCode=' + (process.exitCode || 0));

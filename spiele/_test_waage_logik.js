// Node-Tests fuer Gleichungs-Waage: Kernlogik + Katalog-Lint.
// Aufruf: node spiele/_test_waage_logik.js  (pures Node, kein Framework)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const daten = require(path.join(__dirname, 'waage-daten.js'));
const logik = require(path.join(__dirname, 'waage-logik.js'));
const { STUFEN, EMPFEHLUNGEN, MUSTER_TEXTE, TRAINER_NAMEN, EMPFEHLUNGS_SCHWELLE, TEXTE } = daten;
const { wende_an, ist_geloest, loesung, klassifiziere_fehlop,
        naechsterSchritt, kandidaten_ops, opKey,
        formatTex, seiteTex, zustandTex, opTex, opLabel,
        empfehlungs_hrefs } = logik;

let anzahl = 0;
function test(name, fn) {
  anzahl++;
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; }
}

const alleAufgaben = [].concat(...STUFEN.map(s => s.aufgaben));
const MUSTER = ['einseitig', 'gegenoperation', 'teilen-vor-sammeln', 'zu-frueh-teilen'];

// ---------- wende_an: Erfolgsfaelle ----------
test('wende_an sub_c beide: zieht 1er-Gewichte auf beiden Seiten ab', () => {
  const z = wende_an({ xL: 3, cL: 2, xR: 0, cR: 8 }, { art: 'sub_c', wert: 2, seite: 'beide' });
  assert.deepStrictEqual(z, { xL: 3, cL: 0, xR: 0, cR: 6 });
});

test('wende_an sub_x beide: zieht x-Kisten auf beiden Seiten ab', () => {
  const z = wende_an({ xL: 3, cL: 2, xR: 1, cR: 8 }, { art: 'sub_x', wert: 1, seite: 'beide' });
  assert.deepStrictEqual(z, { xL: 2, cL: 2, xR: 0, cR: 8 });
});

test('wende_an div beide: teilt alle vier Komponenten', () => {
  const z = wende_an({ xL: 2, cL: 0, xR: 0, cR: 6 }, { art: 'div', wert: 2, seite: 'beide' });
  assert.deepStrictEqual(z, { xL: 1, cL: 0, xR: 0, cR: 3 });
});

test('wende_an: Eingabezustand bleibt unveraendert (reine Funktion)', () => {
  const z0 = { xL: 3, cL: 2, xR: 0, cR: 8 };
  wende_an(z0, { art: 'sub_c', wert: 2, seite: 'beide' });
  assert.deepStrictEqual(z0, { xL: 3, cL: 2, xR: 0, cR: 8 });
});

// ---------- wende_an: Fehlerfaelle ----------
test('wende_an einseitig links: fehler einseitig, kippt links (linke Seite wuerde leichter)', () => {
  const z0 = { xL: 1, cL: 5, xR: 0, cR: 8 };
  const r = wende_an(z0, { art: 'sub_c', wert: 2, seite: 'links' });
  assert.strictEqual(r.fehler, 'einseitig');
  assert.strictEqual(r.kippt, 'links');
  assert.deepStrictEqual(z0, { xL: 1, cL: 5, xR: 0, cR: 8 });
});

test('wende_an einseitig rechts: kippt rechts', () => {
  const r = wende_an({ xL: 1, cL: 5, xR: 0, cR: 8 }, { art: 'sub_c', wert: 3, seite: 'rechts' });
  assert.strictEqual(r.fehler, 'einseitig');
  assert.strictEqual(r.kippt, 'rechts');
});

test('wende_an einseitig div: geteilte Seite wuerde leichter', () => {
  const r = wende_an({ xL: 2, cL: 0, xR: 0, cR: 6 }, { art: 'div', wert: 2, seite: 'rechts' });
  assert.strictEqual(r.fehler, 'einseitig');
  assert.strictEqual(r.kippt, 'rechts');
});

test('wende_an sub_c zu viel: fehler negativ (Stufen 1-4)', () => {
  const r = wende_an({ xL: 1, cL: 2, xR: 0, cR: 8 }, { art: 'sub_c', wert: 3, seite: 'beide' });
  assert.strictEqual(r.fehler, 'negativ');
});

test('wende_an sub_x zu viel: fehler negativ', () => {
  const r = wende_an({ xL: 2, cL: 0, xR: 1, cR: 4 }, { art: 'sub_x', wert: 2, seite: 'beide' });
  assert.strictEqual(r.fehler, 'negativ');
});

test('wende_an div nicht teilbar: fehler nicht-teilbar', () => {
  const r = wende_an({ xL: 3, cL: 2, xR: 0, cR: 8 }, { art: 'div', wert: 3, seite: 'beide' });
  assert.strictEqual(r.fehler, 'nicht-teilbar');
});

test('wende_an unbekannte Art (Distraktor add_c): fehler unbekannte-art', () => {
  const r = wende_an({ xL: 1, cL: 2, xR: 0, cR: 5 }, { art: 'add_c', wert: 2, seite: 'beide' });
  assert.strictEqual(r.fehler, 'unbekannte-art');
});

// ---------- wende_an: erlaubeNegativ (Stufe 5) ----------
test('wende_an erlaubeNegativ: sub_c darf ins Negative', () => {
  const z = wende_an({ xL: 2, cL: 5, xR: 0, cR: 2 }, { art: 'sub_c', wert: 5, seite: 'beide' }, true);
  assert.deepStrictEqual(z, { xL: 2, cL: 0, xR: 0, cR: -3 });
});

test('wende_an erlaubeNegativ: div darf Brueche erzeugen', () => {
  const z = wende_an({ xL: 2, cL: 0, xR: 0, cR: -3 }, { art: 'div', wert: 2, seite: 'beide' }, true);
  assert.deepStrictEqual(z, { xL: 1, cL: 0, xR: 0, cR: -1.5 });
});

test('wende_an erlaubeNegativ: einseitig bleibt trotzdem Fehler', () => {
  const r = wende_an({ xL: 1, cL: -3, xR: 0, cR: -1 }, { art: 'sub_c', wert: -3, seite: 'links' }, true);
  assert.strictEqual(r.fehler, 'einseitig');
});

test('wende_an: sub_c mit negativem Wert einseitig kippt zur ANDEREN Seite (Seite wird schwerer)', () => {
  const r = wende_an({ xL: 1, cL: 2, xR: 0, cR: 5 }, { art: 'sub_c', wert: -2, seite: 'links' }, true);
  assert.strictEqual(r.fehler, 'einseitig');
  assert.strictEqual(r.kippt, 'rechts');
});

// ---------- ist_geloest ----------
test('ist_geloest: x links isoliert -> Loesung rechts', () => {
  assert.deepStrictEqual(ist_geloest({ xL: 1, cL: 0, xR: 0, cR: 4 }), { geloest: true, loesung: 4 });
});

test('ist_geloest: x rechts isoliert -> Loesung links (Symmetrie)', () => {
  assert.deepStrictEqual(ist_geloest({ xL: 0, cL: 7, xR: 1, cR: 0 }), { geloest: true, loesung: 7 });
});

test('ist_geloest: negative/Bruch-Loesung erlaubt', () => {
  assert.deepStrictEqual(ist_geloest({ xL: 1, cL: 0, xR: 0, cR: -1.5 }), { geloest: true, loesung: -1.5 });
});

test('ist_geloest: nicht geloest', () => {
  assert.deepStrictEqual(ist_geloest({ xL: 2, cL: 0, xR: 0, cR: 6 }), { geloest: false, loesung: null });
  assert.deepStrictEqual(ist_geloest({ xL: 1, cL: 2, xR: 0, cR: 6 }), { geloest: false, loesung: null });
  assert.deepStrictEqual(ist_geloest({ xL: 1, cL: 0, xR: 1, cR: 0 }), { geloest: false, loesung: null });
});

// ---------- loesung ----------
test('loesung: bekannte Werte (3x + 2 = 8 -> 2)', () => {
  const a = {
    stufe: 3, start: { xL: 3, cL: 2, xR: 0, cR: 8 },
    musterweg: [
      { art: 'sub_c', wert: 2, seite: 'beide' },
      { art: 'div', wert: 3, seite: 'beide' }
    ]
  };
  assert.strictEqual(loesung(a), 2);
});

test('loesung: wirft bei inkonsistentem Musterweg', () => {
  const kaputt = {
    stufe: 1, start: { xL: 1, cL: 2, xR: 0, cR: 8 },
    musterweg: [{ art: 'sub_c', wert: 5, seite: 'beide' }]
  };
  assert.throws(() => loesung(kaputt));
});

test('loesung: wirft, wenn Musterweg nicht bei geloestem Zustand endet', () => {
  const halb = {
    stufe: 3, start: { xL: 3, cL: 2, xR: 0, cR: 8 },
    musterweg: [{ art: 'sub_c', wert: 2, seite: 'beide' }]
  };
  assert.throws(() => loesung(halb));
});

// ---------- klassifiziere_fehlop ----------
const kAufgabe = {
  stufe: 3, start: { xL: 3, cL: 2, xR: 0, cR: 8 },
  fallen_ops: [
    { op: { art: 'div', wert: 3, seite: 'beide' }, muster: 'zu-frueh-teilen', text: 'Testtext lang genug' }
  ],
  musterweg: [
    { art: 'sub_c', wert: 2, seite: 'beide' },
    { art: 'div', wert: 3, seite: 'beide' }
  ]
};

test('klassifiziere_fehlop: fallen_op-Match liefert dessen Muster', () => {
  const m = klassifiziere_fehlop(kAufgabe, kAufgabe.start, { art: 'div', wert: 3, seite: 'beide' });
  assert.strictEqual(m, 'zu-frueh-teilen');
});

test('klassifiziere_fehlop: dieselbe Op ist NACH dem Vorbereiten korrekt -> null', () => {
  // nach sub_c 2: 3x = 6, jetzt ist div 3 der richtige Schritt
  const z = wende_an(kAufgabe.start, { art: 'sub_c', wert: 2, seite: 'beide' });
  const m = klassifiziere_fehlop(kAufgabe, z, { art: 'div', wert: 3, seite: 'beide' });
  assert.strictEqual(m, null);
});

test('klassifiziere_fehlop: einseitig-Fallback ohne fallen_op-Eintrag', () => {
  const m = klassifiziere_fehlop(kAufgabe, kAufgabe.start, { art: 'sub_c', wert: 2, seite: 'links' });
  assert.strictEqual(m, 'einseitig');
});

test('klassifiziere_fehlop: korrekte beidseitige Op -> null', () => {
  const m = klassifiziere_fehlop(kAufgabe, kAufgabe.start, { art: 'sub_c', wert: 2, seite: 'beide' });
  assert.strictEqual(m, null);
});

// ---------- Katalog-Lint ----------
test('Katalog: 5 Stufen mit je 6 Aufgaben (30 gesamt)', () => {
  assert.strictEqual(STUFEN.length, 5);
  STUFEN.forEach((s, i) => {
    assert.strictEqual(s.nr, i + 1, 'Stufen-Nr ' + s.nr);
    assert.strictEqual(s.aufgaben.length, 6, 'Stufe ' + s.nr + ' hat ' + s.aufgaben.length + ' Aufgaben');
    s.aufgaben.forEach(a => assert.strictEqual(a.stufe, s.nr, a.id + ': stufe-Feld passt nicht'));
  });
  assert.strictEqual(alleAufgaben.length, 30);
});

test('Katalog: IDs eindeutig und im Format w<stufe>-NN', () => {
  const ids = alleAufgaben.map(a => a.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const a of alleAufgaben) {
    assert.ok(new RegExp('^w' + a.stufe + '-\\d\\d$').test(a.id), a.id + ': ID-Format');
  }
});

// (Frueher gab es ein redundantes anzeige-Feld samt Konsistenz-Lint; die UI
// rendert die Aufgabenstellung jetzt direkt via zustandTex(aufgabe.start).)
test('Notation: zustandTex fuer typische Startzustaende', () => {
  assert.strictEqual(zustandTex({ xL: 1, cL: 2, xR: 0, cR: 5 }), 'x + 2 = 5');
  assert.strictEqual(zustandTex({ xL: 3, cL: 0, xR: 0, cR: 12 }), '3x = 12');
  assert.strictEqual(zustandTex({ xL: 1, cL: -3, xR: 0, cR: -1 }), 'x - 3 = -1');
  assert.strictEqual(zustandTex({ xL: 2, cL: -1, xR: 1, cR: -4 }), '2x - 1 = x - 4');
  assert.strictEqual(zustandTex({ xL: 0, cL: 0, xR: 0, cR: 0 }), '0 = 0');
});

test('Notation: formatTex/seiteTex mit Dezimalkomma (KaTeX {,})', () => {
  assert.strictEqual(formatTex(2), '2');
  assert.strictEqual(formatTex(-1.5), '-1{,}5');
  assert.strictEqual(seiteTex(0, -1.5), '-1{,}5');
});

test('Notation: opLabel-Sonderfaelle (wert 1, negatives sub_c, Distraktoren)', () => {
  assert.strictEqual(opLabel({ art: 'sub_x', wert: 1, seite: 'beide' }), '&minus;x auf beiden Seiten');
  assert.strictEqual(opLabel({ art: 'sub_c', wert: -3, seite: 'beide' }), '+3 auf beiden Seiten');
  assert.strictEqual(opLabel({ art: 'sub_c', wert: 2, seite: 'links' }), '&minus;2 nur links');
  assert.strictEqual(opLabel({ art: 'mul', wert: 4, seite: 'beide' }), '&middot;4 auf beiden Seiten');
  assert.strictEqual(opLabel({ art: 'div', wert: 3, seite: 'rechts' }), ':3 nur rechts');
});

test('Notation: opTex (sub_c negativ wird zu +, sub_x 1 ohne Koeffizient)', () => {
  assert.strictEqual(opTex({ art: 'sub_c', wert: 3, seite: 'beide' }), '- 3');
  assert.strictEqual(opTex({ art: 'sub_c', wert: -3, seite: 'beide' }), '+ 3');
  assert.strictEqual(opTex({ art: 'sub_x', wert: 1, seite: 'beide' }), '- x');
  assert.strictEqual(opTex({ art: 'div', wert: 4, seite: 'beide' }), ': 4');
});

test('Katalog: Musterweg loest jede Aufgabe in <= 5 Schritten', () => {
  for (const a of alleAufgaben) {
    assert.ok(a.musterweg.length >= 1 && a.musterweg.length <= 5, a.id + ': ' + a.musterweg.length + ' Schritte');
    assert.doesNotThrow(() => loesung(a), a.id + ': Musterweg inkonsistent');
  }
});

test('Katalog: Stufen 1-4 alle Zwischenzustaende ganzzahlig >= 0, Loesung positiv-ganzzahlig', () => {
  for (const a of alleAufgaben) {
    if (a.stufe === 5) continue;
    let z = a.start;
    const pruefe = (zz, wo) => {
      for (const k of ['xL', 'cL', 'xR', 'cR']) {
        assert.ok(Number.isInteger(zz[k]) && zz[k] >= 0, a.id + ' ' + wo + ': ' + k + '=' + zz[k]);
      }
    };
    pruefe(z, 'start');
    for (let i = 0; i < a.musterweg.length; i++) {
      z = wende_an(z, a.musterweg[i]);
      assert.ok(!z.fehler, a.id + ' Schritt ' + (i + 1) + ': ' + z.fehler);
      pruefe(z, 'Schritt ' + (i + 1));
    }
    const l = loesung(a);
    assert.ok(Number.isInteger(l) && l > 0, a.id + ': Loesung ' + l + ' nicht positiv-ganzzahlig');
  }
});

test('Katalog: Stufe 5 waage:false, Stufen 1-4 waage:true', () => {
  for (const a of alleAufgaben) {
    assert.strictEqual(a.waage, a.stufe !== 5, a.id + ': waage-Flag');
  }
});

test('Katalog: Stufe-5-Musterwege brauchen erlaubeNegativ wirklich (min. 2 Aufgaben) und loesung() stimmt', () => {
  const s5 = STUFEN[4].aufgaben;
  let brauchen = 0;
  for (const a of s5) {
    let z = a.start;
    let noetig = false;
    for (const op of a.musterweg) {
      const ohne = wende_an(z, op, false);
      if (ohne.fehler) noetig = true;
      z = wende_an(z, op, true);
      assert.ok(!z.fehler, a.id + ': Musterweg scheitert selbst mit erlaubeNegativ');
    }
    if (noetig) brauchen++;
  }
  assert.ok(brauchen >= 2, 'nur ' + brauchen + ' Stufe-5-Aufgaben nutzen Negativ/Bruch wirklich');
});

test('Katalog: jede Aufgabe hat min. 1 fallen_op, alle wohlgeformt', () => {
  const ARTEN = ['sub_c', 'sub_x', 'div', 'add_c', 'add_x', 'mul'];
  const SEITEN = ['beide', 'links', 'rechts'];
  for (const a of alleAufgaben) {
    assert.ok(Array.isArray(a.fallen_ops) && a.fallen_ops.length >= 1, a.id + ': keine fallen_ops');
    for (const f of a.fallen_ops) {
      assert.ok(ARTEN.indexOf(f.op.art) !== -1, a.id + ': fallen_op-Art ' + f.op.art);
      assert.ok(typeof f.op.wert === 'number' && f.op.wert > 0, a.id + ': fallen_op-Wert ' + f.op.wert);
      assert.ok(SEITEN.indexOf(f.op.seite) !== -1, a.id + ': fallen_op-Seite ' + f.op.seite);
      assert.ok(MUSTER.indexOf(f.muster) !== -1, a.id + ': Muster "' + f.muster + '"');
      assert.ok(typeof f.text === 'string' && f.text.length >= 10, a.id + ': Fallen-Text fehlt/zu kurz');
    }
  }
});

test('Katalog: fallen_ops greifen im Startzustand (klassifiziere_fehlop liefert ihr Muster)', () => {
  for (const a of alleAufgaben) {
    for (const f of a.fallen_ops) {
      const m = klassifiziere_fehlop(a, a.start, f.op);
      assert.strictEqual(m, f.muster, a.id + ': fallen_op ' + JSON.stringify(f.op) + ' -> ' + m);
    }
  }
});

test('Katalog: stufentypische Muster kommen vor (Stufe 3 zu-frueh-teilen, Stufe 4 teilen-vor-sammeln)', () => {
  const hat = (nr, muster) => STUFEN[nr - 1].aufgaben.some(a => a.fallen_ops.some(f => f.muster === muster));
  assert.ok(hat(3, 'zu-frueh-teilen'), 'Stufe 3 ohne zu-frueh-teilen');
  assert.ok(hat(4, 'teilen-vor-sammeln'), 'Stufe 4 ohne teilen-vor-sammeln');
});

test('EMPFEHLUNGEN + MUSTER_TEXTE: jedes Muster abgedeckt, jede Zieldatei existiert', () => {
  for (const m of MUSTER) {
    assert.ok(Array.isArray(EMPFEHLUNGEN[m]) && EMPFEHLUNGEN[m].length > 0, m + ': keine Empfehlung');
    assert.ok(typeof MUSTER_TEXTE[m] === 'string' && MUSTER_TEXTE[m].length >= 5, m + ': kein MUSTER_TEXT');
    for (const l of EMPFEHLUNGEN[m]) {
      const ziel = path.resolve(__dirname, l); // Links relativ zu spiele/
      assert.ok(fs.existsSync(ziel), m + ': Ziel fehlt: ' + l);
    }
  }
});

// ---------- Kandidaten & Hilfe-Schritt ----------
test('kandidaten_ops: jede Stufen-1-4-Aufgabe hat im Start >= 1 einseitigen Kandidaten', () => {
  for (const a of alleAufgaben) {
    if (a.stufe === 5) continue;
    const ops = kandidaten_ops(a, a.start);
    assert.ok(ops.some(o => o.seite !== 'beide'), a.id + ': kein einseitiger Kandidat');
  }
});

test('kandidaten_ops: dedupliziert (opKey eindeutig)', () => {
  for (const a of alleAufgaben) {
    const keys = kandidaten_ops(a, a.start).map(opKey);
    assert.strictEqual(new Set(keys).size, keys.length, a.id + ': doppelte Kandidaten');
  }
});

test('kandidaten_ops: jeder musterweg-Schritt ist Kandidat seines Zwischenzustands', () => {
  for (const a of alleAufgaben) {
    let z = a.start;
    for (const op of a.musterweg) {
      const keys = kandidaten_ops(a, z).map(opKey);
      assert.ok(keys.indexOf(opKey(op)) !== -1,
        a.id + ': Schritt ' + opKey(op) + ' fehlt in Kandidaten von ' + JSON.stringify(z));
      z = wende_an(z, op, a.stufe === 5);
    }
  }
});

test('naechsterSchritt loest alle 30 Aufgaben in <= 5 Schritten', () => {
  for (const a of alleAufgaben) {
    let z = a.start;
    let schritte = 0;
    while (!ist_geloest(z).geloest) {
      const op = naechsterSchritt(z, a.stufe);
      assert.ok(op, a.id + ': kein naechster Schritt bei ' + JSON.stringify(z));
      z = wende_an(z, op, a.stufe === 5);
      assert.ok(!z.fehler, a.id + ': naechsterSchritt scheitert: ' + z.fehler);
      schritte++;
      assert.ok(schritte <= 5, a.id + ': mehr als 5 Schritte');
    }
  }
});

// ---------- Empfehlungs-Policy ----------
test('empfehlungs_hrefs: Policy-Tabelle (Schwelle ' + EMPFEHLUNGS_SCHWELLE + ' / alleSelbst / Dedup)', () => {
  // 1 Vorkommen + alles selbst geloest -> keine Links
  assert.deepStrictEqual(empfehlungs_hrefs({ 'einseitig': 1 }, true, null), []);
  // 2 Vorkommen -> Link trotz alleSelbst
  assert.deepStrictEqual(empfehlungs_hrefs({ 'einseitig': 2 }, true, null),
    EMPFEHLUNGEN['einseitig']);
  // 1 Vorkommen + Hilfe genutzt (nicht alles selbst) -> Link
  assert.deepStrictEqual(empfehlungs_hrefs({ 'einseitig': 1 }, false, null),
    EMPFEHLUNGEN['einseitig']);
  // Dedup ueber Muster hinweg + Ausschlussliste
  const beide = empfehlungs_hrefs({ 'zu-frueh-teilen': 2, 'teilen-vor-sammeln': 2 }, true, null);
  assert.deepStrictEqual(beide, EMPFEHLUNGEN['zu-frueh-teilen']);
  assert.deepStrictEqual(
    empfehlungs_hrefs({ 'zu-frueh-teilen': 2 }, true, EMPFEHLUNGEN['zu-frueh-teilen']), []);
});

test('TRAINER_NAMEN: jeder EMPFEHLUNGEN-href hat einen Anzeigenamen', () => {
  for (const m in EMPFEHLUNGEN) {
    for (const href of EMPFEHLUNGEN[m]) {
      assert.ok(typeof TRAINER_NAMEN[href] === 'string' && TRAINER_NAMEN[href].length > 0,
        m + ': kein TRAINER_NAMEN-Eintrag fuer ' + href);
    }
  }
});

test('TEXTE: alle wende_an-Fehlercodes haben einen Fallback-Text', () => {
  for (const code of ['einseitig', 'nicht-teilbar', 'negativ', 'unbekannte-art']) {
    assert.ok(typeof TEXTE.fehler[code] === 'string' && TEXTE.fehler[code].length >= 10,
      code + ': kein Fallback-Text');
  }
  // abgeleiteter einseitig-Fallback: unveraenderter Wortlaut fuer die UI-Tests
  assert.ok(TEXTE.fehler['einseitig'].indexOf('nur eine Seite ver\u00e4ndert') !== -1,
    'einseitig-Fallback verliert den Kern aus MUSTER_TEXTE');
});

test('ASCII-only: Daten-, Logik- und UI-Datei ohne Nicht-ASCII-Zeichen', () => {
  for (const f of ['waage-daten.js', 'waage-logik.js', 'waage.js']) {
    const inhalt = fs.readFileSync(path.join(__dirname, f), 'utf8');
    const m = inhalt.match(/[^\x00-\x7F]/);
    assert.ok(!m, f + ': Nicht-ASCII-Zeichen gefunden: ' + JSON.stringify(m && m[0]));
  }
});

console.log('\n' + anzahl + ' Tests, exitCode=' + (process.exitCode || 0));

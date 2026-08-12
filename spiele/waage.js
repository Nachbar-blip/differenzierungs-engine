// Gleichungs-Waage "Balance" - UI-Schicht.
// Nutzt STUFEN/EMPFEHLUNGEN/MUSTER_TEXTE (waage-daten.js) und
// wende_an/ist_geloest/klassifiziere_fehlop (waage-logik.js).
// WICHTIG: Alle JS-Strings sind ASCII-only; Umlaute nur als HTML-Entities
// (werden via innerHTML gerendert) oder \u-Escapes.
// Kontrakt der Logik-Schicht: Distraktor-Arten (add_c, mul, ...) werden NIE
// angewendet - wende_an liefert fuer sie {fehler:"unbekannte-art"}.
// kippt-Semantik: wende_an nennt bei einseitigen Ops die Seite, die LEICHTER
// wuerde - diese Seite geht in der Animation nach OBEN.
'use strict';

(function () {

  // ===== SVG-Layout-Konstanten =====
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var VIEW_W = 640, VIEW_H = 310;
  var PIVX = 320, PIVY = 70;   // Drehpunkt des Balkens
  var ARM = 200;               // halbe Balkenlaenge
  var KIPP_WINKEL = 11;        // Grad der Was-waere-wenn-Kippung

  // Anzeigenamen fuer Empfehlungs-Links (Entities erlaubt, Strings ASCII)
  var TRAINER_NAMEN = {
    '../trainer/7-gleichungen-linear.html': 'Lineare Gleichungen (Klasse 7)',
    '../trainer/7-terme-vereinfachen.html': 'Terme vereinfachen (Klasse 7)'
  };

  // Standard-Texte, falls eine Fehl-Op keinen kuratierten Fallen-Text hat
  var FEHLER_TEXTE = {
    'einseitig': 'Du hast nur eine Seite ver&auml;ndert &ndash; das Gleichgewicht geht verloren. Immer beide Seiten gleich behandeln.',
    'nicht-teilbar': 'So l&auml;sst sich nicht alles in gleich gro&szlig;e Portionen aufteilen &ndash; es entstehen Bruchst&uuml;cke. Versuch erst etwas anderes.',
    'negativ': 'So viel liegt gar nicht auf der Waage &ndash; du kannst nicht mehr wegnehmen, als da ist.',
    'unbekannte-art': 'Dieser Schritt bringt dich nicht weiter &ndash; er macht die Gleichung voller statt leerer.'
  };

  // ===== Spielzustand =====
  var stufeIdx = 0;
  var aufgabeIdx = 0;
  var aufgabe = null;
  var zustand = null;          // {xL, cL, xR, cR}
  var history = [];            // Zustaende (fuer die Mitschrift)
  var opsHist = [];            // angewendete Ops (history[i] --op[i]--> history[i+1])
  var gesperrt = false;        // Eingabe gesperrt (Animation/Erfolg)
  var geloestFlag = false;
  var fehlVersuche = 0;        // Fehl-Ops in der aktuellen Aufgabe
  var musterDieseAufgabe = {}; // Muster max. 1x je Aufgabe zaehlen
  var musterStufe = {};
  var musterGesamt = {};
  var loesungGezeigt = false;  // "Zeig mir den naechsten Schritt" genutzt
  var selbstGeloestStufe = 0;
  var hilfeGenutztStufe = 0;
  var gespielteStufen = 0;
  var aktiverTab = 'waage';
  var animId = null;
  var kippTimer = null;

  // DOM-Referenzen
  var el = {};
  ['startScreen', 'spielScreen', 'auswertungScreen', 'stufeInfo', 'aufgabeInfo',
   'aufgabeAnzeige', 'tabWaage', 'tabSkizze', 'tabGleichung', 'stufe5Hinweis',
   'panelWaage', 'panelSkizze', 'panelGleichung', 'waageWrap', 'skizzeWrap',
   'mitschriftGleichung', 'opLeiste', 'btnNaechsterSchritt', 'feedbackBereich',
   'auswertungTitel', 'auswertungInhalt', 'auswertungGesamt',
   'btnNaechsteStufe', 'btnStufenwahl'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  // Mini-Mitschrift (aktuelle Gleichung) unter Waage und Skizze
  var miniWaage = document.createElement('div');
  miniWaage.className = 'mitschrift-mini';
  el.panelWaage.appendChild(miniWaage);
  var miniSkizze = document.createElement('div');
  miniSkizze.className = 'mitschrift-mini';
  el.panelSkizze.appendChild(miniSkizze);

  // SVG-Teile der aktuellen Aufgabe
  var svg = null, balken = null, panG = null;

  // ===== Hilfsfunktionen =====

  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // Deterministischer String-Hash (Button-Reihenfolge pro Aufgabe stabil mischen)
  function hashStr(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h;
  }

  function opKey(op) { return op.art + '|' + op.wert + '|' + op.seite; }

  function ggt(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }

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

  function katexInto(node, tex) {
    if (typeof katex !== 'undefined') {
      try { katex.render(tex, node, { throwOnError: false }); return; } catch (e) { /* Fallback unten */ }
    }
    node.textContent = tex;
  }

  // ===== Gleichung als LaTeX =====

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

  // Button-Beschriftung (alle Arten inkl. Distraktoren)
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

  // ===== Operations-Kandidaten aus dem Zustand ableiten =====

  function standardOps(z, stufe) {
    var ops = [];
    var mx = Math.min(z.xL, z.xR);
    if (mx > 0) ops.push({ art: 'sub_x', wert: mx, seite: 'beide' });
    if (stufe === 5) {
      // x-Seite bestimmen und deren Konstante entfernen (darf negativ sein)
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
  // x sammeln -> Konstante der x-Seite raeumen -> aufteilen.
  function naechsterSchritt(z, stufe) {
    var mx = Math.min(z.xL, z.xR);
    if (mx > 0) return { art: 'sub_x', wert: mx, seite: 'beide' };
    var xsL = z.xL > 0;
    var c = xsL ? z.cL : z.cR;
    if (c !== 0 && (stufe === 5 || c > 0)) return { art: 'sub_c', wert: c, seite: 'beide' };
    var a = xsL ? z.xL : z.xR;
    if (a > 1) return { art: 'div', wert: a, seite: 'beide' };
    return null;
  }

  // ===== Waage (SVG) =====

  function baueWaage() {
    el.waageWrap.innerHTML = '';
    svg = svgEl('svg', {
      'class': 'waage-svg',
      viewBox: '0 0 ' + VIEW_W + ' ' + VIEW_H,
      'aria-label': 'Balkenwaage mit x-Kisten und 1er-Gewichten'
    });
    svg.appendChild(svgEl('line', { 'class': 'wg-boden', x1: 200, y1: 292, x2: 440, y2: 292 }));
    svg.appendChild(svgEl('polygon', { 'class': 'wg-staender', points: '320,74 298,290 342,290' }));
    balken = svgEl('g');
    balken.appendChild(svgEl('line', { 'class': 'wg-balken', x1: PIVX - ARM, y1: PIVY, x2: PIVX + ARM, y2: PIVY }));
    svg.appendChild(balken);
    svg.appendChild(svgEl('circle', { 'class': 'wg-drehpunkt', cx: PIVX, cy: PIVY, r: 9 }));
    panG = {};
    ['L', 'R'].forEach(function (s) {
      var g = svgEl('g');
      g.appendChild(svgEl('line', { 'class': 'wg-schnur', x1: 0, y1: 0, x2: -52, y2: 80 }));
      g.appendChild(svgEl('line', { 'class': 'wg-schnur', x1: 0, y1: 0, x2: 52, y2: 80 }));
      g.appendChild(svgEl('path', { 'class': 'wg-schale', d: 'M -58 80 Q 0 106 58 80 Z' }));
      var inhalt = svgEl('g');
      g.appendChild(inhalt);
      panG[s] = { g: g, inhalt: inhalt };
      svg.appendChild(g);
    });
    el.waageWrap.appendChild(svg);
    setNeigung(0);
  }

  function setNeigung(winkel) {
    balken.setAttribute('transform', 'rotate(' + winkel + ' ' + PIVX + ' ' + PIVY + ')');
    var rad = winkel * Math.PI / 180;
    ['L', 'R'].forEach(function (s) {
      var dx = (s === 'L' ? -1 : 1) * (ARM - 14);
      var x = PIVX + dx * Math.cos(rad);
      var y = PIVY + dx * Math.sin(rad);
      panG[s].g.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
    });
  }

  // Schalen-Inhalt: erst x-Kisten (Quadrate), dann 1er-Gewichte (Kreise),
  // gestapelt in Reihen zu 5 direkt ueber der Schale.
  function fuellePan(seite, x, c, animiert) {
    var alt = panG[seite].inhalt;
    var inhalt = svgEl('g', animiert ? { 'class': 'wg-inhalt-neu' } : {});
    var n = x + c;
    for (var i = 0; i < n; i++) {
      var row = Math.floor(i / 5);
      var inRow = Math.min(5, n - row * 5);
      var col = i % 5;
      var px = (col - (inRow - 1) / 2) * 29;
      var py = 66 - row * 28;
      if (i < x) {
        inhalt.appendChild(svgEl('rect', { 'class': 'wg-kiste', x: px - 13, y: py - 13, width: 26, height: 26, rx: 4 }));
        var tk = svgEl('text', { 'class': 'wg-kiste-text', x: px, y: py + 5 });
        tk.textContent = 'x';
        inhalt.appendChild(tk);
      } else {
        inhalt.appendChild(svgEl('circle', { 'class': 'wg-gewicht', cx: px, cy: py, r: 11 }));
        var tg = svgEl('text', { 'class': 'wg-gewicht-text', x: px, y: py + 4 });
        tg.textContent = '1';
        inhalt.appendChild(tg);
      }
    }
    panG[seite].g.replaceChild(inhalt, alt);
    panG[seite].inhalt = inhalt;
  }

  function animiereNeigung(von, zu, dauer, cb) {
    var t0 = null;
    function schritt(ts) {
      if (t0 === null) t0 = ts;
      var f = Math.min(1, (ts - t0) / dauer);
      var e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; // ease in-out
      setNeigung(von + (zu - von) * e);
      if (f < 1) { animId = requestAnimationFrame(schritt); }
      else { animId = null; if (cb) cb(); }
    }
    animId = requestAnimationFrame(schritt);
  }

  // Was-waere-wenn: kippt = Seite, die LEICHTER wuerde -> geht nach OBEN.
  // SVG-Rotation: positiver Winkel hebt das linke Balkenende (y-Achse zeigt nach unten).
  function kippAnimation(kippt, cb) {
    var ziel = kippt === 'links' ? KIPP_WINKEL : -KIPP_WINKEL;
    animiereNeigung(0, ziel, 350, function () {
      kippTimer = setTimeout(function () { animiereNeigung(ziel, 0, 350, cb); }, 800);
    });
  }

  // Kurze "Bruchstuecke"-Andeutung (zu frueh geteilt): rote Scherben rieseln
  function zeigeBruchstuecke() {
    ['L', 'R'].forEach(function (s) {
      for (var i = 0; i < 4; i++) {
        var px = (i - 1.5) * 26, py = 46;
        var p = svgEl('polygon', {
          'class': 'wg-bruch',
          points: px + ',' + py + ' ' + (px + 9) + ',' + (py + 13) + ' ' + (px - 6) + ',' + (py + 14)
        });
        panG[s].g.appendChild(p);
        setTimeout((function (node) {
          return function () { if (node.parentNode) node.parentNode.removeChild(node); };
        })(p), 1200);
      }
    });
  }

  // ===== Skizze (ikonisch) =====

  function skizzeSeiteHtml(titel, x, c) {
    var s = '<div class="skizze-seite"><div class="skizze-titel">' + titel + '</div><div>';
    for (var i = 0; i < x; i++) s += '<span class="sk-kiste">x</span>';
    if (c !== 0) {
      if (Number.isInteger(c)) {
        var neg = c < 0;
        for (var j = 0; j < Math.abs(c); j++) {
          s += '<span class="sk-gewicht' + (neg ? ' sk-minus' : '') + '">' + (neg ? '&minus;1' : '1') + '</span>';
        }
      } else {
        s += '<span class="sk-gewicht' + (c < 0 ? ' sk-minus' : '') + '">' + formatHtml(c) + '</span>';
      }
    }
    if (x === 0 && c === 0) s += '<span class="sk-leer">leer (0)</span>';
    return s + '</div></div>';
  }

  function renderSkizze() {
    el.skizzeWrap.innerHTML =
      skizzeSeiteHtml('Linke Seite', zustand.xL, zustand.cL) +
      '<div class="skizze-gleich">=</div>' +
      skizzeSeiteHtml('Rechte Seite', zustand.xR, zustand.cR);
  }

  // ===== Mitschrift (symbolisch) =====

  function renderMitschrift() {
    el.mitschriftGleichung.innerHTML = '';
    for (var i = 0; i < history.length; i++) {
      var zeile = document.createElement('div');
      zeile.className = 'mitschrift-zeile';
      var tex = zustandTex(history[i]);
      if (i < opsHist.length) tex += ' \\;\\big|\\; ' + opTex(opsHist[i]);
      else if (i === history.length - 1 && ist_geloest(history[i]).geloest) {
        zeile.className += ' mitschrift-ergebnis';
      }
      katexInto(zeile, tex);
      el.mitschriftGleichung.appendChild(zeile);
    }
  }

  function renderMini() {
    katexInto(miniWaage, zustandTex(zustand));
    katexInto(miniSkizze, zustandTex(zustand));
  }

  // ===== Operations-Buttons =====

  function renderButtons() {
    el.opLeiste.innerHTML = '';
    if (geloestFlag) return;
    var ops = standardOps(zustand, aufgabe.stufe);
    var vorhanden = {};
    ops.forEach(function (o) { vorhanden[opKey(o)] = true; });
    (aufgabe.fallen_ops || []).forEach(function (f) {
      if (!vorhanden[opKey(f.op)]) { vorhanden[opKey(f.op)] = true; ops.push(f.op); }
    });
    // Deterministisch gemischt: Seed aus Aufgaben-id + Op-Schluessel
    ops.sort(function (a, b) {
      return hashStr(aufgabe.id + '#' + opKey(a)) - hashStr(aufgabe.id + '#' + opKey(b));
    });
    ops.forEach(function (op) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'op-btn';
      b.innerHTML = opLabel(op);
      b.disabled = gesperrt;
      b.addEventListener('click', function () { opKlick(op); });
      el.opLeiste.appendChild(b);
    });
  }

  function sperren() {
    el.opLeiste.querySelectorAll('button').forEach(function (b) { b.disabled = gesperrt; });
    el.btnNaechsterSchritt.disabled = gesperrt;
  }

  // ===== Rendering-Sammler =====

  function renderZustand(animiert) {
    if (aufgabe.waage) {
      fuellePan('L', zustand.xL, zustand.cL, animiert);
      fuellePan('R', zustand.xR, zustand.cR, animiert);
      setNeigung(0);
    }
    renderSkizze();
    renderMitschrift();
    renderMini();
    renderButtons();
  }

  // ===== Tabs (EIS) =====

  function setTab(name) {
    aktiverTab = name;
    [['waage', el.tabWaage, el.panelWaage],
     ['skizze', el.tabSkizze, el.panelSkizze],
     ['gleichung', el.tabGleichung, el.panelGleichung]].forEach(function (t) {
      var aktiv = t[0] === name;
      t[1].classList.toggle('aktiv', aktiv);
      t[1].setAttribute('aria-selected', String(aktiv));
      t[2].hidden = !aktiv;
    });
  }

  // ===== Spielablauf =====

  function zeigeScreen(name) {
    el.startScreen.hidden = name !== 'start';
    el.spielScreen.hidden = name !== 'spiel';
    el.auswertungScreen.hidden = name !== 'auswertung';
  }

  function starteStufe(idx) {
    stufeIdx = idx;
    aufgabeIdx = 0;
    musterStufe = {};
    selbstGeloestStufe = 0;
    hilfeGenutztStufe = 0;
    zeigeAufgabe();
    zeigeScreen('spiel');
  }

  function zeigeAufgabe() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (kippTimer) { clearTimeout(kippTimer); kippTimer = null; }
    aufgabe = STUFEN[stufeIdx].aufgaben[aufgabeIdx];
    zustand = aufgabe.start;
    history = [zustand];
    opsHist = [];
    gesperrt = false;
    geloestFlag = false;
    fehlVersuche = 0;
    musterDieseAufgabe = {};
    loesungGezeigt = false;
    el.stufeInfo.textContent = 'Stufe ' + (stufeIdx + 1) + ': ' + STUFEN[stufeIdx].name;
    el.aufgabeInfo.textContent = 'Aufgabe ' + (aufgabeIdx + 1) + ' von ' + STUFEN[stufeIdx].aufgaben.length;
    el.feedbackBereich.innerHTML = '';
    el.btnNaechsterSchritt.hidden = true;
    el.btnNaechsterSchritt.disabled = false;

    // Stufe 5: Waage-Tab gesperrt, Standard-Tab = Gleichung
    el.tabWaage.disabled = !aufgabe.waage;
    el.tabWaage.title = aufgabe.waage ? '' : 'Eine Waage kann keine negativen Zahlen wiegen';
    el.stufe5Hinweis.hidden = aufgabe.waage;
    if (!aufgabe.waage && aktiverTab === 'waage') setTab('gleichung');
    else setTab(aktiverTab);

    el.aufgabeAnzeige.innerHTML = 'L&ouml;se die Gleichung ';
    var span = document.createElement('span');
    el.aufgabeAnzeige.appendChild(span);
    katexInto(span, aufgabe.anzeige);

    if (aufgabe.waage) baueWaage();
    else el.waageWrap.innerHTML = '';
    renderZustand(false);
  }

  function fallenText(op) {
    var fallen = aufgabe.fallen_ops || [];
    for (var i = 0; i < fallen.length; i++) {
      if (opKey(fallen[i].op) === opKey(op)) return fallen[i].text;
    }
    return null;
  }

  function opKlick(op) {
    if (gesperrt) return;
    el.feedbackBereich.innerHTML = '';
    var muster = klassifiziere_fehlop(aufgabe, zustand, op);
    var res = wende_an(zustand, op, aufgabe.stufe === 5);
    if (res.fehler) fehlOp(op, muster, res);
    else schrittAnwenden(op, res, false);
  }

  function fehlOp(op, muster, res) {
    fehlVersuche++;
    if (muster && !musterDieseAufgabe[muster]) { // je Aufgabe max. 1x zaehlen
      musterDieseAufgabe[muster] = true;
      musterStufe[muster] = (musterStufe[muster] || 0) + 1;
    }
    if (fehlVersuche >= 3) el.btnNaechsterSchritt.hidden = false;
    var text = fallenText(op) || FEHLER_TEXTE[res.fehler] || FEHLER_TEXTE['unbekannte-art'];

    if (res.fehler === 'einseitig' && aufgabe.waage) {
      // kippt = Seite, die leichter wuerde -> geht nach OBEN
      var seiteTxt = res.kippt === 'links'
        ? 'Die linke Seite w&uuml;rde leichter und ginge nach oben.'
        : 'Die rechte Seite w&uuml;rde leichter und ginge nach oben.';
      gesperrt = true;
      sperren();
      zeigeFeedback('falsch', 'Die Waage kippt!', seiteTxt + '<br>' + text, false);
      kippAnimation(res.kippt, function () {
        gesperrt = false;
        sperren();
      });
    } else if (res.fehler === 'nicht-teilbar' && aufgabe.waage) {
      zeigeBruchstuecke();
      zeigeFeedback('falsch', 'Das gibt Bruchst&uuml;cke!', text, false);
    } else {
      zeigeFeedback('falsch', 'Stopp!', text, false);
    }
  }

  function schrittAnwenden(op, neu, viaHilfe) {
    opsHist.push(op);
    history.push(neu);
    zustand = neu;
    var g = ist_geloest(neu);
    if (g.geloest) {
      geloestFlag = true;
      gesperrt = true;
      el.btnNaechsterSchritt.hidden = true;
    }
    renderZustand(true);
    if (g.geloest) {
      var n = formatHtml(g.loesung);
      var satz = aufgabe.waage
        ? 'x = ' + n + ' &ndash; die Kiste wiegt ' + n + '!'
        : 'x = ' + n + ' &ndash; auch ohne Waage sicher gel&ouml;st!';
      var zusatz = viaHilfe || loesungGezeigt
        ? 'Du hast dir Schritte zeigen lassen &ndash; beim n&auml;chsten Mal schaffst du es allein.'
        : 'Stark, das hast du selbst geschafft!';
      zeigeFeedback('richtig', 'Gel&ouml;st!', satz + '<br>' + zusatz, true);
    }
  }

  function zeigeFeedback(art, titel, text, mitWeiter) {
    var html = '<div class="feedback feedback-' + art + '">' +
      '<div class="feedback-icon">' + titel + '</div>' +
      '<div class="wg-loesungstext">' + text + '</div>' +
      (mitWeiter ? '<button class="btn-weiter" id="btnWeiter" type="button">Weiter</button>' : '') +
      '</div>';
    el.feedbackBereich.innerHTML = html;
    var b = document.getElementById('btnWeiter');
    if (b) b.addEventListener('click', naechsteAufgabe);
  }

  // "Zeig mir den naechsten Schritt": fuehrt EINEN korrekten Schritt aus,
  // markiert die Aufgabe als "mit Hilfe" (zaehlt nicht als selbst geloest).
  function naechsterSchrittKlick() {
    if (gesperrt) return;
    var op = naechsterSchritt(zustand, aufgabe.stufe);
    if (!op) return;
    el.feedbackBereich.innerHTML = '';
    loesungGezeigt = true;
    var res = wende_an(zustand, op, aufgabe.stufe === 5);
    if (!res.fehler) schrittAnwenden(op, res, true);
  }

  function naechsteAufgabe() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (loesungGezeigt) hilfeGenutztStufe++;
    else selbstGeloestStufe++;
    aufgabeIdx++;
    if (aufgabeIdx >= STUFEN[stufeIdx].aufgaben.length) {
      gespielteStufen++;
      zeigeAuswertung();
    } else {
      zeigeAufgabe();
    }
  }

  // ===== Auswertung =====

  function musterListeHtml(zaehler) {
    var html = '<ul class="auswertung-liste">';
    var gefunden = false;
    for (var m in zaehler) {
      if (!zaehler[m]) continue;
      gefunden = true;
      html += '<li>' + zaehler[m] + 'x ' + (MUSTER_TEXTE[m] || m) + '</li>';
    }
    html += '</ul>';
    return gefunden ? html : '';
  }

  // ausschluss: hrefs, die schon woanders angezeigt werden (Dedup Stufen-/Gesamt-Block)
  function empfehlungenHtml(zaehler, ausschluss) {
    var links = [], gesehen = {};
    for (var h in (ausschluss || {})) gesehen[h] = true;
    for (var m in zaehler) {
      if (!zaehler[m] || !EMPFEHLUNGEN[m]) continue;
      EMPFEHLUNGEN[m].forEach(function (href) {
        if (gesehen[href]) return;
        gesehen[href] = true;
        links.push('<a class="wg-outline" href="' + href + '">' + (TRAINER_NAMEN[href] || href) + '</a>');
      });
    }
    if (links.length === 0) return '';
    return '<div class="empfehlung-block"><h3>Diese Trainer helfen dir weiter:</h3>' + links.join('') + '</div>';
  }

  function empfehlungsHrefs(zaehler) {
    var hrefs = {};
    for (var m in zaehler) {
      if (!zaehler[m] || !EMPFEHLUNGEN[m]) continue;
      EMPFEHLUNGEN[m].forEach(function (href) { hrefs[href] = true; });
    }
    return hrefs;
  }

  function zeigeAuswertung() {
    var stufe = STUFEN[stufeIdx];
    var letzteStufe = stufeIdx >= STUFEN.length - 1;
    for (var m in musterStufe) {
      musterGesamt[m] = (musterGesamt[m] || 0) + musterStufe[m];
    }
    el.auswertungTitel.textContent = 'Stufe ' + (stufeIdx + 1) + ' geschafft!';

    var liste = musterListeHtml(musterStufe);
    var anzahl = stufe.aufgaben.length;
    var erfolgSatz = selbstGeloestStufe >= anzahl
      ? '<p class="wg-loesungstext">Alle ' + anzahl + ' Aufgaben hast du selbst gel&ouml;st &ndash; super!</p>'
      : '<p class="wg-loesungstext">' + selbstGeloestStufe + ' von ' + anzahl +
        ' Aufgaben hast du selbst gel&ouml;st.</p>';
    var hilfeSatz = hilfeGenutztStufe > 0
      ? '<p class="wg-loesungstext">Bei ' + hilfeGenutztStufe + ' von ' + anzahl +
        ' Aufgaben hast du dir Schritte zeigen lassen &ndash; auch so lernt man!</p>'
      : '';
    var html;
    if (liste === '') {
      html = '<div class="auswertung-positiv">Klasse! Keine einzige Fehl-Umformung.' +
        (letzteStufe ? ' Du hast alle Stufen gemeistert!' : ' Trau dich an die n&auml;chste Stufe!') + '</div>' +
        erfolgSatz + hilfeSatz;
    } else {
      html = '<p class="wg-loesungstext">Hier hat dich die Waage ausgetrickst:</p>' + liste +
        erfolgSatz + hilfeSatz + empfehlungenHtml(musterStufe);
    }
    el.auswertungInhalt.innerHTML = html;

    // Gesamt-Block ab der zweiten gespielten Stufe (Empfehlungs-Dedup!)
    if (gespielteStufen > 1) {
      var gesamtListe = musterListeHtml(musterGesamt);
      var schonGezeigt = liste === '' ? {} : empfehlungsHrefs(musterStufe);
      el.auswertungGesamt.innerHTML = '<h3>Alle Stufen zusammen:</h3>' +
        (gesamtListe === ''
          ? '<div class="auswertung-positiv">Bisher keine einzige Fehl-Umformung &ndash; du formst um wie ein Profi!</div>'
          : gesamtListe + empfehlungenHtml(musterGesamt, schonGezeigt));
    } else {
      el.auswertungGesamt.innerHTML = '';
    }

    // hidden reicht nicht: .btn-weiter (spirale.css) setzt display:inline-block ->
    // zusaetzlich per style.display UND scoped [hidden]-Regel in waage.css.
    el.btnNaechsteStufe.hidden = letzteStufe;
    el.btnNaechsteStufe.style.display = letzteStufe ? 'none' : '';
    el.btnNaechsteStufe.textContent = letzteStufe ? '' : 'Weiter zu Stufe ' + (stufeIdx + 2);
    zeigeScreen('auswertung');
  }

  // ===== Verdrahtung =====

  document.querySelectorAll('.stufe-karte').forEach(function (karte) {
    karte.addEventListener('click', function () {
      starteStufe(parseInt(karte.getAttribute('data-stufe'), 10));
    });
  });
  el.tabWaage.addEventListener('click', function () { setTab('waage'); });
  el.tabSkizze.addEventListener('click', function () { setTab('skizze'); });
  el.tabGleichung.addEventListener('click', function () { setTab('gleichung'); });
  el.btnNaechsterSchritt.addEventListener('click', naechsterSchrittKlick);
  el.btnNaechsteStufe.addEventListener('click', function () { starteStufe(stufeIdx + 1); });
  el.btnStufenwahl.addEventListener('click', function () { zeigeScreen('start'); });

})();

// Gleichungs-Waage "Balance" - UI-Schicht.
// Daten: STUFEN/EMPFEHLUNGEN/MUSTER_TEXTE/TRAINER_NAMEN/TEXTE (waage-daten.js).
// Logik: wende_an/ist_geloest/klassifiziere_fehlop + kandidaten_ops/
// naechsterSchritt (Prioritaetsliste), Notation (opLabel/opTex/zustandTex/
// formatHtml) und Empfehlungs-Policy (empfehlungs_hrefs) aus waage-logik.js.
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

  // A11y: bei reduzierter Bewegung Animations-Dauern/-Pausen auf ~0
  var REDUZIERT = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KIPP_DAUER = REDUZIERT ? 1 : 350;
  var KIPP_PAUSE = REDUZIERT ? 0 : 800;
  var BRUCH_DAUER = REDUZIERT ? 0 : 1200;

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
  var fehlKatAufgabe = {};     // Fehl-Kategorie -> Anzahl in DIESER Aufgabe (Eskalation)
  var musterProStufe = {};    // stufeIdx -> Muster-Zaehler; Replay UEBERSCHREIBT (keine Doppelzaehlung)
  var loesungGezeigt = false;  // "Zeig mir den naechsten Schritt" genutzt
  var selbstGeloestStufe = 0;
  var aktiverTab = 'waage';
  var animId = null;
  var kippTimer = null;
  var bruchTimer = null;

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

  function katexInto(node, tex) {
    node.innerHTML = katexHtml(tex);
  }

  function katexHtml(tex) {
    if (typeof katex !== 'undefined') {
      try { return katex.renderToString(tex, { throwOnError: false }); }
      catch (e) { /* Fallback unten */ }
    }
    var div = document.createElement('div');
    div.textContent = tex;
    return div.innerHTML;
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
    animiereNeigung(0, ziel, KIPP_DAUER, function () {
      kippTimer = setTimeout(function () { animiereNeigung(ziel, 0, KIPP_DAUER, cb); }, KIPP_PAUSE);
    });
  }

  // Kurze "Bruchstuecke"-Andeutung (zu frueh geteilt): rote Scherben rieseln.
  // Alle Scherben einer Seite in EINER Gruppe, EIN Aufraeum-Timer (dessen ID
  // cancelt zeigeAufgabe beim Aufgabenwechsel mit).
  function zeigeBruchstuecke() {
    if (bruchTimer) { clearTimeout(bruchTimer); bruchTimer = null; }
    var gruppen = [];
    ['L', 'R'].forEach(function (s) {
      var g = svgEl('g', {});
      for (var i = 0; i < 4; i++) {
        var px = (i - 1.5) * 26, py = 46;
        g.appendChild(svgEl('polygon', {
          'class': 'wg-bruch',
          points: px + ',' + py + ' ' + (px + 9) + ',' + (py + 13) + ' ' + (px - 6) + ',' + (py + 14)
        }));
      }
      panG[s].g.appendChild(g);
      gruppen.push(g);
    });
    bruchTimer = setTimeout(function () {
      bruchTimer = null;
      gruppen.forEach(function (g) { if (g.parentNode) g.parentNode.removeChild(g); });
    }, BRUCH_DAUER);
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
  // Inkrementell: zeigeAufgabe leert und setzt die Startzeile, jeder Schritt
  // rendert nur die Vorzeile neu (Op-Anhang) und haengt EINE Zeile an.

  function mitschriftZeile(z) {
    var zeile = document.createElement('div');
    zeile.className = 'mitschrift-zeile';
    katexInto(zeile, zustandTex(z));
    el.mitschriftGleichung.appendChild(zeile);
    return zeile;
  }

  function mitschriftReset() {
    el.mitschriftGleichung.innerHTML = '';
    mitschriftZeile(zustand);
  }

  function mitschriftSchritt(op, neu, geloest) {
    var vor = el.mitschriftGleichung.lastElementChild;
    katexInto(vor, zustandTex(history[history.length - 2]) + ' \\;\\big|\\; ' + opTex(op));
    var zeile = mitschriftZeile(neu);
    if (geloest) zeile.className += ' mitschrift-ergebnis';
  }

  function renderMini() {
    var html = katexHtml(zustandTex(zustand)); // 1x rendern, 2x einsetzen
    miniWaage.innerHTML = html;
    miniSkizze.innerHTML = html;
  }

  // ===== Operations-Buttons =====

  function renderButtons() {
    el.opLeiste.innerHTML = '';
    if (geloestFlag) return;
    kandidaten_ops(aufgabe, zustand).forEach(function (op) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'op-btn';
      b.setAttribute('data-op', opKey(op));
      b.innerHTML = opLabel(op);
      b.disabled = gesperrt;
      el.opLeiste.appendChild(b);
    });
  }

  // Delegierter Click-Listener (ein Listener statt einer pro Button)
  el.opLeiste.addEventListener('click', function (ev) {
    var b = ev.target.closest('button.op-btn');
    if (!b || b.disabled) return;
    var teile = b.getAttribute('data-op').split('|');
    opKlick({ art: teile[0], wert: Number(teile[1]), seite: teile[2] });
  });

  function setGesperrt(v) {
    gesperrt = v;
    el.opLeiste.querySelectorAll('button').forEach(function (b) { b.disabled = v; });
    el.btnNaechsterSchritt.disabled = v;
  }

  // ===== Rendering-Sammler =====

  function renderZustand(animiert) {
    if (aufgabe.waage) {
      fuellePan('L', zustand.xL, zustand.cL, animiert);
      fuellePan('R', zustand.xR, zustand.cR, animiert);
      setNeigung(0);
    }
    renderSkizze();
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
    musterProStufe[stufeIdx] = {}; // Replay UEBERSCHREIBT den Stufen-Zaehler
    selbstGeloestStufe = 0;
    zeigeAufgabe();
    zeigeScreen('spiel');
  }

  function zeigeAufgabe() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (kippTimer) { clearTimeout(kippTimer); kippTimer = null; }
    if (bruchTimer) { clearTimeout(bruchTimer); bruchTimer = null; }
    aufgabe = STUFEN[stufeIdx].aufgaben[aufgabeIdx];
    zustand = aufgabe.start;
    history = [zustand];
    opsHist = [];
    gesperrt = false;
    geloestFlag = false;
    fehlVersuche = 0;
    fehlKatAufgabe = {};
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
    setTab(!aufgabe.waage && aktiverTab === 'waage' ? 'gleichung' : aktiverTab);

    el.aufgabeAnzeige.innerHTML = 'L&ouml;se die Gleichung ';
    var span = document.createElement('span');
    el.aufgabeAnzeige.appendChild(span);
    katexInto(span, zustandTex(aufgabe.start));

    if (aufgabe.waage) baueWaage();
    else el.waageWrap.innerHTML = '';
    mitschriftReset();
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
    // Muster je Aufgabe max. 1x zaehlen. fehlKatAufgabe reicht als Duplikat-
    // Merker: eine Schluesselkollision Muster vs. fehler-Code ist unmoeglich,
    // denn der einzige gemeinsame Schluessel ist "einseitig" - und
    // res.fehler === "einseitig" tritt nur bei seite !== "beide" auf, wo
    // klassifiziere_fehlop immer ein Muster liefert (kat === muster).
    var musterStufe = musterProStufe[stufeIdx];
    if (muster && !fehlKatAufgabe[muster]) {
      musterStufe[muster] = (musterStufe[muster] || 0) + 1;
    }
    if (fehlVersuche >= 3) el.btnNaechsterSchritt.hidden = false;
    var text = fallenText(op) || TEXTE.fehler[res.fehler];
    // Eskalation: dieselbe Fehl-Kategorie zum 2. Mal in DIESER Aufgabe
    var kat = muster || res.fehler;
    fehlKatAufgabe[kat] = (fehlKatAufgabe[kat] || 0) + 1;
    if (fehlKatAufgabe[kat] >= 2) text = TEXTE.eskalation + text;

    if (res.fehler === 'einseitig' && aufgabe.waage) {
      // kippt = Seite, die leichter wuerde -> geht nach OBEN
      setGesperrt(true);
      zeigeFeedback('falsch', 'Die Waage kippt!', TEXTE.kipp[res.kippt] + '<br>' + text, false);
      kippAnimation(res.kippt, function () { setGesperrt(false); });
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
    mitschriftSchritt(op, neu, g.geloest);
    if (g.geloest) {
      var n = formatHtml(g.loesung);
      var satz = (aufgabe.waage ? TEXTE.geloestWaage : TEXTE.geloestOhneWaage)
        .replace(/\{n\}/g, n);
      var zusatz = viaHilfe || loesungGezeigt ? TEXTE.geloestMitHilfe : TEXTE.geloestSelbst;
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
    var box = el.feedbackBereich.firstElementChild;
    if (box && box.scrollIntoView) {
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
    var res = wende_an(zustand, op, aufgabe.stufe === 5);
    if (!res.fehler) {
      loesungGezeigt = true; // erst nach erfolgreichem Schritt als "mit Hilfe" markieren
      schrittAnwenden(op, res, true);
    }
  }

  function naechsteAufgabe() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (!loesungGezeigt) selbstGeloestStufe++;
    aufgabeIdx++;
    if (aufgabeIdx >= STUFEN[stufeIdx].aufgaben.length) {
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

  // Policy (Schwelle + Dedup) liegt in empfehlungs_hrefs (waage-logik.js);
  // hier werden nur noch die <a>-Tags gebaut.
  function empfehlungenHtml(zaehler, alleSelbst, ausschluss) {
    var links = empfehlungs_hrefs(zaehler, alleSelbst, ausschluss).map(function (href) {
      return '<a class="wg-outline" href="' + href + '">' + (TRAINER_NAMEN[href] || href) + '</a>';
    });
    if (links.length === 0) return '';
    return '<div class="empfehlung-block"><h3>Diese Trainer helfen dir weiter:</h3>' + links.join('') + '</div>';
  }

  function zeigeAuswertung() {
    var stufe = STUFEN[stufeIdx];
    var letzteStufe = stufeIdx >= STUFEN.length - 1;
    var musterStufe = musterProStufe[stufeIdx];
    var musterGesamt = {};
    for (var si in musterProStufe) {
      for (var ms in musterProStufe[si]) {
        musterGesamt[ms] = (musterGesamt[ms] || 0) + musterProStufe[si][ms];
      }
    }
    el.auswertungTitel.textContent = 'Stufe ' + (stufeIdx + 1) + ' geschafft!';

    var liste = musterListeHtml(musterStufe);
    var anzahl = stufe.aufgaben.length;
    var hilfeGenutzt = anzahl - selbstGeloestStufe; // jede Aufgabe: selbst ODER mit Hilfe
    var alleSelbst = selbstGeloestStufe >= anzahl;
    var erfolgSatz = alleSelbst
      ? '<p class="wg-loesungstext">Alle ' + anzahl + ' Aufgaben hast du selbst gel&ouml;st &ndash; super!</p>'
      : '<p class="wg-loesungstext">' + selbstGeloestStufe + ' von ' + anzahl +
        ' Aufgaben hast du selbst gel&ouml;st.</p>';
    var hilfeSatz = hilfeGenutzt > 0
      ? '<p class="wg-loesungstext">Bei ' + hilfeGenutzt + ' von ' + anzahl +
        ' Aufgaben hast du dir Schritte zeigen lassen &ndash; auch so lernt man!</p>'
      : '';
    var html;
    if (liste === '') {
      html = '<div class="auswertung-positiv">Klasse! Keine einzige Fehl-Umformung.' +
        (letzteStufe ? ' Du hast alle Stufen gemeistert!' : ' Trau dich an die n&auml;chste Stufe!') + '</div>' +
        erfolgSatz + hilfeSatz;
    } else {
      // Stufe 5 laeuft ohne Waage -> gleichungsbezogene Formulierung
      var trickser = stufe.nr === 5 ? 'die Gleichung' : 'die Waage';
      html = '<p class="wg-loesungstext">Hier hat dich ' + trickser + ' ausgetrickst:</p>' + liste +
        erfolgSatz + hilfeSatz + empfehlungenHtml(musterStufe, alleSelbst, null);
    }
    el.auswertungInhalt.innerHTML = html;

    // Gesamt-Block ab der zweiten gespielten Stufe (Empfehlungs-Dedup!)
    if (Object.keys(musterProStufe).length > 1) {
      var gesamtListe = musterListeHtml(musterGesamt);
      var schonGezeigt = liste === '' ? [] : empfehlungs_hrefs(musterStufe, alleSelbst, null);
      el.auswertungGesamt.innerHTML = '<h3>Alle Stufen zusammen:</h3>' +
        (gesamtListe === ''
          ? '<div class="auswertung-positiv">Bisher keine einzige Fehl-Umformung &ndash; du formst um wie ein Profi!</div>'
          : gesamtListe + empfehlungenHtml(musterGesamt, alleSelbst, schonGezeigt));
    } else {
      el.auswertungGesamt.innerHTML = '';
    }

    // [hidden] traegt: waage.css setzt scoped "#app [hidden] { display:none !important }"
    // gegen .btn-weiter aus spirale.css (display:inline-block).
    el.btnNaechsteStufe.hidden = letzteStufe;
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

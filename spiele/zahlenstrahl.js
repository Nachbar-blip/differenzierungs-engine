// Zahlenstrahl-Spiel "Stelle die Zahl" - UI-Schicht.
// Nutzt STUFEN/EMPFEHLUNGEN (zahlenstrahl-daten.js) und
// klassifiziere/wertZuPos/posZuWert (zahlenstrahl-logik.js).
// WICHTIG: Alle JS-Strings sind ASCII-only; Umlaute nur als HTML-Entities
// (werden via innerHTML gerendert) oder direkt im HTML-Dokument.
'use strict';

(function () {

  // ===== SVG-Layout-Konstanten =====
  var VIEW_W = 700;      // viewBox-Breite
  var VIEW_H = 130;      // viewBox-Hoehe
  var PAD = 40;          // Rand links/rechts
  var ACHSE_Y = 65;      // y der Strahl-Linie
  var TRACK_W = VIEW_W - 2 * PAD;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // Anzeigenamen fuer Empfehlungs-Links (Entities erlaubt, Strings ASCII)
  var TRAINER_NAMEN = {
    '../trainer/5-zahlen-stellenwert.html': 'Stellenwert-Training (Klasse 5)',
    '../trainer/5-dezimalbrueche.html': 'Dezimalbr&uuml;che (Klasse 5)',
    '../trainer/6-dezimalbrueche-rechnen.html': 'Rechnen mit Dezimalbr&uuml;chen (Klasse 6)',
    '../trainer/5-brueche-anteile.html': 'Br&uuml;che und Anteile (Klasse 5)'
  };

  // Fehlvorstellungs-Muster -> Schuelersprache fuer die Auswertung
  var MUSTER_TEXTE = {
    'stellenwert': 'bist du in die Stellenwert-Falle getappt: Zehntel sind gro&szlig;e St&uuml;cke, Hundertstel viel kleinere.',
    'komma-trennt': 'hast du das Komma wie eine Trennung von zwei Zahlen gelesen. Aber eine Kommazahl ist EINE Zahl.',
    'laengere-zahl': 'dachtest du: l&auml;ngere Zahl = gr&ouml;&szlig;ere Zahl. Bei Kommazahlen stimmt das nicht!',
    'bruch-als-paar': 'hast du den Bruch als zwei einzelne Zahlen gelesen. Ein Bruch ist EINE Zahl.',
    'skala': 'hast du &uuml;bersehen, was ein Strich auf der Skala wert ist. Erst schauen, dann setzen!'
  };

  // ===== Spielzustand =====
  var stufeIdx = 0;        // Index in STUFEN
  var aufgabeIdx = 0;      // 0..7
  var versuche = 0;        // Fehlversuche der aktuellen Aufgabe
  var markerWert = 0;      // aktueller Marker-Wert
  var gesperrt = false;    // Eingabe gesperrt (Feedback/Loesung laeuft)
  var musterStufe = {};    // Muster-Zaehler der aktuellen Stufe
  var musterGesamt = {};   // Muster-Zaehler ueber alle gespielten Stufen
  var hilfeGenutztStufe = 0;      // Aufgaben dieser Stufe, bei denen Hilfe offen war
  var hilfeDieseAufgabe = false;  // lokales mitHilfe-Flag (STUFEN bleibt unveraendert)
  var gespielteStufen = 0;
  var animId = null;

  // DOM-Referenzen
  var el = {};
  ['startScreen', 'spielScreen', 'auswertungScreen', 'stufeInfo', 'aufgabeInfo',
   'aufgabeAnzeige', 'strahlWrap', 'btnPruefen', 'btnHilfe', 'hilfePanel',
   'tabBild', 'tabTafel', 'hilfeBild', 'hilfeTafel', 'feedbackBereich',
   'auswertungTitel', 'auswertungInhalt', 'auswertungGesamt',
   'btnNaechsteStufe', 'btnStufenwahl'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  // SVG-Teile der aktuellen Aufgabe
  var svg = null, marker = null, feinGruppe = null;

  // ===== Hilfsfunktionen =====

  // Deutsche Zahldarstellung: Punkt -> Komma (nur fuer Anzeige)
  function formatDe(zahl) {
    var s = String(Math.round(zahl * 1000) / 1000);
    return s.replace('.', ',');
  }

  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function aktuelleAufgabe() {
    return STUFEN[stufeIdx].aufgaben[aufgabeIdx];
  }

  function zeigeScreen(name) {
    el.startScreen.hidden = name !== 'start';
    el.spielScreen.hidden = name !== 'spiel';
    el.auswertungScreen.hidden = name !== 'auswertung';
  }

  // ===== Strahl aufbauen =====

  function xVonWert(strahl, wert) {
    return PAD + wertZuPos(strahl, wert) * TRACK_W;
  }

  function baueStrahl(aufgabe) {
    var strahl = aufgabe.strahl;
    el.strahlWrap.innerHTML = '';
    svg = svgEl('svg', {
      'class': 'strahl-svg',
      viewBox: '0 0 ' + VIEW_W + ' ' + VIEW_H,
      'aria-hidden': 'false'
    });

    // Grundlinie mit Pfeilspitze rechts
    svg.appendChild(svgEl('line', { 'class': 'strahl-linie', x1: PAD - 10, y1: ACHSE_Y, x2: VIEW_W - PAD + 14, y2: ACHSE_Y }));
    svg.appendChild(svgEl('path', { 'class': 'strahl-linie', d: 'M ' + (VIEW_W - PAD + 8) + ' ' + (ACHSE_Y - 6) + ' L ' + (VIEW_W - PAD + 16) + ' ' + ACHSE_Y + ' L ' + (VIEW_W - PAD + 8) + ' ' + (ACHSE_Y + 6), fill: 'none' }));

    // Ticks (index-basiert statt w += tick, sonst Float-Drift)
    var anzahlTicks = Math.round((strahl.max - strahl.min) / strahl.tick);
    for (var ti = 0; ti <= anzahlTicks; ti++) {
      var x = xVonWert(strahl, strahl.min + ti * strahl.tick);
      svg.appendChild(svgEl('line', { 'class': 'strahl-tick', x1: x, y1: ACHSE_Y - 7, x2: x, y2: ACHSE_Y + 7 }));
    }

    // Beschriftungen
    strahl.beschriftet.forEach(function (bw) {
      var t = svgEl('text', { 'class': 'strahl-label', x: xVonWert(strahl, bw), y: ACHSE_Y + 30 });
      t.textContent = formatDe(bw); // SVG-Textknoten, kein JS-String-Problem
      svg.appendChild(t);
    });

    // Platzhalter fuer feine Hilfs-Unterteilung
    feinGruppe = svgEl('g', { 'class': 'strahl-fein' });
    svg.appendChild(feinGruppe);

    // Marker (Startposition: linker Rand = strahl.min, nie auf der Loesung)
    markerWert = strahl.min;
    marker = svgEl('g', {
      'class': 'zs-marker',
      role: 'slider',
      tabindex: '0',
      'aria-label': 'Marker auf dem Zahlenstrahl',
      'aria-valuemin': strahl.min,
      'aria-valuemax': strahl.max,
      'aria-valuenow': strahl.min
    });
    marker.appendChild(svgEl('rect', { 'class': 'marker-hitbox', x: -26, y: 0, width: 52, height: VIEW_H }));
    marker.appendChild(svgEl('line', { 'class': 'marker-griff', x1: 0, y1: ACHSE_Y - 26, x2: 0, y2: ACHSE_Y }));
    marker.appendChild(svgEl('circle', { 'class': 'marker-kopf', cx: 0, cy: ACHSE_Y - 34, r: 14 }));
    svg.appendChild(marker);
    setzeMarker(strahl.min);

    el.strahlWrap.appendChild(svg);
    verdrahteMarker(aufgabe);
  }

  function setzeMarker(wert) {
    var strahl = aktuelleAufgabe().strahl;
    markerWert = posZuWert(strahl, wertZuPos(strahl, wert)); // klemmen
    marker.setAttribute('transform', 'translate(' + xVonWert(strahl, markerWert) + ',0)');
    var gerundet = Math.round(markerWert * 1000) / 1000;
    marker.setAttribute('aria-valuenow', gerundet);
    marker.setAttribute('aria-valuetext', formatDe(gerundet));
  }

  function wertVonClientX(clientX) {
    var rect = svg.getBoundingClientRect();
    var xView = (clientX - rect.left) * (VIEW_W / rect.width);
    return posZuWert(aktuelleAufgabe().strahl, (xView - PAD) / TRACK_W);
  }

  function verdrahteMarker(aufgabe) {
    var ziehen = false;

    svg.addEventListener('pointerdown', function (ev) {
      if (gesperrt) return;
      ziehen = true;
      svg.setPointerCapture(ev.pointerId);
      setzeMarker(wertVonClientX(ev.clientX));
      marker.focus();
      ev.preventDefault();
    });
    svg.addEventListener('pointermove', function (ev) {
      if (!ziehen || gesperrt) return;
      setzeMarker(wertVonClientX(ev.clientX));
    });
    svg.addEventListener('pointerup', function () { ziehen = false; });
    svg.addEventListener('pointercancel', function () { ziehen = false; });

    // Tastatur: Pfeiltasten +-tick/10, mit Shift +-tick
    marker.addEventListener('keydown', function (ev) {
      if (gesperrt) return;
      var tick = aufgabe.strahl.tick;
      var schritt = ev.shiftKey ? tick : tick / 10;
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') {
        setzeMarker(markerWert - schritt);
        ev.preventDefault();
      } else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') {
        setzeMarker(markerWert + schritt);
        ev.preventDefault();
      } else if (ev.key === 'Enter') {
        pruefen();
        ev.preventDefault();
      }
    });
  }

  // Feine Unterteilung einblenden (Falle-Hilfe + EIS-Bild):
  // zusaetzliche Striche im Abstand hilfe.unterteile, Beschriftung an jedem 5.
  function zeigeUnterteilung() {
    var aufgabe = aktuelleAufgabe();
    var strahl = aufgabe.strahl;
    var schritt = aufgabe.hilfe.unterteile;
    if (feinGruppe.childNodes.length === 0) {
      // index-basiert statt w += schritt, sonst Float-Drift
      var anzahl = Math.round((strahl.max - strahl.min) / schritt);
      for (var i = 0; i <= anzahl; i++) {
        var w = strahl.min + i * schritt;
        var x = xVonWert(strahl, w);
        feinGruppe.appendChild(svgEl('line', { x1: x, y1: ACHSE_Y - 14, x2: x, y2: ACHSE_Y }));
        if (i % 5 === 0) {
          var t = svgEl('text', { x: x, y: ACHSE_Y - 18 });
          t.textContent = formatDe(Math.round(w * 1000) / 1000);
          feinGruppe.appendChild(t);
        }
      }
    }
    feinGruppe.classList.add('sichtbar');
  }

  // ===== Hilfe-Panel (EIS) =====

  function baueTafel(aufgabe) {
    var typ = aufgabe.hilfe.typ;
    if (typ === 'bruch') {
      el.hilfeTafel.innerHTML = '<p class="hilfe-erklaerung">Der Bruchstreifen zeigt: So viele Teile vom Ganzen sind gemeint.</p>';
      el.hilfeTafel.appendChild(baueBruchstreifen(aufgabe));
      return;
    }
    // Stellenwerttafel: natuerlich -> H|Z|E, dezimal -> E|z|h(|t)
    var zahl = aufgabe.zahl;
    var kopf, zellen;
    if (typ === 'natuerlich') {
      var g = Math.round(zahl);
      kopf = ['H', 'Z', 'E'];
      zellen = [Math.floor(g / 100) % 10, Math.floor(g / 10) % 10, g % 10];
      if (g >= 1000) { kopf.unshift('T'); zellen.unshift(Math.floor(g / 1000) % 10); }
      el.hilfeTafel.innerHTML = '<p class="hilfe-erklaerung">H = Hunderter, Z = Zehner, E = Einer.</p>' +
        tafelHtml(kopf, zellen, -1);
    } else {
      var e = Math.floor(zahl + 1e-9);
      var rest = Math.round((zahl - e) * 1000); // Tausendstel-genau
      kopf = ['E', 'z', 'h'];
      zellen = [e, Math.floor(rest / 100) % 10, Math.floor(rest / 10) % 10];
      if (rest % 10 !== 0) { kopf.push('t'); zellen.push(rest % 10); }
      el.hilfeTafel.innerHTML = '<p class="hilfe-erklaerung">E = Einer, z = Zehntel, h = Hundertstel' +
        (kopf.length === 4 ? ', t = Tausendstel' : '') + '. Nach dem Komma wird jedes St&uuml;ck 10-mal kleiner.</p>' +
        tafelHtml(kopf, zellen, 1);
    }
  }

  // kommaNach: Index der Spalte, NACH der das Komma steht (-1 = kein Komma)
  function tafelHtml(kopf, zellen, kommaNach) {
    var kopfHtml = '', zeileHtml = '';
    for (var i = 0; i < kopf.length; i++) {
      kopfHtml += '<th>' + kopf[i] + '</th>';
      zeileHtml += '<td>' + zellen[i] + '</td>';
      if (i === kommaNach - 1) {
        kopfHtml += '<th class="swt-komma"></th>';
        zeileHtml += '<td class="swt-komma">,</td>';
      }
    }
    return '<table class="swt-tafel"><tr>' + kopfHtml + '</tr><tr>' + zeileHtml + '</tr></table>';
  }

  // Bruchstreifen: Nenner/Zaehler aus der KaTeX-Anzeige lesen (z. B. "1\tfrac{1}{2}")
  function baueBruchstreifen(aufgabe) {
    var m = aufgabe.anzeige.match(/^(\d*)\\tfrac\{(\d+)\}\{(\d+)\}$/);
    var ganze = m && m[1] ? parseInt(m[1], 10) : 0;
    var z = m ? parseInt(m[2], 10) : 1;
    var n = m ? parseInt(m[3], 10) : 2;
    var streifen = ganze + Math.max(1, Math.ceil(z / n)); // volle Ganze + Bruchteil-Streifen
    var teileGefuellt = ganze * n + z;                    // gefuellte Teile insgesamt
    var bw = 300, bh = 34, gap = 10;
    var sv = svgEl('svg', {
      'class': 'bruchstreifen-svg',
      viewBox: '0 0 ' + bw + ' ' + (streifen * (bh + gap)),
      width: bw, height: streifen * (bh + gap)
    });
    var idx = 0;
    for (var s = 0; s < streifen; s++) {
      for (var t = 0; t < n; t++, idx++) {
        sv.appendChild(svgEl('rect', {
          'class': 'bruch-teil' + (idx < teileGefuellt ? ' gefuellt' : ''),
          x: t * (bw / n) + 1, y: s * (bh + gap) + 1,
          width: bw / n - 2, height: bh
        }));
      }
    }
    return sv;
  }

  function hilfeUmschalten() {
    var offen = el.hilfePanel.hidden;
    el.hilfePanel.hidden = !offen;
    el.btnHilfe.setAttribute('aria-expanded', String(offen));
    el.btnHilfe.innerHTML = offen ? 'Hilfe ausblenden' : 'Hilfe anzeigen';
    if (offen) {
      if (!hilfeDieseAufgabe) { // Nutzung zaehlt als "mit Hilfe" (1x pro Aufgabe)
        hilfeDieseAufgabe = true;
        hilfeGenutztStufe++;
      }
      if (el.tabBild.classList.contains('aktiv')) zeigeUnterteilung();
    }
  }

  function tabWaehlen(bild) {
    el.tabBild.classList.toggle('aktiv', bild);
    el.tabTafel.classList.toggle('aktiv', !bild);
    el.tabBild.setAttribute('aria-selected', String(bild));
    el.tabTafel.setAttribute('aria-selected', String(!bild));
    el.hilfeBild.hidden = !bild;
    el.hilfeTafel.hidden = bild;
    if (bild) zeigeUnterteilung();
  }

  // ===== Spielablauf =====

  function starteStufe(idx) {
    stufeIdx = idx;
    aufgabeIdx = 0;
    musterStufe = {};
    hilfeGenutztStufe = 0;
    zeigeAufgabe();
    zeigeScreen('spiel');
  }

  function zeigeAufgabe() {
    var aufgabe = aktuelleAufgabe();
    versuche = 0;
    gesperrt = false;
    hilfeDieseAufgabe = false;
    el.stufeInfo.textContent = 'Stufe ' + (stufeIdx + 1);
    el.aufgabeInfo.textContent = 'Aufgabe ' + (aufgabeIdx + 1) + ' von ' + STUFEN[stufeIdx].aufgaben.length;
    el.feedbackBereich.innerHTML = '';
    el.hilfePanel.hidden = true;
    el.btnHilfe.setAttribute('aria-expanded', 'false');
    el.btnHilfe.innerHTML = 'Hilfe anzeigen';
    el.btnPruefen.disabled = false;
    tabWaehlenOhneBild();
    el.aufgabeAnzeige.innerHTML = 'Stelle die Zahl \\(' + aufgabe.anzeige + '\\) ein!';
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(el.aufgabeAnzeige, {
        delimiters: [{ left: '\\(', right: '\\)', display: false }],
        throwOnError: false
      });
    }
    baueStrahl(aufgabe);
    baueTafel(aufgabe);
  }

  // Tabs zuruecksetzen, ohne die Unterteilung sofort einzublenden
  function tabWaehlenOhneBild() {
    el.tabBild.classList.add('aktiv');
    el.tabTafel.classList.remove('aktiv');
    el.tabBild.setAttribute('aria-selected', 'true');
    el.tabTafel.setAttribute('aria-selected', 'false');
    el.hilfeBild.hidden = false;
    el.hilfeTafel.hidden = true;
  }

  function pruefen() {
    if (gesperrt) return;
    var aufgabe = aktuelleAufgabe();
    var resultat = klassifiziere(aufgabe, markerWert);

    if (resultat.ergebnis === 'richtig') {
      gesperrt = true;
      el.btnPruefen.disabled = true;
      marker.classList.add('geloest');
      zeigeFeedback('richtig', 'Richtig!', 'Genau da wohnt die Zahl ' + formatDe(aufgabe.zahl) + '. Stark!', true);
      return;
    }

    versuche++;
    if (resultat.ergebnis === 'falle') {
      musterStufe[resultat.muster] = (musterStufe[resultat.muster] || 0) + 1;
      musterGesamt[resultat.muster] = (musterGesamt[resultat.muster] || 0) + 1;
      zeigeUnterteilung(); // ikonische Hilfe: Strahl unterteilt sich
      if (versuche >= 2) {
        zeigeLoesung(resultat.text);
      } else {
        zeigeFeedback('falsch', 'Halt, eine Falle!', resultat.text + ' Schau auf die neuen Striche und versuch es noch einmal.', false);
      }
    } else { // daneben
      var hinweis = resultat.richtung === 'links'
        ? 'Deine Markierung sitzt zu weit links. Die Zahl liegt weiter rechts.'
        : 'Deine Markierung sitzt zu weit rechts. Die Zahl liegt weiter links.';
      if (versuche >= 2) {
        zeigeLoesung(hinweis);
      } else {
        zeigeFeedback('falsch', 'Noch nicht ganz.', hinweis + ' Du hast noch einen Versuch!', false);
      }
    }
  }

  function zeigeFeedback(art, titel, text, mitWeiter) {
    var html = '<div class="feedback feedback-' + art + '">' +
      '<div class="feedback-icon">' + titel + '</div>' +
      '<div class="zs-loesungstext">' + text + '</div>' +
      (mitWeiter ? '<button class="btn-weiter" id="btnWeiter" type="button">Weiter</button>' : '') +
      '</div>';
    el.feedbackBereich.innerHTML = html;
    var b = document.getElementById('btnWeiter');
    if (b) b.addEventListener('click', naechsteAufgabe);
  }

  // Loesung zeigen: Marker gleitet animiert zur korrekten Position
  function zeigeLoesung(erklaerung) {
    var aufgabe = aktuelleAufgabe();
    gesperrt = true;
    el.btnPruefen.disabled = true;
    zeigeUnterteilung();

    var start = markerWert, ziel = aufgabe.zahl, t0 = null, dauer = 700;
    function schritt(ts) {
      if (t0 === null) t0 = ts;
      var f = Math.min(1, (ts - t0) / dauer);
      var eased = 1 - (1 - f) * (1 - f); // sanftes Abbremsen
      setzeMarkerAnimiert(start + (ziel - start) * eased);
      if (f < 1) {
        animId = requestAnimationFrame(schritt);
      } else {
        marker.classList.add('geloest');
        zeigeFeedback('falsch', 'Hier wohnt die Zahl:',
          erklaerung + '<br>Die richtige Stelle ist ' + formatDe(aufgabe.zahl) + ' &ndash; der Marker zeigt sie dir jetzt.', true);
      }
    }
    animId = requestAnimationFrame(schritt);
  }

  // Marker-Position waehrend der Animation setzen (ohne Klemm-Logik-Umweg)
  function setzeMarkerAnimiert(wert) {
    var strahl = aktuelleAufgabe().strahl;
    markerWert = wert;
    marker.setAttribute('transform', 'translate(' + xVonWert(strahl, wert) + ',0)');
    var gerundet = Math.round(wert * 1000) / 1000;
    marker.setAttribute('aria-valuenow', gerundet);
    marker.setAttribute('aria-valuetext', formatDe(gerundet));
  }

  function naechsteAufgabe() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
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

  function empfehlungenHtml(zaehler) {
    var links = [], gesehen = {};
    for (var m in zaehler) {
      if (!zaehler[m] || !EMPFEHLUNGEN[m]) continue;
      EMPFEHLUNGEN[m].forEach(function (href) {
        if (gesehen[href]) return;
        gesehen[href] = true;
        links.push('<a href="' + href + '">' + (TRAINER_NAMEN[href] || href) + '</a>');
      });
    }
    if (links.length === 0) return '';
    return '<div class="empfehlung-block"><h3>Diese Trainer helfen dir weiter:</h3>' + links.join('') + '</div>';
  }

  function zeigeAuswertung() {
    var stufe = STUFEN[stufeIdx];
    var letzteStufe = stufeIdx >= STUFEN.length - 1;
    el.auswertungTitel.innerHTML = 'Stufe ' + (stufeIdx + 1) + ' geschafft!';

    var liste = musterListeHtml(musterStufe);
    var hilfeSatz = hilfeGenutztStufe > 0
      ? '<p class="hilfe-erklaerung">' + hilfeGenutztStufe + ' von ' + stufe.aufgaben.length +
        ' Aufgaben hast du mit Hilfe gel&ouml;st &ndash; Hilfe holen ist schlau!</p>'
      : '';
    var html;
    if (liste === '') {
      html = '<div class="auswertung-positiv">Klasse! Du bist in keine einzige Falle getappt.' +
        (letzteStufe ? ' Du hast alle Stufen gemeistert!' : ' Trau dich an die n&auml;chste Stufe!') + '</div>' + hilfeSatz;
    } else {
      html = '<p class="hilfe-erklaerung">Hier hat dich der Zahlenstrahl ausgetrickst:</p>' + liste +
        hilfeSatz + empfehlungenHtml(musterStufe);
    }
    el.auswertungInhalt.innerHTML = html;

    // Gesamt-Block, sobald mehr als eine Stufe gespielt wurde
    if (gespielteStufen > 1) {
      var gesamtListe = musterListeHtml(musterGesamt);
      el.auswertungGesamt.innerHTML = '<h3>Alle Stufen zusammen:</h3>' +
        (gesamtListe === ''
          ? '<div class="auswertung-positiv">Bisher keine einzige Falle &ndash; du liest den Zahlenstrahl wie ein Profi!</div>'
          : gesamtListe + empfehlungenHtml(musterGesamt));
    } else {
      el.auswertungGesamt.innerHTML = '';
    }

    el.btnNaechsteStufe.hidden = letzteStufe;
    el.btnNaechsteStufe.innerHTML = 'Weiter zu Stufe ' + (stufeIdx + 2);
    zeigeScreen('auswertung');
  }

  // ===== Verdrahtung =====

  document.querySelectorAll('.stufe-karte').forEach(function (karte) {
    karte.addEventListener('click', function () {
      starteStufe(parseInt(karte.getAttribute('data-stufe'), 10));
    });
  });
  el.btnPruefen.addEventListener('click', pruefen);
  el.btnHilfe.addEventListener('click', hilfeUmschalten);
  el.tabBild.addEventListener('click', function () { tabWaehlen(true); });
  el.tabTafel.addEventListener('click', function () { tabWaehlen(false); });
  el.btnNaechsteStufe.addEventListener('click', function () { starteStufe(stufeIdx + 1); });
  el.btnStufenwahl.addEventListener('click', function () { zeigeScreen('start'); });

})();

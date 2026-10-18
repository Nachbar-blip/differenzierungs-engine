/**
 * p3-reflexion.js — Pattern-3-Fehlertyp-Reflexion (DiffEngine, Ref4OHG)
 *
 * Gleiche Datei in beiden Repos; Aenderungen in beiden nachziehen.
 *
 * Aktiv nur wenn THEMA_CONFIG.p3Enabled === true.
 * Hakt sich per window.P3 in spirale-engine.js ein (die Engine prueft, ob P3 da ist).
 *
 * Gesammelt wird jede Aufgabe, die auf Level 6 gestellt war - auch die, mit der man
 * wieder auf Level 5 faellt; nicht die Level-5-Aufgabe, mit der man aufsteigt.
 * Ab dem ersten Erreichen von Level 6 steht im Feedback der Knopf zum Rueckblick.
 *
 * LocalStorage-Keys (<NS> = data-sammlung am <script>-Tag, z. B. "ref4ohg-"; leer in DiffEngine):
 *   p3-<NS>history-<THEMA_KEY>        — Level-6-Aufgaben dieser Runde
 *   p3-<NS>reflexion-<THEMA_KEY>      — Einordnungen (id@ts der Aufgabe -> Typ)
 *   p3-<NS>level6-reached-<THEMA_KEY> — Flag fuer dauerhafte Knopf-Sichtbarkeit
 *
 * Warum der Namensraum: Alle Sammlungen liegen unter nachbar-blip.github.io und teilen sich
 * damit einen localStorage. Ohne ihn zeigte der Rueckblick von Ref4OHG bei gleichem THEMA_KEY
 * die Aufgaben-IDs aus der DiffEngine - mit fremden Aufgabentexten.
 */

(function () {
  'use strict';

  if (typeof THEMA_KEY === 'undefined' || typeof THEMA_CONFIG === 'undefined') {
    console.warn('P3: THEMA_KEY/THEMA_CONFIG nicht gefunden, Modul inaktiv');
    return;
  }

  if (!THEMA_CONFIG.p3Enabled) {
    return;
  }

  const skript = document.currentScript;
  const NS = skript && skript.dataset.sammlung ? skript.dataset.sammlung + '-' : '';

  const STORAGE_LEVEL6_FLAG = 'p3-' + NS + 'level6-reached-' + THEMA_KEY;

  function readLevel6Reached() {
    try {
      return localStorage.getItem(STORAGE_LEVEL6_FLAG) === 'true';
    } catch (e) {
      return false;
    }
  }

  function writeLevel6Reached(val) {
    try {
      localStorage.setItem(STORAGE_LEVEL6_FLAG, val ? 'true' : 'false');
    } catch (e) {
      console.warn('P3: localStorage nicht verfügbar');
    }
  }

  const STORAGE_HISTORY = 'p3-' + NS + 'history-' + THEMA_KEY;
  const P3_HISTORY_MAX = 50;

  function readHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY);
      const history = raw ? JSON.parse(raw) : [];
      // Ein kaputter Stand ('{}', 'null', fremde Eintraege) darf den Trainer nicht sperren
      return Array.isArray(history)
        ? history.filter(function (e) { return e && typeof e.id === 'number'; })
        : [];
    } catch (e) {
      return [];
    }
  }

  function writeHistory(history) {
    try {
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
    } catch (e) {
      console.warn('P3: localStorage schreiben fehlgeschlagen');
    }
  }

  function pushHistory(entry) {
    const history = readHistory();
    history.push(entry);
    while (history.length > P3_HISTORY_MAX) {
      history.shift();
    }
    writeHistory(history);
  }

  const STORAGE_REFLEXION = 'p3-' + NS + 'reflexion-' + THEMA_KEY;

  function readReflexion() {
    try {
      const raw = localStorage.getItem(STORAGE_REFLEXION);
      const ref = raw ? JSON.parse(raw) : {};
      return ref && typeof ref === 'object' && !Array.isArray(ref) ? ref : {};
    } catch (e) {
      return {};
    }
  }

  function writeReflexion(obj) {
    try {
      localStorage.setItem(STORAGE_REFLEXION, JSON.stringify(obj));
    } catch (e) {
      console.warn('P3: reflexion speichern fehlgeschlagen');
    }
  }

  // Schluessel einer Kachel: bleibt gleich, wenn vorn alte Eintraege herausfallen
  // (der Index in der Historie verschob sich dabei, die Einordnung rutschte auf die Nachbaraufgabe)
  function kachelKey(entry) {
    return entry.id + '@' + entry.ts;
  }

  function zaehleTypen() {
    const ref = readReflexion();
    const zaehler = { richtig: 0, rechenfehler: 0, idee: 0 };
    readHistory().forEach(function (entry) {
      const typ = ref[kachelKey(entry)];
      if (typ && zaehler.hasOwnProperty(typ)) zaehler[typ]++;
    });
    return zaehler;
  }

  // Der Rueckblick zeigt nur Level-6-Aufgaben: "eine Stufe hoeher" gibt es hier nicht.
  function berechneEmpfehlung(zaehler) {
    const total = zaehler.richtig + zaehler.rechenfehler + zaehler.idee;
    if (total < 3) return '';
    if (zaehler.idee >= 2) {
      return 'Mehrere Verständnislücken — üb eine Stufe tiefer und lies dort die Lösungswege genau.';
    }
    if (zaehler.rechenfehler >= 3) {
      return 'Rechenfehler häufen sich — Tempo raus, jeden Schritt aufschreiben.';
    }
    if (zaehler.richtig / total > 0.7) {
      return 'Läuft. Level 6 sitzt — nimm dir das nächste Thema vor.';
    }
    return '';
  }

  function updateSammelbalken() {
    const zaehler = zaehleTypen();
    Object.keys(zaehler).forEach(function (typ) {
      const el = document.getElementById('p3-z-' + typ);
      if (el) el.textContent = String(zaehler[typ]);
    });
    const emp = document.getElementById('p3Empfehlung');
    if (emp) emp.textContent = berechneEmpfehlung(zaehler);
  }

  // data: { aufgabeId, correct, level (Stufe der Aufgabe), levelVor, levelNach }
  function onAnswered(data) {
    if (!data || typeof data.aufgabeId !== 'number') return;

    const stufe = typeof data.level === 'number' ? data.level : data.levelVor;

    // auch stufe === 6: Wer schon vor P3 auf Level 6 stand und gleich absteigt
    if ((data.levelNach === 6 || stufe === 6) && !readLevel6Reached()) {
      writeLevel6Reached(true);
    }

    if (stufe !== 6) return;

    pushHistory({
      id: data.aufgabeId,
      correct: !!data.correct,
      ts: Date.now()
    });
  }

  function renderSessionEndButton(container) {
    if (!container) return;
    if (!readLevel6Reached()) return;
    if (container.querySelector('#btnSessionEnden')) return;  // nicht doppelt

    const btn = document.createElement('button');
    btn.id = 'btnSessionEnden';
    btn.className = 'btn btn-session-ende';
    btn.textContent = 'Runde beenden & Rückblick';
    btn.addEventListener('click', openRueckblick);
    container.appendChild(btn);
  }

  function findAufgabe(id) {
    if (typeof AUFGABEN === 'undefined') return null;
    return AUFGABEN.find(function (a) { return a.id === id; });
  }

  // Formeln wie in der Aufgabe setzen: die Engine-Funktion haelt Inline-Formeln und
  // Satzzeichen zusammen; ohne sie (aeltere Engine) nur KaTeX.
  function setzeFormeln(container) {
    if (typeof window.spiraleRenderMath === 'function') {
      window.spiraleRenderMath(container);
    } else if (typeof renderMathInElement === 'function') {
      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    }
  }

  function kachelHtml(entry, idx) {
    const auf = findAufgabe(entry.id);
    // Frage und Loesungsweg sind Trainer-HTML (wie in der Aufgabenkarte), nicht gekuerzt:
    // Wer einordnen soll, muss die ganze Aufgabe vor sich haben.
    const frage = auf ? auf.frage : '(Aufgabe nicht gefunden)';
    const weg = auf && auf.loesungsweg
      ? `<details class="p3-loesungsweg"><summary>Lösungsweg ansehen</summary>` +
        `<div class="p3-loesungsweg-text">${auf.loesungsweg}</div></details>`
      : '';
    const badge = entry.correct
      ? '<span class="p3-badge ok">&check; richtig</span>'
      : '<span class="p3-badge fehler">&cross; falsch</span>';
    const knopf = function (typ, text) {
      return `<button type="button" class="p3-ft-btn" data-typ="${typ}" aria-pressed="false">${text}</button>`;
    };
    return `
      <div class="p3-kachel" data-idx="${idx}" data-key="${kachelKey(entry)}">
        <div class="p3-kachel-kopf">Aufgabe #${entry.id} ${badge}</div>
        <div class="p3-kachel-frage">${frage}</div>
        ${weg}
        <div class="p3-kachel-buttons" role="group" aria-label="Wie lief diese Aufgabe?">
          ${knopf('richtig', 'Konnte ich')}
          ${knopf('rechenfehler', 'Rechenfehler')}
          ${knopf('idee', 'Keine Idee')}
        </div>
      </div>
    `;
  }

  const AUFGABEN_UI = '.aufgabe-karte, #feedback, #tippBox, #btnTipp, .keyboard-hint';

  function openRueckblick() {
    const app = document.getElementById('app');
    if (!app) return;

    const aufgabenKarte = app.querySelector('.aufgabe-karte');

    // Alten Rückblick entfernen
    const alt = document.getElementById('p3Rueckblick');
    if (alt) alt.remove();

    const history = readHistory();
    const container = document.createElement('section');
    container.id = 'p3Rueckblick';
    container.className = 'p3-rueckblick';

    if (history.length === 0) {
      container.innerHTML = `
        <h2>Rückblick</h2>
        <p class="p3-leer-hinweis">Noch keine Aufgaben auf Level 6 in dieser Runde.</p>
        <button type="button" id="btnZurueckZumTraining" class="btn btn-weiter">Zurück zum Training</button>
      `;
    } else {
      container.innerHTML = `
        <h2>Rückblick auf deine <span class="p3-nobr">Level-6-Aufgaben</span></h2>
        <p class="p3-anleitung">Wie lief jede Aufgabe? Ordne sie ein — unten siehst du dein Muster.</p>
        <div class="p3-kacheln">${history.map(kachelHtml).join('\n')}</div>
        <aside class="p3-sammler" id="p3Sammler">
          <h3>Dein Muster in dieser Runde</h3>
          <div class="p3-balken" id="p3Balken">
            <div class="p3-segment" data-typ="richtig"><span class="p3-label">Konnte ich</span><span class="p3-zahl" id="p3-z-richtig">0</span></div>
            <div class="p3-segment" data-typ="rechenfehler"><span class="p3-label">Rechenfehler</span><span class="p3-zahl" id="p3-z-rechenfehler">0</span></div>
            <div class="p3-segment" data-typ="idee"><span class="p3-label">Keine Idee</span><span class="p3-zahl" id="p3-z-idee">0</span></div>
          </div>
          <p class="p3-empfehlung" id="p3Empfehlung" aria-live="polite"></p>
        </aside>
        <button type="button" id="btnZurueckZumTraining" class="btn btn-weiter">Zurück zum Training</button>
      `;
    }

    // Aufgaben-UI erst ausblenden, wenn der Rueckblick steht. Tipp und Tastenhinweis gehoeren
    // zur versteckten Aufgabe (die Tasten sind waehrenddessen gesperrt). naechsteAufgabe baut
    // beim Zurueckgehen alles neu auf.
    app.querySelectorAll(AUFGABEN_UI).forEach(function (el) { el.style.display = 'none'; });

    // an die Stelle der Aufgabenkarte, nicht ans Ende hinter "Fortschritt zuruecksetzen"
    if (aufgabenKarte) {
      app.insertBefore(container, aufgabenKarte);
    } else {
      app.appendChild(container);
    }
    setzeFormeln(container);
    markiereGespeicherte(container);
    updateSammelbalken();

    bindFehlertypButtons(container);
    bindZurueckButton(container);

    container.scrollIntoView({ block: 'start' });
    const erste = container.querySelector('h2');
    if (erste) {
      erste.tabIndex = -1;
      erste.focus({ preventScroll: true });
    }
  }

  function markiere(kachel, typ) {
    kachel.querySelectorAll('.p3-ft-btn').forEach(function (b) {
      const an = b.dataset.typ === typ;
      b.classList.toggle('p3-ft-gewaehlt', an);
      b.setAttribute('aria-pressed', an ? 'true' : 'false');
    });
  }

  // Nach einem Reload im Rueckblick stehen die Einordnungen noch im Speicher.
  function markiereGespeicherte(container) {
    const ref = readReflexion();
    container.querySelectorAll('.p3-kachel').forEach(function (kachel) {
      const typ = ref[kachel.dataset.key];
      if (typ) markiere(kachel, typ);
    });
  }

  function bindFehlertypButtons(container) {
    container.querySelectorAll('.p3-ft-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const kachel = btn.closest('.p3-kachel');
        if (!kachel) return;

        const ref = readReflexion();
        ref[kachel.dataset.key] = btn.dataset.typ;
        writeReflexion(ref);

        markiere(kachel, btn.dataset.typ);
        updateSammelbalken();
      });
    });
  }

  function bindZurueckButton(container) {
    const btn = container.querySelector('#btnZurueckZumTraining');
    if (!btn) return;
    btn.addEventListener('click', function () {
      try {
        localStorage.removeItem(STORAGE_HISTORY);
        localStorage.removeItem(STORAGE_REFLEXION);
        // STORAGE_LEVEL6_FLAG bleibt!
      } catch (e) { /* no-op */ }

      const rueckblick = document.getElementById('p3Rueckblick');
      if (rueckblick) rueckblick.remove();

      // Aufgaben-UI wieder zeigen
      const app = document.getElementById('app');
      if (!app) return;
      app.querySelectorAll(AUFGABEN_UI).forEach(function (el) { el.style.display = ''; });

      // Nächste Aufgabe direkt triggern — Engine-API
      if (typeof window.naechsteAufgabe === 'function') {
        window.naechsteAufgabe();
      }
    });
  }

  // "Fortschritt zuruecksetzen" der Engine: auch Runde, Einordnungen und Level-6-Flag
  function reset() {
    try {
      localStorage.removeItem(STORAGE_HISTORY);
      localStorage.removeItem(STORAGE_REFLEXION);
      localStorage.removeItem(STORAGE_LEVEL6_FLAG);
    } catch (e) { /* no-op */ }
    const rueckblick = document.getElementById('p3Rueckblick');
    if (rueckblick) rueckblick.remove();
  }

  window.P3 = {
    onAnswered: onAnswered,
    renderSessionEndButton: renderSessionEndButton,
    reset: reset
  };
})();

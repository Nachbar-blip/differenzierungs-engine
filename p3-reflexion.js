/**
 * p3-reflexion.js — Pattern-3-Fehlertyp-Reflexion für DiffEngine
 *
 * Aktiv nur wenn THEMA_CONFIG.p3Enabled === true.
 * Hakt sich per window.P3 in spirale-engine.js ein (optional chaining).
 *
 * LocalStorage-Keys:
 *   p3-history-<THEMA_KEY>       — Level-6-Aufgaben-Historie dieser Session
 *   p3-reflexion-<THEMA_KEY>     — Klassifikations-Klicks
 *   p3-level6-reached-<THEMA_KEY> — Flag für permanente Button-Sichtbarkeit
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

  const STORAGE_LEVEL6_FLAG = 'p3-level6-reached-' + THEMA_KEY;

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

  const STORAGE_HISTORY = 'p3-history-' + THEMA_KEY;
  const P3_HISTORY_MAX = 50;

  function readHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY);
      return raw ? JSON.parse(raw) : [];
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

  const STORAGE_REFLEXION = 'p3-reflexion-' + THEMA_KEY;

  function readReflexion() {
    try {
      const raw = localStorage.getItem(STORAGE_REFLEXION);
      return raw ? JSON.parse(raw) : {};
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

  function zaehleTypen() {
    const ref = readReflexion();
    const zaehler = { richtig: 0, rechenfehler: 0, idee: 0 };
    Object.values(ref).forEach(function (typ) {
      if (typ && zaehler.hasOwnProperty(typ)) zaehler[typ]++;
    });
    return zaehler;
  }

  function berechneEmpfehlung(zaehler) {
    const total = zaehler.richtig + zaehler.rechenfehler + zaehler.idee;
    if (total < 3) return '';
    if (zaehler.idee >= 2) {
      return 'Mehrere Verständnislücken — geh nochmal zu den Grundlagen / zur Definition.';
    }
    if (zaehler.rechenfehler >= 3) {
      return 'Rechenfehler häufen sich — Tempo raus, jeden Schritt aufschreiben.';
    }
    if (zaehler.richtig / total > 0.7) {
      return 'Läuft. Beim nächsten Mal eine Stufe höher arbeiten.';
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

  function onAnswered(data) {
    if (!data || typeof data.aufgabeId !== 'number') return;
    if (data.levelNach !== 6) return;

    if (data.levelVor < 6) {
      writeLevel6Reached(true);
    }

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
    btn.textContent = 'Session beenden & Rückblick';
    btn.addEventListener('click', openRueckblick);
    container.appendChild(btn);
  }

  function findAufgabe(id) {
    if (typeof AUFGABEN === 'undefined') return null;
    return AUFGABEN.find(function (a) { return a.id === id; });
  }

  function kuerzeFrage(text, maxLen) {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 1) + '…';
  }

  function openRueckblick() {
    const app = document.getElementById('app');
    if (!app) return;

    // Aufgaben-UI ausblenden
    const aufgabenKarte = app.querySelector('.aufgabe-karte');
    const feedback = app.querySelector('#feedback');
    if (aufgabenKarte) aufgabenKarte.style.display = 'none';
    if (feedback) feedback.style.display = 'none';

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
        <p class="p3-leer-hinweis">Noch keine Aufgaben auf Level 6 in dieser Session.</p>
        <button id="btnZurueckZumTraining" class="btn">Zurück zum Training</button>
      `;
    } else {
      const kacheln = history.map(function (entry, idx) {
        const auf = findAufgabe(entry.id);
        const frage = auf ? kuerzeFrage(auf.frage, 120) : '(Aufgabe nicht gefunden)';
        const badge = entry.correct
          ? '<span class="p3-badge ok">&check; richtig</span>'
          : '<span class="p3-badge fehler">&cross; falsch</span>';
        return `
          <div class="p3-kachel" data-idx="${idx}">
            <div class="p3-kachel-kopf">Aufgabe #${entry.id} ${badge}</div>
            <div class="p3-kachel-frage">${frage}</div>
            <div class="p3-kachel-buttons">
              <button class="p3-ft-btn" data-typ="richtig">Konnte ich</button>
              <button class="p3-ft-btn" data-typ="rechenfehler">Rechenfehler</button>
              <button class="p3-ft-btn" data-typ="idee">Keine Idee</button>
            </div>
          </div>
        `;
      }).join('\n');

      container.innerHTML = `
        <h2>Rückblick auf deine Level-6-Aufgaben</h2>
        <div class="p3-kacheln">${kacheln}</div>
        <aside class="p3-sammler" id="p3Sammler">
          <h3>Dein Muster in dieser Session</h3>
          <div class="p3-balken" id="p3Balken">
            <div class="p3-segment" data-typ="richtig"><span class="p3-label">Konnte ich</span><span class="p3-zahl" id="p3-z-richtig">0</span></div>
            <div class="p3-segment" data-typ="rechenfehler"><span class="p3-label">Rechenfehler</span><span class="p3-zahl" id="p3-z-rechenfehler">0</span></div>
            <div class="p3-segment" data-typ="idee"><span class="p3-label">Keine Idee</span><span class="p3-zahl" id="p3-z-idee">0</span></div>
          </div>
          <p class="p3-empfehlung" id="p3Empfehlung"></p>
        </aside>
        <button id="btnZurueckZumTraining" class="btn">Zurück zum Training</button>
      `;
    }

    app.appendChild(container);

    // KaTeX-Rendering in Rückblick (wenn vorhanden)
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    }

    // Klick-Listener (Task 17 + 19)
    bindFehlertypButtons(container);
    bindZurueckButton(container);
  }

  function bindFehlertypButtons(container) {
    const buttons = container.querySelectorAll('.p3-ft-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const kachel = btn.closest('.p3-kachel');
        if (!kachel) return;

        const idx = kachel.dataset.idx;
        const typ = btn.dataset.typ;

        const ref = readReflexion();
        ref[idx] = typ;
        writeReflexion(ref);

        kachel.querySelectorAll('.p3-ft-btn').forEach(function (b) {
          b.classList.remove('p3-ft-gewaehlt');
        });
        btn.classList.add('p3-ft-gewaehlt');

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
      const aufgabenKarte = app.querySelector('.aufgabe-karte');
      const feedback = app.querySelector('#feedback');
      if (aufgabenKarte) aufgabenKarte.style.display = '';
      if (feedback) feedback.style.display = '';

      // Nächste Aufgabe direkt triggern — Engine-API
      if (typeof window.naechsteAufgabe === 'function') {
        window.naechsteAufgabe();
      }
    });
  }

  window.P3 = {
    onAnswered: onAnswered,
    renderSessionEndButton: renderSessionEndButton
  };
})();

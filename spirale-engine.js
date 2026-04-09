/**
 * spirale-engine.js — Adaptive Spiral-Algorithmus Engine
 *
 * Voraussetzungen (vom HTML gesetzt):
 *   THEMA_KEY, THEMA_CONFIG, AUFGABEN
 *
 * Externe Abhängigkeit: KaTeX + auto-render (vom HTML geladen)
 */

(function () {
  'use strict';

  // ── Konstanten ──────────────────────────────────────────────

  const LEVEL_NAMEN = {
    1: 'babyleicht',
    2: 'leicht',
    3: 'nervenschonend',
    4: 'mittel',
    5: 'anspruchsvoll',
    6: 'wagnerisch'
  };

  const STORAGE_KEY = 'spirale-' + THEMA_KEY;

  const DEFAULT_STATE = {
    level: 3,
    streak: 0,
    wrongStreak: 0,
    answered: [],
    totalCorrect: 0,
    totalAttempts: 0
  };

  // ── State ───────────────────────────────────────────────────

  let state = null;
  let currentAufgabe = null;
  let feedbackShown = false;

  // ── LocalStorage ────────────────────────────────────────────

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = JSON.parse(raw);
        // Sicherstellen, dass alle Felder vorhanden sind
        for (const key of Object.keys(DEFAULT_STATE)) {
          if (state[key] === undefined) {
            state[key] = DEFAULT_STATE[key];
          }
        }
      } else {
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      }
    } catch (e) {
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Spirale: localStorage nicht verfügbar', e);
    }
  }

  // ── Aufgaben-Auswahl ───────────────────────────────────────

  function getNextAufgabe() {
    const levelTasks = AUFGABEN.filter(a => a.level === state.level);

    if (levelTasks.length === 0) {
      return null;
    }

    // Verfügbare (noch nicht beantwortete) Aufgaben
    let available = levelTasks.filter(a => !state.answered.includes(a.id));

    // Alle beantwortet → answered für dieses Level zurücksetzen
    if (available.length === 0) {
      const levelIds = levelTasks.map(a => a.id);
      state.answered = state.answered.filter(id => !levelIds.includes(id));
      saveState();
      available = levelTasks;
    }

    // Zufällige Auswahl
    const idx = Math.floor(Math.random() * available.length);
    return available[idx];
  }

  // ── Antwort-Validierung ─────────────────────────────────────

  function validiereAntwort(aufgabe, eingabe) {
    if (aufgabe.typ === 'numerisch') {
      // Komma als Dezimaltrennzeichen akzeptieren
      const cleaned = String(eingabe).replace(',', '.').trim();
      const userVal = parseFloat(cleaned);
      if (isNaN(userVal)) return false;
      const toleranz = aufgabe.toleranz || 0;
      return Math.abs(userVal - aufgabe.loesung) <= toleranz;
    }

    if (aufgabe.typ === 'mc') {
      return eingabe === aufgabe.korrekt;
    }

    return false;
  }

  // ── Spiral-Logik ────────────────────────────────────────────

  function applySpiral(correct) {
    const prevLevel = state.level;

    if (correct) {
      state.streak++;
      state.wrongStreak = 0;

      if (state.streak >= 2) {
        state.level = Math.min(6, state.level + 1);
        state.streak = 0;
        state.wrongStreak = 0;
      }
    } else {
      state.wrongStreak++;
      state.streak = 0;

      if (state.wrongStreak >= 2) {
        state.level = Math.max(1, state.level - 1);
        state.streak = 0;
        state.wrongStreak = 0;
      }
    }

    saveState();

    return {
      levelChanged: state.level !== prevLevel,
      levelUp: state.level > prevLevel,
      newLevel: state.level,
      prevLevel: prevLevel
    };
  }

  // ── KaTeX Rendering ─────────────────────────────────────────

  function renderMath(container) {
    if (typeof renderMathInElement === 'function' && container) {
      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    }
  }

  // ── UI-Bausteine ────────────────────────────────────────────

  function buildHeader() {
    return `<header>
      <h1>${escapeHtml(THEMA_CONFIG.name)}</h1>
      <a href="index.html" class="back-link">&larr; Zur Übersicht</a>
    </header>`;
  }

  function buildLevelAnzeige() {
    let segments = '';
    for (let i = 1; i <= 6; i++) {
      const active = i === state.level ? ' active' : '';
      const filled = i <= state.level ? ' filled' : '';
      segments += `<div class="level-segment${active}${filled}" data-level="${i}">${i}</div>`;
    }
    return `<div class="level-anzeige">
      ${segments}
      <span class="level-label">Level ${state.level} · ${LEVEL_NAMEN[state.level]}</span>
    </div>`;
  }

  function buildStats() {
    const falsch = state.totalAttempts - state.totalCorrect;
    return `<div class="stats-leiste">
      <span class="stat-richtig">&check; ${state.totalCorrect}</span>
      <span class="stat-falsch">&cross; ${falsch}</span>
      <span class="stat-fortschritt">Aufgabe ${state.totalAttempts + 1}</span>
    </div>`;
  }

  function buildAufgabeKarte(aufgabe) {
    let eingabe = '';

    if (aufgabe.typ === 'numerisch') {
      eingabe = `<div class="eingabe-bereich">
        <input type="text" id="antwortInput" placeholder="Deine Antwort..." autofocus autocomplete="off">
        <button class="btn btn-pruefen" id="btnPruefen">Prüfen</button>
      </div>`;
    } else if (aufgabe.typ === 'mc') {
      const labels = ['A', 'B', 'C', 'D'];
      const optionen = (aufgabe.optionen || []).map((opt, i) =>
        `<button class="mc-option" data-index="${i}">${labels[i]}) ${opt}</button>`
      ).join('\n');
      eingabe = `<div class="mc-bereich">${optionen}</div>`;
    }

    return `<div class="aufgabe-karte">
      <div class="aufgabe-text">${aufgabe.frage}</div>
      ${eingabe}
    </div>`;
  }

  function buildFeedback() {
    return '<div class="feedback" id="feedback" style="display:none"></div>';
  }

  function buildTipp() {
    return `<div class="tipp-box" id="tippBox" style="display:none"></div>
    <button class="btn-tipp" id="btnTipp">Tipp anzeigen</button>`;
  }

  function buildFooter() {
    return `<div class="keyboard-hint">
      <kbd>Enter</kbd> Prüfen · <kbd>&rarr;</kbd> Weiter · <kbd>T</kbd> Tipp · <kbd>1</kbd>–<kbd>4</kbd> MC-Antwort
    </div>
    <button class="btn-reset" id="btnReset">Fortschritt zurücksetzen</button>`;
  }

  // ── Hilfsfunktionen ─────────────────────────────────────────

  function escapeHtml(text) {
    const el = document.createElement('span');
    el.textContent = text;
    return el.innerHTML;
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  // ── Render-Funktionen ───────────────────────────────────────

  function renderLevelAnzeige() {
    const container = $('.level-anzeige');
    if (!container) return;

    for (let i = 1; i <= 6; i++) {
      const seg = container.querySelector(`[data-level="${i}"]`);
      if (!seg) continue;
      seg.classList.toggle('active', i === state.level);
      seg.classList.toggle('filled', i <= state.level);
    }

    const label = container.querySelector('.level-label');
    if (label) {
      label.textContent = `Level ${state.level} · ${LEVEL_NAMEN[state.level]}`;
    }
  }

  function renderStats() {
    const container = $('.stats-leiste');
    if (!container) return;
    const falsch = state.totalAttempts - state.totalCorrect;
    container.querySelector('.stat-richtig').innerHTML = `&check; ${state.totalCorrect}`;
    container.querySelector('.stat-falsch').innerHTML = `&cross; ${falsch}`;
    container.querySelector('.stat-fortschritt').textContent = `Aufgabe ${state.totalAttempts + 1}`;
  }

  function renderAufgabe(aufgabe) {
    currentAufgabe = aufgabe;
    feedbackShown = false;

    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = [
      buildHeader(),
      buildLevelAnzeige(),
      buildStats(),
      buildAufgabeKarte(aufgabe),
      buildFeedback(),
      buildTipp(),
      buildFooter()
    ].join('');

    // KaTeX rendern
    renderMath(app);

    // Event-Listener binden
    bindEvents();

    // Autofocus für numerische Eingabe
    const input = document.getElementById('antwortInput');
    if (input) {
      // Timeout damit DOM bereit ist
      setTimeout(() => input.focus(), 50);
    }
  }

  // ── Event-Binding ───────────────────────────────────────────

  function bindEvents() {
    // Prüfen-Button
    const btnPruefen = document.getElementById('btnPruefen');
    if (btnPruefen) {
      btnPruefen.addEventListener('click', checkAntwort);
    }

    // MC-Optionen
    document.querySelectorAll('.mc-option').forEach(btn => {
      btn.addEventListener('click', function () {
        const idx = parseInt(this.dataset.index, 10);
        selectMC(idx);
      });
    });

    // Tipp-Button
    const btnTipp = document.getElementById('btnTipp');
    if (btnTipp) {
      btnTipp.addEventListener('click', zeigeTipp);
    }

    // Reset-Button
    const btnReset = document.getElementById('btnReset');
    if (btnReset) {
      btnReset.addEventListener('click', resetFortschritt);
    }

    // Enter im Input
    const input = document.getElementById('antwortInput');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (feedbackShown) {
            naechsteAufgabe();
          } else {
            checkAntwort();
          }
        }
      });
    }
  }

  // ── Antwort prüfen ──────────────────────────────────────────

  function checkAntwort() {
    if (feedbackShown || !currentAufgabe) return;
    if (currentAufgabe.typ !== 'numerisch') return;

    const input = document.getElementById('antwortInput');
    if (!input) return;

    const eingabe = input.value.trim();
    if (eingabe === '') return;

    const correct = validiereAntwort(currentAufgabe, eingabe);
    verarbeiteAntwort(correct);
  }

  function selectMC(index) {
    if (feedbackShown || !currentAufgabe) return;
    if (currentAufgabe.typ !== 'mc') return;

    // Visuelles Feedback: gewählte Option hervorheben
    const buttons = document.querySelectorAll('.mc-option');
    buttons.forEach((btn, i) => {
      btn.classList.toggle('selected', i === index);
    });

    const correct = validiereAntwort(currentAufgabe, index);
    verarbeiteAntwort(correct, index);
  }

  function verarbeiteAntwort(correct, mcIndex) {
    feedbackShown = true;

    // State aktualisieren
    state.totalAttempts++;
    if (correct) state.totalCorrect++;
    state.answered.push(currentAufgabe.id);

    // Spiral-Logik anwenden
    const spiralResult = applySpiral(correct);

    // Input/MC deaktivieren
    disableEingabe(correct, mcIndex);

    // Feedback anzeigen
    showFeedback(correct, spiralResult);

    // Stats aktualisieren
    renderStats();
    saveState();
  }

  function disableEingabe(correct, mcIndex) {
    const input = document.getElementById('antwortInput');
    if (input) {
      input.disabled = true;
      input.classList.add(correct ? 'input-correct' : 'input-wrong');
    }

    const btnPruefen = document.getElementById('btnPruefen');
    if (btnPruefen) {
      btnPruefen.disabled = true;
    }

    // MC-Optionen deaktivieren und richtige/falsche markieren
    if (currentAufgabe.typ === 'mc') {
      document.querySelectorAll('.mc-option').forEach((btn, i) => {
        btn.disabled = true;
        if (i === currentAufgabe.korrekt) {
          btn.classList.add('mc-correct');
        } else if (i === mcIndex && !correct) {
          btn.classList.add('mc-wrong');
        }
      });
    }
  }

  function showFeedback(correct, spiralResult) {
    const fb = document.getElementById('feedback');
    if (!fb) return;

    let levelHinweis = '';
    if (spiralResult.levelChanged) {
      if (spiralResult.levelUp) {
        levelHinweis = `<div class="level-change level-up">Level up! &#127881; &rarr; Level ${spiralResult.newLevel} (${LEVEL_NAMEN[spiralResult.newLevel]})</div>`;
      } else {
        levelHinweis = `<div class="level-change level-down">Zurück zu Level ${spiralResult.newLevel} (${LEVEL_NAMEN[spiralResult.newLevel]})</div>`;
      }
    }

    const icon = correct
      ? '<div class="feedback-icon feedback-correct">&check; Richtig!</div>'
      : '<div class="feedback-icon feedback-wrong">&cross; Leider falsch.</div>';

    const loesung = currentAufgabe.loesungsweg
      ? `<div class="loesungsweg"><strong>Lösungsweg:</strong> ${currentAufgabe.loesungsweg}</div>`
      : '';

    fb.innerHTML = `
      ${icon}
      ${levelHinweis}
      ${loesung}
      <button class="btn btn-weiter" id="btnWeiter">Weiter &rarr;</button>
    `;
    fb.style.display = 'block';

    // KaTeX im Feedback rendern
    renderMath(fb);

    // Level-Anzeige aktualisieren (nach Spiral-Logik)
    if (spiralResult.levelChanged) {
      renderLevelAnzeige();
      animateLevelChange(spiralResult.levelUp);
    }

    // Weiter-Button binden
    const btnWeiter = document.getElementById('btnWeiter');
    if (btnWeiter) {
      btnWeiter.addEventListener('click', naechsteAufgabe);
      setTimeout(() => btnWeiter.focus(), 50);
    }

    // Tipp-Button ausblenden
    const btnTipp = document.getElementById('btnTipp');
    if (btnTipp) {
      btnTipp.style.display = 'none';
    }
  }

  function animateLevelChange(isUp) {
    const anzeige = $('.level-anzeige');
    if (!anzeige) return;

    const cls = isUp ? 'flash-up' : 'flash-down';
    anzeige.classList.add(cls);
    setTimeout(() => anzeige.classList.remove(cls), 800);
  }

  // ── Nächste Aufgabe ─────────────────────────────────────────

  function naechsteAufgabe() {
    if (!feedbackShown) return;

    const aufgabe = getNextAufgabe();

    if (!aufgabe) {
      zeigeAlleGeschafft();
      return;
    }

    renderAufgabe(aufgabe);
  }

  function zeigeAlleGeschafft() {
    const app = document.getElementById('app');
    if (!app) return;

    const quote = state.totalAttempts > 0
      ? Math.round((state.totalCorrect / state.totalAttempts) * 100)
      : 0;

    app.innerHTML = `
      ${buildHeader()}
      <div class="alle-geschafft">
        <div class="geschafft-icon">&#127942;</div>
        <h2>Alle Aufgaben geschafft!</h2>
        <p>Du hast ${state.totalCorrect} von ${state.totalAttempts} Aufgaben richtig beantwortet (${quote}%).</p>
        <p>Aktuelles Level: ${state.level} (${LEVEL_NAMEN[state.level]})</p>
        <button class="btn btn-weiter" id="btnNeustart">Nochmal starten</button>
        <a href="index.html" class="btn btn-zurueck">Zur Übersicht</a>
      </div>
      <button class="btn-reset" id="btnReset">Fortschritt zurücksetzen</button>
    `;

    const btnNeustart = document.getElementById('btnNeustart');
    if (btnNeustart) {
      btnNeustart.addEventListener('click', function () {
        // Answered zurücksetzen, Level beibehalten
        state.answered = [];
        saveState();
        const aufgabe = getNextAufgabe();
        if (aufgabe) renderAufgabe(aufgabe);
      });
    }

    const btnReset = document.getElementById('btnReset');
    if (btnReset) {
      btnReset.addEventListener('click', resetFortschritt);
    }
  }

  // ── Tipp ────────────────────────────────────────────────────

  function zeigeTipp() {
    if (!currentAufgabe || !currentAufgabe.tipp) return;

    const tippBox = document.getElementById('tippBox');
    if (!tippBox) return;

    tippBox.innerHTML = `<strong>Tipp:</strong> ${currentAufgabe.tipp}`;
    tippBox.style.display = 'block';
    renderMath(tippBox);

    // Tipp-Button ausblenden
    const btnTipp = document.getElementById('btnTipp');
    if (btnTipp) {
      btnTipp.style.display = 'none';
    }
  }

  // ── Reset ───────────────────────────────────────────────────

  function resetFortschritt() {
    if (!confirm('Möchtest du wirklich deinen gesamten Fortschritt zurücksetzen?')) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    saveState();

    const aufgabe = getNextAufgabe();
    if (aufgabe) renderAufgabe(aufgabe);
  }

  // ── Keyboard-Shortcuts ──────────────────────────────────────

  function initKeyboard() {
    document.addEventListener('keydown', function (e) {
      // Nicht reagieren wenn in einem Input-Feld (Enter wird dort separat behandelt)
      const inInput = document.activeElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

      if (inInput) return;

      // Enter → Prüfen oder Weiter
      if (e.key === 'Enter') {
        e.preventDefault();
        if (feedbackShown) {
          naechsteAufgabe();
        } else if (currentAufgabe && currentAufgabe.typ === 'numerisch') {
          const input = document.getElementById('antwortInput');
          if (input && input.value.trim() !== '') {
            checkAntwort();
          }
        }
        return;
      }

      // → Weiter (nach Feedback)
      if (e.key === 'ArrowRight' && feedbackShown) {
        e.preventDefault();
        naechsteAufgabe();
        return;
      }

      // T → Tipp
      if ((e.key === 't' || e.key === 'T') && !feedbackShown) {
        e.preventDefault();
        zeigeTipp();
        return;
      }

      // 1-4 → MC-Auswahl
      if (!feedbackShown && currentAufgabe && currentAufgabe.typ === 'mc') {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 4) {
          e.preventDefault();
          const idx = num - 1;
          if (idx < (currentAufgabe.optionen || []).length) {
            selectMC(idx);
          }
        }
      }
    });
  }

  // ── Init ────────────────────────────────────────────────────

  function initApp() {
    loadState();
    initKeyboard();

    const aufgabe = getNextAufgabe();
    if (aufgabe) {
      renderAufgabe(aufgabe);
    } else {
      zeigeAlleGeschafft();
    }
  }

  // ── Globale API (für HTML onclick falls nötig) ──────────────

  window.checkAntwort = checkAntwort;
  window.selectMC = selectMC;
  window.naechsteAufgabe = naechsteAufgabe;
  window.zeigeTipp = zeigeTipp;
  window.resetFortschritt = resetFortschritt;

  // ── Start ───────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();

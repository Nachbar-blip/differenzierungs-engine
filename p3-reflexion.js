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

  function openRueckblick() {
    /* implementiert in Task 15 */
    console.log('P3: Rückblick noch nicht implementiert');
  }

  window.P3 = {
    onAnswered: function (_data) { /* Task 12 */ },
    renderSessionEndButton: renderSessionEndButton
  };
})();

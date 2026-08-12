// spirale-kids.js — Kids-Addon: mobiler Ziffernblock (inkl. Komma/Minus) am Antwortfeld.
// Die Engine rendert #antwortInput bei jeder Aufgabe neu, daher MutationObserver.
// Engine wird NICHT angefasst; wird nur von den Klasse-5/6-Hüllen geladen.
(function () {
    function patch(root) {
        const input = root.querySelector('#antwortInput');
        if (input && !input.hasAttribute('inputmode')) {
            input.setAttribute('inputmode', 'decimal');
            input.setAttribute('autocapitalize', 'off');
        }
    }
    const app = document.getElementById('app');
    if (!app) return;
    patch(app);
    new MutationObserver(() => patch(app)).observe(app, { childList: true, subtree: true });
})();

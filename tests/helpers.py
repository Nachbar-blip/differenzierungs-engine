"""Hilfsfunktionen fuer DiffEngine Playwright-Tests."""

import json
from playwright.sync_api import Page

BASE_URL = "https://nachbar-blip.github.io/differenzierungs-engine"


def load_trainer(page: Page, trainer_file: str, timeout: int = 15000):
    """Laedt einen Trainer und wartet bis die App gerendert hat."""
    url = f"{BASE_URL}/trainer/{trainer_file}"
    response = page.goto(url, timeout=timeout, wait_until="networkidle")
    page.wait_for_selector("#app .aufgabe-karte", timeout=timeout)
    return response


def get_aufgaben(page: Page) -> list:
    """Extrahiert das AUFGABEN-Array aus dem Trainer-JS."""
    return page.evaluate("AUFGABEN")


def setup_console_error_capture(page: Page) -> list:
    """Richtet console.error-Capture ein. Muss VOR page.goto() aufgerufen werden.
    Returns a list that will be populated with error messages."""
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    return errors


def count_katex_errors(page: Page) -> int:
    """Zaehlt KaTeX-Render-Fehler auf der Seite."""
    return page.evaluate("document.querySelectorAll('.katex-error').length")


def beantworte_aufgabe(page: Page, aufgabe: dict) -> bool:
    """Beantwortet eine einzelne Aufgabe korrekt.
    Returns True wenn die Antwort akzeptiert wurde (Feedback sichtbar).
    """
    if aufgabe["typ"] == "mc":
        korrekt_idx = aufgabe["korrekt"]
        buttons = page.query_selector_all(".mc-option")
        if korrekt_idx < len(buttons):
            buttons[korrekt_idx].click()
        else:
            return False

    elif aufgabe["typ"] == "numerisch":
        loesung = aufgabe["loesung"]
        input_el = page.query_selector("#antwortInput")
        if not input_el:
            return False
        text = str(loesung).replace(".", ",")
        input_el.fill(text)
        page.click("#btnPruefen")

    else:
        return False

    try:
        page.wait_for_selector("#feedback[style*='block']", timeout=5000)
        return True
    except Exception:
        return False


def klick_weiter(page: Page):
    """Klickt den Weiter-Button nach Feedback."""
    btn = page.query_selector("#btnWeiter")
    if btn:
        btn.click()
        page.wait_for_selector(".aufgabe-karte", timeout=5000)


def force_aufgabe_by_reload(page: Page, trainer_file: str, target_level: int):
    """Setzt localStorage so, dass der Trainer auf dem gewuenschten Level startet."""
    thema_key = trainer_file.replace(".html", "")
    state = {
        "level": target_level,
        "streak": 0,
        "wrongStreak": 0,
        "answered": [],
        "totalCorrect": 0,
        "totalAttempts": 0,
    }
    state_json = json.dumps(state)
    page.evaluate(f"localStorage.setItem('spirale-{thema_key}', '{state_json}')")
    page.reload(wait_until="networkidle")
    page.wait_for_selector("#app .aufgabe-karte", timeout=10000)


def get_current_aufgabe_id(page: Page) -> int:
    """Liest die ID der aktuell angezeigten Aufgabe aus dem DOM."""
    return page.evaluate("""
        (() => {
            const frageEl = document.querySelector('.aufgabe-text');
            if (!frageEl) return -1;
            const frageHTML = frageEl.innerHTML;
            for (const a of AUFGABEN) {
                // Vergleiche die ersten 30 Zeichen des Frage-HTML
                if (frageHTML.includes(a.frage.substring(0, 30))) return a.id;
            }
            return -1;
        })()
    """)

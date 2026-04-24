"""Hilfsfunktionen fuer DiffEngine Playwright-Tests."""

import json
import os
from playwright.sync_api import Page

BASE_URL = os.environ.get("DIFFENGINE_BASE_URL", "https://nachbar-blip.github.io/differenzierungs-engine")


def load_trainer(page: Page, trainer_file: str, timeout: int = 30000):
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


def force_single_aufgabe(page: Page, trainer_file: str, aufgabe_id: int,
                         level: int, all_level_ids: list):
    """Setzt localStorage so, dass nur eine bestimmte Aufgabe uebrig bleibt.
    Alle anderen Aufgaben des Levels werden als 'answered' markiert."""
    thema_key = trainer_file.replace(".html", "")
    # Alle IDs des Levels AUSSER der gewuenschten als beantwortet markieren
    answered = [aid for aid in all_level_ids if aid != aufgabe_id]
    state = {
        "level": level,
        "streak": 0,
        "wrongStreak": 0,
        "answered": answered,
        "totalCorrect": 0,
        "totalAttempts": 0,
    }
    state_json = json.dumps(state)
    page.evaluate(f"localStorage.setItem('spirale-{thema_key}', '{state_json}')")
    page.reload(wait_until="networkidle")
    page.wait_for_selector("#app .aufgabe-karte", timeout=10000)


def get_current_aufgabe_id(page: Page) -> int:
    """Liest die ID der aktuell angezeigten Aufgabe aus dem DOM.
    Nutzt localStorage-State um Kandidaten einzugrenzen."""
    return page.evaluate("""
        (() => {
            try {
                const key = 'spirale-' + THEMA_KEY;
                const s = JSON.parse(localStorage.getItem(key));
                const lvl = s ? s.level : 3;
                const answered = s ? (s.answered || []) : [];
                const available = AUFGABEN.filter(a => a.level === lvl && !answered.includes(a.id));
                if (available.length === 1) return available[0].id;
                if (available.length === 0) {
                    // Answered-Reset: alle des Levels sind Kandidaten
                    const all = AUFGABEN.filter(a => a.level === lvl);
                    return all.length > 0 ? all[0].id : -1;
                }
                // Mehrere Kandidaten: Typ-Filter
                const mcBtns = document.querySelectorAll('.mc-option');
                const numInput = document.getElementById('antwortInput');
                const typ = mcBtns.length > 0 ? 'mc' : (numInput ? 'numerisch' : 'unknown');
                const typed = available.filter(a => a.typ === typ);
                if (typed.length === 1) return typed[0].id;
                return typed.length > 0 ? typed[0].id : available[0].id;
            } catch(e) { return -1; }
        })()
    """)

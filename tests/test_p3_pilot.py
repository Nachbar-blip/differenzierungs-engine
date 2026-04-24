"""Playwright-Tests fuer den P3-Pilot auf 9-func-quadratisch."""

import json
import pytest
from helpers import load_trainer, BASE_URL

PILOT_TRAINER = "9-func-quadratisch.html"
PILOT_KEY = "9-func-quadratisch"


def _set_p3_level6_reached(page, reached: bool = True):
    page.evaluate(
        "([key, val]) => localStorage.setItem(key, val)",
        [f"p3-level6-reached-{PILOT_KEY}", json.dumps(reached)]
    )


def _set_p3_history(page, entries: list):
    page.evaluate(
        "([key, val]) => localStorage.setItem(key, val)",
        [f"p3-history-{PILOT_KEY}", json.dumps(entries)]
    )


def _get_p3_history(page):
    raw = page.evaluate(f"localStorage.getItem('p3-history-{PILOT_KEY}')")
    return json.loads(raw) if raw else None


def _get_p3_reflexion(page):
    raw = page.evaluate(f"localStorage.getItem('p3-reflexion-{PILOT_KEY}')")
    return json.loads(raw) if raw else None


def _force_level(page, level: int, level6_reached: bool = False):
    state = {
        "level": level, "streak": 0, "wrongStreak": 0,
        "answered": [], "totalCorrect": 0, "totalAttempts": 0,
    }
    page.evaluate(
        "([key, val]) => localStorage.setItem(key, val)",
        [f"spirale-{PILOT_KEY}", json.dumps(state)]
    )
    if level6_reached:
        _set_p3_level6_reached(page, True)
    page.reload(wait_until="networkidle")
    page.wait_for_selector("#app", timeout=10000)


class TestP3Modul:
    def test_p3_object_verfuegbar(self, page):
        load_trainer(page, PILOT_TRAINER)
        p3_exists = page.evaluate("typeof window.P3 !== 'undefined'")
        assert p3_exists, "window.P3 nicht definiert im Pilot-Trainer"

    def test_p3_config_flag_gesetzt(self, page):
        load_trainer(page, PILOT_TRAINER)
        flag = page.evaluate("THEMA_CONFIG.p3Enabled === true")
        assert flag, "THEMA_CONFIG.p3Enabled nicht true"


class TestButtonSichtbarkeit:
    def test_kein_button_vor_level6(self, page):
        load_trainer(page, PILOT_TRAINER)
        _force_level(page, level=3, level6_reached=False)
        btn = page.query_selector("#btnSessionEnden")
        assert btn is None, "Button darf vor Level-6-Erstkontakt nicht existieren"

    def test_button_bei_level6_reached_flag(self, page):
        load_trainer(page, PILOT_TRAINER)
        _force_level(page, level=6, level6_reached=True)
        page.evaluate("""
            const fb = document.getElementById('feedback');
            window.P3.renderSessionEndButton(fb);
        """)
        btn = page.query_selector("#btnSessionEnden")
        assert btn is not None, "Button muss ab level6_reached sichtbar sein"

    def test_button_bleibt_bei_level5_wenn_erreicht(self, page):
        load_trainer(page, PILOT_TRAINER)
        _force_level(page, level=5, level6_reached=True)
        page.evaluate("""
            const fb = document.getElementById('feedback');
            window.P3.renderSessionEndButton(fb);
        """)
        btn = page.query_selector("#btnSessionEnden")
        assert btn is not None, "Button muss auch auf Level 5 bleiben, wenn Level 6 mal erreicht wurde"


class TestHistorie:
    def test_onAnswered_pusht_level6_eintrag(self, page):
        load_trainer(page, PILOT_TRAINER)
        page.evaluate("""
            window.P3.onAnswered({ aufgabeId: 17, correct: true, levelVor: 5, levelNach: 6 });
        """)
        history = _get_p3_history(page)
        assert history is not None
        assert len(history) == 1
        assert history[0]["id"] == 17
        assert history[0]["correct"] is True

    def test_onAnswered_ignoriert_andere_level(self, page):
        load_trainer(page, PILOT_TRAINER)
        page.evaluate("""
            window.P3.onAnswered({ aufgabeId: 5, correct: true, levelVor: 3, levelNach: 4 });
        """)
        history = _get_p3_history(page)
        assert history is None or history == []

    def test_onAnswered_setzt_level6_flag_bei_erstkontakt(self, page):
        load_trainer(page, PILOT_TRAINER)
        flag_before = page.evaluate(f"localStorage.getItem('p3-level6-reached-{PILOT_KEY}')")
        assert flag_before != "true"
        page.evaluate("""
            window.P3.onAnswered({ aufgabeId: 17, correct: true, levelVor: 5, levelNach: 6 });
        """)
        flag_after = page.evaluate(f"localStorage.getItem('p3-level6-reached-{PILOT_KEY}')")
        assert flag_after == "true"

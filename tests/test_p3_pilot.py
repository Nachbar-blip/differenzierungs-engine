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

    def test_historie_soft_cap_50(self, page):
        load_trainer(page, PILOT_TRAINER)
        page.evaluate("""
            for (let i = 0; i < 55; i++) {
                window.P3.onAnswered({ aufgabeId: i, correct: true, levelVor: 5, levelNach: 6 });
            }
        """)
        history = _get_p3_history(page)
        assert len(history) == 50, f"Erwartet 50 Einträge, erhalten {len(history)}"
        assert history[0]["id"] == 5, "Älteste Einträge müssen rausgefallen sein (FIFO)"
        assert history[-1]["id"] == 54


class TestRueckblick:
    def test_klick_oeffnet_rueckblick_container(self, page):
        load_trainer(page, PILOT_TRAINER)
        _force_level(page, level=6, level6_reached=True)
        _set_p3_history(page, [
            {"id": 17, "correct": True, "ts": 1000},
            {"id": 23, "correct": False, "ts": 2000},
        ])
        page.evaluate("""
            const wrapper = document.createElement('div');
            wrapper.id = 'testFeedback';
            document.body.appendChild(wrapper);
            window.P3.renderSessionEndButton(wrapper);
            document.getElementById('btnSessionEnden').click();
        """)
        container = page.query_selector("#p3Rueckblick")
        assert container is not None, "Rückblick-Container muss nach Klick existieren"
        kacheln = page.query_selector_all(".p3-kachel")
        assert len(kacheln) == 2, f"Erwartet 2 Kacheln, erhalten {len(kacheln)}"

    def test_leere_historie_zeigt_hinweis(self, page):
        load_trainer(page, PILOT_TRAINER)
        _force_level(page, level=6, level6_reached=True)
        page.evaluate("""
            const wrapper = document.createElement('div');
            document.body.appendChild(wrapper);
            window.P3.renderSessionEndButton(wrapper);
            document.getElementById('btnSessionEnden').click();
        """)
        container = page.query_selector("#p3Rueckblick")
        assert container is not None
        hinweis = page.query_selector(".p3-leer-hinweis")
        assert hinweis is not None, "Leer-Hinweis muss bei leerer Historie erscheinen"


class TestFehlertypKlick:
    def _oeffne_rueckblick(self, page, history):
        load_trainer(page, PILOT_TRAINER)
        _force_level(page, level=6, level6_reached=True)
        _set_p3_history(page, history)
        page.evaluate("""
            const wrapper = document.createElement('div');
            document.body.appendChild(wrapper);
            window.P3.renderSessionEndButton(wrapper);
            document.getElementById('btnSessionEnden').click();
        """)

    def test_klick_aktualisiert_zahl(self, page):
        self._oeffne_rueckblick(page, [{"id": 17, "correct": True, "ts": 1000}])
        page.click(".p3-kachel[data-idx='0'] .p3-ft-btn[data-typ='regel']")
        zahl = page.text_content("#p3-z-regel")
        assert zahl == "1"

    def test_buttons_werden_disabled_nach_klick(self, page):
        self._oeffne_rueckblick(page, [{"id": 17, "correct": True, "ts": 1000}])
        page.click(".p3-kachel[data-idx='0'] .p3-ft-btn[data-typ='regel']")
        btns = page.query_selector_all(".p3-kachel[data-idx='0'] .p3-ft-btn")
        for b in btns:
            assert b.is_disabled(), "Alle 4 Buttons müssen nach Klick disabled sein"

    def test_reflexion_wird_in_localstorage_gespeichert(self, page):
        self._oeffne_rueckblick(page, [{"id": 17, "correct": True, "ts": 1000}])
        page.click(".p3-kachel[data-idx='0'] .p3-ft-btn[data-typ='konzept']")
        reflexion = _get_p3_reflexion(page)
        assert reflexion == {"0": "konzept"}

    def test_empfehlung_ab_3_klicks(self, page):
        history = [{"id": i, "correct": True, "ts": i * 1000} for i in range(1, 4)]
        self._oeffne_rueckblick(page, history)
        for idx in range(3):
            page.click(f".p3-kachel[data-idx='{idx}'] .p3-ft-btn[data-typ='konzept']")
        page.wait_for_function("document.getElementById('p3Empfehlung').textContent.length > 0", timeout=3000)
        text = page.text_content("#p3Empfehlung")
        assert "Konzept" in text or "Diagnose" in text


class TestZurueck:
    def test_zurueck_raeumt_historie_und_reflexion(self, page):
        load_trainer(page, PILOT_TRAINER)
        _force_level(page, level=6, level6_reached=True)
        _set_p3_history(page, [{"id": 17, "correct": True, "ts": 1000}])
        page.evaluate(
            "([key, val]) => localStorage.setItem(key, val)",
            [f"p3-reflexion-{PILOT_KEY}", '{"0": "regel"}']
        )
        page.evaluate("""
            const wrapper = document.createElement('div');
            document.body.appendChild(wrapper);
            window.P3.renderSessionEndButton(wrapper);
            document.getElementById('btnSessionEnden').click();
            document.getElementById('btnZurueckZumTraining').click();
        """)
        assert _get_p3_history(page) is None
        assert _get_p3_reflexion(page) is None

    def test_zurueck_behaelt_level6_flag(self, page):
        load_trainer(page, PILOT_TRAINER)
        _force_level(page, level=6, level6_reached=True)
        _set_p3_history(page, [{"id": 17, "correct": True, "ts": 1000}])
        page.evaluate("""
            const wrapper = document.createElement('div');
            document.body.appendChild(wrapper);
            window.P3.renderSessionEndButton(wrapper);
            document.getElementById('btnSessionEnden').click();
            document.getElementById('btnZurueckZumTraining').click();
        """)
        flag = page.evaluate(f"localStorage.getItem('p3-level6-reached-{PILOT_KEY}')")
        assert flag == "true"

    def test_zurueck_behaelt_engine_state(self, page):
        load_trainer(page, PILOT_TRAINER)
        _force_level(page, level=6, level6_reached=True)
        _set_p3_history(page, [{"id": 17, "correct": True, "ts": 1000}])
        engine_state_before = page.evaluate(f"localStorage.getItem('spirale-{PILOT_KEY}')")
        page.evaluate("""
            const wrapper = document.createElement('div');
            document.body.appendChild(wrapper);
            window.P3.renderSessionEndButton(wrapper);
            document.getElementById('btnSessionEnden').click();
            document.getElementById('btnZurueckZumTraining').click();
        """)
        engine_state_after = page.evaluate(f"localStorage.getItem('spirale-{PILOT_KEY}')")
        assert engine_state_before == engine_state_after


class TestEdgeCases:
    def test_onAnswered_crasht_nicht_bei_storage_exception(self, page):
        load_trainer(page, PILOT_TRAINER)
        page.evaluate("""
            const orig = Storage.prototype.setItem;
            Storage.prototype.setItem = function () { throw new Error('QuotaExceeded'); };
            try {
                window.P3.onAnswered({ aufgabeId: 17, correct: true, levelVor: 5, levelNach: 6 });
            } finally {
                Storage.prototype.setItem = orig;
            }
        """)
        assert True

"""Playwright-Smoke-Tests fuer die 16 Klasse-5/6-Trainer (Kids-Addon).

Laedt jeden Trainer per file://-URL (KaTeX kommt vom CDN, Internet noetig)
und prueft: keine Konsolenfehler, KaTeX gerendert, 36 Aufgaben,
Kids-Addon (inputmode="decimal", Touch-Hoehen >= 48 px) sowie je eine
korrekt beantwortete numerische und MC-Aufgabe.

Nutzt die bestehenden Fixtures aus conftest.py (browser/page) und die
Helfer aus helpers.py — aber file:// statt BASE_URL.
"""

import pathlib
import pytest
from helpers import (
    setup_console_error_capture, count_katex_errors,
    beantworte_aufgabe, force_single_aufgabe,
)

REPO = pathlib.Path(__file__).resolve().parent.parent
TRAINER_5_6 = sorted((REPO / "trainer").glob("5-*.html")) + \
              sorted((REPO / "trainer").glob("6-*.html"))

MIN_TOUCH = 48  # px, Kids-Addon Mindest-Touchhoehe


def _lade_lokal(page, pfad: pathlib.Path):
    """Laedt einen Trainer per file://-URL und wartet auf App + KaTeX."""
    page.goto(pfad.as_uri(), wait_until="networkidle", timeout=30000)
    page.wait_for_selector("#app .aufgabe-karte", timeout=30000)
    # KaTeX-Bibliothek (CDN) muss geladen sein; .katex-Elemente erscheinen
    # erst, wenn die aktuelle Aufgabe Mathe enthaelt — das prueft der Test
    # spaeter an einer gezielt gewaehlten Mathe-Aufgabe.
    page.wait_for_function("typeof katex !== 'undefined'", timeout=30000)


def _kritische_fehler(errors):
    """Filtert unkritische Konsolenmeldungen (wie in test_trainer.py)."""
    return [e for e in errors
            if "CORS" not in e and "deprecated" not in e.lower()
            and "favicon" not in e.lower()]


def _ist_nicht_ganzzahlig(loesung):
    """True bei Dezimal-Loesungen (z. B. 3.5) — die brauchen Komma-Eingabe."""
    return isinstance(loesung, float) and loesung != int(loesung)


def _finde_aufgabe(aufgaben, typ, mit_mathe=False):
    """Erste Aufgabe des Typs.

    Bevorzugungen (mit Fallback auf die erstbeste, falls keine existiert):
    - numerisch: nicht-ganzzahlige Loesung, damit die Komma-Eingabe
      (Punkt→Komma) wirklich geprueft wird und nicht still leer laeuft
    - mit_mathe: Frage mit Inline-KaTeX
    """
    passend = [a for a in aufgaben if a["typ"] == typ]
    if typ == "numerisch":
        komma = [a for a in passend if _ist_nicht_ganzzahlig(a.get("loesung"))]
        if mit_mathe:
            for a in komma:
                if "\\(" in a.get("frage", ""):
                    return a
        if komma:
            return komma[0]
    if mit_mathe:
        for a in passend:
            if "\\(" in a.get("frage", ""):
                return a
    return passend[0] if passend else None


def _zeige_aufgabe(page, pfad, aufgabe, aufgaben):
    """Navigiert per localStorage-Reload gezielt zu einer Aufgabe."""
    level_ids = [a["id"] for a in aufgaben if a["level"] == aufgabe["level"]]
    force_single_aufgabe(page, pfad.name, aufgabe["id"],
                         aufgabe["level"], level_ids)


@pytest.mark.parametrize("pfad", TRAINER_5_6, ids=lambda p: p.stem)
def test_trainer_smoke(page, pfad):
    errors = setup_console_error_capture(page)
    _lade_lokal(page, pfad)

    # 1./2. Keine JS-Fehler, KaTeX ohne Render-Fehler
    assert count_katex_errors(page) == 0, f"{pfad.name}: KaTeX-Render-Fehler"

    # 3. 36 Aufgaben
    aufgaben = page.evaluate("AUFGABEN")
    assert len(aufgaben) == 36, f"{pfad.name}: {len(aufgaben)} statt 36 Aufgaben"

    # 4. Numerische Aufgabe: Kids-Addon + korrekte Antwort mit Komma
    num = _finde_aufgabe(aufgaben, "numerisch", mit_mathe=True)
    assert num is not None, f"{pfad.name}: keine numerische Aufgabe vorhanden"
    _zeige_aufgabe(page, pfad, num, aufgaben)
    inp = page.wait_for_selector("#antwortInput", timeout=10000)
    # 2. KaTeX gerendert (Aufgabe mit Mathe wurde bevorzugt gewaehlt;
    #    falls kein Mathe in der Frage: nur Fehlerfreiheit geprueft)
    if "\\(" in num.get("frage", ""):
        page.wait_for_selector(".katex", state="attached", timeout=10000)
    assert count_katex_errors(page) == 0, f"{pfad.name}: KaTeX-Render-Fehler"
    assert inp.get_attribute("inputmode") == "decimal", \
        f"{pfad.name}: inputmode fehlt (Kids-Addon nicht aktiv?)"
    box = inp.bounding_box()
    assert box and box["height"] >= MIN_TOUCH, \
        f"{pfad.name}: Eingabefeld nur {box and box['height']} px hoch"
    assert beantworte_aufgabe(page, num), \
        f"{pfad.name}: numerische Antwort nicht akzeptiert"
    assert page.query_selector("#feedback.feedback-richtig"), \
        f"{pfad.name}: kein Richtig-Feedback bei numerischer Aufgabe"

    # 5. MC-Aufgabe: Button-Hoehe + korrekte Option
    mc = _finde_aufgabe(aufgaben, "mc")
    assert mc is not None, f"{pfad.name}: keine MC-Aufgabe vorhanden"
    _zeige_aufgabe(page, pfad, mc, aufgaben)
    btn = page.wait_for_selector(".mc-option", timeout=10000)
    box = btn.bounding_box()
    assert box and box["height"] >= MIN_TOUCH, \
        f"{pfad.name}: MC-Button nur {box and box['height']} px hoch"
    assert beantworte_aufgabe(page, mc), \
        f"{pfad.name}: MC-Antwort nicht akzeptiert"
    assert page.query_selector("#feedback.feedback-richtig"), \
        f"{pfad.name}: kein Richtig-Feedback bei MC-Aufgabe"

    # 1. (Abschluss) Keine kritischen Konsolenfehler ueber den ganzen Lauf
    kritisch = _kritische_fehler(errors)
    assert not kritisch, f"{pfad.name}: Konsolenfehler: {kritisch}"


def test_regression_kl7_ohne_kids_addon(page):
    """Kl.-7-Trainer laedt fehlerfrei und bekommt KEIN inputmode (kein Addon)."""
    pfad = REPO / "trainer" / "7-gleichungen-linear.html"
    errors = setup_console_error_capture(page)
    _lade_lokal(page, pfad)

    aufgaben = page.evaluate("AUFGABEN")
    num = _finde_aufgabe(aufgaben, "numerisch")
    assert num is not None
    _zeige_aufgabe(page, pfad, num, aufgaben)
    inp = page.wait_for_selector("#antwortInput", timeout=10000)
    assert inp.get_attribute("inputmode") is None, \
        "Kl.-7-Trainer hat inputmode — Kids-Addon faelschlich geladen?"

    kritisch = _kritische_fehler(errors)
    assert not kritisch, f"Kl.-7-Konsolenfehler: {kritisch}"

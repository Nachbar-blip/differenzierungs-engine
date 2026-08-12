"""Playwright-Smoke-Tests fuer die 16 Klasse-5/6-Trainer (Kids-Addon).

Laedt jeden Trainer per file://-URL (KaTeX kommt vom CDN, Internet noetig)
und prueft: keine Konsolenfehler, KaTeX gerendert, 36 Aufgaben,
Kids-Addon (inputmode="decimal", Touch-Hoehen >= --kids-touch) sowie je eine
korrekt beantwortete numerische und MC-Aufgabe.

Nutzt die bestehenden Fixtures aus conftest.py (browser/page) und die
Helfer aus helpers.py — aber file:// statt BASE_URL.
"""

import pathlib
import pytest
from helpers import (
    get_aufgaben, setup_console_error_capture, count_katex_errors,
    kritische_fehler, beantworte_aufgabe, force_single_aufgabe,
)

REPO = pathlib.Path(__file__).resolve().parent.parent
TRAINER_5_6 = sorted((REPO / "trainer").glob("[56]-*.html"))


def _lade_lokal(page, pfad: pathlib.Path):
    """Laedt einen Trainer per file://-URL und wartet auf die App."""
    page.goto(pfad.as_uri(), wait_until="networkidle", timeout=30000)
    page.wait_for_selector("#app .aufgabe-karte", timeout=30000)


def _min_touch(page) -> float:
    """Liest die Touch-Mindesthoehe aus der CSS-Variablen des Kids-Addons —
    das CSS bleibt Single Source of Truth."""
    wert = page.evaluate(
        "getComputedStyle(document.documentElement).getPropertyValue('--kids-touch')")
    assert wert.strip().endswith("px"), "--kids-touch fehlt (Kids-Addon nicht geladen?)"
    return float(wert.strip()[:-2])


def _ist_nicht_ganzzahlig(loesung):
    """True bei Dezimal-Loesungen (z. B. 3.5) — die brauchen Komma-Eingabe."""
    return isinstance(loesung, float) and loesung != int(loesung)


def _finde_aufgabe(aufgaben, typ, mit_mathe=False):
    """Beste Aufgabe des Typs (None, falls keine existiert).

    Bevorzugungen: Frage mit Inline-KaTeX (falls mit_mathe), bei numerisch
    zusaetzlich nicht-ganzzahlige Loesung, damit die Komma-Eingabe
    (Punkt-zu-Komma) wirklich geprueft wird und nicht still leer laeuft.
    """
    passend = [a for a in aufgaben if a["typ"] == typ]
    return max(passend, key=lambda a: (
        mit_mathe and "\\(" in a.get("frage", ""),
        typ == "numerisch" and _ist_nicht_ganzzahlig(a.get("loesung")),
    ), default=None)


def _zeige_aufgabe(page, pfad, aufgabe, aufgaben):
    """Navigiert per localStorage-Reload gezielt zu einer Aufgabe."""
    level_ids = [a["id"] for a in aufgaben if a["level"] == aufgabe["level"]]
    force_single_aufgabe(page, pfad.name, aufgabe["id"],
                         aufgabe["level"], level_ids)


def _pruefe_und_beantworte(page, pfad, aufgabe, selektor, min_touch):
    """Prueft Touch-Hoehe des Elements der bereits angezeigten Aufgabe,
    beantwortet korrekt und verlangt Richtig-Feedback. Gibt das Element zurueck."""
    el = page.wait_for_selector(selektor, timeout=10000)
    box = el.bounding_box()
    assert box and box["height"] >= min_touch, \
        f"{pfad.name}: {selektor} nur {box and box['height']} px hoch"
    assert beantworte_aufgabe(page, aufgabe), \
        f"{pfad.name}: Antwort ({aufgabe['typ']}) nicht akzeptiert"
    assert page.query_selector("#feedback.feedback-richtig"), \
        f"{pfad.name}: kein Richtig-Feedback ({aufgabe['typ']})"
    return el


@pytest.mark.parametrize("pfad", TRAINER_5_6, ids=lambda p: p.stem)
def test_trainer_smoke(page, pfad):
    errors = setup_console_error_capture(page)
    _lade_lokal(page, pfad)
    min_touch = _min_touch(page)

    # 3. 36 Aufgaben
    aufgaben = get_aufgaben(page)
    assert len(aufgaben) == 36, f"{pfad.name}: {len(aufgaben)} statt 36 Aufgaben"

    # 4. Numerische Aufgabe: Kids-Addon + korrekte Antwort mit Komma
    num = _finde_aufgabe(aufgaben, "numerisch", mit_mathe=True)
    assert num is not None, f"{pfad.name}: keine numerische Aufgabe vorhanden"
    _zeige_aufgabe(page, pfad, num, aufgaben)
    # 2. KaTeX gerendert (Aufgabe mit Mathe wurde bevorzugt gewaehlt;
    #    falls kein Mathe in der Frage: nur Fehlerfreiheit geprueft)
    if "\\(" in num.get("frage", ""):
        page.wait_for_selector(".katex", state="attached", timeout=10000)
    assert count_katex_errors(page) == 0, f"{pfad.name}: KaTeX-Render-Fehler"
    inp = _pruefe_und_beantworte(page, pfad, num, "#antwortInput", min_touch)
    assert inp.get_attribute("inputmode") == "decimal", \
        f"{pfad.name}: inputmode fehlt (Kids-Addon nicht aktiv?)"

    # 5. MC-Aufgabe: Button-Hoehe + korrekte Option
    mc = _finde_aufgabe(aufgaben, "mc")
    assert mc is not None, f"{pfad.name}: keine MC-Aufgabe vorhanden"
    _zeige_aufgabe(page, pfad, mc, aufgaben)
    _pruefe_und_beantworte(page, pfad, mc, ".mc-option", min_touch)

    # 1. Keine kritischen Konsolenfehler ueber den ganzen Lauf
    kritisch = kritische_fehler(errors)
    assert not kritisch, f"{pfad.name}: Konsolenfehler: {kritisch}"


def test_regression_kl7_ohne_kids_addon(page):
    """Kl.-7-Trainer laedt fehlerfrei und bekommt KEIN inputmode (kein Addon)."""
    pfad = REPO / "trainer" / "7-gleichungen-linear.html"
    errors = setup_console_error_capture(page)
    _lade_lokal(page, pfad)

    aufgaben = get_aufgaben(page)
    num = _finde_aufgabe(aufgaben, "numerisch")
    assert num is not None
    _zeige_aufgabe(page, pfad, num, aufgaben)
    inp = page.wait_for_selector("#antwortInput", timeout=10000)
    assert inp.get_attribute("inputmode") is None, \
        "Kl.-7-Trainer hat inputmode — Kids-Addon faelschlich geladen?"

    kritisch = kritische_fehler(errors)
    assert not kritisch, f"Kl.-7-Konsolenfehler: {kritisch}"

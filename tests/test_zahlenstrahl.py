"""Playwright-Tests fuer das Zahlenstrahl-Spiel (spiele/zahlenstrahl.html).

Laedt das Spiel per file://-URL (KaTeX vom CDN, Internet noetig) und prueft:
Laden ohne Konsolenfehler, Richtig-/Falle-/Daneben-Pfade, Loesungsanimation,
EIS-Hilfe, Stufen-Ende mit Empfehlungs-Links, Kids-Touch-Hitbox, localStorage
bleibt leer sowie die Node-Logiktests als Regression.

Nutzt die Fixtures aus conftest.py (browser/page) und Helfer aus helpers.py.
"""

import pathlib
import shutil
import subprocess

import pytest
from helpers import setup_console_error_capture, kritische_fehler, count_katex_errors

REPO = pathlib.Path(__file__).resolve().parent.parent
SPIEL = REPO / "spiele" / "zahlenstrahl.html"

# SVG-Layout-Konstanten aus zahlenstrahl.js (fuer Maus-Positionierung)
VIEW_W, VIEW_H, PAD, ACHSE_Y = 700, 130, 40, 65
TRACK_W = VIEW_W - 2 * PAD
TOLERANZ_ANTEIL = 0.015  # wie zahlenstrahl-logik.js


# ===== Helfer =====

def _lade(page):
    """Laedt das Spiel und wartet auf den Startbildschirm."""
    page.goto(SPIEL.as_uri(), wait_until="networkidle", timeout=30000)
    page.wait_for_selector("#startScreen .stufe-karte", timeout=30000)


def _starte_stufe(page, stufe_idx):
    """Klickt die Stufenkarte und wartet auf die erste Aufgabe."""
    page.click(f".stufe-karte[data-stufe='{stufe_idx}']")
    page.wait_for_selector("#spielScreen svg.strahl-svg", timeout=10000)


def _aufgabe(page, stufe_idx, aufgabe_idx):
    """Zieht die Aufgaben-Daten aus dem STUFEN-Katalog der Seite."""
    return page.evaluate(f"STUFEN[{stufe_idx}].aufgaben[{aufgabe_idx}]")


def _format_de(zahl):
    """Deutsche Komma-Darstellung wie formatDe() in zahlenstrahl.js."""
    g = round(zahl * 1000) / 1000
    s = str(int(g)) if g == int(g) else repr(g)
    return s.replace(".", ",")


def _setze_marker_maus(page, strahl, wert):
    """Setzt den Marker per Mausklick exakt (Pixel-Fehler << Toleranz)."""
    page.locator("svg.strahl-svg").scroll_into_view_if_needed()
    box = page.locator("svg.strahl-svg").bounding_box()
    assert box, "Strahl-SVG nicht sichtbar"
    p = (wert - strahl["min"]) / (strahl["max"] - strahl["min"])
    x = box["x"] + (PAD + p * TRACK_W) * (box["width"] / VIEW_W)
    y = box["y"] + ACHSE_Y * (box["height"] / VIEW_H)
    page.mouse.click(x, y)


def _daneben_wert(aufgabe):
    """Wert, der klar weder richtig noch Falle ist (> 2x Toleranz Abstand)."""
    strahl = aufgabe["strahl"]
    spanne = strahl["max"] - strahl["min"]
    tol = spanne * TOLERANZ_ANTEIL
    ziele = [aufgabe["zahl"]] + [f["pos"] for f in aufgabe.get("fallen", [])]
    kandidaten = [strahl["min"] + k * spanne / 40 for k in range(41)]
    bester = max(kandidaten, key=lambda w: min(abs(w - z) for z in ziele))
    assert min(abs(bester - z) for z in ziele) > 2 * tol, \
        f"kein sicherer Daneben-Wert fuer {aufgabe['id']}"
    return bester


def _pruefen(page):
    page.click("#btnPruefen")


def _spiele_stufe_korrekt(page, stufe_idx, erste_aufgabe_mit_falle=False):
    """Spielt alle 8 Aufgaben einer Stufe programmgesteuert korrekt durch.

    Optional wird bei der ersten Aufgabe zuerst die Falle getroffen
    (provoziert Empfehlungs-Links in der Auswertung)."""
    _starte_stufe(page, stufe_idx)
    anzahl = page.evaluate(f"STUFEN[{stufe_idx}].aufgaben.length")
    for i in range(anzahl):
        aufgabe = _aufgabe(page, stufe_idx, i)
        if i == 0 and erste_aufgabe_mit_falle and aufgabe.get("fallen"):
            _setze_marker_maus(page, aufgabe["strahl"], aufgabe["fallen"][0]["pos"])
            _pruefen(page)
            page.wait_for_selector("#feedbackBereich .feedback-falsch", timeout=5000)
        _setze_marker_maus(page, aufgabe["strahl"], aufgabe["zahl"])
        _pruefen(page)
        page.wait_for_selector("#feedbackBereich .feedback-richtig", timeout=5000)
        page.click("#btnWeiter")
    page.wait_for_selector("#auswertungScreen:not([hidden])", timeout=5000)


# ===== Tests =====

def test_seite_laedt(page):
    """Seite laedt ohne kritische Konsolenfehler, 5 Stufenkarten, KaTeX da."""
    errors = setup_console_error_capture(page)
    _lade(page)
    assert page.locator(".stufe-karte").count() == 5, "es muessen 5 Stufenkarten sein"
    for i in range(5):
        assert page.locator(f".stufe-karte[data-stufe='{i}']").is_visible()
    assert page.evaluate("typeof katex !== 'undefined'"), "KaTeX-Bibliothek fehlt"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_richtig_pfad_tastatur(page):
    """Stufe 3: Marker per Pfeiltasten exakt auf den Zielwert, Enter -> richtig."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 2)
    aufgabe = _aufgabe(page, 2, 0)
    strahl, tick = aufgabe["strahl"], aufgabe["strahl"]["tick"]

    # Schrittzahlen: erst grobe Shift-Schritte (+-tick), dann feine (+-tick/10)
    gesamt = aufgabe["zahl"] - strahl["min"]
    shift_schritte = int(gesamt // tick)
    fein_schritte = round((gesamt - shift_schritte * tick) / (tick / 10))
    assert abs(shift_schritte * tick + fein_schritte * tick / 10 - gesamt) < 1e-9, \
        f"{aufgabe['id']}: Zielwert per Tastatur nicht exakt erreichbar"

    marker = page.locator("[role='slider']")
    marker.focus()
    for _ in range(shift_schritte):
        page.keyboard.press("Shift+ArrowRight")
    for _ in range(fein_schritte):
        page.keyboard.press("ArrowRight")

    erwartet = round(aufgabe["zahl"] * 1000) / 1000
    assert float(marker.get_attribute("aria-valuenow")) == pytest.approx(erwartet), \
        "aria-valuenow stimmt nicht mit dem Zielwert ueberein"

    page.keyboard.press("Enter")
    page.wait_for_selector("#feedbackBereich .feedback-richtig", timeout=5000)
    assert page.locator("#btnWeiter").is_visible(), "Weiter-Button fehlt nach richtig"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_falle_pfad(page):
    """Marker auf Fallen-Position -> Mustertext der Falle + feine Unterteilung."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 2)
    aufgabe = _aufgabe(page, 2, 0)
    assert aufgabe.get("fallen"), f"{aufgabe['id']}: keine Falle im Katalog"
    falle = aufgabe["fallen"][0]

    _setze_marker_maus(page, aufgabe["strahl"], falle["pos"])
    _pruefen(page)
    page.wait_for_selector("#feedbackBereich .feedback-falsch", timeout=5000)

    feedback = page.locator("#feedbackBereich").text_content()
    kern = falle["text"][:30]  # distinktiver Anfang des Fallen-Texts
    assert kern in feedback, f"Fallen-Text fehlt im Feedback: {kern!r}"
    assert page.locator("g.strahl-fein.sichtbar").count() == 1, \
        "feine Unterteilung nach Falle nicht sichtbar"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_daneben_pfad(page):
    """Klar abseits platziert -> Richtungshinweis (links/rechts) im Feedback."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 2)
    aufgabe = _aufgabe(page, 2, 0)
    wert = _daneben_wert(aufgabe)

    _setze_marker_maus(page, aufgabe["strahl"], wert)
    _pruefen(page)
    page.wait_for_selector("#feedbackBereich .feedback-falsch", timeout=5000)

    feedback = page.locator("#feedbackBereich").text_content()
    assert "links" in feedback or "rechts" in feedback, \
        f"kein Richtungshinweis im Feedback: {feedback!r}"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_loesung_nach_zwei_fehlversuchen(page):
    """Zwei Fehlversuche -> Marker gleitet zur Loesung, btnWeiter erscheint."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 2)
    aufgabe = _aufgabe(page, 2, 0)
    wert = _daneben_wert(aufgabe)

    for _ in range(2):
        _setze_marker_maus(page, aufgabe["strahl"], wert)
        _pruefen(page)
        page.wait_for_selector("#feedbackBereich .feedback-falsch", timeout=5000)

    # Loesungsanimation ~700 ms: der Weiter-Button erscheint erst im letzten
    # Animationsframe — auf ihn warten, kein blinder Sleep
    page.wait_for_selector("#btnWeiter", timeout=5000)
    erwartet = round(aufgabe["zahl"] * 1000) / 1000
    marker = page.locator("[role='slider']")
    assert float(marker.get_attribute("aria-valuenow")) == pytest.approx(erwartet), \
        "Marker steht nach der Loesungsanimation nicht auf dem Zielwert"
    assert marker.get_attribute("aria-valuetext") == _format_de(aufgabe["zahl"]), \
        "aria-valuetext ist keine deutsche Komma-Darstellung der Loesung"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_eis_hilfe(page):
    """Hilfe oeffnen, Tab Tafel -> Stellenwerttafel/Bruchstreifen, KaTeX sauber."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 2)
    aufgabe = _aufgabe(page, 2, 0)

    page.click("#btnHilfe")
    page.wait_for_selector("#hilfePanel:not([hidden])", timeout=5000)
    page.click("#tabTafel")
    page.wait_for_selector("#hilfeTafel:not([hidden])", timeout=5000)

    if aufgabe["hilfe"]["typ"] == "bruch":
        assert page.locator("#hilfeTafel .bruchstreifen-svg").count() == 1, \
            "Bruchstreifen fehlt in der Tafel-Hilfe"
    else:
        assert page.locator("#hilfeTafel table.swt-tafel").count() == 1, \
            "Stellenwerttafel fehlt in der Tafel-Hilfe"
    assert count_katex_errors(page) == 0, "KaTeX-Render-Fehler auf der Seite"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_stufen_ende_und_empfehlung(page):
    """8 Aufgaben durchspielen (mit provozierter Falle) -> Auswertung ohne
    Punkte/Prozente, Empfehlungs-Link zeigt auf existierende Trainer-Datei."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _spiele_stufe_korrekt(page, 2, erste_aufgabe_mit_falle=True)

    text = page.locator("#auswertungScreen").text_content()
    assert "%" not in text, "Auswertung enthaelt Prozentangabe"
    assert "Punkt" not in text, "Auswertung enthaelt Punktangabe"

    links = page.locator("#auswertungInhalt .empfehlung-block a")
    assert links.count() >= 1, "kein Empfehlungs-Link trotz provozierter Falle"
    for i in range(links.count()):
        href = links.nth(i).get_attribute("href")
        ziel = (SPIEL.parent / href).resolve()
        assert ziel.is_file(), f"Empfehlungs-Ziel fehlt im Dateisystem: {href}"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_kids_css_und_touch_hitbox(page):
    """Kids-CSS aktiv (--kids-touch) und Marker-Hitbox >= 48 px."""
    errors = setup_console_error_capture(page)
    _lade(page)
    wert = page.evaluate(
        "getComputedStyle(document.documentElement).getPropertyValue('--kids-touch')")
    assert wert.strip().endswith("px"), "--kids-touch fehlt (Kids-CSS nicht geladen?)"

    _starte_stufe(page, 0)
    box = page.locator(".marker-hitbox").bounding_box()
    assert box, "Marker-Hitbox nicht gefunden"
    assert box["width"] >= 48, f"Hitbox nur {box['width']:.0f} px breit"
    assert box["height"] >= 48, f"Hitbox nur {box['height']:.0f} px hoch"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_localstorage_bleibt_leer(page):
    """Vor und nach einer gespielten Stufe: kein localStorage-Eintrag."""
    _lade(page)
    assert page.evaluate("Object.keys(localStorage).length") == 0, \
        "localStorage schon beim Laden befuellt"
    _spiele_stufe_korrekt(page, 0)
    assert page.evaluate("Object.keys(localStorage).length") == 0, \
        "Spiel schreibt in localStorage"


def test_node_logiktests_gruen():
    """Regression: node spiele/_test_logik.js weiterhin gruen."""
    node = shutil.which("node")
    if not node:
        pytest.skip("node nicht im PATH")
    ergebnis = subprocess.run(
        [node, str(REPO / "spiele" / "_test_logik.js")],
        capture_output=True, text=True, timeout=60)
    assert ergebnis.returncode == 0, \
        f"Node-Logiktests rot:\n{ergebnis.stdout}\n{ergebnis.stderr}"

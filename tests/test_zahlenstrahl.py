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
from helpers import (setup_console_error_capture, kritische_fehler,
                     count_katex_errors, lade_lokal, min_touch)

REPO = pathlib.Path(__file__).resolve().parent.parent
SPIEL = REPO / "spiele" / "zahlenstrahl.html"

# SVG-Layout-Konstanten aus zahlenstrahl.js (fuer Maus-Positionierung)
VIEW_W, VIEW_H, PAD, ACHSE_Y = 700, 130, 40, 65
TRACK_W = VIEW_W - 2 * PAD


# ===== Helfer =====

def _lade(page):
    """Laedt das Spiel und wartet auf den Startbildschirm."""
    lade_lokal(page, SPIEL, "#startScreen .stufe-karte")


def _starte_stufe(page, stufe_idx):
    """Klickt die Stufenkarte und wartet auf die erste Aufgabe."""
    page.click(f".stufe-karte[data-stufe='{stufe_idx}']")
    page.wait_for_selector("#spielScreen svg.strahl-svg", timeout=10000)


def _aufgabe(page, stufe_idx, aufgabe_idx):
    """Zieht die Aufgaben-Daten aus dem STUFEN-Katalog der Seite."""
    return page.evaluate(f"STUFEN[{stufe_idx}].aufgaben[{aufgabe_idx}]")


def _setze_marker_maus(page, strahl, wert):
    """Setzt den Marker per Mausklick exakt (Pixel-Fehler << Toleranz)."""
    page.locator("svg.strahl-svg").scroll_into_view_if_needed()
    box = page.locator("svg.strahl-svg").bounding_box()
    assert box, "Strahl-SVG nicht sichtbar"
    p = (wert - strahl["min"]) / (strahl["max"] - strahl["min"])
    x = box["x"] + (PAD + p * TRACK_W) * (box["width"] / VIEW_W)
    y = box["y"] + ACHSE_Y * (box["height"] / VIEW_H)
    page.mouse.click(x, y)


def _daneben_wert(page, aufgabe):
    """Wert, der klar weder richtig noch Falle ist (> 2x Toleranz Abstand).
    Die Toleranz kommt aus toleranz() der Seite — keine Konstanten-Kopie."""
    strahl = aufgabe["strahl"]
    spanne = strahl["max"] - strahl["min"]
    tol = page.evaluate("(s) => toleranz(s)", strahl)
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


def _tastatur_schritte(aufgabe):
    """Schrittzahlen zum Ziel: grobe Shift-Schritte (+-tick), feine (+-tick/10).
    None, wenn der Zielwert so nicht exakt erreichbar ist."""
    strahl, tick = aufgabe["strahl"], aufgabe["strahl"]["tick"]
    gesamt = aufgabe["zahl"] - strahl["min"]
    shift = int(gesamt // tick)
    fein = round((gesamt - shift * tick) / (tick / 10))
    if abs(shift * tick + fein * tick / 10 - gesamt) > 1e-9:
        return None
    return shift, fein


def test_richtig_pfad_tastatur(page):
    """Marker per Pfeiltasten exakt auf den Zielwert, Enter -> richtig.
    Gewaehlt wird gezielt eine Aufgabe, deren Ziel KEIN Tick-Vielfaches ist,
    damit auch die feine Schrittweite (+-tick/10) real ausgefuehrt wird."""
    errors = setup_console_error_capture(page)
    _lade(page)
    stufen = page.evaluate("STUFEN")
    stufe_idx = aufgabe = schritte = None
    for si, stufe in enumerate(stufen):
        # Nur erste Aufgabe je Stufe: das Spiel startet deterministisch dort
        s = _tastatur_schritte(stufe["aufgaben"][0])
        if s and s[1] > 0:
            stufe_idx, aufgabe, schritte = si, stufe["aufgaben"][0], s
            break
    assert aufgabe, "keine Stufe startet mit einem Nicht-Tick-Vielfachen als Ziel"
    shift_schritte, fein_schritte = schritte
    assert fein_schritte > 0  # Guard: Fein-Schrittweite muss real abgedeckt sein

    _starte_stufe(page, stufe_idx)

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
    wert = _daneben_wert(page, aufgabe)

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
    wert = _daneben_wert(page, aufgabe)

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
    valuenow = marker.get_attribute("aria-valuenow")
    assert marker.get_attribute("aria-valuetext") == valuenow.replace(".", ","), \
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
    """Kids-CSS aktiv (--kids-touch) und Marker-Hitbox >= --kids-touch."""
    errors = setup_console_error_capture(page)
    _lade(page)
    mt = min_touch(page)

    _starte_stufe(page, 0)
    box = page.locator(".marker-hitbox").bounding_box()
    assert box, "Marker-Hitbox nicht gefunden"
    assert box["width"] >= mt, f"Hitbox nur {box['width']:.0f} px breit"
    assert box["height"] >= mt, f"Hitbox nur {box['height']:.0f} px hoch"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_localstorage_bleibt_leer(page):
    """Vor und nach einer gespielten Stufe: kein localStorage-Eintrag."""
    errors = setup_console_error_capture(page)
    _lade(page)
    assert page.evaluate("Object.keys(localStorage).length") == 0, \
        "localStorage schon beim Laden befuellt"
    _spiele_stufe_korrekt(page, 0)
    assert page.evaluate("Object.keys(localStorage).length") == 0, \
        "Spiel schreibt in localStorage"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_letzte_stufe_kein_weiter_button(page):
    """Regression: Nach Stufe 5 (Index 4) darf kein 'Weiter zu Stufe 6'-Button
    sichtbar sein (spirale.css .btn-weiter ueberstimmt sonst [hidden]) und die
    End-Auswertung darf keinen Konsolenfehler werfen."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _spiele_stufe_korrekt(page, 4)

    assert not page.locator("#btnNaechsteStufe").is_visible(), \
        "Weiter-Button nach der letzten Stufe sichtbar"
    text = page.locator("#auswertungInhalt").text_content()
    assert "Alle 8 Aufgaben hast du selbst" in text, \
        f"Erfolgsstand fehlt in der Auswertung: {text!r}"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_falle_doppelt_zaehlt_einmal_und_sofort_feedback(page):
    """Regression: Dieselbe Falle 2x in einer Aufgabe -> Muster zaehlt 1x in der
    Auswertung; die Loesungs-Erklaerung steht sofort da (nicht erst nach der
    Animation); Erfolgsstand zeigt '7 von 8'."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 2)
    aufgabe = _aufgabe(page, 2, 0)
    falle = aufgabe["fallen"][0]

    # Aufgabe 1: zweimal dieselbe Falle treffen -> Loesung wird gezeigt
    for _ in range(2):
        _setze_marker_maus(page, aufgabe["strahl"], falle["pos"])
        _pruefen(page)
        page.wait_for_selector("#feedbackBereich .feedback-falsch", timeout=5000)

    # Sofort-Feedback: Erklaerung schon waehrend der Animation sichtbar
    assert "Hier wohnt die Zahl" in page.locator("#feedbackBereich").text_content(), \
        "Loesungs-Erklaerung erscheint nicht sofort beim Animationsstart"
    page.wait_for_selector("#btnWeiter", timeout=5000)
    page.click("#btnWeiter")

    # Restliche 7 Aufgaben korrekt loesen
    anzahl = page.evaluate("STUFEN[2].aufgaben.length")
    for i in range(1, anzahl):
        a = _aufgabe(page, 2, i)
        _setze_marker_maus(page, a["strahl"], a["zahl"])
        _pruefen(page)
        page.wait_for_selector("#feedbackBereich .feedback-richtig", timeout=5000)
        page.click("#btnWeiter")
    page.wait_for_selector("#auswertungScreen:not([hidden])", timeout=5000)

    text = page.locator("#auswertungInhalt").text_content()
    assert "1x " in text and "2x " not in text, \
        f"Falle muss pro Aufgabe genau 1x zaehlen: {text!r}"
    assert "7 von 8" in text, f"Erfolgsstand '7 von 8' fehlt: {text!r}"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_fallen_texte_mit_echten_umlauten(page):
    """Regression: Fallen-Texte zeigen echte Umlaute (\\u-Escapes in der
    ASCII-Quelldatei), keine Ersatzschreibungen wie 'groesser'."""
    _lade(page)
    texte = page.evaluate(
        "STUFEN.flatMap(s => s.aufgaben).flatMap(a => a.fallen || []).map(f => f.text).join(' ')")
    for ersatz in ["groesser", "Stueck", "Haelfte", "Fuer ", "Zaehle", "heisst"]:
        assert ersatz not in texte, f"Ersatzschreibung {ersatz!r} in Fallen-Texten"
    assert "größer" in texte, "echtes 'groesser' mit Umlauten fehlt"
    assert "Stück" in texte, "echtes 'Stueck' mit Umlauten fehlt"


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

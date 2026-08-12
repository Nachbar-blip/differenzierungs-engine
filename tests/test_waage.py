"""Playwright-Tests fuer die Gleichungs-Waage (spiele/waage.html).

Laedt das Spiel per file://-URL (KaTeX vom CDN, Internet noetig) und prueft:
Laden ohne Konsolenfehler, korrekte/einseitige/Distraktor-Operationen,
Musterweg-Loesung, Tab-Sync (EIS), Stufe-5-Sperre, Hilfe-Pfad,
Stufen-Ende-Auswertung mit Empfehlungs-Links, letzte-Stufe-Regression,
localStorage bleibt leer sowie die Node-Logiktests als Regression.

Nutzt die Fixtures aus conftest.py (browser/page) und Helfer aus helpers.py.
"""

import pathlib
import shutil
import subprocess

import pytest
from helpers import (setup_console_error_capture, kritische_fehler,
                     count_katex_errors, lade_lokal)

REPO = pathlib.Path(__file__).resolve().parent.parent
SPIEL = REPO / "spiele" / "waage.html"

MINUS = "−"   # opLabel nutzt &minus;
MAL = "·"     # opLabel nutzt &middot;


# ===== Helfer =====

def _lade(page):
    """Laedt das Spiel und wartet auf den Startbildschirm."""
    lade_lokal(page, SPIEL, "#startScreen .stufe-karte")


def _starte_stufe(page, stufe_idx):
    """Klickt die Stufenkarte und wartet auf den Spielbildschirm."""
    page.click(f".stufe-karte[data-stufe='{stufe_idx}']")
    page.wait_for_selector("#spielScreen:not([hidden])", timeout=10000)


def _aufgabe(page, stufe_idx, aufgabe_idx):
    """Zieht die Aufgaben-Daten aus dem STUFEN-Katalog der Seite."""
    return page.evaluate(f"STUFEN[{stufe_idx}].aufgaben[{aufgabe_idx}]")


def _op_label(op):
    """Button-Beschriftung wie opLabel() in waage.js (Werte sind ganzzahlig)."""
    art, w, seite = op["art"], op["wert"], op["seite"]
    if art == "sub_c":
        kern = (MINUS + str(w)) if w >= 0 else ("+" + str(-w))
    elif art == "add_c":
        kern = ("+" + str(w)) if w >= 0 else (MINUS + str(-w))
    elif art == "sub_x":
        kern = MINUS + ("" if w == 1 else str(w)) + "x"
    elif art == "add_x":
        kern = "+" + ("" if w == 1 else str(w)) + "x"
    elif art == "div":
        kern = ":" + str(w)
    elif art == "mul":
        kern = MAL + str(w)
    else:
        kern = "?"
    wo = {"beide": "auf beiden Seiten", "links": "nur links",
          "rechts": "nur rechts"}[seite]
    return kern + " " + wo


def _klick_op(page, op):
    """Klickt den Operations-Button mit exakt passender Beschriftung.

    Wartet vorher, bis die Buttons freigegeben sind (die Kipp-Animation
    sperrt die Eingabe ~1,5 s -- auf die Freigabe warten statt sleep)."""
    page.wait_for_selector("#opLeiste button:not([disabled])", timeout=10000)
    label = _op_label(op)
    buttons = page.locator("#opLeiste button")
    for i in range(buttons.count()):
        if buttons.nth(i).inner_text().strip() == label:
            buttons.nth(i).click()
            return
    texte = [buttons.nth(i).inner_text() for i in range(buttons.count())]
    pytest.fail(f"Op-Button {label!r} nicht gefunden; vorhanden: {texte}")


def _naechster_zustand(page, zustand, op, stufe):
    """Berechnet den Folgezustand ueber die echte Logik der Seite."""
    return page.evaluate(
        "([z, op, neg]) => wende_an(z, op, neg)",
        [zustand, op, stufe == 5])


def _svg_zaehlung(page):
    """(Kisten, Gewichte) im Waage-SVG."""
    return (page.locator(".waage-svg .wg-kiste").count(),
            page.locator(".waage-svg .wg-gewicht").count())


def _mitschrift_zeilen(page):
    return page.locator("#mitschriftGleichung .mitschrift-zeile").count()


def _loese_aufgabe(page, aufgabe):
    """Loest die aktuelle Aufgabe komplett per Musterweg."""
    for op in aufgabe["musterweg"]:
        _klick_op(page, op)
    page.wait_for_selector("#feedbackBereich .feedback-richtig", timeout=5000)


def _weiter(page):
    page.click("#feedbackBereich #btnWeiter")


def _spiele_stufe(page, stufe_idx, falle_bei=(), falle_doppelt=False):
    """Spielt alle 6 Aufgaben einer Stufe per Musterweg durch.

    falle_bei: Aufgaben-Indizes, bei denen vorher die erste Falle geklickt wird
    (falle_doppelt: zweimal dieselbe -> Muster darf nur 1x je Aufgabe zaehlen)."""
    _starte_stufe(page, stufe_idx)
    anzahl = page.evaluate(f"STUFEN[{stufe_idx}].aufgaben.length")
    for i in range(anzahl):
        aufgabe = _aufgabe(page, stufe_idx, i)
        if i in falle_bei and aufgabe.get("fallen_ops"):
            falle = aufgabe["fallen_ops"][0]
            for _ in range(2 if falle_doppelt else 1):
                _klick_op(page, falle["op"])
                page.wait_for_selector("#feedbackBereich .feedback-falsch",
                                       timeout=5000)
        _loese_aufgabe(page, aufgabe)
        _weiter(page)
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


def test_korrekte_operation(page):
    """Erster Musterweg-Schritt (Stufe 1) -> Mitschrift +1, SVG zeigt den
    per wende_an() berechneten Folgezustand (Kisten-/Gewichte-Anzahl)."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 0)
    aufgabe = _aufgabe(page, 0, 0)
    op = aufgabe["musterweg"][0]
    neu = _naechster_zustand(page, aufgabe["start"], op, aufgabe["stufe"])
    assert "fehler" not in neu, f"Musterweg-Schritt scheitert: {neu}"

    assert _mitschrift_zeilen(page) == 1, "Mitschrift startet nicht mit 1 Zeile"
    _klick_op(page, op)
    assert _mitschrift_zeilen(page) == 2, "Mitschrift waechst nicht um 1 Zeile"

    kisten, gewichte = _svg_zaehlung(page)
    assert kisten == neu["xL"] + neu["xR"], \
        f"Kisten im SVG: {kisten}, erwartet {neu['xL'] + neu['xR']}"
    assert gewichte == neu["cL"] + neu["cR"], \
        f"Gewichte im SVG: {gewichte}, erwartet {neu['cL'] + neu['cR']}"
    assert count_katex_errors(page) == 0, "KaTeX-Render-Fehler auf der Seite"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_einseitige_operation(page):
    """Einseitige Op -> Kipp-Feedback mit Mustertext, Mitschrift und SVG
    unveraendert (nach Animationsende), danach normal loesbar."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 0)
    aufgabe = _aufgabe(page, 0, 0)
    falle = aufgabe["fallen_ops"][0]
    assert falle["op"]["seite"] != "beide", "w1-01 muss eine einseitige Falle haben"
    vorher = _svg_zaehlung(page)

    _klick_op(page, falle["op"])
    page.wait_for_selector("#feedbackBereich .feedback-falsch", timeout=5000)
    feedback = page.locator("#feedbackBereich").inner_text()
    assert "kippt" in feedback, f"kein Kipp-Feedback: {feedback!r}"
    assert falle["text"][:30] in feedback, \
        f"Fallen-Text fehlt im Feedback: {falle['text'][:30]!r}"

    # Kipp-Animation sperrt die Eingabe ~1,5 s -> auf Freigabe warten
    page.wait_for_selector("#opLeiste button:not([disabled])", timeout=10000)
    assert _mitschrift_zeilen(page) == 1, "Mitschrift trotz Fehl-Op gewachsen"
    assert _svg_zaehlung(page) == vorher, "SVG-Zustand trotz Fehl-Op veraendert"

    _loese_aufgabe(page, aufgabe)
    assert "x =" in page.locator("#feedbackBereich").inner_text()
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_distraktor_add_und_mul(page):
    """Distraktoren add_c (Stufe 1) und mul (Stufe 2): Zustand unveraendert,
    Feedback zeigt den kuratierten Gegenoperation-Text."""
    errors = setup_console_error_capture(page)
    _lade(page)

    # add_c: Stufe 1, Aufgabe 2 (erst Aufgabe 1 loesen)
    _starte_stufe(page, 0)
    _loese_aufgabe(page, _aufgabe(page, 0, 0))
    _weiter(page)
    aufgabe = _aufgabe(page, 0, 1)
    falle = aufgabe["fallen_ops"][0]
    assert falle["op"]["art"] == "add_c" and falle["muster"] == "gegenoperation"
    _klick_op(page, falle["op"])
    page.wait_for_selector("#feedbackBereich .feedback-falsch", timeout=5000)
    assert falle["text"][:30] in page.locator("#feedbackBereich").inner_text()
    assert _mitschrift_zeilen(page) == 1, "add_c-Distraktor hat den Zustand veraendert"

    # mul: Stufe 2, Aufgabe 1
    page.reload(wait_until="networkidle")
    page.wait_for_selector("#startScreen .stufe-karte", timeout=10000)
    _starte_stufe(page, 1)
    aufgabe = _aufgabe(page, 1, 0)
    falle = aufgabe["fallen_ops"][0]
    assert falle["op"]["art"] == "mul" and falle["muster"] == "gegenoperation"
    vorher = _svg_zaehlung(page)
    _klick_op(page, falle["op"])
    page.wait_for_selector("#feedbackBereich .feedback-falsch", timeout=5000)
    assert falle["text"][:30] in page.locator("#feedbackBereich").inner_text()
    assert _svg_zaehlung(page) == vorher, "mul-Distraktor hat den Zustand veraendert"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_aufgabe_komplett_loesen(page):
    """Aufgabe per Musterweg loesen -> 'x = N'-Erfolg + Weiter-Button."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 2)
    aufgabe = _aufgabe(page, 2, 0)
    loesung = page.evaluate("(a) => loesung(a)", aufgabe)

    _loese_aufgabe(page, aufgabe)
    feedback = page.locator("#feedbackBereich").inner_text()
    erwartet = "x = " + str(int(loesung) if loesung == int(loesung) else loesung)
    assert erwartet in feedback.replace(MINUS, "-"), \
        f"{erwartet!r} fehlt im Erfolgs-Feedback: {feedback!r}"
    assert page.locator("#feedbackBereich #btnWeiter").is_visible(), \
        "Weiter-Button fehlt nach dem Loesen"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_tab_sync(page):
    """EIS-Sync: Schritt im Gleichung-Tab aktualisiert die Waage,
    Schritt im Skizze-Tab laesst die Mitschrift wachsen."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 3)  # Stufe 4: mehrere Schritte
    aufgabe = _aufgabe(page, 3, 0)
    op1, op2 = aufgabe["musterweg"][0], aufgabe["musterweg"][1]
    z1 = _naechster_zustand(page, aufgabe["start"], op1, aufgabe["stufe"])
    z2 = _naechster_zustand(page, z1, op2, aufgabe["stufe"])

    # Schritt 1 im Gleichung-Tab -> Waage-Tab zeigt den neuen Zustand
    page.click("#tabGleichung")
    page.wait_for_selector("#panelGleichung:not([hidden])", timeout=5000)
    _klick_op(page, op1)
    page.click("#tabWaage")
    page.wait_for_selector("#panelWaage:not([hidden])", timeout=5000)
    kisten, gewichte = _svg_zaehlung(page)
    assert kisten == z1["xL"] + z1["xR"], f"Waage nicht synchron: {kisten} Kisten"
    assert gewichte == z1["cL"] + z1["cR"], f"Waage nicht synchron: {gewichte} Gewichte"

    # Schritt 2 im Skizze-Tab -> Mitschrift waechst auf 3 Zeilen
    page.click("#tabSkizze")
    page.wait_for_selector("#panelSkizze:not([hidden])", timeout=5000)
    _klick_op(page, op2)
    assert _mitschrift_zeilen(page) == 3, "Mitschrift nicht synchron zum Skizze-Schritt"
    kisten_sk = page.locator("#skizzeWrap .sk-kiste").count()
    assert kisten_sk == z2["xL"] + z2["xR"], "Skizze nicht synchron"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_stufe5_sperre_und_negativ(page):
    """Stufe 5: Waage-Tab disabled, Hinweis sichtbar, Default-Tab Gleichung;
    Negativ-Bruch-Aufgabe (x = -1,5) loesbar mit Komma-Darstellung."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 4)
    assert page.locator("#tabWaage").is_disabled(), "Waage-Tab nicht gesperrt"
    assert page.locator("#stufe5Hinweis").is_visible(), "Stufe-5-Hinweis fehlt"
    assert "aktiv" in page.locator("#tabGleichung").get_attribute("class"), \
        "Gleichung ist nicht der Default-Tab in Stufe 5"
    assert page.locator(".waage-svg").count() == 0, "SVG-Waage trotz Stufe 5 gebaut"

    # Aufgabe 1 loesen, dann Aufgabe 2 (2x + 5 = 2 -> x = -1,5)
    _loese_aufgabe(page, _aufgabe(page, 4, 0))
    _weiter(page)
    aufgabe = _aufgabe(page, 4, 1)
    loesung = page.evaluate("(a) => loesung(a)", aufgabe)
    assert loesung == -1.5, "w5-02 muss x = -1,5 liefern (Katalog geaendert?)"
    _loese_aufgabe(page, aufgabe)
    feedback = page.locator("#feedbackBereich").inner_text()
    assert "1,5" in feedback, f"Komma-Darstellung fehlt: {feedback!r}"
    assert MINUS + "1,5" in feedback, f"Minuszeichen fehlt: {feedback!r}"
    assert "ohne Waage" in feedback, "Stufe-5-Erfolgstext fehlt"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_hilfe_nach_drei_fehlops(page):
    """3 Fehl-Ops -> 'Zeig mir den naechsten Schritt' erscheint; Klick fuehrt
    den Schritt aus (Mitschrift +1); Auswertung zaehlt 'mit Hilfe'."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 0)
    _loese_aufgabe(page, _aufgabe(page, 0, 0))
    _weiter(page)

    # Aufgabe 2 (w1-02): add_c-Distraktor sperrt nicht (kein Kipp) -> 3x klicken
    aufgabe = _aufgabe(page, 0, 1)
    falle_op = aufgabe["fallen_ops"][0]["op"]
    assert not page.locator("#btnNaechsterSchritt").is_visible(), \
        "Hilfe-Button schon vor Fehl-Ops sichtbar"
    for _ in range(3):
        _klick_op(page, falle_op)
        page.wait_for_selector("#feedbackBereich .feedback-falsch", timeout=5000)
    page.wait_for_selector("#btnNaechsterSchritt:not([hidden])", timeout=5000)
    assert page.locator("#btnNaechsterSchritt").is_visible(), \
        "Hilfe-Button nach 3 Fehl-Ops nicht sichtbar"

    page.click("#btnNaechsterSchritt")
    assert _mitschrift_zeilen(page) == 2, "Hilfe-Schritt nicht ausgefuehrt"
    # w1-02 ist einschrittig -> direkt geloest, als 'mit Hilfe' markiert
    page.wait_for_selector("#feedbackBereich .feedback-richtig", timeout=5000)
    assert "zeigen lassen" in page.locator("#feedbackBereich").inner_text(), \
        "Erfolgstext markiert die Hilfe-Nutzung nicht"
    _weiter(page)

    # Rest der Stufe selbst loesen -> Auswertung: 5 von 6 selbst, 1 mit Hilfe
    anzahl = page.evaluate("STUFEN[0].aufgaben.length")
    for i in range(2, anzahl):
        _loese_aufgabe(page, _aufgabe(page, 0, i))
        _weiter(page)
    page.wait_for_selector("#auswertungScreen:not([hidden])", timeout=5000)
    text = page.locator("#auswertungInhalt").inner_text()
    assert f"5 von {anzahl} Aufgaben hast du selbst" in text, \
        f"Selbst-geloest-Zaehler falsch: {text!r}"
    assert "zeigen lassen" in text, f"Hilfe-Nutzung fehlt in der Auswertung: {text!r}"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_stufen_ende_auswertung(page):
    """Dieselbe Falle in ZWEI Aufgaben provozieren -> Muster zaehlt 2x,
    keine %/Punkte, Empfehlungs-Links (Schwelle >= 2) existieren im Dateisystem."""
    errors = setup_console_error_capture(page)
    _lade(page)
    # Stufe 3 (Index 2): fallen_ops[0] ist in Aufgabe 1 UND 2 'zu-frueh-teilen'
    _spiele_stufe(page, 2, falle_bei=(0, 1))

    text = page.locator("#auswertungScreen").inner_text()
    assert "%" not in text, "Auswertung enthaelt Prozentangabe"
    assert "Punkt" not in text, "Auswertung enthaelt Punktangabe"

    inhalt = page.locator("#auswertungInhalt").inner_text()
    assert "2x " in inhalt, \
        f"Falle in zwei Aufgaben muss 2x zaehlen: {inhalt!r}"
    anzahl = page.evaluate("STUFEN[2].aufgaben.length")
    assert f"Alle {anzahl} Aufgaben hast du selbst" in inhalt, \
        f"Erfolgsstand 'Alle {anzahl}' fehlt (Fallen zaehlen nicht als Hilfe): {inhalt!r}"

    links = page.locator("#auswertungInhalt .empfehlung-block a")
    assert links.count() >= 1, "kein Empfehlungs-Link trotz 2x provozierter Falle"
    hrefs = set()
    for i in range(links.count()):
        href = links.nth(i).get_attribute("href")
        assert href not in hrefs, f"Empfehlungs-Link doppelt: {href}"
        hrefs.add(href)
        ziel = (SPIEL.parent / href).resolve()
        assert ziel.is_file(), f"Empfehlungs-Ziel fehlt im Dateisystem: {href}"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_einzelfalle_ohne_empfehlungslink(page):
    """1 Fallen-Vorkommen (auch 2x geklickt = 1x je Aufgabe) bei komplett selbst
    geloester Stufe -> Muster gelistet, aber KEIN Empfehlungs-Link (Schwelle).
    Prueft zugleich die Eskalations-Zusatzzeile beim 2. Klick derselben Falle."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 2)
    aufgabe = _aufgabe(page, 2, 0)
    falle = aufgabe["fallen_ops"][0]
    _klick_op(page, falle["op"])
    page.wait_for_selector("#feedbackBereich .feedback-falsch", timeout=5000)
    assert "gleiche Falle" not in page.locator("#feedbackBereich").inner_text(), \
        "Eskalations-Zeile schon beim 1. Fehler"
    _klick_op(page, falle["op"])
    page.wait_for_selector("#feedbackBereich .feedback-falsch", timeout=5000)
    assert "gleiche Falle" in page.locator("#feedbackBereich").inner_text(), \
        "Eskalations-Zeile fehlt beim 2. gleichen Fehler"

    anzahl = page.evaluate("STUFEN[2].aufgaben.length")
    for i in range(anzahl):
        _loese_aufgabe(page, _aufgabe(page, 2, i))
        _weiter(page)
    page.wait_for_selector("#auswertungScreen:not([hidden])", timeout=5000)

    inhalt = page.locator("#auswertungInhalt").inner_text()
    assert "1x " in inhalt and "2x " not in inhalt, \
        f"Falle muss pro Aufgabe genau 1x zaehlen: {inhalt!r}"
    assert f"Alle {anzahl} Aufgaben hast du selbst" in inhalt, \
        f"Erfolgsstand 'Alle {anzahl}' fehlt: {inhalt!r}"
    assert page.locator("#auswertungInhalt .auswertung-liste li").count() >= 1, \
        "Muster-Liste fehlt trotz Falle"
    assert page.locator("#auswertungInhalt .empfehlung-block a").count() == 0, \
        "Empfehlungs-Link trotz nur 1 Vorkommen bei komplett selbst geloester Stufe"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_einseitiger_button_ueberall(page):
    """Jede Aufgabe der Stufe 1 bietet mindestens einen einseitigen Button an;
    der abgeleitete Button (Aufgabe ohne einseitige Daten-Falle) liefert
    Kipp-Feedback mit einseitig-Diagnose."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _starte_stufe(page, 0)
    anzahl = page.evaluate("STUFEN[0].aufgaben.length")
    for i in range(anzahl):
        hat_einseitig = page.evaluate(
            "Array.from(document.querySelectorAll('#opLeiste button'))"
            ".some(b => b.textContent.includes('nur links')"
            " || b.textContent.includes('nur rechts'))")
        assert hat_einseitig, f"Aufgabe {i + 1} ohne einseitigen Button"
        if i == 1:
            # w1-02 hat KEINE einseitige Daten-Falle -> abgeleiteter Button
            # (erste Standard-Op 'nur links') muss Kipp + einseitig liefern
            aufgabe = _aufgabe(page, 0, i)
            assert all(f["op"]["seite"] == "beide" for f in aufgabe["fallen_ops"]), \
                "w1-02 sollte keine einseitige Daten-Falle haben (Katalog geaendert?)"
            _klick_op(page, {"art": "sub_c", "wert": 3, "seite": "links"})
            page.wait_for_selector("#feedbackBereich .feedback-falsch", timeout=5000)
            feedback = page.locator("#feedbackBereich").inner_text()
            assert "kippt" in feedback, f"kein Kipp-Feedback: {feedback!r}"
            assert "nur eine Seite" in feedback, \
                f"generischer einseitig-Text fehlt: {feedback!r}"
        _loese_aufgabe(page, _aufgabe(page, 0, i))
        _weiter(page)
    page.wait_for_selector("#auswertungScreen:not([hidden])", timeout=5000)
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_letzte_stufe_kein_weiter_button(page):
    """Regression: Nach Stufe 5 (Index 4) darf kein 'Weiter zu Stufe 6'-Button
    sichtbar sein (spirale.css .btn-weiter ueberstimmt sonst [hidden])."""
    errors = setup_console_error_capture(page)
    _lade(page)
    _spiele_stufe(page, 4)

    assert not page.locator("#btnNaechsteStufe").is_visible(), \
        "Weiter-Button nach der letzten Stufe sichtbar"
    assert page.locator("#btnNaechsteStufe").evaluate(
        "e => getComputedStyle(e).display") == "none", \
        "btnNaechsteStufe hat kein display:none (spirale.css-Falle)"
    assert page.locator("#btnStufenwahl").is_visible(), "Stufenwahl-Button fehlt"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_localstorage_bleibt_leer(page):
    """Vor und nach einer komplett gespielten Stufe: kein localStorage-Eintrag."""
    errors = setup_console_error_capture(page)
    _lade(page)
    assert page.evaluate("Object.keys(localStorage).length") == 0, \
        "localStorage schon beim Laden befuellt"
    _spiele_stufe(page, 0, falle_bei=(0,))
    assert page.evaluate("Object.keys(localStorage).length") == 0, \
        "Spiel schreibt in localStorage"
    assert not kritische_fehler(errors), f"Konsolenfehler: {kritische_fehler(errors)}"


def test_node_logiktests_gruen():
    """Regression: node spiele/_test_waage_logik.js weiterhin gruen."""
    node = shutil.which("node")
    if not node:
        pytest.skip("node nicht im PATH")
    ergebnis = subprocess.run(
        [node, str(REPO / "spiele" / "_test_waage_logik.js")],
        capture_output=True, text=True, timeout=60)
    assert ergebnis.returncode == 0, \
        f"Node-Logiktests rot:\n{ergebnis.stdout}\n{ergebnis.stderr}"

"""P3 - Fehlertyp-Reflexion (Didaktik-Pattern 3) in den DiffEngine-Trainern.

Wer Level 6 einmal erreicht hat, bekommt im Feedback den Knopf "Runde beenden & Rueckblick".
Der Rueckblick zeigt jede Level-6-Aufgabe dieser Runde mit ganzer Frage und aufklappbarem
Loesungsweg; je Aufgabe ordnet man ein (Konnte ich / Rechenfehler / Keine Idee), der
Sammelbalken zaehlt mit und gibt ab drei Einordnungen eine Empfehlung.

Seit 04/2026 (Pilot: tests/test_p3_pilot.py, durch diese Datei ersetzt). Am 2026-10-18 beim
Uebernehmen nach Ref4OHG ueberarbeitet; das Modul ist seitdem in beiden Repos dieselbe Datei.
Korrigiert wurde:
  - gesammelt wird die Aufgabe, die auf Level 6 gestellt war (vorher: jede Aufgabe, NACH der
    man auf Level 6 stand - also auch die Level-5-Aufgabe beim Aufstieg, nicht aber die
    Level-6-Aufgabe beim Abstieg),
  - die Frage steht ganz da (vorher nach 120 Zeichen abgeschnitten, oft mitten im Satz),
    der Loesungsweg ist aufklappbar,
  - bei offenem Rueckblick wirken Enter und Zifferntasten nicht mehr auf die versteckte Aufgabe,
  - "Fortschritt zuruecksetzen" loescht auch die P3-Daten,
  - Einordnungen haengen an der Aufgabe (id@ts), nicht an ihrer Position in der Historie,
  - Ref4OHG hat einen eigenen Namensraum (data-sammlung="ref4ohg"), weil beide unter
    nachbar-blip.github.io einen localStorage teilen; die DiffEngine behaelt die alten Keys,
    damit Level-6-Flag und Runde der Schueler erhalten bleiben.
"""

import json
import re
from pathlib import Path

import pytest
from helpers import load_trainer, beantworte_aufgabe

ROOT = Path(__file__).resolve().parent.parent
PILOT = "9-func-quadratisch.html"
KEY = PILOT[:-5]


# --- Hilfen ---------------------------------------------------------------

def _ls_set(page, key, value):
    page.evaluate("([k, v]) => localStorage.setItem(k, v)", [key, value])


def _ls_get(page, key):
    raw = page.evaluate("k => localStorage.getItem(k)", key)
    return json.loads(raw) if raw else None


def _starte(page, level=6, streak=0, wrong=0, erreicht=True, historie=None):
    """Laedt den Pilot-Trainer mit gesetztem Engine- und P3-Zustand."""
    load_trainer(page, PILOT)
    _ls_set(page, f"spirale-{KEY}", json.dumps({
        "level": level, "streak": streak, "wrongStreak": wrong,
        "answered": [], "totalCorrect": 0, "totalAttempts": 0}))
    if erreicht:
        _ls_set(page, f"p3-level6-reached-{KEY}", "true")
    if historie is not None:
        _ls_set(page, f"p3-history-{KEY}", json.dumps(historie))
    page.reload(wait_until="networkidle")
    page.wait_for_selector("#app .aufgabe-karte", timeout=10000)


def _aufgabe(page, nr):
    return page.evaluate(f"AUFGABEN.find(a => a.id === {nr})")


def _aktuelle(page):
    return page.evaluate("window.spiraleAktuelleAufgabe()")


def _engine_level(page):
    return page.evaluate("JSON.parse(localStorage.getItem('spirale-' + THEMA_KEY)).level")


def _falsch_beantworten(page):
    a = _aktuelle(page)
    if a["typ"] == "mc":
        falsch = next(i for i in range(len(a["optionen"])) if i != a["korrekt"])
        page.query_selector_all(".mc-option")[falsch].click()
    else:
        page.fill("#antwortInput", "-987654321")
        page.click("#btnPruefen")
    page.wait_for_selector("#feedback[style*='block']", timeout=5000)


def _oeffne_rueckblick(page):
    """Wie ein Schueler: eine Aufgabe beantworten, dann den Knopf im Feedback klicken."""
    if not page.query_selector("#btnSessionEnden"):
        _falsch_beantworten(page)
    page.click("#btnSessionEnden")
    page.wait_for_selector("#p3Rueckblick")


# --- Einbindung in allen Trainern (ohne Browser) --------------------------

TRAINER = sorted((ROOT / "trainer").glob("*.html"))


@pytest.mark.parametrize("datei", TRAINER, ids=[p.stem for p in TRAINER])
def test_p3_in_jedem_trainer_eingebunden(datei):
    roh = datei.read_text(encoding="utf-8")
    kopf = re.search(r"const THEMA_CONFIG\s*=\s*\{[^}]*\}", roh).group(0)
    assert "p3Enabled: true" in kopf, kopf
    p3 = roh.find('<script src="../p3-reflexion.js"></script>')
    engine = roh.find('<script src="../spirale-engine.js"></script>')
    assert p3 != -1, "p3-reflexion.js fehlt"
    assert p3 < engine, "p3-reflexion.js muss vor spirale-engine.js geladen werden"


def test_engine_ruft_p3_haken():
    js = (ROOT / "spirale-engine.js").read_text(encoding="utf-8")
    assert "window.P3.onAnswered" in js
    assert "window.P3.renderSessionEndButton" in js
    assert "window.spiraleRenderMath" in js


# --- Modul ----------------------------------------------------------------

def test_p3_aktiv(page):
    load_trainer(page, PILOT)
    assert page.evaluate("typeof window.P3 === 'object' && THEMA_CONFIG.p3Enabled === true")


def test_ohne_flag_inaktiv(page):
    """Ein Trainer ohne p3Enabled bleibt ohne P3 (Schalter fuer Ausnahmen)."""
    load_trainer(page, PILOT)
    art = page.evaluate("""() => {
        delete window.P3;
        THEMA_CONFIG.p3Enabled = false;
        return fetch('../p3-reflexion.js').then(r => r.text())
            .then(t => { (0, eval)(t); return typeof window.P3; });
    }""")
    assert art == "undefined"


# --- Was gesammelt wird (echter Durchlauf durch die Engine) ---------------

def test_level6_aufgabe_wird_gesammelt(page):
    _starte(page, level=6, erreicht=False)
    a = _aktuelle(page)
    assert beantworte_aufgabe(page, a)
    hist = _ls_get(page, f"p3-history-{KEY}")
    assert [(h["id"], h["correct"]) for h in hist] == [(a["id"], True)]
    assert page.query_selector("#feedback #btnSessionEnden"), "Knopf muss im Feedback stehen"


def test_aufstieg_mit_level5_aufgabe_wird_nicht_gesammelt(page):
    """Die Aufgabe, mit der man auf Level 6 aufsteigt, ist eine Level-5-Aufgabe."""
    _starte(page, level=5, streak=1, erreicht=False)
    assert beantworte_aufgabe(page, _aktuelle(page))
    assert _engine_level(page) == 6
    assert not _ls_get(page, f"p3-history-{KEY}")
    assert _ls_get(page, f"p3-level6-reached-{KEY}") is True, "Level 6 erreicht -> Knopf frei"
    assert page.query_selector("#btnSessionEnden")


def test_abstieg_mit_level6_aufgabe_wird_gesammelt(page):
    """Zweimal falsch auf Level 6 -> zurueck auf 5; die Level-6-Aufgabe gehoert in den Rueckblick."""
    _starte(page, level=6, wrong=1)
    a = _aktuelle(page)
    _falsch_beantworten(page)
    assert _engine_level(page) == 5
    hist = _ls_get(page, f"p3-history-{KEY}")
    assert [(h["id"], h["correct"]) for h in hist] == [(a["id"], False)]
    assert page.query_selector("#btnSessionEnden"), "Knopf bleibt nach dem Abstieg"


def test_kein_knopf_vor_level6(page):
    _starte(page, level=3, erreicht=False)
    _falsch_beantworten(page)
    assert page.query_selector("#btnSessionEnden") is None


def test_historie_hoechstens_50(page):
    load_trainer(page, PILOT)
    page.evaluate("""() => { for (let i = 0; i < 55; i++)
        window.P3.onAnswered({aufgabeId: i, correct: true, level: 6, levelVor: 6, levelNach: 6}); }""")
    hist = _ls_get(page, f"p3-history-{KEY}")
    assert len(hist) == 50 and hist[0]["id"] == 5 and hist[-1]["id"] == 54


def test_speicher_voll_kein_absturz(page):
    load_trainer(page, PILOT)
    page.evaluate("""() => {
        const orig = Storage.prototype.setItem;
        Storage.prototype.setItem = function () { throw new Error('QuotaExceeded'); };
        try { window.P3.onAnswered({aufgabeId: 31, correct: true, level: 6, levelVor: 6, levelNach: 6}); }
        finally { Storage.prototype.setItem = orig; }
    }""")


# --- Rueckblick -----------------------------------------------------------

def test_rueckblick_zeigt_ganze_frage_mit_formeln(page):
    load_trainer(page, PILOT)
    ids = page.evaluate("AUFGABEN.filter(a => a.level === 6).map(a => a.id)")
    laengste = max(ids, key=lambda i: len(_aufgabe(page, i)["frage"]))
    _starte(page, historie=[{"id": laengste, "correct": False, "ts": 1}])
    _oeffne_rueckblick(page)
    kachel = page.query_selector(".p3-kachel[data-idx='0']")
    text = kachel.query_selector(".p3-kachel-frage").inner_text()
    assert "…" not in text
    frage = _aufgabe(page, laengste)["frage"]
    ende = re.sub(r"\\\(.*?\\\)|<[^>]+>", " ", frage).split()[-1]
    assert text.rstrip().endswith(ende), (ende, text[-80:])
    assert kachel.query_selector_all(".p3-kachel-frage .katex"), "Formeln muessen gesetzt sein"
    assert not page.query_selector("#p3Rueckblick .katex-error")
    assert "\\(" not in page.inner_text("#p3Rueckblick")


def test_rueckblick_nutzt_formelsatz_der_engine(page):
    """Die Engine setzt Formeln mit haltFormelnZusammen - im Rueckblick genauso."""
    _starte(page, historie=[{"id": 31, "correct": True, "ts": 1}])
    _oeffne_rueckblick(page)
    assert page.query_selector(".p3-kachel-frage .formel")


def test_loesungsweg_aufklappbar(page):
    _starte(page, historie=[{"id": 34, "correct": False, "ts": 1}])
    _oeffne_rueckblick(page)
    details = page.query_selector(".p3-kachel[data-idx='0'] details.p3-loesungsweg")
    assert details and not details.evaluate("d => d.open"), "zu Beginn zugeklappt"
    details.query_selector("summary").click()
    assert details.evaluate("d => d.open")
    inhalt = details.query_selector(".p3-loesungsweg-text")
    assert inhalt.is_visible() and inhalt.query_selector(".katex")


def test_leere_runde_zeigt_hinweis(page):
    _starte(page, level=5, historie=[])
    _oeffne_rueckblick(page)            # Level-5-Aufgabe beantwortet: nichts gesammelt
    assert page.query_selector("#p3Rueckblick .p3-leer-hinweis")
    assert not page.query_selector(".p3-kachel")


def test_einordnen_zaehlen_und_aendern(page):
    _starte(page, historie=[{"id": 31, "correct": True, "ts": 1}])
    _oeffne_rueckblick(page)
    k = ".p3-kachel[data-idx='0'] "
    page.click(k + ".p3-ft-btn[data-typ='rechenfehler']")
    assert page.text_content("#p3-z-rechenfehler") == "1"
    assert page.get_attribute(k + ".p3-ft-btn[data-typ='rechenfehler']", "aria-pressed") == "true"
    page.click(k + ".p3-ft-btn[data-typ='idee']")
    assert page.text_content("#p3-z-rechenfehler") == "0"
    assert page.text_content("#p3-z-idee") == "1"
    assert page.get_attribute(k + ".p3-ft-btn[data-typ='rechenfehler']", "aria-pressed") == "false"
    assert _ls_get(page, f"p3-reflexion-{KEY}") == {"31@1": "idee"}


@pytest.mark.parametrize("typ,erwartet", [
    ("idee", "Verständnis"), ("rechenfehler", "Rechenfehler"), ("richtig", "Läuft")])
def test_empfehlung_ab_drei(page, typ, erwartet):
    _starte(page, level=5, historie=[{"id": i, "correct": True, "ts": i} for i in (31, 32, 33)])
    _oeffne_rueckblick(page)            # Level 5: die Antwort kommt nicht dazu, es bleiben drei
    for idx in range(3):
        assert page.text_content("#p3Empfehlung") == ""
        page.click(f".p3-kachel[data-idx='{idx}'] .p3-ft-btn[data-typ='{typ}']")
    text = page.text_content("#p3Empfehlung")
    assert erwartet in text, text
    assert "höher" not in text, "Auf Level 6 gibt es keine hoehere Stufe"


def test_zurueck_raeumt_runde_und_behaelt_fortschritt(page):
    _starte(page, historie=[{"id": 31, "correct": True, "ts": 1}])
    _oeffne_rueckblick(page)
    page.click(".p3-kachel[data-idx='0'] .p3-ft-btn[data-typ='richtig']")
    vorher = _engine_level(page)
    page.click("#btnZurueckZumTraining")
    assert _ls_get(page, f"p3-history-{KEY}") is None
    assert _ls_get(page, f"p3-reflexion-{KEY}") is None
    assert _ls_get(page, f"p3-level6-reached-{KEY}") is True
    assert page.query_selector("#p3Rueckblick") is None
    assert page.is_visible(".aufgabe-karte")
    assert _engine_level(page) == vorher


def test_zurueck_knopf_ist_gestaltet(page):
    _starte(page, historie=[{"id": 31, "correct": True, "ts": 1}])
    _oeffne_rueckblick(page)
    hg = page.evaluate("getComputedStyle(document.getElementById('btnZurueckZumTraining')).backgroundImage")
    assert "gradient" in hg, "Zurueck-Knopf sieht aus wie ein Browser-Standardknopf"


def test_reload_im_rueckblick(page):
    _starte(page, historie=[{"id": 31, "correct": True, "ts": 1}])
    _oeffne_rueckblick(page)
    page.reload(wait_until="networkidle")
    page.wait_for_selector("#app .aufgabe-karte")
    assert page.query_selector("#p3Rueckblick") is None
    assert len(_ls_get(page, f"p3-history-{KEY}")) == 2   # 31 + die eben beantwortete


# --- Tasten bei offenem Rueckblick ----------------------------------------

def test_tasten_wirken_nicht_auf_versteckte_aufgabe(page):
    _starte(page, historie=[{"id": 31, "correct": True, "ts": 1}])
    _falsch_beantworten(page)
    vorher = (_aktuelle(page)["id"], page.evaluate("localStorage.getItem('spirale-' + THEMA_KEY)"))
    page.click("#btnSessionEnden")
    page.wait_for_selector("#p3Rueckblick")
    page.wait_for_timeout(450)          # Sperrfrist der Engine nach einer Antwort abgelaufen
    page.evaluate("document.activeElement && document.activeElement.blur()")
    for taste in ("Enter", "ArrowRight", "1", "2", "t"):
        page.keyboard.press(taste)
    assert page.query_selector("#p3Rueckblick"), "Rueckblick muss offen bleiben"
    nachher = (_aktuelle(page)["id"], page.evaluate("localStorage.getItem('spirale-' + THEMA_KEY)"))
    assert nachher == vorher


def test_enter_auf_rueckblick_knopf_oeffnet_rueckblick(page):
    _starte(page, historie=[{"id": 31, "correct": True, "ts": 1}])
    _falsch_beantworten(page)
    page.wait_for_timeout(450)
    vorher = _aktuelle(page)["id"]
    page.focus("#btnSessionEnden")
    page.keyboard.press("Enter")
    page.wait_for_selector("#p3Rueckblick", timeout=3000)
    assert _aktuelle(page)["id"] == vorher, "Enter auf dem Knopf darf nicht weiterschalten"


# --- Darstellung ----------------------------------------------------------

def test_handy_layout(page):
    page.set_viewport_size({"width": 360, "height": 800})
    _starte(page, historie=[{"id": 35, "correct": True, "ts": 1}])
    _oeffne_rueckblick(page)
    spalten = page.evaluate("getComputedStyle(document.querySelector('.p3-balken')).gridTemplateColumns")
    assert len(spalten.split()) == 1
    assert page.evaluate("getComputedStyle(document.querySelector('.p3-kachel-buttons')).flexDirection") == "column"
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Seite schiebt waagerecht"


def test_keine_konsolenfehler(page):
    fehler = []
    page.on("console", lambda m: fehler.append(m.text) if m.type == "error" else None)
    _starte(page, historie=[{"id": i, "correct": i % 2 == 0, "ts": i} for i in (31, 32, 33, 34, 35, 36)])
    _oeffne_rueckblick(page)
    for d in page.query_selector_all("details.p3-loesungsweg summary"):
        d.click()
    assert not fehler, fehler


# --- Befunde aus dem Review vom 2026-10-18 --------------------------------

def test_ref4ohg_runde_bleibt_draussen(page):
    """Ref4OHG legt seine P3-Daten unter p3-ref4ohg-* ab (gleicher Origin); die DiffEngine
    liest sie nicht."""
    fremd = [{"id": 999, "correct": True, "ts": 5}]
    load_trainer(page, PILOT)
    _ls_set(page, f"p3-ref4ohg-history-{KEY}", json.dumps(fremd))
    _ls_set(page, f"p3-ref4ohg-level6-reached-{KEY}", "true")
    _starte(page, level=3, erreicht=False)
    _falsch_beantworten(page)
    assert page.query_selector("#btnSessionEnden") is None
    assert _ls_get(page, f"p3-ref4ohg-history-{KEY}") == fremd


def test_fortschritt_zuruecksetzen_loescht_p3(page):
    page.on("dialog", lambda d: d.accept())
    _starte(page, historie=[{"id": 31, "correct": True, "ts": 1}])
    _oeffne_rueckblick(page)
    page.click(".p3-kachel[data-idx='0'] .p3-ft-btn[data-typ='richtig']")
    page.click("#btnReset")
    page.wait_for_selector("#app .aufgabe-karte")
    assert page.query_selector("#p3Rueckblick") is None
    for art in ("history", "reflexion", "level6-reached"):
        assert _ls_get(page, f"p3-{art}-{KEY}") is None, art
    assert _engine_level(page) == 3
    _falsch_beantworten(page)
    assert page.query_selector("#btnSessionEnden") is None


def test_tipp_und_tastenhinweis_im_rueckblick_versteckt(page):
    _starte(page, historie=[{"id": 31, "correct": True, "ts": 1}])
    page.click("#btnTipp")
    _oeffne_rueckblick(page)
    for sel in ("#tippBox", "#btnTipp", ".keyboard-hint", ".aufgabe-karte", "#feedback"):
        el = page.query_selector(sel)
        assert el is None or not el.is_visible(), sel
    page.click("#btnZurueckZumTraining")
    assert page.is_visible(".aufgabe-karte") and page.is_visible(".keyboard-hint")


def test_einordnung_haengt_an_aufgabe_nicht_an_position(page):
    """Ueber 50 Eintraege faellt der aelteste heraus; die Einordnungen der uebrigen bleiben bei
    ihrer Aufgabe (vorher rutschten sie, nach dem Index geschluesselt, auf die Nachbarkachel)."""
    hist = [{"id": 31 + i % 6, "correct": True, "ts": 100 + i} for i in range(50)]
    _starte(page, historie=hist)
    _oeffne_rueckblick(page)              # Antwort auf Level 6: Eintrag 51, der aelteste faellt weg
    zweite = page.get_attribute(".p3-kachel[data-idx='1']", "data-key")
    page.click(".p3-kachel[data-idx='1'] .p3-ft-btn[data-typ='idee']")
    page.reload(wait_until="networkidle")
    page.wait_for_selector("#app .aufgabe-karte")
    _falsch_beantworten(page)             # noch ein Eintrag, wieder faellt der aelteste weg
    page.click("#btnSessionEnden")
    page.wait_for_selector("#p3Rueckblick")
    markiert = page.eval_on_selector_all(
        ".p3-ft-btn[aria-pressed='true']", "bs => bs.map(b => b.closest('.p3-kachel').dataset.key)")
    assert markiert == [zweite]
    assert page.text_content("#p3-z-idee") == "1"


def test_reload_stellt_einordnungen_wieder_her(page):
    _starte(page, level=5, historie=[{"id": 31, "correct": True, "ts": 1}, {"id": 32, "correct": False, "ts": 2}])
    _oeffne_rueckblick(page)
    page.click(".p3-kachel[data-idx='1'] .p3-ft-btn[data-typ='rechenfehler']")
    page.reload(wait_until="networkidle")
    page.wait_for_selector("#app .aufgabe-karte")
    _oeffne_rueckblick(page)
    assert page.get_attribute(".p3-kachel[data-idx='1'] .p3-ft-btn[data-typ='rechenfehler']", "aria-pressed") == "true"
    assert page.text_content("#p3-z-rechenfehler") == "1"


@pytest.mark.parametrize("historie,reflexion", [
    ("{}", "{}"), ("null", "null"), ("[1, null, {\"x\": 2}]", "[]"), ("kaputt", "kaputt")])
def test_kaputter_speicher_sperrt_nichts(page, historie, reflexion):
    fehler = []
    page.on("pageerror", lambda e: fehler.append(str(e)))
    _starte(page)
    _ls_set(page, f"p3-history-{KEY}", historie)
    _ls_set(page, f"p3-reflexion-{KEY}", reflexion)
    _oeffne_rueckblick(page)
    assert page.query_selector("#btnZurueckZumTraining")
    page.click("#btnZurueckZumTraining")
    assert page.is_visible(".aufgabe-karte")
    assert not fehler, fehler


def test_handy_mit_aufgeklappten_loesungswegen(page):
    page.set_viewport_size({"width": 360, "height": 800})
    _starte(page, level=5, historie=[{"id": i, "correct": True, "ts": i} for i in (31, 32, 33, 34, 35, 36)])
    _oeffne_rueckblick(page)
    for d in page.query_selector_all("details.p3-loesungsweg summary"):
        d.click()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    ragt = page.evaluate("""() => [...document.querySelectorAll('#p3Rueckblick .katex')].filter(f => {
        const k = f.closest('.p3-kachel').getBoundingClientRect();
        let clip = Infinity;
        for (let e = f.parentNode; e && !e.classList.contains('p3-kachel'); e = e.parentNode)
            if (getComputedStyle(e).overflowX !== 'visible') clip = Math.min(clip, e.getBoundingClientRect().right);
        return Math.min(f.getBoundingClientRect().right, clip) > k.right + 1;
    }).length""")
    assert ragt == 0

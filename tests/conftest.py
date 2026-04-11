"""Shared fixtures and trainer list for Playwright tests."""

import pytest
from playwright.sync_api import sync_playwright

BASE_URL = "https://nachbar-blip.github.io/differenzierungs-engine"

TRAINER_FILES = [
    "7-dreiecke-konstruktionen.html",
    "7-gleichungen-linear.html",
    "7-koerper-volumen.html",
    "7-kreise-umfang-flaeche.html",
    "7-prozent-anwendungen-zins.html",
    "7-prozent-grundaufgaben.html",
    "7-rat-zahlen-rechnen.html",
    "7-terme-vereinfachen.html",
    "7-wahrscheinlichkeit.html",
    "7-zuordnungen-proportional.html",
    "8-aehnlichkeit-streckung.html",
    "8-gleichungen-linear.html",
    "8-koerperberechnung.html",
    "8-kreise-winkel.html",
    "8-lineare-funktionen-anwendungen.html",
    "8-lineare-funktionen-grund.html",
    "8-pythagoras.html",
    "8-quadratwurzeln-reelle-zahlen.html",
    "8-terme-binomische-formeln.html",
    "8-zufallsversuche-mehrstufig.html",
    "9-func-gleich-hoehere-grade.html",
    "9-func-linear-wdh.html",
    "9-func-quadrat-anwendungen.html",
    "9-func-quadrat-gleichungen.html",
    "9-func-quadratisch.html",
    "9-log-rechnen.html",
    "9-pot-ganzzahlige-exp.html",
    "9-pot-gesetze.html",
    "9-pot-natuerliche-exp.html",
    "9-pot-wurzeln-rational.html",
    "9-pot-zehnerpotenzen.html",
    "9-stoch-haeufigkeiten.html",
    "9-stoch-histogramm-boxplot.html",
    "9-stoch-lage-streumass.html",
    "9-trig-anwendungen.html",
    "9-trig-identitaeten.html",
    "9-trig-rechtwinkliges-dreieck.html",
    "9-trig-sinus-kosinus-satz.html",
    "10-exp-funktionen.html",
    "10-exp-wachstum-zerfall.html",
    "10-func-lgs-2.html",
    "10-func-lgs-3-gauss.html",
    "10-log-funktionen.html",
    "10-stoch-erwartungswert.html",
    "10-stoch-verteilungen.html",
    "10-stoch-zufallsgroessen.html",
    "10-trig-cos-tan-funktion.html",
    "10-trig-einheitskreis.html",
    "10-trig-sin-cos-parameter.html",
    "10-trig-sinusfunktion.html",
    "10-vek-abhaengigkeit.html",
    "10-vek-ebene-raum.html",
    "10-vek-skalarprodukt.html",
    "10-vek-vektorprodukt.html",
    "11-analysis-ableitungsregeln.html",
    "11-analysis-extrempunkte-wendepunkte.html",
    "11-analysis-extremwertaufgaben.html",
    "11-analysis-funktionsbegriff.html",
    "11-analysis-grenzwerte.html",
    "11-analysis-kurvendiskussion.html",
    "11-analysis-monotonie-kruemmung.html",
    "11-analysis-steckbriefaufgaben.html",
    "11-analysis-tangenten-normalen.html",
    "11-lk-analysis-funktionsscharen.html",
    "11-lk-analysis-grenzwertsaetze.html",
    "11-lk-analysis-kettenregel.html",
    "11-lk-analysis-newton.html",
    "12-analysis-bestimmtes-integral.html",
    "12-analysis-flaechenberechnung.html",
    "12-analysis-stammfunktionen.html",
    "12-geom-abstaende.html",
    "12-geom-ebenen.html",
    "12-geom-geraden.html",
    "12-geom-kreis-lagebeziehungen.html",
    "12-geom-kreisgleichung.html",
    "12-geom-vektoren-wiederholung.html",
    "12-lk-analysis-ln-substitution.html",
    "12-lk-geom-ebene-ebene.html",
    "12-lk-geom-kreis-kreis.html",
    "12-lk-geom-tangenten.html",
    "12-lk-stoch-beurteilende-statistik.html",
    "12-lk-stoch-normalverteilung.html",
    "12-stoch-bedingte-wahrscheinlichkeit.html",
    "12-stoch-binomialverteilung.html",
    "12-stoch-grundlagen.html",
    "12-stoch-sigma-umgebungen.html",
    "12-stoch-zufallsgroessen.html",
]


@pytest.fixture(scope="session")
def browser():
    """Shared browser instance across all tests."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser):
    """Fresh browser context + page per test (isoliert localStorage)."""
    context = browser.new_context()
    page = context.new_page()
    yield page
    context.close()


def pytest_generate_tests(metafunc):
    """Parametrisiert alle Tests mit der Trainer-Liste."""
    if "trainer_file" in metafunc.fixturenames:
        metafunc.parametrize(
            "trainer_file",
            TRAINER_FILES,
            ids=[f.replace(".html", "") for f in TRAINER_FILES],
        )

"""Formelsatz in den Trainern: Formeln bleiben im Kasten und werden nicht zerrissen.

Geprueft wird an echten Aufgaben, bei 360 px (Handy) und 700 px, jeweils mit Tipp und
Loesungsweg. Die Ursachen liegen in spirale.css und spirale-engine.js, nicht in den
Aufgabentexten - deshalb genuegen wenige Aufgaben je Mangel:

  ragt     eine Formel ragt sichtbar aus ihrem Kasten (abgesetzte Formeln auf dem Handy)
  seite    die Seite laesst sich waagerecht schieben
  umbruch  eine Inline-Formel, die in den Kasten passt, laeuft ueber zwei Zeilen ("k <" / "0")
  zeichen  ein angeklebtes Zeichen steht in einer anderen Zeile als die Formel ("?" allein)
  eng      eine umbrochene Formel, deren Zeilen sich beruehren (Nenner stoesst auf den
           Zaehler der naechsten Zeile) - erst durch den Umbruch abgesetzter Formeln moeglich

Uebernommen aus Ref4OHG (gleiche Engine). Messung vor der Korrektur ueber alle 3631 Aufgaben
mit Formeln aus allen 103 Trainern (inkl. Kl. 5/6), je 360 und 700 px: ragt 511, seite 357,
umbruch 2214, zeichen 243 Befunde. Die Faelle unten sind eine Auswahl daraus. "eng" fand erst
die Sichtpruefung nach der Uebernahme.
"""

import pytest
from helpers import load_trainer, get_aufgaben, force_single_aufgabe

BEFUNDE_JS = r"""() => {
  const out = [];
  const gleicheZeile = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  for (const k of document.querySelectorAll('.aufgabe-text, .mc-option, .tipp-box, .loesungsweg')) {
    if (k.offsetParent === null) continue;
    const kr = k.getBoundingClientRect(), cs = getComputedStyle(k);
    const links = kr.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    const rechts = kr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
    for (const f of k.querySelectorAll('.katex')) {
      const basen = [...f.querySelectorAll('.katex-html > .base')].map(b => b.getBoundingClientRect());
      if (!basen.length) continue;
      const tex = f.querySelector('annotation').textContent;
      // Was ein scrollender Vorfahr abschneidet, ragt nicht heraus
      let clipL = -Infinity, clipR = Infinity;
      for (let e = f; e !== k; e = e.parentNode) {
        const c = getComputedStyle(e);
        if (c.overflowX === 'visible' || c.display === 'inline') continue;
        const r = e.getBoundingClientRect();
        clipL = Math.max(clipL, r.left); clipR = Math.min(clipR, r.right);
      }
      const l = Math.max(Math.min(...basen.map(b => b.left)), clipL);
      const r = Math.min(Math.max(...basen.map(b => b.right)), clipR);
      if (r > rechts + 1 || l < links - 1) out.push(['ragt', k.className, tex]);
      // Umbrochene abgesetzte Formel: die Zeilen duerfen nicht aneinanderstossen (Nenner auf
      // Zaehler). Inline-Formeln brechen nur um, wenn sie breiter sind als der Kasten; dort
      // beruehren sich hoechstens die Kaesten der Bausteine im Zeilenabstand des Textes, die
      // Zeichen nicht (Sichtpruefung) - darum nur abgesetzte.
      const reihen = [];
      basen.forEach((b, i) => {
        if (i && gleicheZeile(b, basen[i - 1])) {
          const z = reihen[reihen.length - 1];
          z.top = Math.min(z.top, b.top); z.bottom = Math.max(z.bottom, b.bottom);
        } else reihen.push({top: b.top, bottom: b.bottom});
      });
      if (f.closest('.katex-display') && reihen.some((z, i) => i && z.top - reihen[i - 1].bottom < 2)) {
        out.push(['eng', k.className, tex]);
      }
      if (f.closest('.katex-display')) continue;
      const breite = basen.reduce((s, b) => s + b.width, 0);
      const zeilen = basen.filter((b, i) => i === 0 || !gleicheZeile(b, basen[i - 1])).length;
      if (zeilen > 1 && breite <= rechts - links) out.push(['umbruch', k.className, tex]);
      // Zeichen ohne Leerraum vor/hinter der Formel (auto-render legt ein <span> um jede Formel)
      for (const [nach, basis] of [[true, basen[basen.length - 1]], [false, basen[0]]]) {
        let n = f;
        while (!(nach ? n.nextSibling : n.previousSibling) && n.parentNode !== k && n.parentNode.tagName === 'SPAN') n = n.parentNode;
        let t = nach ? n.nextSibling : n.previousSibling;
        if (t && t.nodeType === 1 && t.classList.contains('formel-zeichen')) t = t.firstChild;
        if (!t || t.nodeType !== 3 || !t.length) continue;
        const i = nach ? 0 : t.length - 1;
        if (/\s/.test(t.nodeValue[i])) continue;
        const rg = document.createRange();
        rg.setStart(t, i); rg.setEnd(t, i + 1);
        if (!gleicheZeile(rg.getBoundingClientRect(), basis)) out.push(['zeichen', k.className, tex + ' | ' + t.nodeValue[i]]);
      }
    }
  }
  if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push(['seite', '', '']);
  return out;
}"""


def zeige(page, datei, nr, breite):
    """Zeigt genau diese Aufgabe mit Tipp und Loesungsweg in der gegebenen Breite."""
    # Die Engine mischt die MC-Optionen. Mit dem Buchstaben davor ("A) " ist breiter als "D) ")
    # verschiebt sich der Zeilenumbruch - derselbe Fall war mal "zeichen", mal "umbruch".
    # Math.random knapp unter 1 laesst die Mischung bei der Originalreihenfolge.
    if not getattr(page, "_reihenfolge_fest", False):
        page.add_init_script("Math.random = () => 0.999999;")
        page._reihenfolge_fest = True
    page.set_viewport_size({"width": breite, "height": 900})
    page.emulate_media(reduced_motion="reduce")
    load_trainer(page, datei)
    aufgaben = get_aufgaben(page)
    aufgabe = next(a for a in aufgaben if a["id"] == nr)
    stufe = [a["id"] for a in aufgaben if a["level"] == aufgabe["level"]]
    force_single_aufgabe(page, datei, nr, aufgabe["level"], stufe)
    page.click("#btnTipp")
    if aufgabe["typ"] == "mc":
        page.click(".mc-option")
    else:
        page.fill("#antwortInput", "-987654321")
        page.click("#btnPruefen")
    page.wait_for_selector("#feedback .loesungsweg", state="visible", timeout=5000)
    page.evaluate("() => document.fonts.ready")


def befunde(page, art):
    return [b for b in page.evaluate(BEFUNDE_JS) if b[0] == art]


# (Trainer, Aufgabe, Breite, Mangel) - jede Zeile war vor der Korrektur ein Befund
FAELLE = [
    # abgesetzte Formel im Loesungsweg breiter als der Kasten
    ("12-lk-geom-kreis-kreis.html", 1, 360, "ragt"),
    ("7-koerper-volumen.html", 9, 360, "ragt"),
    ("5-dezimalbrueche.html", 9, 360, "ragt"),                      # Kl. 5 (Kids-Addon)
    ("11-analysis-extremwertaufgaben.html", 31, 700, "ragt"),
    # Inline-Formel in einer MC-Option, die auch umbrochen nicht passt (Wurzel aus Bruch in Klammer)
    ("12-lk-stoch-beurteilende-statistik.html", 7, 360, "ragt"),
    ("12-lk-geom-kreis-kreis.html", 1, 360, "seite"),
    # ohne Formel: ein Wort breiter als sein Kasten (Titel, Zahlwort in MC-Option, Kl. 5)
    ("10-stoch-verteilungen.html", 1, 360, "seite"),
    ("5-zahlen-stellenwert.html", 14, 360, "seite"),
    ("10-stoch-verteilungen.html", 1, 360, "umbruch"),             # Fragetext
    ("10-exp-funktionen.html", 16, 700, "umbruch"),
    ("10-trig-einheitskreis.html", 30, 360, "umbruch"),            # MC-Option
    ("5-daten-diagramme.html", 27, 360, "umbruch"),                # Kl. 5
    ("10-vek-abhaengigkeit.html", 1, 360, "zeichen"),              # "." allein am Zeilenanfang
    ("10-trig-sin-cos-parameter.html", 7, 700, "zeichen"),         # "?"
    ("10-func-lgs-3-gauss.html", 29, 700, "zeichen"),              # ","
    ("7-koerper-volumen.html", 30, 360, "zeichen"),                # ")" in MC-Option
    ("5-groessen-einheiten.html", 34, 360, "zeichen"),             # "(" davor, Kl. 5
    # abgesetzte Formel mit Bruechen, nach der Uebernahme umbrochen: Nenner "5" stiess auf "785"
    ("6-daten-kenngroessen.html", 35, 360, "eng"),                 # Kl. 6
]


@pytest.mark.parametrize("datei,nr,breite,art", FAELLE,
                         ids=[f"{d[:-5]}-{n}-{b}px-{a}" for d, n, b, a in FAELLE])
def test_formelsatz(page, datei, nr, breite, art):
    zeige(page, datei, nr, breite)
    gefunden = befunde(page, art)
    assert not gefunden, f"{datei} #{nr} bei {breite}px: {gefunden}"


def test_lange_inline_formel_bricht_im_kasten_um(page):
    """Eine Inline-Formel, die breiter ist als der Kasten, darf (nur dann) an Relations- und
    Rechenzeichen umbrechen - sie sprengt den Kasten nicht."""
    zeige(page, "12-stoch-zufallsgroessen.html", 34, 360)   # V(X) = (0-2,6)^2 * 0,5 + ...
    assert not befunde(page, "ragt")
    assert not befunde(page, "seite")


def test_satzzeichen_haengt_an_formel_die_den_kasten_fuellt(page):
    """Grenzfall: Die Formel passt gerade so in die Zeile, Formel + Punkt nicht mehr. Dann darf
    weder der Punkt allein in die naechste Zeile rutschen noch die Formel deswegen umbrechen -
    der Punkt haengt an der Formel, und dahinter ist sein Platz freigehalten."""
    zeige(page, "11-analysis-monotonie-kruemmung.html", 35, 360)
    assert not befunde(page, "zeichen")
    assert not befunde(page, "umbruch")
    luecken = page.evaluate(r"""() => [...document.querySelectorAll('.formel-zeichen')].map(z => {
      const r = document.createRange();
      r.selectNodeContents(z);
      return parseFloat(getComputedStyle(z.parentNode).marginRight) - r.getBoundingClientRect().width;
    })""")
    assert luecken and all(abs(d) < 0.6 for d in luecken), luecken


def test_hochzahlen_lesbar(page):
    """Hochzahlen (KaTeX setzt sie mit 70 % der Formelgroesse) sind auch auf dem Handy in
    Optionen und Loesungsweg mindestens 12 px gross - bei rund 11 px ging das Minus im
    Exponenten unter."""
    zeige(page, "9-pot-ganzzahlige-exp.html", 15, 360)   # MC mit x^{-6} in Optionen und Loesungsweg
    for kasten in (".mc-option", ".loesungsweg"):
        assert page.query_selector(kasten + " .katex"), f"Testaufgabe hat keine Formel in {kasten}"
        formel = page.evaluate(
            "s => parseFloat(getComputedStyle(document.querySelector(s + ' .katex')).fontSize)", kasten)
        assert formel * 0.7 >= 12, f"{kasten}: Formel {formel}px, Hochzahl {formel * 0.7:.1f}px"


def test_abgesetzte_formel_wird_nicht_beschnitten(page):
    """Der Ueberlaufschutz darf weder Bruchstriche/Nenner abschneiden noch die Hoehe aendern:
    Der beschneidende Kasten hat oben und unten Luft, die abgesetzte Formel bleibt so hoch
    wie ihr Inhalt."""
    zeige(page, "10-exp-funktionen.html", 5, 360)   # $$ ... = \frac{1}{2^1} = ... $$
    werte = page.evaluate(r"""() => [...document.querySelectorAll('.loesungsweg .katex-display')].map(d => {
      const html = d.querySelector('.katex-html');
      const basen = [...html.querySelectorAll(':scope > .base')].map(b => b.getBoundingClientRect());
      const clip = [d, d.firstElementChild].find(e => getComputedStyle(e).overflowY !== 'visible');
      const c = clip ? clip.getBoundingClientRect() : {top: -Infinity, bottom: Infinity};
      return {luftOben: Math.min(...basen.map(b => b.top)) - c.top,
              luftUnten: c.bottom - Math.max(...basen.map(b => b.bottom)),
              hoehe: d.getBoundingClientRect().height, inhalt: html.getBoundingClientRect().height};
    })""")
    assert werte, "keine abgesetzte Formel im Loesungsweg gefunden"
    for w in werte:
        assert w["luftOben"] >= 3 and w["luftUnten"] >= 3, w
        assert abs(w["hoehe"] - w["inhalt"]) < 0.5, w


# --- Betraege in abgesetzten Formeln (statisch, ohne Browser) -------------
# Abgesetzte Formeln duerfen auf dem Handy umbrechen (spirale.css), KaTeX bricht dabei auf
# oberster Ebene an Relations- und Rechenzeichen. Ein Betrag |3k - 1| ist fuer KaTeX keine
# Einheit und brach innen um ("3|k -" / "1|"). Gruppiert ({|3k - 1|}) bleibt er zusammen.

import re
from pathlib import Path

_BS = "\\\\"   # ein TeX-Backslash im Dateitext (TeX steht in JS-Strings)
_KEIN_BETRAG = tuple(_BS + w for w in ("left", "right", "middle", "big", "Big", "bigg", "Bigg", "bigl", "bigr"))
_BRUCHSTELLE = re.compile(r"[+=<>]|(?<![{(\[^_|])-|" + re.escape(_BS)
                          + r"(cdot|le|ge|leq|geq|neq|approx|pm|mp|times|Rightarrow|iff)(?![a-zA-Z])")


def _offene_betraege(formel):
    """Betraege auf oberster Klammerebene, die innen umbrechen koennen und nicht gruppiert sind."""
    tiefe, offen, i, out = 0, None, 0, []
    while i < len(formel):
        if formel.startswith(_BS + _BS, i):
            i += 4
            continue
        if formel.startswith(_BS, i):
            i += 2
            m = re.match(r"[a-zA-Z]+", formel[i:])
            if m:
                i += m.end()
                if formel[:i].endswith(_KEIN_BETRAG) and formel.startswith("|", i):
                    i += 1
            else:
                i += 1
            continue
        c = formel[i]
        tiefe += (c == "{") - (c == "}")
        if c == "|" and tiefe == 0:
            if offen is None:
                offen = i
            else:
                if _BRUCHSTELLE.search(formel[offen:i]):   # mit '|': Minus gleich dahinter ist Vorzeichen
                    out.append(formel[offen:i + 1])
                offen = None
        i += 1
    return out


def test_betraege_in_abgesetzten_formeln_sind_gruppiert():
    befunde = []
    for datei in sorted((Path(__file__).resolve().parent.parent / "trainer").glob("*.html")):
        for formel in re.findall(r"\$\$(.*?)\$\$", datei.read_text(encoding="utf-8"), re.S):
            befunde += [f"{datei.name}: {b}" for b in _offene_betraege(formel)]
    assert not befunde, "als {|...|} schreiben:\n" + "\n".join(befunde)

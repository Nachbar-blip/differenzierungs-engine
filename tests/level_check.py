"""Gate fuer die Level-Rubrik der DifferenzierungsEngine (Plan 2026-09-17, Schritt 1).

Prueft Trainer-HTMLs ohne Browser auf Verstoesse gegen die Level-Rubrik:
Formel-/Rechenweg-Ansage ab Level 4, MC-Lastigkeit in Level 5/6, ratbare MC,
fehlende Toleranz, Duplikate ueber Trainer hinweg, trivialisierende Stellen.

Aufruf:
    python tests/level_check.py                      # alle Trainer, nur Bericht
    python tests/level_check.py --strict trainer/10-exp-funktionen.html ...
                                                     # Exit 1 bei hartem Verstoss

Die AUFGABEN-Arrays werden per node ausgewertet (echtes JS, kein JSON).
"""

import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRAINER_DIR = ROOT / "trainer"

# Harte Regeln (Rubrik "Verboten"):
FORMEL_ANSAGE = re.compile(
    r"\(Formel|Formel:|Modell:|Verwende\s|Nutze\s|Hinweis:\s*(zuerst|erst)|Tipp:", re.I)
RECHENART_ANSAGE = re.compile(
    r"^\s*(Addiere|Subtrahiere|Multipliziere|Dividiere|Kuerze|Kürze|Erweitere)\b", re.I)
NULL_AUSWERTUNG = re.compile(r"f'\(0\)|f\\'\(0\)|an der Stelle\s*(x\s*=\s*)?0\b", re.I)
# Die Engine rendert kein Markdown: **fett** erscheint woertlich (Sichtpruefung 2026-09-18).
MARKDOWN_FETT = re.compile(r"\*\*[^*\r\n]+\*\*")
KETTEN_TRAINER = re.compile(r"ableitungsregeln|kettenregel")


def lade_aufgaben(pfad: Path) -> list:
    js = r"""
const fs=require('fs');const h=fs.readFileSync(process.argv[1],'utf8');
const blocks=h.match(/<script>([\s\S]*?)<\/script>/g)||[];
for(const b of blocks){const code=b.replace(/<\/?script>/g,'');
  if(!/AUFGABEN/.test(code))continue;
  const fn=new Function(code+';return AUFGABEN;');
  process.stdout.write(JSON.stringify(fn()));process.exit(0);}
process.exit(2);
"""
    r = subprocess.run(["node", "-e", js, str(pfad)], capture_output=True, text=True,
                       encoding="utf-8")
    if r.returncode != 0:
        raise RuntimeError(f"{pfad.name}: AUFGABEN nicht auswertbar: {r.stderr.strip()[:200]}")
    return json.loads(r.stdout)


def normalisiere(frage: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", frage)).strip().lower()


def pruefe_trainer(pfad: Path, aufgaben: list):
    """Liefert (harte_fehler, warnungen) als Listen von Strings."""
    hart, warn = [], []
    name = pfad.name

    if len(aufgaben) != 36:
        hart.append(f"{len(aufgaben)} statt 36 Aufgaben")
    ids = [a.get("id") for a in aufgaben]
    if any(not isinstance(i, int) for i in ids):
        hart.append("id nicht ueberall Number")
    if len(set(ids)) != len(ids):
        hart.append("doppelte ids")
    je_level = Counter(a.get("level") for a in aufgaben)
    for lv in range(1, 7):
        if je_level[lv] != 6:
            hart.append(f"Level {lv}: {je_level[lv]} statt 6 Aufgaben")

    for a in aufgaben:
        k = f"#{a.get('id')} L{a.get('level')}"
        frage = a.get("frage", "")
        lv = a.get("level", 0)
        typ = a.get("typ")
        if typ == "mc":
            opt = a.get("optionen") or []
            if not (2 <= len(opt) <= 4) or not (0 <= a.get("korrekt", -1) < len(opt)):
                hart.append(f"{k}: MC-Optionen/korrekt ungueltig")
            elif len(set(opt)) < len(opt):
                hart.append(f"{k}: identische MC-Optionen")
        elif typ == "numerisch":
            loes = a.get("loesung")
            if not isinstance(loes, (int, float)):
                hart.append(f"{k}: loesung fehlt")
            elif float(loes) != int(loes) and not a.get("toleranz"):
                hart.append(f"{k}: Dezimal-Loesung ohne toleranz")
        else:
            hart.append(f"{k}: typ ungueltig ({typ})")

        for feld in ("frage", "tipp", "loesungsweg"):
            if MARKDOWN_FETT.search(a.get(feld) or ""):
                hart.append(f"{k}: Markdown-Sternchen in '{feld}' (bitte <b>…</b>)")

        if lv >= 4 and FORMEL_ANSAGE.search(frage):
            hart.append(f"{k}: Formel-/Rechenweg-Ansage in Level >= 4")
        if lv >= 4 and RECHENART_ANSAGE.search(normalisiere(frage)):
            warn.append(f"{k}: Rechenart wird angesagt (Level >= 4)")
        if KETTEN_TRAINER.search(name) and lv >= 4 and NULL_AUSWERTUNG.search(frage):
            warn.append(f"{k}: Auswertung an x = 0 trivialisiert Produkt-/Kettenregel")

    for lv in (5, 6):
        mc = sum(1 for a in aufgaben if a.get("level") == lv and a.get("typ") == "mc")
        if mc > 3:
            hart.append(f"Level {lv}: {mc}/6 MC (max. 3 erlaubt)")

    # Level 1 einer Datei vs. Level >= 4 derselben Datei: gleiche Frage -> Inversion
    fragen = {}
    for a in aufgaben:
        fragen.setdefault(normalisiere(a.get("frage", "")), []).append(a)
    for f, gruppe in fragen.items():
        if len(gruppe) > 1:
            hart.append("identische Frage: " + ", ".join(f"#{a['id']}" for a in gruppe))
    return hart, warn


def main(argv):
    strict = "--strict" in argv
    dateien = [Path(x) for x in argv if x.endswith(".html")]
    if not dateien:
        dateien = sorted(TRAINER_DIR.glob("*.html"))
    dateien = [d if d.is_absolute() else ROOT / d for d in dateien]

    alle = {}
    for d in dateien:
        alle[d] = lade_aufgaben(d)

    # Duplikate ueber Trainer hinweg (gegen den gesamten Pool, nicht nur die Auswahl)
    pool = {}
    for d in sorted(TRAINER_DIR.glob("*.html")):
        aufg = alle.get(d) or lade_aufgaben(d)
        for a in aufg:
            pool.setdefault(normalisiere(a.get("frage", "")), []).append((d.name, a["id"], a["level"]))

    exit_code = 0
    for d, aufg in alle.items():
        hart, warn = pruefe_trainer(d, aufg)
        for a in aufg:
            treffer = [t for t in pool.get(normalisiere(a.get("frage", "")), []) if t[0] != d.name]
            if treffer:
                warn.append(f"#{a['id']} L{a['level']}: identisch mit "
                            + ", ".join(f"{t[0]} #{t[1]} L{t[2]}" for t in treffer))
        status = "FEHLER" if hart else ("WARNUNG" if warn else "ok")
        print(f"== {d.name}: {status}")
        for h in hart:
            print(f"   FEHLER  {h}")
        for w in warn:
            print(f"   warn    {w}")
        if hart and strict:
            exit_code = 1
    return exit_code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

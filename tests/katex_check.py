"""Gate: rendert JEDE Aufgabe eines Trainers (Frage, Tipp, Loesungsweg) und zaehlt KaTeX-Fehler.

Die Playwright-Suite prueft KaTeX nur auf der ersten angezeigten Aufgabe; Fehler in den
uebrigen 35 blieben unsichtbar (gefunden 2026-09-17 bei der Sichtpruefung Welle 1).
Braucht einen laufenden Server (DIFFENGINE_BASE_URL, Standard http://127.0.0.1:8765).

    python tests/katex_check.py trainer/10-exp-funktionen.html ...
"""
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("DIFFENGINE_BASE_URL", "http://127.0.0.1:8765")


def pruefe(page, name: str) -> list:
    page.goto(f"{BASE}/trainer/{name}", wait_until="networkidle")
    aufgaben = page.evaluate("AUFGABEN")
    fehler = []
    for a in aufgaben:
        ids = [x["id"] for x in aufgaben if x["level"] == a["level"] and x["id"] != a["id"]]
        state = {"level": a["level"], "streak": 0, "wrongStreak": 0, "answered": ids,
                 "totalCorrect": 0, "totalAttempts": 0}
        page.evaluate(f"localStorage.setItem('spirale-{name[:-5]}', '{json.dumps(state)}')")
        page.reload(wait_until="networkidle")
        page.wait_for_selector("#app .aufgabe-karte")
        page.keyboard.press("t")
        # Antwort abgeben, damit auch der Loesungsweg gerendert wird
        if a["typ"] == "mc":
            page.click(".mc-option")
        else:
            page.fill("#antwortInput", "0")
            page.click("#btnPruefen")
        page.wait_for_selector("#feedback[style*='block']", timeout=5000)
        n = page.evaluate("document.querySelectorAll('.katex-error').length")
        if n:
            texte = page.evaluate(
                "[...document.querySelectorAll('.katex-error')].map(e => e.textContent)")
            fehler.append(f"#{a['id']} L{a['level']}: {n} KaTeX-Fehler: {texte[:2]}")
    return fehler


def main(dateien: list) -> int:
    code = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for d in dateien:
            f = pruefe(page, Path(d).name)
            print(f"== {Path(d).name}: {'FEHLER' if f else 'ok'}")
            for x in f:
                print("   ", x)
            code |= bool(f)
        browser.close()
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

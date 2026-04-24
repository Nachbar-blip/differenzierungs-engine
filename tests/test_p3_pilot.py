"""Playwright-Tests fuer den P3-Pilot auf 9-func-quadratisch."""

import json
import pytest
from helpers import load_trainer, BASE_URL

PILOT_TRAINER = "9-func-quadratisch.html"
PILOT_KEY = "9-func-quadratisch"


def _set_p3_level6_reached(page, reached: bool = True):
    page.evaluate(
        f"localStorage.setItem('p3-level6-reached-{PILOT_KEY}', {json.dumps(reached)})"
    )


def _set_p3_history(page, entries: list):
    page.evaluate(
        f"localStorage.setItem('p3-history-{PILOT_KEY}', '{json.dumps(entries)}')"
    )


def _get_p3_history(page):
    raw = page.evaluate(f"localStorage.getItem('p3-history-{PILOT_KEY}')")
    return json.loads(raw) if raw else None


def _get_p3_reflexion(page):
    raw = page.evaluate(f"localStorage.getItem('p3-reflexion-{PILOT_KEY}')")
    return json.loads(raw) if raw else None


def _force_level(page, level: int, level6_reached: bool = False):
    state = {
        "level": level, "streak": 0, "wrongStreak": 0,
        "answered": [], "totalCorrect": 0, "totalAttempts": 0,
    }
    page.evaluate(f"localStorage.setItem('spirale-{PILOT_KEY}', '{json.dumps(state)}')")
    if level6_reached:
        _set_p3_level6_reached(page, True)
    page.reload(wait_until="networkidle")
    page.wait_for_selector("#app", timeout=10000)

"""Playwright-Tests fuer alle 87 DiffEngine-Trainer."""

import pytest
from helpers import (
    load_trainer, get_aufgaben, setup_console_error_capture,
    count_katex_errors, beantworte_aufgabe, klick_weiter,
    force_single_aufgabe, BASE_URL,
)


class TestTrainerStatisch:
    """Statische Pruefungen ohne Interaktion."""

    def test_seite_laedt(self, page, trainer_file):
        """Trainer-Seite antwortet mit HTTP 200 und rendert die App."""
        response = load_trainer(page, trainer_file)
        assert response.status == 200, f"{trainer_file}: HTTP {response.status}"

    def test_keine_js_fehler(self, page, trainer_file):
        """Keine console.error beim Laden der Seite."""
        errors = setup_console_error_capture(page)
        load_trainer(page, trainer_file)
        critical = [e for e in errors if "CORS" not in e and "deprecated" not in e.lower()]
        assert len(critical) == 0, f"{trainer_file}: JS-Fehler: {critical}"

    def test_katex_rendert(self, page, trainer_file):
        """Keine KaTeX-Render-Fehler auf der Seite."""
        load_trainer(page, trainer_file)
        err_count = count_katex_errors(page)
        assert err_count == 0, f"{trainer_file}: {err_count} KaTeX-Fehler"

    def test_36_aufgaben(self, page, trainer_file):
        """Trainer hat genau 36 Aufgaben."""
        load_trainer(page, trainer_file)
        aufgaben = get_aufgaben(page)
        assert len(aufgaben) == 36, f"{trainer_file}: {len(aufgaben)} statt 36 Aufgaben"

    def test_6_level_je_6(self, page, trainer_file):
        """Jedes der 6 Level hat genau 6 Aufgaben."""
        load_trainer(page, trainer_file)
        aufgaben = get_aufgaben(page)
        for level in range(1, 7):
            count = len([a for a in aufgaben if a["level"] == level])
            assert count == 6, f"{trainer_file}: Level {level} hat {count} statt 6 Aufgaben"


class TestTrainerInteraktiv:
    """Alle 36 Aufgaben werden korrekt beantwortet."""

    def test_alle_aufgaben_durchspielbar(self, page, trainer_file):
        """Jede der 36 Aufgaben wird mit der richtigen Antwort beantwortet."""
        load_trainer(page, trainer_file)
        aufgaben = get_aufgaben(page)
        fehler = []
        gesamt_beantwortet = set()

        for level in range(1, 7):
            level_aufgaben = [a for a in aufgaben if a["level"] == level]
            level_ids = [a["id"] for a in level_aufgaben]

            for aufgabe in level_aufgaben:
                # Erzwinge genau diese eine Aufgabe
                force_single_aufgabe(page, trainer_file, aufgabe["id"],
                                     level, level_ids)

                ok = beantworte_aufgabe(page, aufgabe)
                if not ok:
                    fehler.append(
                        f"Level {level}, Aufgabe {aufgabe['id']} "
                        f"(typ={aufgabe['typ']}): Antwort nicht akzeptiert"
                    )
                    continue

                gesamt_beantwortet.add(aufgabe["id"])

        assert len(fehler) == 0, (
            f"{trainer_file}: {len(fehler)} Fehler, "
            f"{len(gesamt_beantwortet)}/36 beantwortet:\n" + "\n".join(fehler)
        )
        assert len(gesamt_beantwortet) == 36, (
            f"{trainer_file}: Nur {len(gesamt_beantwortet)}/36 Aufgaben beantwortet"
        )

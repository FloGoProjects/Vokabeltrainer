# Vokabeltrainer („Vokabel-Gold“)

Web-App (PWA, ohne Build-Schritt) für iPad/Safari: Karteikasten-Vokabeltrainer für 1 Kind (~12 J.), zunächst Englisch,
Antworten eintippen, Belohnung „Vokabel-Gold“, 3 Skins. Anforderungen: `requirements.json` (zuerst dort ändern).

## Datei-Landkarte
- `requirements.json` – Anforderungen (Quelle der Wahrheit)
- `index.html` – App-Gerüst, PIN-Dialog
- `src/app.js` – UI: Ansichten Lernen/Runde/Belohnungen/Einstellungen (keine Logik, nur Verdrahtung)
- `src/answer.js` – Antwortprüfung (Buch-Schreibweise → akzeptierte Eingaben, fast richtig, andere Karte)
- `src/srs.js` – Leitner-Karteikasten (Fächer, Intervalle, Fälligkeit)
- `src/gold.js` – Gold-Regeln, Tagesziel, Serienbonus
- `src/session.js` – Lernbereich filtern, Runde zusammenstellen, Zähler
- `src/store.js` – Spielstand (reine Funktionen) + localStorage, Import-Prüfung
- `src/deck.js` – Prüfung einer Vokabeldatei
- `styles/base.css` – Layout; `styles/themes.css` – Skins heft/modern/pixel (nur Variablen + Deko)
- `data/index.json` – Liste der Vokabeldateien; `data/en/unit-XX.json` – Vokabeln pro Unit
- `sw.js` – Offline-Cache; `manifest.webmanifest`, `icons/` – Home-Bildschirm
- `scripts/` – check-vocab, serve, make-icons
- `test/` – Vitest-Tests

## Befehle
- `npm test` – alle Tests
- `npm run check-vocab` – Vokabeldateien prüfen (`-- --answers` zeigt akzeptierte Antworten je Karte)
- `npm run serve` – lokaler Server auf http://localhost:8080 (Service Worker ist auf localhost aus)
- `npm run make-icons` – Icons neu erzeugen

## Veröffentlichung
- Repo: https://github.com/FloGoProjects/Vokabeltrainer (öffentlich, Remote per HTTPS)
- GitHub Pages aus Branch `main`, Ordner `/` → https://flogoprojects.github.io/Vokabeltrainer/
- Deploy = Push auf `main`. Vorher `npm test` + `npm run check-vocab`, `VERSION` in `sw.js` erhöhen.

## Konventionen
- Vokabel-IDs: `<lang>-u<unit>-<nr>` (z. B. `en-u1-042`), nie umnummerieren (Lernstand hängt daran).
- Neue Unit: Datei `data/en/unit-XX.json` + Eintrag in `data/index.json` + `npm run check-vocab`.
- `unsure: true` = aus unscharfem Foto gelesen, muss geprüft werden.
- Keine Beispielsätze aus dem Buch übernehmen (Urheberrecht).
- Änderung an App-Dateien → `VERSION` in `sw.js` erhöhen und neue Dateien in `APP_SHELL` eintragen.
- Logik nur in testbaren Modulen; `app.js` bleibt Verdrahtung.
- Tage werden als lokale Tagesnummer gerechnet (`todayNumber`), nicht als Zeitstempel.

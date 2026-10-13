# Rumms!

Ein 3D-Survival-Spiel im Stil von Megabonk fürs Handy. Du läufst mit einem von
fünf Helden über eine Hügellandschaft, deine Waffen feuern von selbst, und die
Gegnerhorden werden jede Minute größer. Eine Runde dauert **15 Minuten**
(Megabonk: 10). Danach erscheint der Endboss, der Große Rummser. Wer ihn
besiegt, gewinnt die Runde.

## Spielen

- **Android:** Unter [Releases → rumms](https://github.com/alexandertep92-source/222/releases/tag/rumms) die Datei
  **`Rumms.apk`** auf dem Handy herunterladen und öffnen (einmalig die
  Installation aus unbekannten Quellen erlauben). Neue Versionen einfach
  darüber installieren, Rekorde und Einstellungen bleiben erhalten.
- **Browser (auch iPhone):** `spiel/web/index.html` über einen beliebigen
  Webserver ausliefern, z. B. `npx serve spiel/web`, und im Handy-Browser
  öffnen. Im Querformat spielt es sich am besten.

## Steuerung

| Touch | Tastatur | Aktion |
|---|---|---|
| Linke Bildschirmhälfte: tippen und ziehen | WASD / Pfeiltasten | Laufen (Joystick erscheint dort, wo du tippst) |
| Rechte Bildschirmhälfte: wischen | Q / E | Kamera drehen |
| Knopf **Sprung** | Leertaste | Springen (über kleine Gegner, Felsen und Schockwellen) |
| Knopf **Sprint** | Umschalt | Kurzer, unverwundbarer Spurt |
| Knopf **II** | Esc / P | Pause |

Die Waffen zielen automatisch. Auf Android pausiert die Zurück-Taste die Runde.

## Helden und ihre Waffen

Jeder Held startet mit seiner ersten Waffe und schaltet die beiden anderen über
Stufenaufstiege oder Truhen frei. Waffen anderer Helden gibt es nicht.

| Held | Waffen | Passiv |
|---|---|---|
| **Ritter Bruno** (leicht) | Schwert, Heiliger Kreis, Schildwurf | +35 Max-LP, +8 % Rüstung |
| **Jägerin Lyra** (mittel) | Langbogen, Pfeilregen, Wurfmesser | +10 % Krit-Chance, +15 % Projektiltempo |
| **Magier Zappo** (schwer) | Blitzstab, Feuerball, Meteor | +20 % Erfahrung, +10 % Fläche |
| **Ninja Kenji** (mittel) | Shuriken, Kunai, Drachenklinge | Doppelsprung, +15 % Tempo, +8 % Ausweichen |
| **Zwerg Grumbel** (leicht) | Bomben, Erdbeben, Minen | +15 % Fläche, +0,6 LP/s Regeneration |

## Ablauf einer Runde

- Besiegte Gegner lassen Erfahrungskristalle fallen. Bei jedem Stufenaufstieg
  wählst du eine von drei Karten: neue Waffe, Waffen-Verbesserung oder ein Buch
  (gilt für alles). Karten haben Seltenheiten von *Gewöhnlich* bis *Legendär*;
  Glück erhöht die Chance auf seltene Karten. Drei Mal pro Runde darfst du neu
  würfeln.
- **Gold** öffnet Truhen (jede weitere wird teurer, geöffnete Truhen tauchen an
  anderer Stelle neu auf). Lila Truhen von Elite-Gegnern und Bossen sind gratis.
- **Schreine:** drei Sekunden im Kreis stehen bleiben, dann gibt es einen Segen.
- Alle 90 Sekunden kommt eine **Horde**, nach 5 Minuten der **Schleimkönig**,
  nach 10 Minuten der **Golemfürst**.
- Nach **15:00** erscheint der **Große Rummser**. Er stampft Schockwellen (darüber
  springen!), stürmt los, wirft Felsen und ruft Verstärkung. Solange er lebt,
  werden die Horden immer dichter.

## Technik

Reines HTML/JavaScript mit [three.js](https://threejs.org) r158 (liegt unter
`web/js/three.min.js`, MIT-Lizenz). Es gibt keinen Build-Schritt; alle Modelle
bestehen aus einfachen Formen, alle Töne und die Musik werden mit der
Web-Audio-API erzeugt.

| Pfad | Inhalt |
|---|---|
| `web/js/data.js` | Helden, Waffen, Bücher, Gegner, Bosse und Balancing-Werte |
| `web/js/core.js` | Hilfsfunktionen, Gelände, Speicher, Ton und Musik |
| `web/js/world.js` | Renderer, Landschaft, Deko und alle 3D-Modelle |
| `web/js/entities.js` | Spielfigur, Gegner, Sammelobjekte, Effekte |
| `web/js/weapons.js` | Verhalten der 15 Waffen |
| `web/js/bosses.js` | Zwischenbosse und Endboss |
| `web/js/game.js` | Rundenablauf, Eingabe, Kamera, Gegnerwellen, Kartenwahl, Hauptschleife |
| `web/js/ui.js` | Menüs, HUD und Dialoge |
| `android/` | Android-Hülle (WebView), baut `Rumms.apk` |

Die Rundenlänge steht in `web/js/data.js` (`CONFIG.ROUND_SECONDS`).

### Android-App

`.github/workflows/spiel.yml` baut bei jeder Änderung unter `spiel/` die APK und
ersetzt das Release `rumms`. Lokal (Android SDK und Gradle 8.14 nötig):

```bash
cd spiel/android
gradle assembleRelease
```

Die APK wird mit einem eigenen Schlüssel `android/rumms.p12` signiert, damit
neue Versionen als Update installiert werden können. Das Passwort steht offen in
`android/app/build.gradle.kts`, weil das Spiel keine privaten Daten enthält.
Der Schlüssel des Browser-Tresors wird dafür nicht verwendet.

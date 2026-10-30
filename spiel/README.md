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
| Knopf **Sprung** | Leertaste | Springen: kurz tippen = kleiner Hüpfer, halten = hoher Sprung (über kleine Gegner, Felsen und Schockwellen) |
| Knopf **Sprint** | Umschalt | Kurzer, unverwundbarer Spurt |
| Knopf **II** | Esc / P | Pause |

Die Waffen zielen automatisch. Auf Android pausiert die Zurück-Taste die Runde.

**Querformat überall:** Auf Handys im Hochformat dreht sich das Spiel selbst ins
Querformat – auch in Apps, die selbst nur Hochformat können (z. B. die
Claude-App). Handy einfach quer halten. Über **Drehen** im Titelbild oder
*Einstellungen → Bildschirm* lässt sich die Richtung umkehren oder Hochkant
wählen.

**Grafikstufen:** *Mittel* (Standard) mit Echtzeit-Schatten, Gras im Wind und
Leuchteffekten; *Hoch* zusätzlich mit Bloom und schärferen Schatten; *Niedrig*
für ältere Handys ohne Schatten und Gras. Die Auflösung passt sich automatisch
an, wenn das Handy nicht hinterherkommt. Auf *Mittel* und *Hoch* haben Helden,
Gegner, Bosse und Truhen dunkle Comic-Umrisse. Der **Retro-Pixel-Look** (aus,
einschaltbar unter *Einstellungen*) zeichnet die Spielwelt in kleiner Auflösung
und skaliert sie kantig hoch.

## Helden und ihre Waffen

Jeder Held hat fünf eigene Waffen. Er startet mit der ersten und schaltet weitere
über Stufenaufstiege oder Truhen frei. Es gibt **vier Waffenplätze**, eine der
fünf Waffen bleibt also immer im Schrank – welche, entscheidest du. Waffen
anderer Helden gibt es nicht.

| Held | Waffen | Passiv |
|---|---|---|
| **Ritter Bruno** (leicht) | Schwert, Heiliger Kreis, Schildwurf, Lanzenstoß, Himmelshämmer | +35 Max-LP, +8 % Rüstung |
| **Jägerin Lyra** (mittel) | Langbogen, Pfeilregen, Wurfmesser, Falke, Dornenranken | +10 % Krit-Chance, +15 % Projektiltempo |
| **Magier Zappo** (schwer) | Blitzstab, Feuerball, Meteor, Schwarzes Loch, Arkanstrahl | +20 % Erfahrung, +10 % Fläche |
| **Ninja Kenji** (mittel) | Shuriken, Kunai, Drachenklinge, Rauchbombe, Kettensichel | Doppelsprung, +15 % Tempo, +8 % Ausweichen |
| **Zwerg Grumbel** (leicht) | Bomben, Erdbeben, Minen, Kanonenturm, Spitzhacken | +15 % Fläche, +0,6 LP/s Regeneration |

Die neuen Waffen im Überblick:

- **Lanzenstoß:** durchbohrt alle Gegner in einer langen Linie.
- **Himmelshämmer:** goldene Hämmer drehen sich spiralförmig nach außen.
- **Falke:** stößt auf Gegner herab und kehrt zu dir zurück.
- **Dornenranken:** halten Gegner fest und stechen zu.
- **Schwarzes Loch:** saugt Gegner an und schleudert sie am Ende weg.
- **Arkanstrahl:** ein Strahl, der sich einmal um dich dreht.
- **Rauchbombe:** verwirrte Gegner irren umher und greifen nicht an.
- **Kettensichel:** wirbelt in einem weiten Kreis um dich herum.
- **Kanonenturm:** baut einen Turm, der eine Weile selbst feuert.
- **Spitzhacken:** fliegen im hohen Bogen und durchschlagen beim Fallen alles.

## Gegner

20 Gegnertypen. Die Mischung ändert sich im Lauf der Runde gleitend: Neue Arten
kommen dazu, Schleime verschwinden nach und nach. Taucht ein Gegner mit
besonderer Fähigkeit zum ersten Mal auf, erscheint ein kurzer Hinweis.

| Gegner | ab | Besonderheit |
|---|---|---|
| Schleim | 0:00 | langsam, kommt in Massen |
| Knochenkerl | 0:15 | der Standard-Gegner |
| Irrlicht | 1:20 | fliegt in Schwärmen von 5–7 in Schlangenlinien |
| Fledermaus | 1:50 | schnell, fliegt |
| Riesenspinne | 2:10 | springt dich aus einigen Metern Entfernung an |
| Knallpilz | 2:40 | zündet neben dir seine Lunte – weg da! Abgeschossen explodiert er zwischen seinen Freunden |
| Mimik | 2:40 | selten; sieht aus wie eine Truhe und beißt, wenn du ihr zu nahe kommst – lässt viel Gold fallen |
| Spucker | 3:30 | hält Abstand und spuckt Kugeln |
| Riesenschleim | 3:30 | zerfällt in drei kleine Schleime |
| Kobold | 3:50 | teleportiert sich plötzlich direkt neben dich |
| Keiler | 4:30 | scharrt (rotes Blinken, „!“) und stürmt dann geradeaus los – zur Seite ausweichen |
| Stacheligel | 5:00 | schießt Stacheln in alle Richtungen – drüberspringen |
| Steinklotz | 5:40 | sehr zäh |
| Frostwicht | 5:40 | Eiskugeln verlangsamen dich |
| Lavaschleim | 6:20 | hinterlässt brennende Pfützen |
| Goblin-Schamane | 7:00 | heilt alle Gegner um sich herum – zuerst erledigen |
| Geist | 8:10 | fliegt durch Hindernisse |
| Felsentroll | 8:40 | wirft Felsbrocken mit Warnkreis |
| Schildträger | 9:30 | blockt Treffer von vorn; Flächenschaden von oben (Meteor, Pfeilregen, Ranken …) trifft voll |
| Schattenritter | 11:00 | stark und schnell |

## Ablauf einer Runde

- Besiegte Gegner lassen Erfahrungskristalle fallen. Bei jedem Stufenaufstieg
  wählst du eine von drei Karten: neue Waffe, Waffen-Verbesserung oder ein Buch
  (gilt für alles). Karten haben Seltenheiten von *Gewöhnlich* bis *Legendär*;
  Glück erhöht die Chance auf seltene Karten. Drei Mal pro Runde darfst du neu
  würfeln.
- **Gold:** Jeder besiegte Gegner zerplatzt in einer kleinen Münzfontäne und gibt
  mindestens 1 Gold, zähe Gegner mehr, Bosse und Mimiks besonders viel. Gold öffnet Truhen (jede weitere wird teurer, geöffnete
  Truhen tauchen an anderer Stelle neu auf). Lila Truhen von Elite-Gegnern und
  Bossen sind gratis.
- **Truhen** zeigen beim Öffnen Lichtstrahlen in der Farbe der seltensten Karte.
- **Physik:** Besiegte Gegner fliegen im hohen Bogen davon und kegeln andere um,
  eingequetschte Gegner klettern übereinander.
- **Schreine:** drei Sekunden im Kreis stehen bleiben, dann gibt es einen Segen.
- Alle 90 Sekunden kommt eine **Horde**, nach 5 Minuten der **Schleimkönig**,
  nach 10 Minuten der **Golemfürst** und nach 12:30 **Hexe Morla**. Die Hexe
  schwebt auf Abstand, schießt Spiralen aus niedrigen Kugeln (drüberspringen),
  schickt verfolgende Totenköpfe (wegsprinten), legt Giftpfützen, ruft Gehilfen
  und teleportiert sich.
- Nach **15:00** erscheint der **Große Rummser**. Er stampft Schockwellen (darüber
  springen!), stürmt los, wirft Felsen und ruft Verstärkung. Solange er lebt,
  werden die Horden immer dichter.

## Freischaltbares

- **Sterne:** Am Ende jeder Runde gibt es Sterne – je überlebter Minute, je
  besiegtem Boss, für viele besiegte Gegner und für den Sieg.
- **Werkstatt** (Titelbild): Sterne gegen dauerhafte Verbesserungen für alle
  Helden tauschen – Kraft, Lebenskraft, Flinke Füße, Magnet, Glückspilz,
  Weisheit, Startkapital, Glückswürfel (mehr Neuwürfeln) und **Zweites Leben**
  (einmal pro Runde mit halben LP wieder aufstehen).
- **Erfolge** (Titelbild): zehn Aufgaben, z. B. jeden Boss besiegen, 1000 Gegner
  in einer Runde, Stufe 60 oder mit allen Helden gewinnen. Jeder Erfolg bringt
  Sterne und einen **Hut** (Krone, Schleimhut, Zylinder, Hexenhut, Partyhut,
  Propellermütze, Blumenkranz, Pilzkappe, Heiligenschein, Teufelshörner), den du
  in der Heldenauswahl über **Hut** aufsetzt.
- **Albtraum-Modus:** nach dem ersten Sieg in der Heldenauswahl einschaltbar.
  Gegner haben 75 % mehr LP und treffen härter, es kommen mehr und öfter
  Elite-Gegner – dafür gibt es 50 % mehr Sterne.

Fortschritt, Rekorde und Einstellungen werden im Browser bzw. in der App
gespeichert.

## Technik

Reines HTML/JavaScript mit [three.js](https://threejs.org) r158 (liegt unter
`web/js/three.min.js`, MIT-Lizenz). Es gibt keinen Build-Schritt; alle Modelle
bestehen aus einfachen Formen, alle Töne und die Musik werden mit der
Web-Audio-API erzeugt.

Die Spiellogik läuft in festen Schritten (60 pro Sekunde); gezeichnet wird mit
Zwischenwerten zwischen zwei Schritten. Dadurch bewegen sich Figuren und Kamera
gleichmäßig, egal ob das Handy 30, 60 oder 120 Bilder pro Sekunde schafft.

| Pfad | Inhalt |
|---|---|
| `web/js/data.js` | Helden, Waffen, Bücher, Gegner, Bosse, Werkstatt, Erfolge, Hüte und Balancing-Werte |
| `web/js/core.js` | Hilfsfunktionen, Gelände, Speicher, Ton und Musik |
| `web/js/gfx.js` | Renderer, Licht und Schatten, Materialien, Himmel, Leuchtpunkte, Bloom |
| `web/js/world.js` | Landschaft, Teiche, Gras, Deko, Truhen und Schreine |
| `web/js/models.js` | Helden, Gegner, Bosse und Porträts |
| `web/js/entities.js` | Spielfigur, Gegner, Sammelobjekte, Partikel, Effekte |
| `web/js/weapons.js` | Verhalten der 25 Waffen |
| `web/js/bosses.js` | Zwischenbosse und Endboss |
| `web/js/game.js` | Rundenablauf, Eingabe, Kamera, Gegnerwellen, Kartenwahl, Hauptschleife |
| `web/js/icons.js` | Eigene Symbole (SVG) für Waffen, Bücher und Knöpfe |
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

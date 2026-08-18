# PreisApp
# PreisApp

Preisbeobachtung für den Wocheneinkauf – als Scriptable-Skript auf iPhone und iPad.

PreisApp merkt sich die Produkte, die man regelmäßig kauft, holt dazu die aktuellen
Prospektangebote, führt einen eigenen Preisverlauf und meldet sich, wenn ein Produkt
im Angebot ist. Dazu kommt ein vollständiger EAN-Teil: Barcode scannen, Prüfziffer
prüfen, Produkt in den Open-Facts-Datenbanken nachschlagen und fehlende Einträge
selbst anlegen.

Ein einziges `.js` in Scriptable – kein Konto bei mir, kein Server, keine Werbung.
Die Daten liegen in iCloud unter der eigenen Apple-ID.

| | |
|---|---|
| **Version** | 0.68 (EAN-Teil 1.00) |
| **Plattform** | iOS / iPadOS mit [Scriptable](https://scriptable.app) |
| **Sprache** | JavaScript, Oberfläche auf Deutsch |
| **Ablage** | iCloud Drive (`Scriptable/PreisApp` und `Scriptable/EAN`) |

---

## Inhalt

- [Was die App kann](#was-die-app-kann)
- [Betriebsarten](#betriebsarten)
- [Installation](#installation)
- [Ersteinrichtung](#ersteinrichtung)
  - [1. PLZ eintragen](#1-plz-eintragen)
  - [2. marktguru-Keys hinterlegen](#2-marktguru-keys-hinterlegen)
  - [3. Erstes Produkt anlegen](#3-erstes-produkt-anlegen)
  - [4. Optional: Open-Food-Facts-Konto](#4-optional-open-food-facts-konto)
  - [5. Automation für den Abruf](#5-automation-für-den-abruf)
  - [6. Optional: Widget](#6-optional-widget)
- [Einstellungen im Überblick](#einstellungen-im-überblick)
- [Zwei Geräte, zwei Apple-IDs](#zwei-geräte-zwei-apple-ids)
- [Wo die Daten liegen](#wo-die-daten-liegen)
- [Datenquellen](#datenquellen)
- [Grenzen und Hinweise](#grenzen-und-hinweise)
- [Lizenz](#lizenz)

---

## Was die App kann

### Produkte beobachten

- Produkte per Suchbegriff anlegen („Vernel Weichspüler“) und optional eine Sorte
  ergänzen („Sensitiv“), damit die Trefferliste eng bleibt
- Barcode scannen oder eintippen – die EAN wird gleich mit gespeichert
- Warenarten 🍎 Food, 🧴 Beauty, 🐶 Pet und 📦 Products; die Liste lässt sich
  danach filtern
- Suche über Name, Sorte, Händler und Angebotstext
- Filter: alle Produkte → nur solche mit Angebot → nur solche ohne EAN

### Angebote und Preise

- **Prospektangebote** von fast allen Ketten über marktguru (Aldi, Lidl, Edeka,
  Penny, Rewe …) – Aktionspreise, keine Regalpreise
- **Vergleichspreis** („statt …“) aus drei Stufen:
  1. eigener Preisverlauf – der 75-%-Wert der letzten 90 Tage, also der übliche
     obere Preis ohne einzelne Ausreißer
  2. **Open Prices** – gemeldete Ladenpreise zur EAN, Median der jüngsten
     Meldungen, höchstens ein Jahr alt
  3. zuletzt gesehener Preis als Notlösung
- **Einschätzung** je Angebot: 🟢 Bestpreis · 🟡 durchschnittlich · 🔴 eher teuer
  (ab drei erfassten Preisständen)
- **Preisverlauf** als Diagramm, günstigster Preis je Tag, bis zu 60 Tage
- **Preisalarm** als iOS-Mitteilung, sobald ein Angebot auftaucht, das mit dieser
  Kombination aus Händler und Preis noch nicht da war – je Produkt oder für alle
  auf einmal schaltbar
- Händler dauerhaft ausschließen, wenn ihre Angebote nie in Frage kommen

### Auswerten und einkaufen

- **💰 Ersparnis** – was die laufenden Angebote gegenüber dem Normalpreis bringen
- **🛒 Warenkorb-Vergleich** – der ganze Einkauf je Markt durchgerechnet, damit man
  sieht, wo sich der Weg lohnt
- **📍 Filialen in der Nähe** – Märkte der jeweiligen Kette im einstellbaren Umkreis
  (5–30 km) samt Adresse, aus OpenStreetMap
- **📋 Export in die Erinnerungen-App** – Produkte markieren, eine Erinnerung je
  Produkt, mit Preis und Anbieter in der Notiz

### EAN-Teil (📦)

- Prüfziffer nach EAN-8/EAN-13 – Zahlendreher fallen sofort auf
- Abgleich mit vier Datenbanken gleichzeitig: Open Food Facts, Open Products Facts,
  Open Beauty Facts, Open Pet Food Facts
- Fehlende Produkte selbst anlegen und Fotos senden (Vorderseite, Zutaten,
  Nährwerte) – dafür ist ein kostenloses Open-Food-Facts-Konto nötig
- Eigene Einträge verwalten: bearbeiten, Stand neu holen, Datenbank wechseln,
  bereits unter dem eigenen Konto stehende Produkte nachladen
- Gefundene Nummern werden 30 Tage zwischengespeichert

### Darstellung und Bedienung

- Hell, dunkel oder automatisch
- Produktliste als Karten oder als klassische Tabellenzeilen (je Gerät wählbar)
- Layout skaliert stufenlos vom iPhone SE bis zum iPad Pro und folgt der Drehung
- **Fußzeile frei einrichtbar**: Reihenfolge der Symbole per ▲▼, einzelne Symbole
  aus- und einblenden (⚙︎ bleibt immer sichtbar)
- Sicherung der Produktliste samt Preisverlauf, die letzten 10 bleiben erhalten
- Debug-Modus: Quellen einzeln abschalten, Treffer, Dauer und Fehler je Quelle

---

## Betriebsarten

| Aufruf | Was passiert |
|---|---|
| Skript antippen | Volle Oberfläche: Liste, Detail, Vergleich, Einstellungen |
| Homescreen-Widget | Zeigt die aktuellen Angebote aus dem Zwischenspeicher |
| `?silent=1` | Stiller Abruf ohne Dialoge – für die Automation |
| `?ean=4001600123456` | Prüft nur diese Nummer und legt sie in die Zwischenablage – für Kurzbefehle |

Das Widget ruft **nicht** selbst ab: iOS bricht Widget-Läufe nach wenigen Sekunden
hart ab, ein dort begonnener Abruf bliebe halb fertig. Deshalb zeichnet es nur den
letzten Stand; abgerufen wird über die Automation (Schritt 5).

---

## Installation

1. **Scriptable** aus dem App Store laden (kostenlos)
2. iCloud Drive für Scriptable einschalten:
   *Einstellungen → Apple-ID → iCloud → iCloud Drive → Scriptable*
3. `PreisApp.js` in den Scriptable-Ordner legen – entweder über die Dateien-App
   nach *iCloud Drive → Scriptable*, oder in Scriptable ein neues Skript anlegen
   und den Inhalt einfügen
4. Skript einmal antippen. Ohne PLZ und Keys öffnen sich direkt die Einstellungen

Ein Update ist ein Dateiaustausch: neue Fassung über die alte legen. Produkte,
Preisverlauf und Einstellungen bleiben, weil sie in eigenen Dateien liegen.

---

## Ersteinrichtung

### 1. PLZ eintragen

⚙︎ **Einstellungen → PLZ**. Sie bestimmt, welche Märkte abgefragt werden. Ohne PLZ
findet marktguru nichts.

### 2. marktguru-Keys hinterlegen

marktguru hat keine offene Schnittstelle. Die App spricht dieselbe Adresse an wie
die Webseite und braucht dafür deren beide Header. Die holt man sich einmalig am
Rechner:

1. [marktguru.de](https://www.marktguru.de) im Browser öffnen
2. Entwicklerwerkzeuge öffnen (`F12`), Reiter **Netzwerk**
3. Auf der Seite irgendein Produkt suchen
4. In der Liste einen Aufruf an `api.marktguru.de` anklicken
5. Unter **Request Headers** die Werte von `x-clientkey` und `x-apikey` kopieren
6. Beide in ⚙︎ **Einstellungen** eintragen

Die Werte liegen im Schlüsselbund des Geräts, nicht in iCloud – auf einem zweiten
Gerät trägt man sie erneut ein. Lehnt marktguru sie irgendwann ab, steht ein
Warnhinweis in den Einstellungen; dann die Schritte oben wiederholen.

### 3. Erstes Produkt anlegen

Über **＋** in der Produktliste. Zwei Regeln haben sich bewährt:

- **Breit suchen**: „Vernel Weichspüler“ statt „Vernel Weichspüler Sensitiv 800ml“
- **Sorte separat** eintragen: „Sensitiv“ – sie grenzt die Treffer ein, ohne die
  Suche zu verengen

Alternativ **Barcode scannen**: die EAN wird geprüft, in den Datenbanken
nachgeschlagen und Name samt Bild übernommen.

### 4. Optional: Open-Food-Facts-Konto

Nur nötig, wenn man **fehlende Produkte anlegen** oder **Fotos senden** möchte.
Lesen und Abgleichen geht ohne.

1. Kostenlos registrieren: <https://de.openfoodfacts.org/cgi/user.pl>
2. ⚙︎ **Einstellungen → 🌍 Open Food Facts – Login**
3. Wichtig: den **Benutzernamen** eintragen, nicht die E-Mail-Adresse – sonst wird
   die Anmeldung abgelehnt

### 5. Automation für den Abruf

Damit Angebote und Preisalarm auch ohne Öffnen der App kommen:

1. **Kurzbefehle-App → Automation → Neue Automation**
2. **Tageszeit** wählen, z. B. stündlich zwischen 7 und 20 Uhr
3. Aktion: **Skript ausführen → PreisApp**
4. Parameter/Text: `silent=1`
5. „Vor dem Ausführen fragen“ ausschalten

Von Hand geht es jederzeit über 🔄 in der Kopfzeile. Beim Öffnen ruft die App
automatisch ab, wenn der letzte Stand älter als 3 Stunden ist.

### 6. Optional: Widget

Auf dem Homescreen lange drücken → **＋** → **Scriptable** → Größe wählen. Im Widget
unter *Script* die PreisApp auswählen. Es zeigt den letzten Stand; getippt öffnet
es die App.

---

## Einstellungen im Überblick

| Eintrag | Wozu |
|---|---|
| **PLZ** | Bestimmt die abgefragten Märkte |
| **🔔 Alarm für alle Produkte** | Preisalarm für den ganzen Bestand ein/aus |
| **x-clientkey / x-apikey** | Zugang zu marktguru |
| **💶 Open Prices** | Vergleichspreise aus der Gemeinschaftsdatenbank ein/aus |
| **🌍 Open Food Facts – Login** | Nötig zum Anlegen und für Fotos |
| **🏷️ EAN-Zwischenspeicher** | Gemerkte Nummern anzeigen und leeren |
| **📍 Umkreis Filialsuche** | 5, 10, 15, 20 oder 30 km |
| **🗂 Karten-Ansicht** | Karten oder Tabellenzeilen – nur auf diesem Gerät |
| **📋 Export in Erinnerungen** | Markieren und Exportieren ein/aus, Zielliste |
| **🦶 Fußzeile** | Reihenfolge und Auswahl der Symbole |
| **🚫 Händler ausschließen** | Deren Angebote werden überall ausgeblendet |
| **💾 Sicherung** | Sichern und Wiederherstellen der Produktliste |
| **🐞 Debug-Modus** | Quellen einzeln abschalten, Kennzahlen je Quelle |
| **☁️ Speicherort** | Zeigt, ob iCloud oder ein geteilter Ordner aktiv ist |

PLZ, Keys, Login, Farbschema und Karten-Ansicht liegen im **Schlüsselbund** und
gelten je Gerät. Alles andere steht in `meta.json` und wandert über iCloud mit.

---

## Zwei Geräte, zwei Apple-IDs

Unter derselben Apple-ID gleicht sich alles von selbst ab. Für zwei **verschiedene**
Apple-IDs (z. B. im Haushalt) braucht es einen geteilten Ordner:

1. In der Dateien-App unter *iCloud Drive* einen Ordner anlegen, z. B. `PreisApp-Geteilt`
2. Ordner gedrückt halten → **Teilen → Personen einladen**, Berechtigung
   **„Kann Änderungen vornehmen“**
3. Einladung auf dem zweiten Gerät annehmen
4. **Auf jedem Gerät einzeln**: Scriptable öffnen (nicht das Skript) → Zahnrad oben
   links → **File Bookmarks → ＋ → Pick Folder** → den geteilten Ordner wählen
5. Als Namen exakt **`PreisAppShared`** eintragen – ein Wort, Groß-/Kleinschreibung
   zählt, kein Bindestrich, kein Leerzeichen

Stimmt der Name nicht, nutzt die App still ihren eigenen Ordner. Kontrolle: ganz
unten in den Einstellungen steht „👥 Geteilter Ordner aktiv“.

Gleichzeitige Änderungen werden zusammengeführt; beim selben Produkt gewinnt die
neuere Änderung. Löschungen wirken auf beiden Geräten (über Löschvermerke, die nach
60 Tagen verfallen). PLZ, Keys und der OFF-Login werden **nicht** geteilt.

---

## Wo die Daten liegen

```
iCloud Drive/Scriptable/
├── PreisApp/
│   ├── items.json           Produkte
│   ├── history.json         Preisverlauf (60 Tage)
│   ├── normal-prices.json   Vergleichspreise
│   ├── cache.json           zuletzt geholte Angebote
│   ├── seen.json            schon gemeldete Angebote (gegen Doppel-Alarm)
│   ├── meta.json            Einstellungen, die mitwandern
│   └── backups/             die letzten 10 Sicherungen
└── EAN/
    ├── meine.json           eigene EAN-Einträge
    └── eancache.json        gemerkte Datenbankabfragen
```

Alles ist lesbares JSON. Der EAN-Ordner bleibt bewusst außerhalb des geteilten
Ordners, weil die Einträge am persönlichen Open-Food-Facts-Konto hängen.

---

## Datenquellen

| Quelle | Wofür | Lizenz / Hinweis |
|---|---|---|
| [marktguru](https://www.marktguru.de) | Prospektangebote | inoffizielle Schnittstelle, privater Gebrauch |
| [Open Prices](https://prices.openfoodfacts.org) | gemeldete Ladenpreise | ODbL |
| [Open Food Facts](https://openfoodfacts.org) & Schwesterprojekte | Produktname, Bild, Kategorie | ODbL |
| [OpenStreetMap](https://www.openstreetmap.org) / Overpass | Filialen und Adressen | ODbL |
| [ZXing](https://github.com/zxing-js/library) | Barcode-Erkennung | Apache 2.0 |

Händlerlogos sind Marken der jeweiligen Unternehmen.

---

## Grenzen und Hinweise

- **Maßgeblich ist immer der Preis im Markt.** Angebote, Preise und Verfügbarkeiten
  stammen von Dritten und können falsch oder veraltet sein.
- marktguru veröffentlicht keine offene Schnittstelle. Die Keys können jederzeit
  ungültig werden; die App sagt dann Bescheid.
- Open Prices liefert nur zu Produkten mit EAN etwas, und nur, wenn jemand den
  Preis gemeldet hat.
- Der Preisalarm hängt an der Automation. Ohne sie kommen Mitteilungen nur, wenn
  die App geöffnet wird.
- Fotos, die man an Open Food Facts sendet, stehen anschließend unter CC BY-SA –
  also nur eigene Aufnahmen hochladen.
- Das Skript ist für den privaten Eigengebrauch gedacht.

---

## Lizenz

© 2026 Holger Hüttmann. Alle Rechte vorbehalten.

Für den privaten Eigengebrauch. Weitergabe, Veröffentlichung oder kommerzielle
Nutzung nur mit ausdrücklicher Zustimmung. Die Software wird ohne Gewähr
bereitgestellt.


// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: shopping-basket;
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: shopping-bag;
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: barcode;
// gesamt – PreisApp & EAN in einer Datei (Scriptable, iOS)
// ========================================================
//
// Zwei bisher getrennte Skripte, zusammengelegt: PreisApp (Angebote,
// Preisalarm, Vergleich) und EAN (Prüfziffer, Abgleich mit den vier
// Open-Facts-Datenbanken, Anlegen fehlender Produkte, Fotos). Beide
// behalten ihren vollen Funktionsumfang; doppelt Vorhandenes –
// Farbschema, Maße, Zeilenformen, Netzabfrage – gibt es nur noch einmal.
//
// Was sich dadurch ändert:
//   • importModule("EAN") entfällt – der Abgleich läuft im selben Lauf
//   • die Einstellung „EAN-Skript“ entfällt, es gibt nichts mehr zu wählen
//   • eigene Einträge stehen unter 📦 in der Symbolleiste
//   • Ablage bleibt getrennt: Scriptable/PreisApp und Scriptable/EAN
//
// Copyright (c) 2026 Holger. Alle Rechte vorbehalten.
//
// Dieses Skript ist für den privaten Eigengebrauch bestimmt.
// Weitergabe, Veröffentlichung oder kommerzielle Nutzung nur mit
// ausdrücklicher Zustimmung des Urhebers.
//
// Die Software wird ohne Gewähr bereitgestellt. Preise, Angebote und
// Verfügbarkeiten stammen von Dritten und können falsch oder veraltet
// sein – maßgeblich ist immer der Preis im Markt.
//
// Verwendete fremde Dienste und Bibliotheken bleiben Eigentum ihrer
// jeweiligen Rechteinhaber:
//   • marktguru        – inoffizielle Schnittstelle, privater Gebrauch
//   • Open Prices (prices.openfoodfacts.org) – Open Database License (ODbL),
//                        gemeldete Ladenpreise als Vergleichswert
//   • Open Food Facts – Open Database License (ODbL)
//   • OpenStreetMap / Overpass – ODbL, Filialen und Adressen
//   • ZXing (@zxing/library) – Apache License 2.0, Barcode-Erkennung
//   • Logos der Händler – Marken der jeweiligen Unternehmen
//
// --------------------------------------------------
// Läuft in drei Modi:
//   • App (Skript antippen)      -> Liste, Vergleich, Hinzufügen/Löschen
//   • Widget (Homescreen)        -> aktuelle Angebote auf einen Blick
//   • Stiller Lauf (?silent=1)   -> Aktualisierung im Hintergrund
//   • Mit Nummer (?ean=40016…)   -> nur Abgleich, für Kurzbefehle
//
// Einrichtung: in der App unter ❓ (Einrichtung & Hilfe)

// ─── Konfiguration ───────────────────────────────────────────────
const APP_VERSION = "0.68";
const APP_COPYRIGHT = "© 2026 Holger Hüttmann";

// Märkte in der Nähe: Umkreis der Suche und Anzahl der angezeigten Filialen.
// Der Umkreis ist in den Einstellungen wählbar; MARKET_RADIUS_KM ist die
// Vorgabe, solange nichts eingestellt wurde.
const MARKET_RADIUS_KM = 10;
const MARKET_RADIUS_CHOICES = [5, 10, 15, 20, 30];
const MARKET_MAX = 8;

// Version des EAN-Teils. Sie wird getrennt gezählt, weil sie im
// User-Agent gegenüber Open Food Facts steht und dort erkennbar bleiben
// soll – gezählt ab 0.00, immer mit zwei Nachkommastellen:
//   • Minor (+0.01)  Fehlerbehebung, Feinschliff, Ergänzung
//   • Major (+1.00)  alles, was Bestehendes bricht: geänderte Rückgaben,
//                    entfernte Ausfuhren, neues Format von eancache.json
//                    oder meine.json. Die Minor-Stelle fängt bei 00 an.
// 1.00: aus dem eigenständigen Skript wurde ein Teil dieser Datei –
// module.exports ist fort, damit fällt jede Einbindung von außen weg.
const EAN_VERSION_MAJOR = 1;
const EAN_VERSION_MINOR = 0;
const EAN_VERSION = EAN_VERSION_MAJOR + "." + String(EAN_VERSION_MINOR).padStart(2, "0");

// Bezugsquelle für appicon.png. Fehlt die Datei im Datenordner, wird sie beim
// Start einmalig von hier geladen. Leer lassen schaltet den Download ab.
const ICON_URL = "https://raw.githubusercontent.com/HolgerHue/PreisApp/main/appicon.png";


// ─── PreisApp-Icon ─────────────────────────────────────────────────
// Das App-Icon liegt als Datei im Datenordner (appicon.png) und nicht mehr
// im Skript: 337 KB Base64 mussten sonst bei jedem Lauf mitgeladen und
// dekodiert werden. Die Datei liegt neben items.json und wird über iCloud
// mitsynchronisiert; fehlt sie, läuft alles ohne Icon weiter.
let iconCache;                       // undefined = noch nicht geladen

/**
 * Fehlt appicon.png im Datenordner, wird sie einmalig von ICON_URL geladen.
 * Läuft still: ohne Netz, ohne URL oder bei einem Fehler geht es ohne Icon
 * weiter. Muss vor der ersten Anzeige laufen, weil preisAppIcon() nur liest.
 */
async function ensureAppIcon() {
  if (!ICON_URL) return false;
  try {
    const file = FM.joinPath(DIR, "appicon.png");
    if (FM.fileExists(file)) {
      await ensureLocal(file);
      // Eine leere Datei ist so gut wie keine – dann neu holen
      if (FM.fileSize(file) > 0) return false;
    }
    const req = newRequest(ICON_URL);
    const img = await req.loadImage();
    if (!img) return false;
    if (!FM.fileExists(DIR)) FM.createDirectory(DIR, true);
    FM.writeImage(file, img);
    iconCache = img;                  // sofort verwendbar, ohne erneutes Lesen
    return true;
  } catch (e) {
    console.error("appicon.png: " + e.message);
    return false;
  }
}

function preisAppIcon() {
  if (iconCache !== undefined) return iconCache;   // nur einmal je Lauf laden
  iconCache = null;
  try {
    const file = FM.joinPath(DIR, "appicon.png");  // FM/DIR stehen weiter unten
    if (FM.fileExists(file)) {
      if (FM.isFileStoredIniCloud(file)) FM.downloadFileFromiCloud(file);
      iconCache = FM.readImage(file);
    }
  } catch (e) {}
  return iconCache;
}

/**
 * Änderungshistorie – neueste Fassung zuerst.
 * Bei jeder Änderung hier oben einen Eintrag ergänzen und APP_VERSION
 * anpassen; die App zeigt die Liste unter ❓ → „Änderungen“.
 * Versionsschema Major.Minor.Patch:
 *   Patch (0.48.1) – Fehlerbehebung, Kosmetik
 *   Minor (0.49)   – neue Funktion
 *   Major (1.0.0)  – Veröffentlichung; danach 2.0.0 nur bei Bruch,
 *                    z. B. wenn items.json nicht mehr gelesen werden kann
 */
const CHANGELOG = [
  {
    version: "0.68",
    date: "18.08.2026",
    note: "Fußzeile in den Einstellungen einrichten",
    changes: [
      "Neue Zeile „🦶 Fußzeile“ in den Einstellungen: Reihenfolge per ▲▼, Symbole einzeln aus- und wieder einblenden",
      "Vorschau zeigt die Fußzeile, bevor man die Ansicht verlässt",
      "⚙︎ lässt sich nicht ausblenden – sonst wäre der Weg in die Einstellungen verbaut",
      "„↩︎ Vorgabe wiederherstellen“ stellt die Reihenfolge aus FOOTER_ICONS wieder her",
      "Die Auswahl liegt in meta.json und gilt damit auf allen Geräten mit demselben Ordner",
      "FOOTER_ICONS am Dateianfang ist nur noch die Vorgabe – zum Ändern muss das Skript nicht mehr angefasst werden",
    ],
  },
  {
    version: "0.67",
    date: "17.08.2026",
    note: "Rückweg aus den eigenen Einträgen",
    changes: [
      "„‹ Zurück zur Übersicht“ steht jetzt auch über 📦 Meine Einträge – wie in allen anderen Ansichten",
      "Skript-Symbol ist ein Barcode; die doppelte Kopfzeile am Dateianfang ist entfernt",
    ],
  },
  {
    version: "0.66",
    date: "17.08.2026",
    note: "PreisApp und EAN in einer Datei",
    changes: [
      "Das Skript „EAN“ steckt jetzt in dieser Datei – kein importModule, kein zweites Skript im Ordner",
      "Der Abgleich läuft ohne Umweg; fehlt etwas, meldet sich derselbe Dialog wie bisher",
      "Neues Symbol 📦 in der Fußzeile: meine eigenen Einträge, bearbeiten, Stand holen, Foto senden, Datenbank wechseln",
      "Open-Food-Facts-Login und der Zwischenspeicher des Abgleichs stehen in den Einstellungen",
      "Die Einstellung „EAN-Skript“ und die Skriptauswahl sind entfallen",
      "Aufruf mit ?ean=… prüft nur die Nummer – wie der bisherige Start des EAN-Skripts aus einem Kurzbefehl",
      "Farbschema, Maße, Zeilenhöhen und Netzabfrage teilen sich beide Teile – die Darstellung bleibt unverändert",
    ],
  },
  {
    version: "0.65",
    date: "17.08.2026",
    note: "Adressen der Filialen wieder vollständig",
    changes: [
      "Die Rückwärtssuche rief eine Methode auf, die es in Scriptable nicht gibt – fehlende Hausnummern blieben leer und es gab Fehlermeldungen",
      "Bei einem Ausfall wird der Dienst für den Rest des Laufs übersprungen statt je Filiale erneut zu scheitern",
    ],
  },
  {
    version: "0.64",
    date: "17.08.2026",
    note: "Melden von Ladenpreisen entfernt",
    changes: [
      "Die Zeile „Ladenpreis melden“ im Produktdetail ist weg – PreisApp liest Open Prices nur noch",
      "Zugehörige Funktion und der Hinweis in der Hilfe ebenfalls entfernt",
    ],
  },
  {
    version: "0.63",
    date: "17.08.2026",
    note: "Open Prices als vollwertige Quelle",
    changes: [
      "Open Prices steht jetzt neben marktguru in SOURCES und ist im Debug-Modus einzeln abschaltbar",
      "Kennzahlen im Debug-Modus: Treffer, Abfragen, Laufzeit und Fehlermeldung wie bei den Angebotsquellen",
      "Neue Debug-Zeile zeigt, woher die Standardpreise stammen (Verlauf, Open Prices, zuletzt gesehen, ohne)",
      "Standardpreis ist der Median der jüngsten Meldungen statt des ersten Treffers",
      "Der Vergleichswert wird für jedes Produkt ermittelt, auch mit laufendem Angebot – und parallel statt nacheinander",
      "Ein einzelner „zuletzt gesehen“-Preis tritt hinter eine echte Open-Prices-Meldung zurück",
      "Open Prices in Quellenangabe, Hilfe und Kopfzeile genannt (ODbL)",
    ],
  },
  {
    version: "0.62",
    date: "17.08.2026",
    note: "Skriptauswahl zeigt nur noch echte Skripte",
    changes: [
      "In der Auswahl für den EAN-Abgleich stand „preisapp-zxing“ – das ist kein Skript, sondern der zwischengespeicherte Code der Bilderkennung",
      "Der Zwischenspeicher liegt jetzt im Unterordner PreisApp-cache statt neben den Skripten",
      "Eine vorhandene alte Datei wird beim nächsten Scan automatisch umgezogen",
    ],
  },
  {
    version: "0.61",
    date: "17.08.2026",
    note: "Ladenpreise von Open Prices",
    changes: [
      "Neue Preisquelle: gemeldete Ladenpreise aus der Open-Prices-Datenbank, wenn der eigene Verlauf noch nichts hergibt",
      "Greift nur bei Produkten mit EAN, nur Euro-Preise, höchstens ein Jahr alt",
      "Im Produktdetail lässt sich ein selbst gesehener Ladenpreis melden",
      "In den Einstellungen abschaltbar",
    ],
  },
  {
    version: "0.60",
    date: "17.08.2026",
    note: "EAN-Abgleich ohne App-Wechsel",
    changes: [
      "Behoben: PreisApp schloss sich beim Scannen oder Eintippen einer EAN, ohne dass etwas passierte",
      "Der Abgleich läuft jetzt im selben Lauf – PreisApp bleibt offen, die Liste wird nicht neu aufgebaut",
      "Fehlt das Skript „EAN“, meldet die App das deutlich statt still zu enden",
    ],
  },
  {
    version: "0.59",
    date: "17.08.2026",
    note: "Kopfzeile schneidet nichts mehr ab",
    changes: [
      "Die Kopfzeile wächst mit ihrem Text – die langen Warenart-Namen wurden abgeschnitten",
      "Im Kopf steht die Warenart als Kurzform mit Symbol",
      "„1 Markt“ statt „1 Märkte“",
    ],
  },
  {
    version: "0.58",
    date: "17.08.2026",
    note: "Warenarten heißen wie die Datenbanken",
    changes: [
      "Food, Beauty, Pet und Products statt Food, Non-Food und Tierbedarf",
      "Drogerie und Kosmetik sind jetzt eine eigene Warenart statt Teil von Non-Food",
      "Vorhandene Produkte mit „Non-Food“ werden beim Start auf „Products“ gezogen",
    ],
  },
  {
    version: "0.57",
    date: "17.08.2026",
    note: "Unbekannte EAN sauber anlegen",
    changes: [
      "Leerer Anzeigename wird gemeldet, statt still nichts anzulegen",
      "Steht die EAN in keiner Datenbank, wird die Warenart abgefragt – vorher blieb sie unbestimmt",
      "„Bereits vorhanden“ sagt jetzt, dass die EAN nicht übernommen wurde",
    ],
  },
  {
    version: "0.56",
    date: "17.08.2026",
    note: "Ansichten nutzen die volle Bildschirmhöhe",
    changes: [
      "Kurze Ansichten füllen den Bildschirm bis unten statt im Systemhintergrund zu enden",
      "Die Symbolleiste sitzt am unteren Rand, auch wenn die Liste kurz ist",
    ],
  },
  {
    version: "0.55",
    date: "16.08.2026",
    note: "EAN-Abgleich ausgelagert",
    changes: [
      "Barcode-Nummern bearbeitet das eigene Skript „EAN“ – PreisApp übergibt nur noch die Nummer",
      "Prüfziffer, Abgleich mit den Open-Facts-Datenbanken und das Anlegen fehlender Produkte liegen dort",
      "Der Open-Food-Facts-Login ist aus den Einstellungen verschwunden und wohnt jetzt in der EAN-App",
      "Nach dem Abgleich startet PreisApp von selbst wieder und übernimmt Name, Bild und Kategorie",
      "Scannen und Eintippen bleiben in PreisApp",
      "Behoben: beim Umbau waren Vergleichspreis-Hilfen und die Angebotsfilterung mit herausgefallen",
    ],
  },
  {
    version: "0.54",
    date: "16.08.2026",
    note: "Abgelaufene Angebote verschwinden zuverlässig",
    changes: [
      "Liste, Detail, Widget, Verlauf und Export lesen Angebote nur noch über eine gemeinsame Stelle, die Abgelaufenes ausblendet",
      "Angebote ohne Enddatum gelten nach 14 Tagen als abgelaufen – bisher blieben sie unbegrenzt stehen",
      "Läuft ein Angebot über mehrere Zeiträume, zählt das späteste Ende statt des erstgenannten",
      "Enddatum wird als Datum gelesen, nicht als Uhrzeit – ein Angebot lief dadurch je nach Zeitzone einen Tag zu lang",
      "Bleibt bei einer gestörten Quelle der alte Stand stehen, wird er vorher von Abgelaufenem befreit",
    ],
  },
  {
    version: "0.53",
    date: "16.08.2026",
    note: "Filialsuche sichtbar gemacht",
    changes: [
      "📍 vor dem Händlernamen zeigt im Produktdetail an, dass dahinter die Filialsuche liegt – Angebotszeilen und Kopfzeile",
      "Das bisherige 🏷️ ohne Logo entfällt, das 📍 steht an seiner Stelle",
    ],
  },
  {
    version: "0.52.4",
    date: "16.08.2026",
    note: "Code aufgeräumt",
    changes: [
      "Alle Einstellungszeilen entstehen aus einer gemeinsamen Grundform statt aus je 20 gleichen Zeilen",
      "Hilfezeilen (Symbol, Schritt, Warnung) teilen sich ebenfalls eine Grundform",
      "Beide Mitteilungen laufen über eine gemeinsame Funktion",
      "Rund 140 Zeilen weniger, Verhalten und Aussehen unverändert",
    ],
  },
  {
    version: "0.52.3",
    date: "16.08.2026",
    note: "Einstellungen aufgeräumt",
    changes: [
      "Anleitung zu den marktguru-Keys aus dem Kopf der Einstellungen entfernt – sie steht in der Hilfe unter „Ersteinrichtung“",
    ],
  },
  {
    version: "0.52.2",
    date: "16.08.2026",
    note: "Einstellungen: Zurück oben",
    changes: [
      "„✓ Fertig“ am Ende der Einstellungen entfällt – oben steht jetzt „‹ Zurück zur Übersicht“",
    ],
  },
  {
    version: "0.52.1",
    date: "16.08.2026",
    note: "Route öffnen und wählbarer Umkreis",
    changes: [
      "Absturz beim Antippen einer Filiale behoben – Scriptable kennt Safari.open(), nicht Safari.openURL()",
      "Lässt sich Karten nicht öffnen, landet die Adresse in der Zwischenablage",
      "Umkreis der Filialsuche in den Einstellungen wählbar: 5, 10, 15, 20 oder 30 km",
      "Der Umkreis steckt im Zwischenspeicher-Schlüssel – ein Wechsel zurück ist sofort wieder da",
    ],
  },
  {
    version: "0.52",
    date: "16.08.2026",
    note: "Filialsuche im Produktdetail",
    changes: [
      "Filialsuche sitzt jetzt im Produktdetail: Tippen auf Logo oder Händlernamen einer Angebotszeile",
      "Auch die Kopfzeile mit dem besten Preis führt zu den Filialen",
      "Übersicht bleibt unverändert – dort ist der Händler wieder nur Text",
      "Das Fenster öffnet sofort und zeigt „Filialen werden gesucht …“ samt Zwischenstand",
    ],
  },
  {
    version: "0.51",
    date: "16.08.2026",
    note: "Märkte in der Nähe",
    changes: [
      "Neue Filialsuche: nächstgelegene Märkte einer Kette mit Adresse und Entfernung",
      "Grundlage ist der Gerätestandort, ersatzweise die eingetragene PLZ",
      "Filialdaten kommen von OpenStreetMap (Overpass) und werden 30 Tage zwischengespeichert",
      "Antippen einer Filiale öffnet die Route in Apple Karten",
      "Umkreis und Anzahl stehen als Konstanten am Dateianfang (10 km, 8 Filialen)",
    ],
  },
  {
    version: "0.50",
    date: "15.08.2026",
    note: "Sicherer und genauer",
    changes: [
      "Sicherung enthält jetzt auch den Preisverlauf – der einzige Bestand, der sich nicht neu aufbaut",
      "Wiederherstellen führt den Verlauf zusammen, statt ihn zu ersetzen",
      "Unlesbare Dateien werden nicht mehr überschrieben – ein Lesefehler löscht keine Daten mehr",
      "Auf iCloud-Dateien wird jetzt gewartet, statt an ihnen vorbeizulesen",
      "Vergleichspreis ist der 75-%-Wert der letzten 90 Tage statt des zuletzt gesehenen Angebotspreises",
      "Neue Mitteilung, wenn ein beobachtetes Angebot heute oder morgen ausläuft",
      "Das Widget zeichnet nur noch aus dem Speicher und zeigt den Zeitpunkt des letzten Abrufs",
      "marktguru liefert 40 statt 80 Treffer je Abfrage; gespeichert werden bis zu 12 Angebote je Produkt",
    ],
  },
  {
    version: "0.49.1",
    date: "15.08.2026",
    note: "Aufgeräumt",
    changes: [
      "Nie aufgerufene Antwort-Auswertung und ein doppelter Kommentarblock entfernt",
      "Zwei Prüfziffer-Funktionen zu einer zusammengeführt",
      "Merker „looseMatch“ und „failed“ entfernt – sie wurden nie ausgewertet",
      "Doppelte Abschnittsüberschrift und eine Hilfsfunktion mit krummem Namen bereinigt",
    ],
  },
  {
    version: "0.49",
    date: "15.08.2026",
    note: "Weniger Netzabfragen",
    changes: [
      "Gleicher Suchbegriff wird je Lauf nur einmal bei marktguru abgefragt",
      "Erfolglose Bildsuche wird gemerkt – kein Open-Food-Facts-Aufruf bei jedem Lauf",
      "Defekte Bild-URLs und fehlende Logos werden dauerhaft übersprungen",
      "Gescannte EANs werden 30 Tage zwischengespeichert",
      "Im Widget entfällt die Bildsuche; Bilder und Logos brechen bei Zeitnot ab",
      "Bilder werden gesammelt gespeichert statt einzeln nach jedem Fund",
      "Letzte Reste von Open Prices entfernt (Quelle, Debug-Liste, Quellenangabe)",
    ],
  },
  {
    version: "0.48",
    date: "15.08.2026",
    note: "Versionsnummern fortlaufend",
    changes: [
      "Schema jetzt Major.Minor.Patch – 0.1 … 0.43 wie bisher, danach 0.44 bis 0.48",
      "Der Sprung auf 1.0 entfällt; 1.0.0 kommt erst zur Veröffentlichung",
      "Neue Funktion erhöht die Minor-Stelle, eine Fehlerbehebung die Patch-Stelle",
    ],
  },
  {
    version: "0.47",
    date: "15.08.2026",
    note: "Nur noch marktguru",
    changes: [
      "Open Prices vollständig entfernt – Abfrage, Quelle, Statistik und Hilfetexte",
      "Vergleichswert ist jetzt der zuletzt selbst beobachtete Preis",
      "Verlauf enthält wieder ausschließlich Angebote",
      "Die EAN dient weiterhin Produktname und Bild über Open Food Facts",
    ],
  },
  {
    version: "0.46",
    date: "15.08.2026",
    note: "Kein abgeschnittener Text mehr",
    changes: [
      "Alle Zeilen setzen eine eigene Schrift – die Systemtextgröße sprengt die Zeilen nicht mehr",
      "Zeilenhöhe wird aus dem Umbruch des Untertitels berechnet statt fest gesetzt",
      "Angebotszeilen im Detail passen sich langen Produkttexten an",
      "Titel „Im Angebot an … Tagen“ gekürzt zu „Angebotstage: x von y“",
    ],
  },
  {
    version: "0.45",
    date: "15.08.2026",
    note: "Darstellung auf allen Geräten",
    changes: [
      "Zwei Produkte nebeneinander ab iPhone Plus/Max, drei im iPad-Querformat",
      "Bildspalte richtet sich nach Gerät und Lage – im iPad-Querformat nur noch 5 %",
      "Antippbare Zeilen sind mindestens 44 pt hoch (Apple-Vorgabe)",
      "Schrift auf dem iPhone SE größer, Untergrenze 11 pt",
      "Zeilen und Diagramme auf dem iPad flacher statt bildschirmfüllend",
    ],
  },
  {
    version: "0.44",
    date: "15.08.2026",
    note: "Erste fertige Fassung – Karten-Ansicht durchgängig",
    changes: [
      "Karten in allen Ansichten: Produktliste, Ersparnis, Warenkorb-Vergleich und Detail",
      "Spaltenbreiten wachsen stufenlos mit der Bildschirmbreite – vom mini bis zum iPad",
      "Abschnitte sind durch Abstände statt Zebrastreifen getrennt",
      "Erste durchgängig fertige Fassung der Oberfläche",
    ],
  },
  {
    version: "0.43",
    date: "15.08.2026",
    note: "Fehlerbehebung",
    changes: [
      "Absturz beim Start behoben – die Funktion zum Aufräumen abgelaufener Angebote fehlte",
    ],
  },
  {
    version: "0.42",
    date: "15.08.2026",
    note: "Karten-Ansicht für Produkte",
    changes: [
      "Produkte erscheinen als Karten: Bild, Name und großer Preis oben, Details darunter",
      "Ersparnis „statt X €“ wird grün hervorgehoben",
      "Umschalter in den Einstellungen – die klassische Zeilenansicht bleibt wählbar",
    ],
  },
  {
    version: "0.41",
    date: "15.08.2026",
    note: "Abgelaufene Angebote, Widget-Frist, ruhigerer Alarm",
    changes: [
      "Abgelaufene Aktionen werden verworfen – kein Alarm, kein Bestpreis, kein Eintrag im Verlauf",
      "Der Zwischenspeicher wird bei jedem Start von abgelaufenen Angeboten befreit",
      "Widget-Läufe brechen nach 15 Sekunden ab und warten 15 Minuten bis zum nächsten Versuch",
      "Alarm meldet dieselbe Aktion nicht mehr erneut, wenn sich nur der Preis um Cent ändert",
      "Bis zu 2000 gemerkte Angebote statt 500",
    ],
  },
  {
    version: "0.40",
    date: "15.08.2026",
    note: "EAN-Prüfziffer und Schutz vor Datenverlust",
    changes: [
      "EAN-Eingabe prüft die GTIN-Prüfziffer – Zahlendreher fallen sofort auf",
      "Fällt eine Quelle aus, bleiben die zuletzt gefundenen Angebote stehen statt gelöscht zu werden",
      "Behaltene Angebote wandern nicht als heutiger Preisstand in den Verlauf",
      "Kopfzeile weist auf einen alten Stand hin, solange eine Quelle stört",
    ],
  },
  {
    version: "0.39",
    date: "15.08.2026",
    note: "Feld Ort entfernt",
    changes: [
      "Das Feld Ort ist aus den Einstellungen verschwunden – Open Prices fragt ohnehin ohne Ortsbezug ab",
    ],
  },
  {
    version: "0.38",
    date: "15.08.2026",
    note: "Einkaufswagen als Skript-Symbol",
    changes: [
      "icon-glyph auf shopping-cart gesetzt – Scriptable zeigt den Wagen vor dem Skriptnamen",
    ],
  },
  {
    version: "0.37",
    date: "15.08.2026",
    note: "App-Icon wird bei Bedarf geladen",
    changes: [
      "Fehlt appicon.png im Datenordner, wird sie beim Start von ICON_URL geholt",
      "ICON_URL steht als Variable am Dateianfang",
    ],
  },
  {
    version: "0.36",
    date: "15.08.2026",
    note: "Normalpreis robuster, Hinweis auf abgelaufene Schlüssel",
    changes: [
      "Open Prices liefert den Median der jüngsten Einträge statt eines einzelnen Werts",
      "Normalpreise älter als 180 Tage gelten als veraltet und werden nicht mehr verrechnet",
      "Einschätzung erscheint auch ohne Angebot – dann auf Basis des Normalpreises",
      "Widget-Titel nennt, ob Angebote, Preise oder beides zu sehen sind",
      "Einstellungen warnen, wenn marktguru die Schlüssel mit 401/403 ablehnt",
    ],
  },
  {
    version: "0.35",
    date: "15.08.2026",
    note: "Verlauf ohne Rückkopplung",
    changes: [
      "In den Verlauf wandern ohne Angebot nur echte Open-Prices-Werte, nicht der Rückfall „zuletzt gesehen“",
    ],
  },
  {
    version: "0.34",
    date: "15.08.2026",
    note: "Aktualisieren ohne Popup",
    changes: [
      "Nach der manuellen Aktualisierung erscheint kein Bestätigungsfenster mehr",
      "Hinweis nur noch, wenn eine Quelle nicht erreichbar war",
    ],
  },
  {
    version: "0.33",
    date: "15.08.2026",
    note: "Normalpreis für jedes Produkt",
    changes: [
      "Open Prices wird jetzt für alle Produkte abgefragt, nicht nur für die ohne Angebot",
      "Liste zeigt beim Angebot „statt X €“, das Detail die Ersparnis in Euro und Prozent",
      "Ohne Angebot geht der Normalpreis in Verlauf und Einschätzung ein",
    ],
  },
  {
    version: "0.32",
    date: "14.08.2026",
    note: "Kennzahlen der Quellen aussagekräftiger",
    changes: [
      "Debug-Modus zeigt Treffer im Verhältnis zu den Abfragen",
      "Open Prices zählt Produkte ohne EAN gesondert – sie werden gar nicht abgefragt",
    ],
  },
  {
    version: "0.31",
    date: "14.08.2026",
    note: "Open Prices ohne Ortsbezug",
    changes: [
      "Open Prices fragt wieder ohne PLZ und ohne Ort ab – es zählt der neueste Preis",
    ],
  },
  {
    version: "0.30",
    date: "14.08.2026",
    note: "Ort in den Einstellungen, REWE entfernt",
    changes: [
      "Neues Feld Ort in den Einstellungen – die PLZ gilt weiter für marktguru",
      "Open Prices bevorzugt Preise aus dem eingestellten Ort",
      "REWE-Onlineshop komplett entfernt: Marktsuche und Regalpreis sind über Scriptable nicht mehr erreichbar",
      "marktguru und Open Prices melden jetzt ebenfalls Statuscode und Fehlertext",
    ],
  },
  {
    version: "0.29",
    date: "14.08.2026",
    note: "Fehlertext der Quelle anzeigen",
    changes: [
      "Schickt eine Quelle einen Fehlertext im JSON mit, steht er jetzt in der Meldung",
    ],
  },
  {
    version: "0.28",
    date: "14.08.2026",
    note: "REWE-Marktsuche robuster",
    changes: [
      "Marktliste wird nicht mehr an einem festen Pfad erwartet, sondern in der Antwort gesucht",
      "Bleibt sie leer, nennt die Meldung den Aufbau der Antwort",
    ],
  },
  {
    version: "0.27",
    date: "14.08.2026",
    note: "Fehlersuche REWE",
    changes: [
      "Quellen melden jetzt HTTP-Status statt still 0 Treffer zu liefern",
      "HTML-Antworten (Bot-Schutz) werden als solche erkannt und benannt",
      "REWE: leere Marktliste und Marktabfragen ohne Antwort erscheinen im Debug-Modus",
    ],
  },
  {
    version: "0.26",
    date: "14.08.2026",
    note: "Tempo und Datenverbrauch",
    changes: [
      "Widget ruft nur noch ab, wenn die Daten älter als 3 Stunden sind",
      "Jede Netzabfrage bricht nach 12 Sekunden ab – eine hängende Quelle blockiert nicht mehr den Lauf",
      "App-Icon liegt als appicon.png im Datenordner statt im Skript (Datei jetzt rund ein Drittel so groß)",
    ],
  },
  {
    version: "0.25",
    date: "14.08.2026",
    note: "Fortschrittsbalken in der Liste",
    changes: [
      "Der Fortschritt beim Aktualisieren ersetzt nicht mehr die Ansicht",
      "Der Balken erscheint als Zeile unter der Werkzeugzeile, die Produkte bleiben sichtbar",
      "Balken verschwindet nach dem Lauf automatisch, auch bei Fehlern",
    ],
  },
  {
    version: "0.24",
    date: "14.08.2026",
    note: "Änderungshistorie eingeklappt",
    changes: [
      "Alle Versionen werden eingeklappt angezeigt – nur Nummer, Datum und Kurztext",
      "Details erscheinen erst beim Antippen einer Version (▸ / ▾)",
      "Es ist immer nur eine Version gleichzeitig aufgeklappt",
    ],
  },
  {
    version: "0.23",
    date: "14.08.2026",
    note: "PreisApp-Icon in der Hauptansicht",
    changes: [
      "Das neue PreisApp-Icon wird jetzt direkt in der Hauptansicht angezeigt",
      "Das gleiche Icon wird weiterhin im Hilfe-/Über-Bereich verwendet",
      "Icon und Versionsstand sind damit innerhalb der Scriptable-App konsistent",
    ],
  },
  {
    version: "0.22",
    date: "14.08.2026",
    note: "Neues PreisApp-Icon",
    changes: [
      "Neues einheitliches PreisApp-Icon für Scriptable und die App",
      "Icon wird im Bereich „Über PreisApp“ angezeigt",
      "Versionsnummer angehoben",
    ],
  },
  {
    version: "0.21",
    date: "14.08.2026",
    note: "Änderungshistorie verbessert",
    changes: [
      "Versionshistorie kompakt und aufklappbar",
      "Details werden erst beim Öffnen einer Version angezeigt",
    ],
  },

  {
    version: "0.20",
    date: "13.08.2026",
    note: "Open Prices als eigene Quelle",
    changes: [
      "Eigener Schalter in SOURCES, unabhängig von marktguru und REWE",
      "Im Debug-Modus einzeln abschaltbar, mit Treffern und Fehlern",
      "Reihenfolge bei fehlendem Angebot in der Hilfe sichtbar",
    ],
  },
  {
    version: "0.19",
    date: "13.08.2026",
    note: "Fortschrittsanzeige beim Aktualisieren",
    changes: [
      "Fortschrittsbalken während des manuellen Aktualisierens",
      "Zeigt Phase (Angebote/Normalpreise/Bilder/Logos) und Stand",
      "Manuelles Aktualisieren fragt jede aktive Quelle für jedes Produkt ab",
      "Sonst übersprungene Quellen nach einem Fehler jetzt erzwungen",
    ],
  },
  {
    version: "0.18",
    date: "13.08.2026",
    note: "Normalpreis zuverlässiger ermittelt",
    changes: [
      "Ohne Angebot wird zusätzlich ein REWE-Regalpreis versucht",
      "Nur wenn REWE nicht ohnehin schon als Angebotsquelle läuft",
      "Reihenfolge: Open Prices (EAN) → REWE-Regalpreis → eigene Historie",
    ],
  },
  {
    version: "0.17",
    date: "13.08.2026",
    note: "Skalierung auf großen iPads gedämpft",
    changes: [
      "iPad Pro 12.9\": Schrift und Zeilen wirkten überdimensioniert",
      "iPhone unverändert – dort passte die Größe bereits",
      "Nur ein Teil des Zuwachses über der iPhone-Größe wirkt jetzt auf dem iPad",
    ],
  },
  {
    version: "0.16",
    date: "13.08.2026",
    note: "kaufDA und weekli wieder entfernt",
    changes: [
      "Beide hatten keine offene Schnittstelle – FLYER_PORTALS ersatzlos raus",
      "Copyright, Credits und Hilfe bereinigt",
    ],
  },
  {
    version: "0.15",
    date: "13.08.2026",
    note: "Debug-Modus",
    changes: [
      "Quellen einzeln abschaltbar, ohne das Skript zu ändern",
      "Je Quelle Treffer, Dauer und letzter Fehler sichtbar",
      "Warnhinweis in der Liste, solange eine Quelle abgeschaltet ist",
    ],
  },
  {
    version: "0.14",
    date: "13.08.2026",
    note: "Weitere Prospektquellen vorbereitet",
    changes: [
      "kaufDA und weekli als Quellen angelegt (FLYER_PORTALS)",
      "Ab Werk aus – beide veröffentlichen keine offene Schnittstelle",
      "Antworten werden großzügig ausgewertet, gängige Feldnamen erkannt",
      "Beide im Copyright hinter marktguru und REWE genannt",
    ],
  },
  {
    version: "0.13",
    date: "13.08.2026",
    note: "Fußzeile konfigurierbar",
    changes: [
      "Reihenfolge der Symbole über FOOTER_ICONS am Dateianfang änderbar",
      "Einträge weglassen blendet einzelne Symbole aus",
      "Breite passt sich der Anzahl der Symbole an",
    ],
  },
  {
    version: "0.12",
    date: "13.08.2026",
    note: "Anpassung an Gerät und Ausrichtung",
    changes: [
      "Diagramme nutzen die tatsächliche Fensterbreite statt der kurzen Bildschirmkante",
      "Querformat und iPad: keine hochskalierten, unscharfen Diagramme mehr",
      "Spaltenaufteilung richtet sich nach der aktuell sichtbaren Breite",
      "Produktbild im Querformat kleiner, damit die Liste sichtbar bleibt",
      "Zeilenhöhen auf großen Geräten gedämpft – mehr Produkte je Bildschirm",
    ],
  },
  {
    version: "0.11",
    date: "13.08.2026",
    note: "Fehlerbehebung",
    changes: [
      "Barcode-Auswertung startet wieder – der WebView-Aufruf lieferte ein Promise "
        + "statt eines einfachen Werts („Nicht unterstützter Typ“)",
    ],
  },
  {
    version: "0.10",
    date: "13.08.2026",
    note: "Erste vollständige Fassung",
    changes: [
      "Ersparnis-Statistik: Bestpreis gegen Normalpreis",
      "Händler-Ausschlussliste in den Einstellungen",
      "Sicherung und Wiederherstellung der Produktliste",
    ],
  },
  {
    version: "0.9",
    note: "Oberfläche aufgeräumt",
    changes: [
      "Fußzeile auf Symbole umgestellt (Vergleich, Warenart, Einstellungen, Darstellung)",
      "Suchen, Filter, Hinzufügen und Aktualisieren in einer Zeile",
      "Hinzufügen und Scannen zu einem Menü zusammengefasst",
      "Darstellung hell/dunkel/automatisch per Symbol weiterschalten",
      "Detailansicht neu gegliedert: Preis oben, Produktdaten unten",
      "EAN in der Detailansicht sichtbar",
      "Einrichtung & Hilfe als eigene Ansicht mit Themenmenü",
      "Copyright, Versionsnummer und Änderungshistorie",
    ],
  },
  {
    version: "0.8",
    note: "Barcode ohne Kurzbefehl",
    changes: [
      "Barcode per Foto oder aus der Mediathek auslesen (ZXing)",
      "Weg über die Kurzbefehle-App entfernt",
      "Bei fehlgeschlagener Erkennung direkt neues Foto oder Eingabe",
      "Händlerlogos in Listen, Vergleich und Diagrammen",
    ],
  },
  {
    version: "0.7",
    note: "Einkaufsliste",
    changes: [
      "Export in die Erinnerungen-App mit Preis und Anbieter",
      "Liste wählbar und gemerkt, keine Dubletten",
      "Nur markierte Produkte exportieren",
      "Sorte wird in den Titel übernommen",
      "Export in den Einstellungen ein- und ausschaltbar",
    ],
  },
  {
    version: "0.6",
    note: "Mehrere Geräte",
    changes: [
      "Produkte werden über iCloud zusammengeführt statt überschrieben",
      "Zeitstempel je Produkt, neuere Änderung gewinnt",
      "Löschungen wirken geräteübergreifend (Vermerke, 60 Tage)",
      "Geteilter Ordner für eine zweite Apple-ID (Bookmark PreisAppShared)",
      "Statusanzeige des Speicherorts in den Einstellungen",
    ],
  },
  {
    version: "0.5",
    note: "Sortierung und Filter",
    changes: [
      "Produkte alphabetisch nach Namen sortiert",
      "Filter für Produkte ohne hinterlegte EAN",
      "Warenart Food, Non-Food und Tierbedarf mit eigenem Filter",
      "Warenart wird beim EAN-Abgleich automatisch gesetzt",
      "EAN beim Anlegen optional mit angebbar",
    ],
  },
  {
    version: "0.4",
    note: "EAN-Abgleich",
    changes: [
      "Prüfziffer nach GTIN-Standard erkennt Zahlendreher",
      "Suche in vier Open-Facts-Datenbanken statt nur Open Food Facts",
      "Fehlende EAN direkt bei Open Food Facts anlegen",
      "Konto-Verwaltung mit Registrierungslink in den Einstellungen",
    ],
  },
  {
    version: "0.3",
    note: "Darstellung auf dem iPhone",
    changes: [
      "Absturz durch fehlende Konstante behoben",
      "Diagramme scharf und nicht mehr abgeschnitten",
      "Spaltenbreiten für schmale Geräte, Text wird nicht mehr abgeschnitten",
      "Preisalarm für alle Produkte als Schalter in den Einstellungen",
      "Einstellungen als Tabelle statt Eingabedialog",
    ],
  },
  {
    version: "0.2",
    note: "Zweite Quelle",
    changes: [
      "REWE-Onlineshop als Quelle für echte Marktpreise",
      "Normalpreis über die EAN als Vergleichsmaßstab",
      "Warenkorb-Vergleich über alle Produkte",
      "Quellen über die Konstante SOURCES statt über die Oberfläche",
    ],
  },
  {
    version: "0.1",
    note: "Grundgerüst",
    changes: [
      "Angebote über marktguru zur eigenen PLZ",
      "Beobachtungsliste mit Suchbegriff und Sorte",
      "Preisalarm per Mitteilung bei neuen Angeboten",
      "Preisverlauf und Einschätzung günstig/teuer",
      "Widget für den Homescreen",
    ],
  },
];
// Die Namen der beiden Open-Food-Facts-Schlüssel stammen aus dem früheren
// EAN-Skript und bleiben unverändert: der Schlüsselbund gehört Scriptable,
// ein hinterlegter Zugang wird dadurch weiter gefunden.
const KEYCHAIN = { zip: "preisapp.zip", client: "preisapp.clientkey", api: "preisapp.apikey", theme: "preisapp.theme", cardView: "preisapp.cardview", openPrices: "preisapp.openprices", offUser: "eanapp.offuser", offPass: "eanapp.offpass" };
// Speicherort: iCloud Drive (Ordner Scriptable/PreisApp) – damit sich iPhone,
// iPad und Mac dieselben Produkte teilen. Ohne iCloud Drive lokal weiterarbeiten.
const ICLOUD_OK = (() => { try { FileManager.iCloud().documentsDirectory(); return true; } catch (e) { return false; } })();
const FM = ICLOUD_OK ? FileManager.iCloud() : FileManager.local();

/**
 * Geräteübergreifende Freigabe mit einer zweiten Person (z. B. Ehepartner
 * mit eigener Apple-ID): In den Scriptable-Einstellungen unter „File
 * Bookmarks“ einen mit der anderen Person geteilten iCloud-Drive-Ordner
 * unter diesem Namen hinterlegen – auf BEIDEN Geräten denselben Ordner.
 * Ist kein solches Bookmark eingerichtet, läuft alles wie bisher nur
 * innerhalb der eigenen iCloud (kein Verhaltensunterschied).
 */
const SHARED_BOOKMARK = "PreisAppShared";
const SHARED_OK = ICLOUD_OK && (() => { try { return FM.bookmarkExists(SHARED_BOOKMARK); } catch (e) { return false; } })();
const DIR = SHARED_OK ? FM.bookmarkedPath(SHARED_BOOKMARK) : FM.joinPath(FM.documentsDirectory(), "PreisApp");
const FILE_ITEMS = FM.joinPath(DIR, "items.json");
const FILE_SEEN = FM.joinPath(DIR, "seen.json");
const FILE_CACHE = FM.joinPath(DIR, "cache.json");
const FILE_HISTORY = FM.joinPath(DIR, "history.json");
const FILE_META = FM.joinPath(DIR, "meta.json");
const FILE_NORMAL = FM.joinPath(DIR, "normal-prices.json");
const IMG_DIR = FM.joinPath(DIR, "img");
const LOGO_DIR = FM.joinPath(DIR, "logos");

/**
 * Frühere Ablage des ZXing-Caches: eine .js-Datei direkt im Scriptable-Ordner.
 * Sie wird beim ersten Lauf in den Unterordner umgezogen.
 */
const ZXING_LEGACY_NAME = "preisapp-zxing";

if (!FM.fileExists(DIR)) FM.createDirectory(DIR, true);
if (!FM.fileExists(IMG_DIR)) FM.createDirectory(IMG_DIR, true);
if (!FM.fileExists(LOGO_DIR)) FM.createDirectory(LOGO_DIR, true);

// ─── Einstellbare Werte ──────────────────────────────────────────
const REFRESH_MAX_AGE_H = 3;   // Auto-Abruf erst, wenn Daten älter sind
const PARALLEL_REQUESTS = 4;   // gleichzeitige Netzabfragen
const MG_LIMIT = 40;           // Treffer je marktguru-Abfrage (kleiner = weniger Daten)
const CACHE_KEEP = 12;         // gespeicherte Angebote je Produkt
const OFFER_MAX_AGE_D = 14;    // Angebot ohne Enddatum: so lange gilt es als laufend

// iOS räumt Widget-Läufe hart ab, und ein abgebrochener Abruf kostet den
// ganzen Stand. Standardmäßig zeichnet das Widget deshalb nur aus dem
// Zwischenspeicher; abgerufen wird über den stillen Lauf (Kurzbefehle-
// Automation mit ?silent=1). true = das Widget ruft doch selbst ab.
const WIDGET_MAY_REFRESH = false;
// iOS räumt Widget-Läufe nach wenigen Sekunden ab. Dort wird deshalb je
// Abfrage kürzer gewartet und der ganze Lauf hart begrenzt – lieber ein
// unvollständiger Stand als ein Widget, das gar nicht mehr zeichnet.
const REQUEST_TIMEOUT_S = config.runsInWidget ? 5 : 12;  // Abbruch je Netzabfrage
const RUN_BUDGET_MS = config.runsInWidget ? 15000 : 0;   // 0 = kein Zeitlimit
const RETRY_COOLDOWN_MIN = 15;  // Pause nach einem unvollständigen Lauf

// Wie lange erfolglose Netzabfragen gemerkt werden, bevor es erneut versucht
// wird. Ohne diese Sperren fragt jeder Lauf dieselben Fehlschläge neu an:
// eine Bildsuche ohne Treffer, eine tote Bild-URL, ein Händler ohne Logo.
const NO_IMAGE_RETRY_D = 14;    // Produkt ohne auffindbares Bild
const BAD_IMAGE_RETRY_D = 7;    // Bild-URL, die keinen Download liefert
const NO_LOGO_RETRY_D = 30;     // Kette ohne Logo bei beiden Diensten

/**
 * Netzabfrage mit Zeitlimit. Ohne Limit wartet Scriptable unbegrenzt: eine
 * stockende Quelle blockiert dann den ganzen Lauf und lässt im Widget die
 * von iOS gesetzte Frist verstreichen.
 */
function newRequest(url) {
  const r = new Request(url);
  r.timeoutInterval = REQUEST_TIMEOUT_S;
  return r;
}

/**
 * JSON laden und im Fehlerfall eine sprechende Meldung werfen.
 * loadJSON() verschluckt sonst Statuscode und HTML-Antworten – genau das,
 * was Bot-Schutz und abgeschaltete Endpunkte zurückgeben. Die Meldung
 * landet über providerStats in der Debug-Ansicht.
 */
async function loadJSONDiag(req, label) {
  const txt = await req.loadString();
  const code = (req.response && req.response.statusCode) || 0;
  if (code === 401 || code === 403) {
    throw new Error(`${label}: HTTP ${code} – Zugang abgelehnt, Schlüssel vermutlich abgelaufen`);
  }
  if (code !== 200) throw new Error(`${label}: HTTP ${code}`);
  if (/^\s*[<!]/.test(txt)) throw new Error(`${label}: HTML statt JSON (Bot-Schutz?)`);
  try {
    return JSON.parse(txt);
  } catch (e) {
    throw new Error(`${label}: Antwort nicht lesbar`);
  }
}

const HISTORY_DAYS = 60;       // Länge des Preisverlaufs
const SEEN_LIMIT = 2000;       // gemerkte Angebote (gegen Doppel-Alarm)
const NORMAL_MAX_AGE_D = 180;    // ab hier gilt ein Vergleichspreis als veraltet
const NORMAL_WINDOW_D = 90;      // Zeitfenster für den Vergleichspreis aus dem Verlauf
// Händler, die trotz Treffer nicht angezeigt werden sollen (Groß-/Kleinschreibung egal)
const BLOCKED_ADVERTISERS = ["f"];   // Vorgabe; erweiterbar in den Einstellungen

// Symbole der Fußzeile. Reihenfolge und Auswahl stellt man in der App ein:
//   ⚙︎ Einstellungen → „🦶 Fußzeile“. Gespeichert wird das in meta.json
// (meta.footerIcons), gilt also auf allen Geräten mit demselben Ordner.
// Diese Liste ist nur noch die Vorgabe – sie greift, solange nichts
// eingestellt wurde, und steht hinter „Vorgabe wiederherstellen“.
// Die Reihenfolge hier bestimmt zugleich, wie die Symbole in den
// Einstellungen aufgelistet werden.
const FOOTER_CATALOG = [
  { id: "ean",      icon: "📦", label: "Meine EAN-Einträge", hint: "Eigene Nummern, Stand holen, Foto senden" },
  { id: "savings",  icon: "💰", label: "Ersparnis",          hint: "Bestpreis gegen Normalpreis" },
  { id: "help",     icon: "❓", label: "Einrichtung & Hilfe", hint: "Themen, Symbole, Änderungen" },
  { id: "compare",  icon: "🛒", label: "Warenkorb-Vergleich", hint: "Ganzer Einkauf je Markt gerechnet" },
  { id: "category", icon: "🛍", label: "Warenart-Filter",     hint: "Schaltet weiter: alle → 🍎 → 🧽 → 🐶" },
  { id: "settings", icon: "⚙︎", label: "Einstellungen",       hint: "Diese Seite – lässt sich nicht ausblenden" },
  { id: "theme",    icon: "◐",  label: "Darstellung",         hint: "Schaltet weiter: automatisch → hell → dunkel" },
];

// Vorgabe: alles an, in der Reihenfolge des Katalogs.
const FOOTER_ICONS = FOOTER_CATALOG.map(f => f.id);

// Ohne ⚙︎ käme man nur noch über die Warnzeilen in die Einstellungen –
// deshalb bleibt dieses Symbol immer sichtbar.
const FOOTER_PINNED = "settings";

/** Katalogeintrag zu einer Kennung, oder null. */
function footerEntry(id) {
  return FOOTER_CATALOG.find(f => f.id === id) || null;
}

// Preisquellen – hier ein-/ausschalten (keine Auswahl mehr in der App).
// true = wird abgefragt, false = wird übersprungen.
const SOURCES = {
  marktguru: true,    // Angebote: Prospekte fast aller Ketten (braucht x-clientkey und x-apikey)
  openprices: true,   // Vergleichspreise: gemeldete Ladenpreise aus der Open-Prices-Datenbank
};

// ─── Layout: passt sich Gerät und Bildschirmgröße an ─────────────
/**
 * Drei Größenklassen:
 *   compact  – kleine iPhones (SE, mini)
 *   regular  – normale iPhones
 *   large    – iPhone Max/Plus und iPads (mehr Platz, größere Schrift)
 * Grundlage ist die kurze Bildschirmkante, damit die Ausrichtung
 * (Hoch-/Querformat) das Layout nicht verspringen lässt.
 */
/**
 * Stufenlos zwischen Stützpunkten interpolieren (statt fester Klassen).
 * Punkte müssen nach x aufsteigend sortiert sein; außerhalb des
 * Bereichs wird der jeweils äußerste Wert gehalten (kein Extrapolieren).
 */
function interpolate(x, points) {
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
  }
  return points[points.length - 1][1];
}

const LAYOUT = (() => {
  // Erkennt die tatsächliche Bildschirmgröße und -dichte automatisch –
  // keine feste Geräteliste, sondern stufenlose Anpassung anhand der
  // kurzen Bildschirmkante (bleibt bei Drehung des Geräts stabil).
  const size = Device.screenSize();
  const shortSide = Math.min(size.width, size.height);
  const longSide = Math.max(size.width, size.height);
  const pixelScale = Device.screenScale();   // @1x/@2x/@3x – für scharfe Diagramme
  const pad = Device.isPad();

  // Skalierungsfaktor für Schrift/Zeilen, stufenlos anhand der Punktbreite:
  //   iPhone SE (320) … iPhone mini/SE2 (375) … Standard (390) …
  //   Plus/Max (428–430) … iPad mini (744) … iPad (810–834) … iPad Pro (1024–1366)
  // Auf dem SE (320 pt) war 0.85 zu klein zum bequemen Lesen – die Kurve
  // startet jetzt bei 0.92 und fällt bis zum iPhone-Standard flacher ab.
  const rawScale = interpolate(shortSide, [
    [320, 0.92], [375, 0.96], [390, 1.00], [428, 1.08],
    [500, 1.15], [744, 1.22], [834, 1.28], [1024, 1.35], [1366, 1.45],
  ]);

  // Auf dem iPhone bleibt es bei der vollen Kurve (unverändert – passt).
  // Auf dem iPad wirkt sonst nur ein Bruchteil des Zuwachses über 1.0:
  // iPad Pro 12.9" (1024 pt) hätte sonst 35 % größere Schrift als das
  // iPhone – das wirkte auf dem großen Bildschirm überdimensioniert.
  const scale = pad ? 1 + (rawScale - 1) * 0.35 : rawScale;

  // Außenabstand ebenfalls stufenlos – großer Bildschirm, mehr Luft
  const margin = interpolate(shortSide, [
    [320, 14], [390, 20], [428, 24], [744, 32], [1024, 40], [1366, 48],
  ]);

  // Grobe Klasse nur noch für binäre Entscheidungen (z. B. Spaltenaufteilung)
  const klass = shortSide >= 700 ? "large" : shortSide >= 400 ? "regular" : "compact";

  /**
   * Aktuelle Fenstermaße – im Gegensatz zu shortSide/longSide dreht sich
   * das mit dem Gerät mit. Wird bei jedem Aufbau neu gelesen, damit eine
   * Drehung sofort wirkt.
   */
  function viewport() {
    const s = Device.screenSize();
    return {
      width: Math.round(s.width),
      height: Math.round(s.height),
      landscape: s.width > s.height,
    };
  }

  return {
    klass, pad, shortSide, longSide, scale, pixelScale, margin,
    /** Schriftgröße skalieren (gerundet, mit Mindestgröße). */
    font: (base) => Math.max(11, Math.round(base * scale)),   // 11 pt Untergrenze
    /**
     * Zeilenhöhe skalieren. Auf großen Geräten gedämpft: Schrift darf
     * mitwachsen, Zeilen sollen aber nicht so hoch werden, dass nur noch
     * wenige Produkte auf den Bildschirm passen.
     */
    row: (base) => Math.round(base * Math.min(scale, 1 + (scale - 1) * (pad ? 0.35 : 0.6))),
    /** Breite für Diagramme und Bilder – volle Bildschirmbreite minus Rand. */
    width: () => Math.round(shortSide - margin),
    /** Aktuelle Fensterbreite bzw. -höhe (dreht sich mit dem Gerät). */
    viewWidth: () => viewport().width,
    viewHeight: () => viewport().height,
    landscape: () => viewport().landscape,
    /** Anteil der aktuell sichtbaren Höhe (z. B. für das Produktbild). */
    heightFraction: (f, max) => Math.round(Math.min(max, viewport().height * f)),
    /** Zeilen im Widget je nach vom System vorgegebener Widget-Größe. */
    widgetRows: () => config.widgetFamily === "small" ? 3
      : config.widgetFamily === "large" ? 8 : 5,
  };
})();

/**
 * Breite der Bildspalte in der Produktliste.
 * Ergänzt die übrigen Spalten (Info/Preis/✏️/🗑) genau auf 100.
 */
/**
 * Breite der Bildspalte – wird bei jedem Aufbau neu bestimmt (Drehung!).
 * Im Querformat auf dem iPad ist die Zeile so breit, dass ein Bild mit 8 %
 * bereits riesig wäre und dem Text die Hälfte der Breite nimmt.
 */
function imageColWeight() {
  const width = LAYOUT.viewWidth();
  if (LAYOUT.pad && LAYOUT.landscape()) return 5;   // iPad quer
  if (width >= 744) return 8;                        // iPad hoch
  if (width >= 428) return 13;                       // iPhone Max
  return 14;                                         // iPhone Standard
}

/**
 * Produkte nebeneinander: eine Spalte auf schmalen Geräten, zwei ab
 * iPhone-Max-Breite, drei auf dem iPad im Querformat. Mehrspaltig entfällt
 * die Fußzeile der Karte – Bearbeiten und Löschen stecken dann im Detail.
 */
function columns() {
  if (LAYOUT.pad && LAYOUT.landscape()) return 3;
  if (LAYOUT.viewWidth() >= 700) return 2;           // iPad hoch / großes Fenster
  if (LAYOUT.viewWidth() >= 428) return 2;           // iPhone Plus/Max
  return 1;
}

/**
 * Mindesthöhe für antippbare Zeilen: 44 pt nach Apples Vorgaben, damit
 * Schaltflächen sicher zu treffen sind.
 */
const TAP_MIN = 44;
function tapRow(base) { return Math.max(TAP_MIN, LAYOUT.row(base)); }

/**
 * Höhe der eingefügten Zeilen mitzählen. UITable verrät nicht, wie voll es
 * schon ist – deshalb werden addRow und removeAllRows einmal umgehängt.
 * Klappt das auf einer Scriptable-Version nicht, bleibt alles wie bisher.
 */
function trackHeights(table) {
  try {
    if (!table.__addRow) {
      table.__addRow = table.addRow.bind(table);
      table.__clear = table.removeAllRows.bind(table);
      table.addRow = function (row) { table.__used = (table.__used || 0) + (row.height || 44); table.__addRow(row); };
      table.removeAllRows = function () { table.__used = 0; table.__clear(); };
    }
    table.__used = 0;
  } catch (e) {}
}

/**
 * Höhe, die iOS und Scriptable selbst beanspruchen: Statusleiste, die
 * „Close“-Leiste über der Tabelle und der Home-Indikator. Abfragen lässt
 * sich das nicht, deshalb nach Gerät geschätzt – lieber ein paar Punkte zu
 * wenig füllen als eine Ansicht, die ins Leere scrollt.
 */
function chromeHeight() {
  if (LAYOUT.pad) return 120;                       // iPad: keine Notch, keine Home-Leiste
  const longSide = Math.max(Device.screenSize().width, Device.screenSize().height);
  return longSide >= 800 ? 140 : 70;                // mit bzw. ohne Notch und Home-Indikator
}

/**
 * Rest der Bildschirmhöhe mit Zeilen in Hintergrundfarbe auffüllen.
 * Kurze Ansichten lässt UITable sonst im Systemhintergrund stehen: bei
 * hellem Farbschema auf einem dunkel eingestellten Gerät bleibt unten ein
 * schwarzer Block, und die Fußzeile klebt mitten im Bild statt unten.
 * @param reserve Höhe, die danach noch kommt (z. B. die Fußzeile)
 */
function padToBottom(table, T, reserve) {
  if (table.__used === undefined) return;      // Zählung nicht verfügbar
  let free = LAYOUT.viewHeight() - chromeHeight() - (table.__used || 0) - (reserve || 0);
  while (free > 8) {
    const r = new UITableRow();
    r.height = Math.min(120, Math.round(free));
    r.backgroundColor = T.bg;
    table.addRow(r);
    free -= r.height;
  }
}



// ─── Persistenz ──────────────────────────────────────────────────
/**
 * Dateien, die vorhanden, aber nicht lesbar sind (defekt oder noch nicht aus
 * iCloud geladen). Sie dürfen nicht überschrieben werden: sonst macht ein
 * einziger Lesefehler aus einem vollen Bestand eine leere Datei – und iCloud
 * trägt den Verlust auf alle Geräte weiter.
 */
const readFailed = new Set();

/**
 * Datei bei Bedarf aus iCloud holen. downloadFileFromiCloud() liefert ein
 * Promise; ohne await liest man an der noch nicht geladenen Datei vorbei.
 * @returns true, wenn die Datei danach lokal vorliegt.
 */
async function ensureLocal(path) {
  try {
    if (!FM.fileExists(path)) return false;
    if (FM.isFileStoredIniCloud(path) && !FM.isFileDownloaded(path)) {
      await FM.downloadFileFromiCloud(path);
    }
    return true;
  } catch (e) {
    console.error("iCloud: " + path + " – " + e.message);
    return false;
  }
}

/**
 * JSON lesen. Eine fehlende Datei ist harmlos (Fallback), eine vorhandene,
 * aber unlesbare wird vermerkt – flush() überspringt sie dann beim Schreiben.
 */
function readJSON(path, fallback) {
  if (!FM.fileExists(path)) { readFailed.delete(path); return fallback; }
  try {
    if (FM.isFileStoredIniCloud(path) && !FM.isFileDownloaded(path)) {
      throw new Error("noch nicht aus iCloud geladen");
    }
    const data = JSON.parse(FM.readString(path));
    readFailed.delete(path);
    return data;
  } catch (e) {
    readFailed.add(path);
    console.error("Nicht lesbar, wird nicht überschrieben: " + path + " – " + e.message);
    return fallback;
  }
}
function writeJSON(path, data) {
  FM.writeString(path, JSON.stringify(data));
}

/**
 * Produkte über iCloud zusammenführen.
 * Jedes Gerät schreibt dieselbe items.json. Ohne Zusammenführen würde ein
 * Gerät mit altem Stand die Produkte der anderen Geräte überschreiben.
 * Regeln: neuerer Zeitstempel gewinnt, Löschungen wirken über Grabsteine
 * (meta.deleted), die nach 60 Tagen verfallen.
 */
const TOMBSTONE_DAYS = 60;
const keyOf = (q) => String(q || "").trim().toLowerCase();

/** Änderungszeitpunkt setzen – Grundlage für den Abgleich. */
function stampItem(item) {
  if (item) item.updated = Date.now();
  return item;
}

/** Löschvermerk setzen, damit die Löschung auf andere Geräte übergeht. */
function tombstone(query) {
  meta.deleted = meta.deleted || {};
  meta.deleted[keyOf(query)] = Date.now();
  touch("meta");
}

/** Abgelaufene Löschvermerke entfernen. */
function pruneTombstones() {
  if (!meta.deleted) return;
  const limit = Date.now() - TOMBSTONE_DAYS * 86400000;
  let changed = false;
  for (const k of Object.keys(meta.deleted)) {
    if (meta.deleted[k] < limit) { delete meta.deleted[k]; changed = true; }
  }
  if (changed) touch("meta");
}

/** Eigene Liste mit der Datei auf der Platte (= Stand der anderen Geräte) vereinen. */
function mergeItems(mine, theirs) {
  const deleted = meta.deleted || {};
  const out = new Map();

  const consider = (item) => {
    if (!item || !item.query) return;
    const k = keyOf(item.query);
    const del = deleted[k] || 0;
    if (del > (item.updated || 0)) return;              // andernorts gelöscht
    const known = out.get(k);
    if (!known || (item.updated || 0) > (known.updated || 0)) out.set(k, item);
  };

  (Array.isArray(theirs) ? theirs : []).forEach(consider);
  (Array.isArray(mine) ? mine : []).forEach(consider);   // bei Gleichstand gewinnt der eigene Stand
  return [...out.values()];
}

// Erst aus iCloud holen, dann lesen – sonst steht auf einem frisch
// eingerichteten Gerät alles auf Anfang, obwohl die Daten längst da sind.
await Promise.all([FILE_ITEMS, FILE_SEEN, FILE_CACHE, FILE_HISTORY, FILE_META, FILE_NORMAL]
  .map(f => ensureLocal(f)));

let items = readJSON(FILE_ITEMS, []);        // [{query, search, variant, image, ean, alarm}]
// Alte Kennung „nonfood“ auf „products“ ziehen – einmalig beim ersten Start
// nach dem Umbenennen, danach fällt die Schleife durch.
if (items.some(i => i.cat === "nonfood")) {
  items.forEach(i => { if (i.cat === "nonfood") i.cat = "products"; });
}
let seen = new Set(readJSON(FILE_SEEN, [])); // "Nutella|Lidl|3.19" – O(1)-Prüfung
let cache = readJSON(FILE_CACHE, {});        // {query: [offer, …]}
let history = readJSON(FILE_HISTORY, {});    // {query: [{d, p, a}, …]}
let meta = readJSON(FILE_META, {});          // {lastRefresh, listMode}
let normal = readJSON(FILE_NORMAL, {});      // {query: {price, source, date, advertiser}}

// Produkte, die ein anderes Gerät angelegt hat, sind bereits in items.json –
// fehlende Zeitstempel nachtragen, damit der Abgleich vergleichen kann.
items.forEach(i => { if (!i.updated) i.updated = 0; });

/**
 * Schreibvorgänge sammeln statt sofort ausführen: iCloud-Schreibzugriffe
 * sind teuer, deshalb wird jede Datei je Lauf höchstens einmal gesichert.
 */
const dirty = new Set();
const STORES = {
  items:   { path: FILE_ITEMS,   get: () => items },
  seen:    { path: FILE_SEEN,    get: () => [...seen] },
  cache:   { path: FILE_CACHE,   get: () => cache },
  history: { path: FILE_HISTORY, get: () => history },
  meta:    { path: FILE_META,    get: () => meta },
  normal:  { path: FILE_NORMAL,  get: () => normal },
};

function touch(...names) { names.forEach(n => dirty.add(n)); }

function flush() {
  // Produkte vor dem Schreiben mit dem Stand aus iCloud zusammenführen.
  // Nur mit einer lesbaren Datei – sonst gälte deren Inhalt als „gelöscht“.
  if (dirty.has("items")) {
    const theirs = readJSON(FILE_ITEMS, null);
    if (Array.isArray(theirs)) items = mergeItems(items, theirs);
  }
  for (const name of dirty) {
    const st = STORES[name];
    if (!st) continue;
    if (readFailed.has(st.path)) {
      console.error("Schreiben übersprungen (Datei unlesbar): " + st.path);
      continue;
    }
    writeJSON(st.path, st.get());
  }
  dirty.clear();
}

function saveItems() { touch("items"); flush(); }

// ─── Darstellung: hell / dunkel / automatisch ────────────────────
function getThemeMode() {
  return Keychain.contains(KEYCHAIN.theme) ? Keychain.get(KEYCHAIN.theme) : "auto";
}
function setThemeMode(mode) {
  Keychain.set(KEYCHAIN.theme, mode);
}
/** Symbol für den aktuellen Modus – hell, dunkel, automatisch. */
function themeIcon(mode) {
  return mode === "light" ? "☀︎" : mode === "dark" ? "☾" : "◐";
}
/** Reihenfolge beim Antippen: automatisch -> hell -> dunkel -> automatisch. */
function nextThemeMode(mode) {
  return mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
}
/** Benennung des Modus im Klartext – für Einstellungen und Hilfe. */
function themeLabel(mode) {
  return mode === "light" ? "hell" : mode === "dark" ? "dunkel" : "automatisch";
}

/** Liefert die Farben für den aktuell gewählten Modus. */
function theme() {
  let mode = getThemeMode();
  if (mode === "auto") mode = Device.isUsingDarkAppearance() ? "dark" : "light";

  return mode === "dark"
    ? {
        dark: true,
        bg: new Color("#1c1c1e"),
        row: new Color("#2c2c2e"),
        rowAlt: new Color("#242426"),
        text: new Color("#ffffff"),
        muted: new Color("#9aa0a6"),
        good: new Color("#34c759"),
        goodBg: new Color("#14351f"),
        accent: new Color("#4c8bf5"),
        warnBg: new Color("#3b3320"),
      }
    : {
        dark: false,
        bg: new Color("#f2f2f7"),
        row: new Color("#ffffff"),
        rowAlt: new Color("#f8f9fa"),
        text: new Color("#000000"),
        muted: new Color("#5f6368"),
        good: new Color("#0f9d58"),
        goodBg: new Color("#e6f4ea"),
        accent: new Color("#1a73e8"),
        warnBg: new Color("#fef7e0"),
      };
}

// ─── Einstellungen: Fußzeile ─────────────────────────────────────
/**
 * Sichtbare Symbole der Fußzeile in der eingestellten Reihenfolge.
 *
 * Die Auswahl liegt in meta.json und wandert damit über iCloud auf alle
 * Geräte – anders als die Karten-Ansicht, die absichtlich je Gerät gilt.
 * Gelesen wird defensiv: unbekannte Kennungen (aus einer neueren oder
 * älteren Fassung) und Doppelte fliegen raus, ⚙︎ wird notfalls ergänzt.
 */
function footerOrder() {
  const saved = Array.isArray(meta.footerIcons) ? meta.footerIcons : null;
  if (!saved) return FOOTER_ICONS.slice();
  const list = [...new Set(saved.filter(id => footerEntry(id)))];
  if (!list.includes(FOOTER_PINNED)) list.push(FOOTER_PINNED);
  return list;
}

/** Ausgeblendete Symbole – Katalogreihenfolge, damit die Liste ruhig bleibt. */
function footerHidden() {
  const on = footerOrder();
  return FOOTER_ICONS.filter(id => !on.includes(id));
}

/** Neue Reihenfolge sichern. ⚙︎ wird dabei erzwungen. */
function setFooterOrder(list) {
  const clean = [...new Set(list.filter(id => footerEntry(id)))];
  if (!clean.includes(FOOTER_PINNED)) clean.push(FOOTER_PINNED);
  meta.footerIcons = clean;
  touch("meta");
  flush();
}

/** Zurück auf die Vorgabe aus FOOTER_ICONS. */
function resetFooterOrder() {
  delete meta.footerIcons;
  touch("meta");
  flush();
}

/** Vorschau „📦 💰 ❓ …“ für die Einstellungszeile. */
function footerPreview() {
  return footerOrder().map(id => footerEntry(id).icon).join("  ");
}

// ─── Einstellungen (Keychain) ────────────────────────────────────
function cfg() {
  return {
    zip: Keychain.contains(KEYCHAIN.zip) ? Keychain.get(KEYCHAIN.zip) : "",
    clientKey: Keychain.contains(KEYCHAIN.client) ? Keychain.get(KEYCHAIN.client) : "",
    apiKey: Keychain.contains(KEYCHAIN.api) ? Keychain.get(KEYCHAIN.api) : "",
  };
}
function configComplete() {
  const c = cfg();
  if (!c.zip) return false;
  if (providerEnabled("marktguru") && c.clientKey && c.apiKey) return true;
  return false;
}

/**
 * Fußzeile einrichten: Reihenfolge per ▲▼, Symbole ein- und ausblenden.
 *
 * Eigene Ansicht statt eines Alerts, weil ein Alert weder Reihenfolge noch
 * mehr als eine Handvoll Aktionen abbilden kann. Jede Änderung wird sofort
 * gesichert – so steht die Fußzeile auch dann richtig, wenn das Skript
 * zwischendurch beendet wird.
 * @returns {boolean} true, wenn etwas geändert wurde
 */
async function editFooterOrder() {
  let changed = false;
  const t = new UITable();
  t.showSeparators = true;

  function redraw() { changed = true; build(); t.reload(); }

  /** Symbol um eine Stelle verschieben (-1 hoch, +1 runter). */
  function move(id, delta) {
    const list = footerOrder();
    const i = list.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    list.splice(j, 0, list.splice(i, 1)[0]);
    setFooterOrder(list);
    redraw();
  }

  /** Ausgeblendetes Symbol wieder ans Ende der Fußzeile hängen. */
  function show(id) {
    setFooterOrder([...footerOrder(), id]);
    redraw();
  }

  /** Symbol ausblenden – ⚙︎ bleibt, sonst wäre der Weg hierher verbaut. */
  function hide(id) {
    if (id === FOOTER_PINNED) return;
    setFooterOrder(footerOrder().filter(x => x !== id));
    redraw();
  }

  /** Zeile mit Beschriftung links und bis zu drei Schaltflächen rechts. */
  function iconRow(T, title, subtitle, buttons) {
    const row = new UITableRow();
    const used = buttons.reduce((s, b) => s + b.w, 0);
    const tw = 100 - used;
    row.height = autoRowHeight(title, 15, subtitle, 12, tw, tapRow(54));
    row.backgroundColor = T.row;
    const l = row.addText(title, subtitle || "");
    l.widthWeight = tw;
    l.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
    l.titleColor = T.text;
    l.subtitleFont = Font.systemFont(LAYOUT.font(12));
    l.subtitleColor = T.muted;
    buttons.forEach(b => {
      // Ohne onTap wäre es eine tote Schaltfläche – dann lieber Text,
      // damit nichts anklickbar aussieht, was nichts tut (🔒, ausgegraute ▲▼).
      const c = b.tap ? row.addButton(b.label) : row.addText(b.label);
      c.widthWeight = b.w;
      c.centerAligned();
      if (b.tap) c.onTap = b.tap;
      else { c.titleFont = Font.systemFont(LAYOUT.font(15)); c.titleColor = T.muted; }
    });
    t.addRow(row);
  }

  function build() {
    const T = theme();
    trackHeights(t);
    t.removeAllRows();

    const back = new UITableRow();
    back.height = tapRow(44);
    back.backgroundColor = T.bg;
    const bk = back.addText("‹ Zurück zu den Einstellungen");
    bk.titleFont = Font.mediumSystemFont(LAYOUT.font(16));
    bk.titleColor = T.accent;
    back.dismissOnSelect = true;
    back.onSelect = () => {};
    t.addRow(back);

    headerRow(t, T, "🦶 Fußzeile", "Reihenfolge und Auswahl der Symbole");

    // So sieht die Fußzeile nachher aus – rechtsbündig wie im Original
    const prev = new UITableRow();
    prev.height = tapRow(48);
    prev.backgroundColor = T.rowAlt;
    const pv = prev.addText(footerPreview(), "Vorschau · Symbole stehen rechts in der Fußzeile");
    pv.widthWeight = 100;
    pv.titleFont = Font.systemFont(LAYOUT.font(20));
    pv.titleColor = T.text;
    pv.subtitleFont = Font.systemFont(LAYOUT.font(11));
    pv.subtitleColor = T.muted;
    prev.dismissOnSelect = false;
    t.addRow(prev);

    // ── Sichtbare Symbole, in der eingestellten Reihenfolge ──
    const on = footerOrder();
    headerRow(t, T, "Sichtbar", on.length + " von " + FOOTER_ICONS.length + " Symbolen");

    on.forEach((id, i) => {
      const e = footerEntry(id);
      const pinned = id === FOOTER_PINNED;
      const buttons = [
        { label: i > 0 ? "▲" : "·", w: 12, tap: i > 0 ? async () => move(id, -1) : null },
        { label: i < on.length - 1 ? "▼" : "·", w: 12, tap: i < on.length - 1 ? async () => move(id, 1) : null },
        { label: pinned ? "🔒" : "🚫 Aus", w: pinned ? 14 : 24, tap: pinned ? null : async () => hide(id) },
      ];
      iconRow(T, `${i + 1}.  ${e.icon}  ${e.label}`, e.hint, buttons);
    });

    // ── Was gerade nicht angezeigt wird ──
    const off = footerHidden();
    if (off.length) {
      headerRow(t, T, "Ausgeblendet", "Einblenden hängt das Symbol hinten an");
      off.forEach(id => {
        const e = footerEntry(id);
        iconRow(T, `${e.icon}  ${e.label}`, e.hint,
          [{ label: "＋ Ein", w: 24, tap: async () => show(id) }]);
      });
    }

    // ── Vorgabe ──
    const isDefault = footerOrder().join(",") === FOOTER_ICONS.join(",");
    const res = new UITableRow();
    res.height = autoRowHeight("↩︎ Vorgabe wiederherstellen", 15,
      FOOTER_ICONS.map(id => footerEntry(id).icon).join("  "), 12, 100, tapRow(52));
    res.backgroundColor = T.row;
    if (isDefault) {
      const rl = res.addText("↩︎ Vorgabe wiederherstellen", "bereits eingestellt");
      rl.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
      rl.titleColor = T.muted;
      rl.subtitleFont = Font.systemFont(LAYOUT.font(12));
      rl.subtitleColor = T.muted;
    } else {
      const rb = res.addButton("↩︎ Vorgabe wiederherstellen");
      rb.widthWeight = 100;
      rb.onTap = async () => { resetFooterOrder(); redraw(); };
    }
    t.addRow(res);

    infoRow(t, T, "Tipp",
      "Die Fußzeile steht in der Übersicht und in den EAN-Ansichten. "
      + "Je weniger Symbole, desto breiter wird jedes einzelne.",
      T.rowAlt);

    padToBottom(t, T);
  }

  build();
  await t.present(true);
  return changed;
}

async function editSettings() {
  let changed = false;
  const t = new UITable();
  t.showSeparators = true;

  /** Anzahl Produkte mit aktivem Alarm. */
  function alarmActive() { return items.filter(i => i.alarm !== false).length; }

  /** Änderung vermerken und die Tabelle neu zeichnen. */
  function redraw() { changed = true; build(); t.reload(); }

  /** Beschriftung für einen An/Aus-Schalter. */
  function swLabel(on, partial) { return partial ? "◉▬ teilweise" : (on ? "▬◉ EIN" : "◉▬ AUS"); }

  /**
   * Einstellungszeile: Text links, Schaltfläche rechts.
   * Alle Zeilen teilen Höhe, Spaltenbreiten und Schriften – abweichende
   * Werte kommen über opts (Debug-Zeilen je Quelle sind kleiner gesetzt).
   */
  function optionRow(T, title, subtitle, action, onTap, opts) {
    const o = opts || {};
    const row = new UITableRow();
    // Breite: die Schaltfläche bekommt nur ihren Text, der Rest gehört der
    // Beschreibung. Höhe: wächst mit dem Untertitel – mehrzeilige Texte
    // liefen sonst in die Nachbarzeilen (z. B. „Open Prices“).
    const bw = actionWeight(action);
    const tw = 100 - bw;
    const tPt = o.small ? 13 : 15;
    const sPt = o.small ? 11 : 12;
    row.height = autoRowHeight(title, tPt, subtitle, sPt, tw, tapRow(o.height || 52));
    row.backgroundColor = o.bg || T.row;
    const l = row.addText(title, subtitle || "");
    l.widthWeight = tw;
    l.titleFont = o.small ? Font.systemFont(LAYOUT.font(13)) : Font.mediumSystemFont(LAYOUT.font(15));
    l.titleColor = o.titleColor || T.text;
    l.subtitleFont = Font.systemFont(LAYOUT.font(o.small ? 11 : 12));
    l.subtitleColor = o.subtitleColor || T.muted;
    const b = row.addButton(action);
    b.widthWeight = bw;
    b.rightAligned();
    b.onTap = onTap;
    t.addRow(row);
    return row;
  }

  /** Zeile mit gespeichertem Wert – „Ändern“ öffnet ein Eingabefeld. */
  function textRow(T, title, value, placeholder, onSave, secret) {
    optionRow(T, title,
      value ? (secret ? "•".repeat(Math.min(14, value.length)) : value) : "nicht gesetzt",
      "✏️ Ändern",
      async () => {
        const a = new Alert();
        a.title = title;
        if (secret) a.addSecureTextField(placeholder, value);
        else a.addTextField(placeholder, value);
        a.addAction("Speichern");
        a.addCancelAction("Abbrechen");
        if (await a.presentAlert() === -1) return;
        onSave(a.textFieldValue(0).trim());
        redraw();
      },
      { subtitleColor: value ? undefined : T.accent });
  }

  function build() {
    const T = theme();
    const c = cfg();
    trackHeights(t);
    t.removeAllRows();

    // Zurück steht oben – wie in den übrigen Ansichten. Die Zeilenauswahl
    // schließt die Tabelle, danach zeichnet showMain() die Übersicht neu.
    const back = new UITableRow();
    back.height = tapRow(44);
    back.backgroundColor = T.bg;
    const bk_ = back.addText("‹ Zurück zur Übersicht");
    bk_.titleFont = Font.mediumSystemFont(LAYOUT.font(16));
    bk_.titleColor = T.accent;
    back.dismissOnSelect = true;
    back.onSelect = () => {};
    t.addRow(back);

    // Wie man an die Keys kommt, steht in der Hilfe unter „Ersteinrichtung“
    headerRow(t, T, "⚙︎ Einstellungen", "");

    // PLZ – gilt für die Angebotssuche bei marktguru
    textRow(T, "PLZ", c.zip, "z. B. 10115", (v) => {
      Keychain.set(KEYCHAIN.zip, v);
    });

    // Schalter direkt unter der PLZ
    const active = alarmActive();
    const allOn = items.length > 0 && active === items.length;
    optionRow(T, "🔔 Alarm für alle Produkte",
      items.length ? `${active} von ${items.length} Produkten aktiv` : "noch keine Produkte beobachtet",
      swLabel(allOn, active > 0 && !allOn),
      async () => {
        if (!items.length) return;
        const next = !allOn;   // komplett an -> alles aus, sonst alles an
        items.forEach(i => { i.alarm = next; stampItem(i); });
        touch("items");
        flush();
        redraw();
      });

    // marktguru-Keys
    if (meta.keyError) {
      const age = Math.round((Date.now() - meta.keyError.at) / 3600000);
      infoRow(t, T, "⚠️ marktguru lehnt die Schlüssel ab",
        `Zuletzt vor ${age < 1 ? "weniger als 1" : age} Stunde${age === 1 ? "" : "n"} – x-clientkey und x-apikey neu aus dem Browser kopieren.`,
        T.warnBg);
    }
    textRow(T, "x-clientkey", c.clientKey, "x-clientkey", v => Keychain.set(KEYCHAIN.client, v), true);
    textRow(T, "x-apikey", c.apiKey, "x-apikey", v => Keychain.set(KEYCHAIN.api, v), true);

    // Zusätzliche Preisquelle
    const opWanted = openPricesWanted();
    const opBlocked = opWanted && !providerEnabled("openprices");
    optionRow(T, "💶 Open Prices",
      opBlocked
        ? (debugDisabled("openprices")
            ? "an, aber im Debug-Modus abgeschaltet"
            : "an, aber über SOURCES abgeschaltet")
        : opWanted
          ? "Üblicher Ladenpreis aus der Gemeinschaftsdatenbank (ODbL), wenn der eigene Verlauf nichts hergibt"
          : "aus – Vergleichspreise kommen nur aus dem eigenen Verlauf",
      swLabel(opWanted),
      () => { setOpenPrices(!opWanted); redraw(); },
      { subtitleColor: opBlocked ? T.accent : undefined });

    // Open-Food-Facts-Konto – ohne Zugang lässt sich nichts anlegen und
    // kein Foto senden. Lesen und Abgleichen geht auch ohne.
    const off = offCreds();
    const offSet = !!(off.user && off.pass);
    optionRow(T, "🌍 Open Food Facts – Login",
      offSet
        ? "angemeldet als " + off.user + " · Benutzername, nicht die E-Mail-Adresse"
        : "nicht hinterlegt – Abgleich geht, Anlegen und Fotos nicht",
      offSet ? "✏️ Ändern" : "＋ Eintragen",
      async () => { await askOFFLogin(); redraw(); },
      { subtitleColor: offSet ? undefined : T.accent });

    // Zwischenspeicher des Abgleichs
    const eanCount = Object.keys(eanCache).length;
    optionRow(T, "🏷️ EAN-Zwischenspeicher",
      eanCount
        ? `${eanCount} gemerkte Nummer(n) · gültig ${EAN_CACHE_D} Tage`
        : "leer – jede Nummer wird neu abgefragt",
      "🗑 Leeren",
      async () => {
        eanCache = {};
        writeEANCacheFile();
        redraw();
      });

    // Umkreis der Filialsuche im Produktdetail
    optionRow(T, "📍 Umkreis Filialsuche",
      `${marketRadiusKm()} km um Standort bzw. PLZ` + (meta.marketRadiusKm ? "" : " – Vorgabe"),
      `${marketRadiusKm()} km`,
      async () => {
        const a = new Alert();
        a.title = "Umkreis der Filialsuche";
        a.message = "Größerer Umkreis heißt mehr Treffer, aber eine längere Abfrage bei OpenStreetMap.";
        MARKET_RADIUS_CHOICES.forEach(km => a.addAction(`${km} km` + (km === marketRadiusKm() ? "  ✓" : "")));
        a.addCancelAction("Abbrechen");
        const pick = await a.presentAlert();
        if (pick === -1) return;
        meta.marketRadiusKm = MARKET_RADIUS_CHOICES[pick];
        // Gemerkte Filialen bleiben: der Umkreis steckt im Schlüssel,
        // ein Wechsel zurück ist damit sofort wieder da.
        touch("meta");
        flush();
        redraw();
      });

    // Darstellung der Produktliste – Karten oder klassische Zeilen
    const cardOn = cardsOn();
    optionRow(T, "🗂 Karten-Ansicht",
      (cardOn ? "Produkte als Karten" : "Produkte als Tabellenzeilen") + " – nur auf diesem Gerät",
      swLabel(cardOn),
      async () => { setCardView(!cardOn); redraw(); });

    // Fußzeile – Reihenfolge und Auswahl der Symbole
    const fOff = footerHidden();
    optionRow(T, "🦶 Fußzeile",
      footerPreview() + (fOff.length ? `  ·  ${fOff.length} ausgeblendet` : ""),
      "✏️ Ändern",
      // Kein redraw(): die Fußzeile berührt keine Preisdaten, ein
      // Neuladen aller Quellen wäre unnötig. Nur neu zeichnen.
      async () => {
        if (await editFooterOrder()) changed = true;
        build();
        t.reload();
      });

    // Export in die Erinnerungen-App – An/Aus
    const exportOn = meta.exportEnabled !== false;
    optionRow(T, "📋 Export in Erinnerungen",
      exportOn ? "Markieren + Export in der Produktliste sichtbar" : "Markieren + Export ausgeblendet",
      swLabel(exportOn),
      async () => {
        meta.exportEnabled = !exportOn;
        touch("meta");
        flush();
        redraw();
      });

    // Erinnerungen-Liste für den Warenkorb-Export – nur relevant, wenn Export an ist
    if (exportOn) {
      optionRow(T, "📋 Erinnerungen-Liste",
        meta.reminderList || "wird beim ersten Export abgefragt",
        "✏️ Ändern",
        async () => {
          meta.reminderList = "";       // erzwingt die Auswahl erneut
          if (await pickReminderList()) redraw();
        });
    }

    // Ausgeschlossene Händler
    const own = Array.isArray(meta.blocked) ? meta.blocked : [];
    optionRow(T, "🚫 Händler ausschließen",
      own.length ? own.join(", ") : "keine eigenen Einträge",
      "✏️ Ändern",
      async () => {
        const a = new Alert();
        a.title = "Händler ausschließen";
        a.message = "Angebote dieser Händler werden ausgeblendet. Mehrere durch Komma trennen. "
          + "Ab Werk ausgeschlossen: " + BLOCKED_ADVERTISERS.join(", ");
        a.addTextField("z. B. Handelshof, Metro", own.join(", "));
        a.addAction("Speichern");
        a.addCancelAction("Abbrechen");
        if (await a.presentAlert() === -1) return;
        meta.blocked = a.textFieldValue(0).split(",").map(x => x.trim()).filter(Boolean);
        touch("meta");
        flush();
        redraw();
      });

    // Sicherung der Produktliste
    const backups = listBackups();
    optionRow(T, "💾 Sicherung",
      backups.length ? `${backups.length} vorhanden · zuletzt ${backups[0].slice(6, 16)}` : "noch keine angelegt",
      "💾 Sichern",
      async () => {
      const a = new Alert();
      a.title = "Sicherung";
      a.message = `${items.length} Produkte und der komplette Preisverlauf. `
        + "Angebote und Vergleichspreise bleiben außen vor – die rechnen sich neu.";
      a.addAction("💾 Jetzt sichern");
      if (backups.length) a.addAction("↩︎ Wiederherstellen");
      a.addCancelAction("Abbrechen");
      const c = await a.presentAlert();
      if (c === -1) return;

      if (c === 0) {
        const name = createBackup();
        const r = new Alert();
        r.title = name ? "✅ Gesichert" : "❌ Fehlgeschlagen";
        r.message = name ? name + "\n\nOrdner: backups" : "Die Datei ließ sich nicht schreiben.";
        r.addAction("OK");
        await r.presentAlert();
      } else {
        const pick = new Alert();
        pick.title = "Wiederherstellen";
        pick.message = "Die aktuelle Liste wird vorher automatisch gesichert.";
        backups.slice(0, 8).forEach(n => pick.addAction(n.slice(6, 19).replace("_", "  ")));
        pick.addCancelAction("Abbrechen");
        const idx = await pick.presentAlert();
        if (idx === -1) return;
        const n = await restoreBackup(backups[idx]);
        const r = new Alert();
        r.title = n.products ? "✅ Wiederhergestellt" : "❌ Fehlgeschlagen";
        r.message = n.products
          ? `${n.products} Produkte übernommen`
            + (n.days ? ` · ${n.days} Verlaufseinträge ergänzt.` : ".")
          : "Die Sicherung ließ sich nicht lesen.";
        r.addAction("OK");
        await r.presentAlert();
        changed = true;
      }
      build();
      t.reload();
    });

    // Debug-Modus – Quellen einzeln abschaltbar
    const off_ = PROVIDERS.filter(p => debugDisabled(p.id)).map(p => p.name);
    optionRow(T, "🐞 Debug-Modus",
      debugOn()
        ? (off_.length ? "aktiv · aus: " + off_.join(", ") : "aktiv · alle Quellen an")
        : "aus",
      swLabel(debugOn()),
      async () => {
        meta.debug = !debugOn();
        touch("meta");
        flush();
        redraw();
      },
      { subtitleColor: off_.length ? T.accent : undefined });

    if (debugOn()) {
      // Je Quelle eine Zeile mit Schalter und Kennzahlen des letzten Laufs
      PROVIDERS.forEach(p => {
        const st = providerStats[p.id];
        const stats = st
          ? `${st.count} Treffer aus ${st.calls} Abfragen`
            + ` · ${Math.round(st.ms / Math.max(1, st.calls))} ms`
            + (st.error ? " · Fehler: " + st.error : "")
          : "noch nicht abgefragt";
        const art = p.kind === "normal" ? "Vergleichspreise" : "Angebote";
        optionRow(T, "   " + p.name,
          art + " · " + (SOURCES[p.id] !== false ? "Vorgabe an" : "Vorgabe aus") + " · " + stats,
          swLabel(!debugDisabled(p.id)),
          async () => {
            meta.debugSources = meta.debugSources || {};
            meta.debugSources[p.id] = debugDisabled(p.id);
            touch("meta");
            flush();
            redraw();
          },
          {
            height: 50, small: true, bg: T.rowAlt,
            titleColor: debugDisabled(p.id) ? T.muted : T.text,
            subtitleColor: st && st.error ? new Color("#e65100") : undefined,
          });
      });

      // Woher die gespeicherten Standardpreise stammen – zeigt sofort, ob
      // Open Prices überhaupt etwas beiträgt.
      const npStat = { history: 0, openprices: 0, lastseen: 0 };
      for (const it of items) {
        const np = normal[it.query];
        if (!np) continue;
        const id = normalSourceId(np);
        if (npStat[id] === undefined) npStat[id] = 0;
        npStat[id]++;
      }
      const npMissing = items.length - (npStat.history + npStat.openprices + npStat.lastseen);
      const npText = "   Standardpreise: "
        + `${npStat.history} Verlauf · ${npStat.openprices} Open Prices`
        + ` · ${npStat.lastseen} zuletzt gesehen · ${Math.max(0, npMissing)} ohne`;
      const npRow = new UITableRow();
      npRow.height = autoRowHeight(npText, 11, "", 0, 100, LAYOUT.row(38), 3);
      npRow.backgroundColor = T.rowAlt;
      const npL = npRow.addText(npText);
      npL.titleFont = Font.systemFont(LAYOUT.font(11));
      npL.titleColor = T.muted;
      t.addRow(npRow);

      const hint = new UITableRow();
      hint.height = autoRowHeight("   Kennzahlen stammen vom letzten 🔄 Aktualisieren", 11,
        "", 0, 100, LAYOUT.row(38), 3);
      hint.backgroundColor = T.rowAlt;
      const hl = hint.addText("   Kennzahlen stammen vom letzten 🔄 Aktualisieren");
      hl.titleFont = Font.systemFont(LAYOUT.font(11));
      hl.titleColor = T.muted;
      t.addRow(hint);
    }

    // Speicherort / iCloud-Abgleich
    const syncTitle = SHARED_OK
      ? "👥 Geteilter Ordner aktiv"
      : (ICLOUD_OK ? "☁️ iCloud-Abgleich aktiv" : "⚠️ Kein iCloud – nur lokal auf diesem Gerät");
    const syncSub = SHARED_OK
      ? `${items.length} Produkte · über „${SHARED_BOOKMARK}“ mit anderem Gerät geteilt`
      : ICLOUD_OK
        ? `${items.length} Produkte · Ordner Scriptable/PreisApp (nur diese Apple-ID)`
        : "iCloud Drive für Scriptable einschalten (Einstellungen → Apple-ID → iCloud)";
    const syncRow = new UITableRow();
    syncRow.height = autoRowHeight(syncTitle, 15, syncSub, 12, 100, tapRow(52));
    syncRow.backgroundColor = ICLOUD_OK ? T.row : T.warnBg;
    const sy = syncRow.addText(syncTitle, syncSub);
    sy.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
    sy.titleColor = T.text;
    sy.subtitleFont = Font.systemFont(LAYOUT.font(12));
    sy.subtitleColor = T.muted;
    t.addRow(syncRow);

    // Rest der Bildschirmhöhe auffüllen – sonst endet die Liste mitten im
    // Bild und darunter steht der Systemhintergrund.
    padToBottom(t, T);
  }

  build();
  await t.present(true);
  return changed;
}

// ─── Angebotsquellen (Provider) ──────────────────────────────────
// Jede Quelle liefert Angebote im gleichen Format:
//   { price, advertiser, details, validTo, image, conditions, source }
// Quellen werden über SOURCES am Anfang des Skripts zugeschaltet.
// Alle sind inoffizielle Endpunkte – nur für den privaten Gebrauch.

/**
 * Spätestes Ende aus mehreren Gültigkeitszeiträumen. marktguru führt bei
 * länger laufenden Aktionen mehrere Blöcke; der erste ist oft schon vorbei,
 * das Angebot aber noch gültig.
 */
function latestValidTo(dates) {
  if (!Array.isArray(dates)) return null;
  let best = null;
  for (const d of dates) {
    const to = d && d.to;
    if (!to) continue;
    if (!best || String(to) > String(best)) best = to;
  }
  return best || null;
}

/** marktguru: Prospektangebote nahezu aller Ketten (Basisquelle). */
async function fetchMarktguru(query) {
  const c = cfg();
  if (!c.zip || !c.clientKey || !c.apiKey) return [];

  const url = "https://api.marktguru.de/api/v1/offers/search"
    + `?as=web&limit=${MG_LIMIT}&offset=0`
    + "&q=" + encodeURIComponent(query)
    + "&zipCode=" + encodeURIComponent(c.zip);

  const req = newRequest(url);
  req.headers = { "x-clientkey": c.clientKey, "x-apikey": c.apiKey, "Accept": "application/json" };

  // 401/403 heißt fast immer: die kopierten Schlüssel gelten nicht mehr.
  // Das wird gemerkt, damit die Einstellungen darauf hinweisen können.
  let data;
  try {
    data = await loadJSONDiag(req, "marktguru");
  } catch (e) {
    if (/HTTP 40[13]/.test(e.message)) {
      meta.keyError = { at: Date.now(), msg: e.message };
      touch("meta");
    }
    throw e;
  }
  if (meta.keyError) { delete meta.keyError; touch("meta"); }

  return (data.results || [])
    .filter(r => typeof r.price === "number")
    .map(r => ({
      price: r.price,
      advertiser: (r.advertisers && r.advertisers[0] && r.advertisers[0].name) || "Unbekannt",
      details: r.description || "",
      validTo: latestValidTo(r.validityDates),
      image: offerImage(r),
      conditions: offerConditions(r),
      source: "marktguru",
    }));
}

/**
 * Verfügbare Quellen – an/aus über SOURCES am Dateianfang, im Debug-Modus
 * zusätzlich einzeln abschaltbar.
 *
 * kind unterscheidet, wofür eine Quelle zuständig ist:
 *   "offers" – Aktionsangebote, laufen durch fetchOffers zusammen
 *   "normal" – Vergleichspreise (üblicher Ladenpreis), gehen in normal.json
 * Quellen mit kind "normal" liefern keine Angebote und werden von
 * fetchOffers deshalb übersprungen.
 */
const PROVIDERS = [
  { id: "marktguru", name: "marktguru", note: "Prospekte fast aller Ketten", kind: "offers", fetch: fetchMarktguru },
  { id: "openprices", name: "Open Prices", note: "gemeldete Ladenpreise (ODbL)", kind: "normal" },
];

// ─── Debug-Modus ─────────────────────────────────────────────────
// Erlaubt, einzelne Quellen zur Fehlersuche abzuschalten, ohne das Skript
// zu ändern. Die Schalter liegen in meta.debugSources und gelten nur,
// solange der Debug-Modus an ist – SOURCES bleibt die eigentliche Vorgabe.

function debugOn() { return meta.debug === true; }

/** Von Hand abgeschaltet? Nur wirksam im Debug-Modus. */
function debugDisabled(id) {
  return debugOn() && meta.debugSources && meta.debugSources[id] === false;
}

/** Statistik des letzten Abrufs je Quelle: {count, ms, error, calls}. */
let providerStats = {};

// Fortschritt des manuellen Aktualisierens – wird direkt in der Liste angezeigt
// (null = kein Lauf aktiv).
let refreshProgress = null;

/** Quelle aktiv? Vorgabe aus SOURCES, im Debug-Modus zusätzlich abschaltbar. */
function providerEnabled(id) {
  if (debugDisabled(id)) return false;
  return SOURCES[id] !== false;
}

// Fehler je Quelle nur einmal pro Lauf melden (statt je Produkt)
const providerErrors = new Map();

/** Angebote aus allen aktiven Quellen zusammenführen und Dubletten entfernen. */
// Bei einem Fehler wird eine Quelle sonst für den Rest des Laufs übersprungen
// (spart Zeit bei kaputten Endpunkten). Beim manuellen Aktualisieren soll
// aber jedes Produkt bei jeder aktiven Quelle versucht werden – dafür
// dieser Schalter, gültig nur für die Dauer eines refreshAll()-Laufs.
let forceAllSourcesThisRun = false;

async function fetchOffers(query) {
  // Vergleichspreisquellen (kind "normal") liefern keine Angebote – sie
  // werden je Produkt über resolveNormalPrice abgefragt.
  const active = PROVIDERS.filter(p => p.kind !== "normal" && providerEnabled(p.id)
    && (forceAllSourcesThisRun || !providerErrors.has(p.id)));
  if (!active.length && !providerErrors.size) {
    throw new Error("Keine Angebotsquelle aktiv – SOURCES am Anfang des Skripts prüfen.");
  }

  const results = await Promise.all(active.map(async p => {
    const t0 = Date.now();
    const st = providerStats[p.id] || (providerStats[p.id] = { count: 0, ms: 0, calls: 0, error: "" });
    st.calls++;
    try {
      const out = await p.fetch(query);
      st.count += out.length;
      st.ms += Date.now() - t0;
      return out;
    } catch (e) {
      // Quelle für diesen Lauf abschalten, damit nicht jedes Produkt scheitert
      providerErrors.set(p.id, e.message);
      st.error = e.message;
      st.ms += Date.now() - t0;
      console.error(p.name + ": " + e.message);
      return [];
    }
  }));

  const merged = [];
  const seenKeys = new Set();
  for (const offer of results.flat()) {
    if (typeof offer.price !== "number" || !isFinite(offer.price)) continue;
    // Abgelaufene Aktionen liefern manche Quellen weiter mit. Sie dürfen weder
    // Alarm auslösen noch als Bestpreis oder Tagesstand gelten – also raus.
    if (offerExpired(offer)) continue;
    if (blockedAdvertisers().includes(String(offer.advertiser || "").toLowerCase().trim())) continue;
    // Dublette = gleiche Kette, gleicher Preis UND gleicher Angebotstext.
    // Unterschiedliche Größen/Sorten zum selben Preis bleiben erhalten.
    const key = `${normalizeChain(offer.advertiser)}|${offer.price.toFixed(2)}|`
      + String(offer.details || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    // Erfassungszeitpunkt: nur damit lässt sich ein Angebot ohne Enddatum
    // überhaupt altern lassen (siehe offerExpired).
    merged.push({ seenAt: Date.now(), ...offer });
  }
  return merged.sort((a, b) => a.price - b.price);
}

// ─── Abfragen bündeln ────────────────────────────────────────────
// Mehrere Produkte können denselben Suchbegriff benutzen (z. B. „Butter“ mit
// verschiedenen Sorten). Ohne Bündelung geht dieselbe Anfrage mehrfach ins
// Netz. Der Speicher gilt nur für einen Lauf und wird davor geleert, damit
// eine geänderte PLZ oder ein neuer Schlüssel sofort wirkt.
const offerRequests = new Map();       // Suchbegriff (klein) -> Promise

function clearOfferRequests() { offerRequests.clear(); }

/** Wie fetchOffers, aber je Suchbegriff höchstens eine Abfrage. */
function fetchOffersOnce(query) {
  const key = String(query || "").trim().toLowerCase();
  if (!key) return Promise.resolve([]);
  if (offerRequests.has(key)) return offerRequests.get(key);
  // Fehler nicht festhalten – sonst scheitert der nächste Versuch sofort mit.
  const p = fetchOffers(query).catch(e => { offerRequests.delete(key); throw e; });
  offerRequests.set(key, p);
  return p;
}

// ─── Sicherung der Produktliste ──────────────────────────────────
// Nur items.json wird gesichert – Verlauf, Cache und Normalpreise bauen
// sich von selbst wieder auf. Die Kopien liegen im Unterordner „backups“.

const BACKUP_DIR = FM.joinPath(DIR, "backups");
const BACKUP_KEEP = 10;

/** Liste vorhandener Sicherungen, neueste zuerst. */
function listBackups() {
  try {
    if (!FM.fileExists(BACKUP_DIR)) return [];
    return FM.listContents(BACKUP_DIR)
      .filter(n => n.startsWith("items-") && n.endsWith(".json"))
      .sort()
      .reverse();
  } catch (e) { return []; }
}

/**
 * Produktliste und Preisverlauf sichern. Liefert den Dateinamen oder "".
 * Der Verlauf ist der einzige Bestand, der sich NICHT wieder aufbaut – er
 * entsteht über Monate und trägt Bestpreis, Einschätzung und Angebotsfrequenz.
 * Angebote (cache) und Vergleichspreise bleiben außen vor, die rechnen sich neu.
 */
function createBackup() {
  try {
    if (!FM.fileExists(BACKUP_DIR)) FM.createDirectory(BACKUP_DIR, true);
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const name = `items-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      + `_${p(d.getHours())}${p(d.getMinutes())}.json`;
    FM.writeString(FM.joinPath(BACKUP_DIR, name),
      JSON.stringify({ v: 2, at: Date.now(), items, history }));

    // Nur die jüngsten Sicherungen behalten
    const all = listBackups();
    all.slice(BACKUP_KEEP).forEach(old => {
      try { FM.remove(FM.joinPath(BACKUP_DIR, old)); } catch (e) {}
    });
    return name;
  } catch (e) { return ""; }
}

/**
 * Sicherung einspielen – die aktuelle Liste wird vorher gesichert.
 * Versteht beide Formate: reines Array (alte Sicherungen) und {items, history}.
 * @returns {products, days} – übernommene Produkte und Verlaufstage.
 */
async function restoreBackup(name) {
  try {
    const file = FM.joinPath(BACKUP_DIR, name);
    await ensureLocal(file);
    const data = JSON.parse(FM.readString(file));
    const list = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : null);
    if (!list) return { products: 0, days: 0 };
    createBackup();                       // Sicherheitsnetz vor dem Überschreiben
    items = list;
    items.forEach(i => { if (!i.updated) i.updated = 0; });
    touch("items");

    let days = 0;
    if (data && data.history && typeof data.history === "object") {
      // Verlauf zusammenführen statt ersetzen: je Produkt und Tag der
      // günstigste bekannte Wert – so geht nichts verloren, was seit der
      // Sicherung dazugekommen ist.
      for (const q of Object.keys(data.history)) {
        const byDay = new Map((history[q] || []).map(e => [e.d, e]));
        for (const e of data.history[q] || []) {
          const cur = byDay.get(e.d);
          if (!cur || e.p < cur.p) { byDay.set(e.d, e); days++; }
        }
        history[q] = [...byDay.values()].sort((a, b) => (a.d < b.d ? -1 : 1)).slice(-HISTORY_DAYS);
      }
      touch("history");
    }

    flush();
    invalidateDerived();
    return { products: items.length, days };
  } catch (e) { return { products: 0, days: 0 }; }
}

/** Ausgeschlossene Händler: Vorgabe aus dem Code plus eigene Einträge. */
function blockedAdvertisers() {
  const own = Array.isArray(meta.blocked) ? meta.blocked : [];
  return [...BLOCKED_ADVERTISERS, ...own].map(x => String(x).toLowerCase().trim()).filter(Boolean);
}

/** Schreibweisen der Ketten vereinheitlichen (für Dubletten und Vergleich). */
function normalizeChain(name) {
  const n = String(name || "").toLowerCase();
  const hit = Object.keys(CHAIN_DOMAINS).find(c => n.includes(c));
  return hit || n.trim();
}

/**
 * Logo je Kette – über die reguläre Website-Domain, nicht über eine eigene
 * Bilddatei. „aldi süd“/„aldi nord“ werden hier bewusst getrennt gehalten,
 * normalizeChain() fasst sie für Dubletten-Erkennung trotzdem zusammen.
 */
const CHAIN_DOMAINS = {
  "aldi süd": "aldi-sued.de", "aldi nord": "aldi-nord.de", "aldi": "aldi.de",
  "lidl": "lidl.de", "netto": "netto-online.de", "rewe": "rewe.de",
  "penny": "penny.de", "edeka": "edeka.de", "kaufland": "kaufland.de",
  "norma": "norma-online.de", "famila": "famila.de", "combi": "combi-markt.de",
  "marktkauf": "marktkauf.de", "globus": "globus.de", "hit": "hit-shop.de",
  "tegut": "tegut.com", "dm": "dm.de", "rossmann": "rossmann.de",
  "müller": "mueller.de", "getränke hoffmann": "getraenke-hoffmann.de",
  "trinkgut": "trinkgut.de",
};

// ─── Märkte in der Nähe (OpenStreetMap) ──────────────────────────
// Filialen kommen von Overpass (OpenStreetMap), weil marktguru keine
// Marktliste herausgibt und die Ketten selbst jeweils eine eigene, oft
// geschützte Marktsuche betreiben. Ergebnisse werden 30 Tage gemerkt:
// Filialen ziehen selten um, und jede Abfrage kostet mehrere Sekunden.
const MARKET_CACHE_D = 30;
const MARKET_CACHE_MAX = 20;      // gemerkte Umkreis-Abfragen

/** Eingestellter Umkreis in km – aus den Einstellungen, sonst die Vorgabe. */
function marketRadiusKm() {
  const v = Number(meta.marketRadiusKm);
  return MARKET_RADIUS_CHOICES.includes(v) ? v : MARKET_RADIUS_KM;
}

/** Entfernung zweier Koordinaten in Metern (Haversine). */
function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(m) {
  return m < 1000
    ? `${Math.round(m / 10) * 10} m`
    : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/**
 * PLZ in Koordinaten übersetzen (Nominatim). Das Ergebnis wandert nach
 * meta.geo – dieselbe PLZ wird nur einmal aufgelöst.
 */
async function geocodeZip(zip) {
  if (!zip) return null;
  meta.geo = meta.geo || {};
  const hit = meta.geo[zip];
  if (hit && Date.now() - hit.at < MARKET_CACHE_D * 864e5) return { lat: hit.lat, lon: hit.lon };
  const req = newRequest("https://nominatim.openstreetmap.org/search?format=json&limit=1"
    + "&countrycodes=de&postalcode=" + encodeURIComponent(zip));
  req.headers = { "User-Agent": `PreisApp/${APP_VERSION} (Scriptable, privater Gebrauch)` };
  const res = await loadJSONDiag(req, "Nominatim");
  if (!Array.isArray(res) || !res.length) return null;
  const lat = parseFloat(res[0].lat);
  const lon = parseFloat(res[0].lon);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  meta.geo[zip] = { lat, lon, at: Date.now() };
  touch("meta");
  flush();
  return { lat, lon };
}

/**
 * Ausgangspunkt der Suche: erst der Gerätestandort, sonst die PLZ aus den
 * Einstellungen. Verweigerter Standort ist kein Fehler – dann zählt die PLZ.
 */
async function searchOrigin(say) {
  try {
    Location.setAccuracyToHundredMeters();
    const l = await Location.current();
    if (l && isFinite(l.latitude)) {
      return { lat: l.latitude, lon: l.longitude, label: "aktueller Standort" };
    }
  } catch (e) {
    console.error("Standort nicht verfügbar: " + e.message);
  }
  const zip = cfg().zip;
  if (say && zip) say(`PLZ ${zip} wird aufgelöst …`);
  const g = await geocodeZip(zip);
  return g ? { lat: g.lat, lon: g.lon, label: "PLZ " + zip } : null;
}

/** Filialen einer Kette im Umkreis suchen – roh von Overpass. */
async function fetchStores(chain, lat, lon, radiusKm) {
  const term = String(chain).replace(/[\\.^$|?*+()[\]{}]/g, "\\$&");
  const query = `[out:json][timeout:25];`
    + `nwr(around:${radiusKm * 1000},${lat.toFixed(5)},${lon.toFixed(5)})`
    + `[shop][~"^(name|brand|operator)$"~"${term}",i];out center 60;`;
  const req = newRequest("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query));
  const res = await loadJSONDiag(req, "OpenStreetMap");

  const seenAt = new Set();
  const list = [];
  for (const el of res.elements || []) {
    const la = el.lat != null ? el.lat : (el.center && el.center.lat);
    const lo = el.lon != null ? el.lon : (el.center && el.center.lon);
    if (la == null || lo == null) continue;
    // Gebäude und Eingang derselben Filiale liegen doppelt in OSM
    const key = la.toFixed(4) + "," + lo.toFixed(4);
    if (seenAt.has(key)) continue;
    seenAt.add(key);
    const t = el.tags || {};
    const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
    const city = [t["addr:postcode"], t["addr:city"]].filter(Boolean).join(" ");
    list.push({
      name: t.name || t.brand || t.operator || chain,
      address: [street, city].filter(Boolean).join(", "),
      hours: t["opening_hours"] || "",
      lat: la,
      lon: lo,
      dist: Math.round(distanceM(lat, lon, la, lo)),
    });
  }
  list.sort((a, b) => a.dist - b.dist);
  return list.slice(0, MARKET_MAX);
}

/**
 * Adresse zu Koordinaten über iOS. Die Methode heißt Location.reverseGeocode –
 * reverseGeocodeLocation gibt es in Scriptable nicht, der Aufruf lief bisher
 * je Filiale in einen Fehler. Fällt der Dienst aus (kein Netz, Kontingent
 * erschöpft), wird er für den Rest des Laufs übersprungen: die Hausnummer ist
 * nur Beiwerk, die Filiale steht ohnehin schon in der Liste.
 * @returns {string} Adresse oder "" – wirft nie.
 */
let geocodeOff = false;

async function reverseGeocodeAddress(lat, lon) {
  if (geocodeOff) return "";
  if (typeof Location === "undefined" || typeof Location.reverseGeocode !== "function") {
    geocodeOff = true;
    return "";
  }
  try {
    const g = await Location.reverseGeocode(lat, lon);
    const p = g && g[0];
    if (!p) return "";
    // Scriptable liefert je nach iOS-Version flache Felder oder postalAddress
    const pa = p.postalAddress || {};
    const street = [p.thoroughfare || pa.street, p.subThoroughfare]
      .filter(Boolean).join(" ").trim();
    const city = [p.postalCode || pa.postalCode, p.locality || pa.city]
      .filter(Boolean).join(" ").trim();
    return [street, city].filter(Boolean).join(", ");
  } catch (e) {
    geocodeOff = true;   // einmal melden statt je Filiale
    console.error("Rückwärtssuche: " + e.message);
    return "";
  }
}

/**
 * Filialen mit Zwischenspeicher. Der Schlüssel rundet die Koordinaten auf
 * zwei Stellen (rund 1 km) – ein paar Schritte weiter wird nicht neu geladen.
 */
async function nearbyStores(advertiser, onStage) {
  const say = (text) => { if (onStage) onStage(text); };
  const radius = marketRadiusKm();
  const chain = normalizeChain(advertiser) || String(advertiser || "").trim();
  if (!chain) return { error: "Kein Händlername" };

  say("Standort wird bestimmt …");
  const origin = await searchOrigin(say);
  if (!origin) {
    return { error: "Weder Standort noch PLZ verfügbar – PLZ in den Einstellungen eintragen." };
  }

  meta.markets = meta.markets || {};
  // Der Umkreis gehört in den Schlüssel: 20 km liefert eine andere Liste als 10.
  const key = `${chain}|${origin.lat.toFixed(2)},${origin.lon.toFixed(2)}|${radius}`;
  const hit = meta.markets[key];
  if (hit && Date.now() - hit.at < MARKET_CACHE_D * 864e5) {
    return { origin, stores: hit.stores, cachedAt: hit.at };
  }

  say(`OpenStreetMap wird abgefragt (${radius} km um ${origin.label}) …`);
  let stores;
  try {
    stores = await fetchStores(chain, origin.lat, origin.lon, radius);
  } catch (e) {
    // Alter Stand ist besser als gar nichts, wenn Overpass gerade dicht macht
    if (hit) return { origin, stores: hit.stores, cachedAt: hit.at, warn: e.message };
    return { origin, error: e.message };
  }

  // Fehlende Hausnummern über die Rückwärtssuche von iOS auffüllen,
  // aber nur für die ersten drei – der Dienst ist mengenbegrenzt.
  let filled = 0;
  for (const s of stores) {
    if (s.address || filled >= 3) continue;
    say("Adressen werden ergänzt …");
    const addr = await reverseGeocodeAddress(s.lat, s.lon);
    if (addr) s.address = addr;
    filled++;
  }

  meta.markets[key] = { at: Date.now(), stores };
  // Älteste Abfragen herauswerfen, damit meta.json nicht wächst
  const keys = Object.keys(meta.markets);
  if (keys.length > MARKET_CACHE_MAX) {
    keys.sort((a, b) => meta.markets[a].at - meta.markets[b].at)
      .slice(0, keys.length - MARKET_CACHE_MAX)
      .forEach(k => delete meta.markets[k]);
  }
  touch("meta");
  flush();
  return { origin, stores };
}

/**
 * Route zur Filiale in Apple Karten öffnen.
 * Scriptable kennt kein Safari.openURL – die Methode heißt Safari.open().
 * Schlägt auch das fehl (z. B. im Widget-Kontext), landet die Adresse
 * wenigstens in der Zwischenablage.
 */
function openInMaps(store) {
  const label = encodeURIComponent(store.name + (store.address ? ", " + store.address : ""));
  const url = `http://maps.apple.com/?daddr=${store.lat},${store.lon}&q=${label}`;
  try {
    Safari.open(url);
    return true;
  } catch (e) {
    console.error("Karten öffnen: " + e.message);
    Pasteboard.copyString(store.name + (store.address ? ", " + store.address : ""));
    return false;
  }
}

/**
 * Fenster „Märkte in der Nähe“ – eigene Tabelle über der Detailansicht.
 * Das Fenster geht sofort mit einem Suchhinweis auf; die Zeilen werden
 * nachgereicht. present() wird deshalb nicht abgewartet, sondern erst am
 * Ende – sonst liefe die Suche erst nach dem Schließen des Fensters.
 */
async function showMarkets(advertiser) {
  const T = theme();
  const t = new UITable();
  t.showSeparators = true;

  let stage = "Standort wird bestimmt …";
  let res = null;               // null = Suche läuft noch

  function render() {
    trackHeights(t);
    t.removeAllRows();
    headerRow(t, T, advertiser,
      res && res.origin
        ? `Umkreis ${marketRadiusKm()} km · ${res.origin.label}`
        : "Filialen in der Nähe");

    if (!res) {
      // Suchhinweis, solange Standort und Overpass antworten
      const busy = new UITableRow();
      busy.height = tapRow(56);
      busy.backgroundColor = T.goodBg || T.row;
      const b = busy.addText("🔍 Filialen werden gesucht …", stage);
      b.widthWeight = 100;
      b.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
      b.titleColor = T.text;
      b.subtitleFont = Font.systemFont(LAYOUT.font(11));
      b.subtitleColor = T.muted;
      t.addRow(busy);
    } else if (res.error) {
      infoRow(t, T, "Keine Marktliste", res.error, T.warnBg);
    } else if (!res.stores || !res.stores.length) {
      infoRow(t, T, "Keine Filiale gefunden",
        `In OpenStreetMap steht im Umkreis von ${marketRadiusKm()} km kein Markt dieser Kette.`);
    } else {
      if (res.warn) infoRow(t, T, "Alter Stand", res.warn, T.warnBg);
      res.stores.forEach((s, i) => {
        const row = new UITableRow();
        row.dismissOnSelect = false;
        const sub = [s.address || "Adresse unbekannt", s.hours].filter(Boolean).join("  ·  ");
        row.height = autoRowHeight(s.name, 15, sub, 11, 75, tapRow(52));
        row.backgroundColor = i === 0 ? T.goodBg : (i % 2 ? T.rowAlt : T.row);
        const c = row.addText(s.name, sub);
        c.widthWeight = 75;
        c.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
        c.titleColor = T.text;
        c.subtitleFont = Font.systemFont(LAYOUT.font(11));
        c.subtitleColor = T.muted;
        const d = row.addText(formatDistance(s.dist), i === 0 ? "am nächsten" : "");
        d.widthWeight = 25;
        d.rightAligned();
        d.titleFont = Font.boldSystemFont(LAYOUT.font(14));
        d.titleColor = i === 0 ? T.good : T.text;
        d.subtitleFont = Font.systemFont(LAYOUT.font(10));
        d.subtitleColor = T.good;
        row.onSelect = () => openInMaps(s);
        t.addRow(row);
      });
      infoRow(t, T, "Antippen öffnet die Route",
        "Filialdaten: OpenStreetMap (ODbL)"
        + (res.cachedAt ? "  ·  Stand " + formatDateDE(new Date(res.cachedAt)) : ""));
    }

    // Auswählen schließt die Tabelle (dismissOnSelect bleibt hier an)
    const close = new UITableRow();
    close.height = tapRow(44);
    close.backgroundColor = T.bg;
    const cb = close.addText("Schließen");
    cb.centerAligned();
    cb.titleColor = T.accent;
    close.onSelect = () => {};
    t.addRow(close);

    padToBottom(t, T);
  }

  render();
  const closed = t.present(true);         // bewusst ohne await – die Suche läuft weiter

  try {
    res = await nearbyStores(advertiser, (text) => {
      stage = text;
      render();
      t.reload();
    });
  } catch (e) {
    res = { error: e.message };
  }
  render();
  t.reload();

  await closed;
}

/**
 * Bedingungen eines Angebots erkennen – etwa „nur mit App“, Kundenkarte,
 * Coupon oder Mindestabnahme. marktguru schreibt das in Beschreibung,
 * Titel oder eigene Felder; deshalb wird der gesamte Text durchsucht.
 */
function offerConditions(r) {
  const text = [
    r.description, r.title, r.subtitle, r.additionalInfo, r.hint, r.disclaimer,
    r.conditions, r.priceInfo, r.note,
    r.badges && r.badges.map(b => (typeof b === "string" ? b : b && b.name)).join(" "),
  ].filter(Boolean).join(" ").toLowerCase();

  const found = [];
  const rules = [
    [/\bnur\s+(mit|in|über)\s+(der\s+)?app\b|app-?(only|exklusiv)|nur app/, "📱 nur mit App"],
    [/app-?coupon|coupon in der app|digitaler coupon|app-?rabatt/, "📱 App-Coupon"],
    [/kundenkarte|payback|deutschlandcard|kaufland card|rewe bonus|lidl plus|penny app|edeka app|netto-app|marktkauf card/, "💳 nur mit Kundenkarte/App"],
    [/coupon|gutschein|rabattmarke/, "🎟️ mit Coupon"],
    [/ab\s?\d+\s?(stück|st\.|packungen|einheiten)|beim kauf von\s?\d+|mindestabnahme|\b\d+\s?für\b/, "🔢 Mindestabnahme"],
    [/nur online|online-?only|nur im onlineshop/, "🌐 nur online"],
    [/solange der vorrat|nur solange vorrat/, "⚠️ solange Vorrat reicht"],
    [/nur für neukunden|erstbestell/, "🆕 nur Neukunden"],
  ];
  for (const [re, label] of rules) {
    if (re.test(text) && found.indexOf(label) === -1) found.push(label);
  }
  return found;
}

/** Bild-URL aus einem marktguru-Ergebnis herausfischen (Feldnamen variieren). */
function offerImage(r) {
  try {
    if (r.imageUrl) return r.imageUrl;
    if (r.images && r.images.length) {
      const img = r.images[0];
      if (typeof img === "string") return img;
      if (img.url) return img.url;
      if (img.sizes && img.sizes.length) {
        const s = img.sizes[img.sizes.length - 1];
        return s.url || "";
      }
    }
    if (r.product && r.product.imageUrl) return r.product.imageUrl;
  } catch (e) {}
  return "";
}

/** Suchbegriff, der an marktguru geht (Sorte wird separat gefiltert). */
function searchTermOf(item) {
  return (item.search && item.search.trim()) || item.query;
}

/** Angebote für eine Beobachtung inkl. Sorten-Filter. */
async function fetchOffersFor(item) {
  const offers = await fetchOffersOnce(searchTermOf(item));
  const v = (item.variant || "").trim().toLowerCase();
  if (!v) return offers;

  const words = v.split(/\s+/).filter(Boolean);
  const hayOf = (o) => ((o.details || "") + " " + (o.advertiser || "")).toLowerCase();

  // 1. Versuch: alle Wörter der Sorte kommen vor
  const strict = offers.filter(o => words.every(w => hayOf(o).includes(w)));
  if (strict.length) return strict;

  // 2. Versuch: mindestens ein Wort – sonst würde eine zu enge Sorte
  //    alle Treffer wegfiltern und es sähe aus wie „kein Angebot“
  const loose = offers.filter(o => words.some(w => hayOf(o).includes(w)));
  if (loose.length) return loose;

  // 3. Nichts passt: alle Treffer der Suche behalten
  return offers;
}

/** Zeitstempel-Sperre lesen: true = frühestens nach `days` wieder versuchen. */
function blockedFor(store, key, days) {
  const at = (meta[store] || {})[key];
  return !!at && (Date.now() - at) < days * 86400000;
}

/** Fehlschlag merken, damit der nächste Lauf ihn überspringt. */
function markBlocked(store, key) {
  meta[store] = meta[store] || {};
  meta[store][key] = Date.now();
  touch("meta");
}

/**
 * Produktbild suchen: erst Open Food Facts (Originalbild), dann das Bild aus
 * dem Angebot. Bleibt beides ohne Treffer, wird das gemerkt – sonst geht bei
 * jedem Lauf erneut eine Suchabfrage für dasselbe Produkt ins Netz.
 * Im Widget wird gar nicht gesucht: dort zählt jede Sekunde.
 */
async function findImage(name, offers) {
  const fromOffer = (offers || []).find(o => o.image);
  const key = keyOf(name);
  if (!config.runsInWidget && !blockedFor("noImage", key, NO_IMAGE_RETRY_D)) {
    let answered = false;
    try {
      const url = "https://world.openfoodfacts.org/cgi/search.pl?search_terms="
        + encodeURIComponent(name)
        + "&search_simple=1&action=process&json=1&page_size=5&fields=product_name,image_front_url,image_front_small_url";
      const data = await newRequest(url).loadJSON();
      answered = true;
      const hit = (data.products || []).find(p => p.image_front_url || p.image_front_small_url);
      if (hit) return hit.image_front_url || hit.image_front_small_url;
    } catch (e) {}
    // Nur eine beantwortete Suche ohne Treffer sperrt – ein Netzfehler nicht.
    if (answered && !fromOffer) markBlocked("noImage", key);
  }
  return fromOffer ? fromOffer.image : "";
}

/**
 * Fehlendes Bild nachträglich ergänzen.
 * @param defer Nur vormerken statt sofort speichern – beim Sammellauf wird
 *   einmal am Ende geschrieben statt nach jedem einzelnen Bild.
 */
async function ensureImage(item, offers, defer) {
  if (item.image) return;
  const img = await findImage(item.query, offers);
  if (!img) return;
  item.image = img;
  stampItem(item);
  if (defer) touch("items"); else saveItems();
}

/** Alle Beobachtungen aktualisieren; liefert die neuen Angebote zurück. */
/** Aufgaben parallel abarbeiten, aber höchstens `limit` gleichzeitig. */
async function mapLimit(list, limit, worker) {
  const results = new Array(list.length);
  let next = 0;
  const runners = new Array(Math.min(limit, list.length)).fill(0).map(async () => {
    while (next < list.length) {
      const i = next++;
      results[i] = await worker(list[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * @param notify Bei neuen Angeboten eine Mitteilung schicken.
 * @param opts.allSources Keine Quelle wegen eines früheren Fehlers in
 *   diesem Lauf überspringen – jedes Produkt bekommt jede aktive Quelle.
 * @param opts.onProgress (done, total, stage) – für eine Fortschrittsanzeige.
 */
async function refreshAll(notify, opts) {
  opts = opts || {};
  const report = opts.onProgress || (() => {});
  const total = items.length;
  let done = 0;

  forceAllSourcesThisRun = !!opts.allSources;
  clearOfferRequests();            // Stand von vorhin nicht weiterverwenden
  clearOpenPriceRequests();
  // Harte Frist für Widget-Läufe: was danach noch offen ist, wird übersprungen
  // und beim nächsten Lauf nachgeholt.
  const deadline = RUN_BUDGET_MS ? Date.now() + RUN_BUDGET_MS : 0;
  const outOfTime = () => deadline > 0 && Date.now() > deadline;
  try {
    // Angebote parallel laden (4 gleichzeitig) – deutlich schneller als nacheinander
    const results = await mapLimit(items, PARALLEL_REQUESTS, async (item) => {
      if (outOfTime()) {
        report(++done, total, "Angebote");
        return { item, offers: [], skipped: true };
      }
      try {
        const offers = await fetchOffersFor(item);
        report(++done, total, "Angebote");
        return { item, offers };
      } catch (e) {
        console.error(item.query + ": " + e.message);
        report(++done, total, "Angebote");
        return { item, offers: [] };
      }
    });

    // Fällt eine Quelle aus, liefert jedes Produkt ein leeres Ergebnis. Den
    // Cache dann zu überschreiben würde alle Angebote von vorhin löschen und
    // die Liste fälschlich „kein Angebot“ zeigen – also alten Stand behalten.
    const degraded = providerErrors.size > 0;
    const kept = new Set();

    const fresh = [];
    for (const { item, offers, skipped } of results) {
      if (!offers.length && (degraded || skipped)) {
        // Alter Stand bleibt stehen – aber nur, was davon noch läuft.
        const still = activeOffers(item.query);
        if (still.length) {
          if (still.length !== (cache[item.query] || []).length) {
            cache[item.query] = still;
            invalidateDerived();
          }
          kept.add(item.query);
          continue;
        }
      }
      if (skipped) continue;         // gar nicht abgefragt – nichts überschreiben
      cache[item.query] = trimOffers(offers);
      if (item.alarm === false) continue;
      for (const o of offers) {
        // Ohne Preis im Schlüssel: eine Aktion meldet sich einmal, auch wenn
        // marktguru zwischendurch 3,19 € in 3,18 € ändert. Unterschieden wird
        // über das Ende der Aktion – die nächste Woche ist wieder neu.
        const key = `${item.query}|${normalizeChain(o.advertiser)}|`
          + (o.validTo || String(o.details || "").toLowerCase().slice(0, 40));
        if (seen.has(key)) continue;
        seen.add(key);
        fresh.push({ query: item.query, ...o });
      }
    }

    // Vergleichswert je Produkt aus Verlauf und Open Prices. Er wird auch bei
    // laufendem Angebot gesetzt – genau dann wird er ja gebraucht, um die
    // Ersparnis zu zeigen (der heutige Eintrag bleibt dabei außen vor).
    if (results.length) {
      report(total, total, "Vergleichspreise");
      // Gebündelt statt nacheinander: Open Prices geht je Produkt ins Netz.
      // Läuft die Zeit ab (Widget), bleibt der bisherige Wert stehen –
      // besser ein alter Vergleichspreis als gar keiner.
      await mapLimit(results, PARALLEL_REQUESTS, async ({ item }) => {
        if (outOfTime()) return;
        const np = await resolveNormalPrice(item);
        if (np) normal[item.query] = np; else delete normal[item.query];
      });
      touch("normal");
    }

    // Fehlende Produktbilder ermitteln und laden – im Widget nur mit Restzeit,
    // Bilder sind schmückend und dürfen als Erstes ausfallen.
    if (!outOfTime()) {
      report(total, total, "Bilder");
      // Nur Produkte ohne Bild kommen überhaupt in die Suche; gespeichert
      // wird gesammelt am Ende (flush) statt nach jedem einzelnen Fund.
      const needImage = results.filter(r => r.item && !r.item.image);
      if (needImage.length) {
        await mapLimit(needImage, PARALLEL_REQUESTS,
          ({ item, offers }) => outOfTime() ? null : ensureImage(item, offers, true));
      }
      if (!outOfTime()) await preloadImages(outOfTime);
      if (!outOfTime()) {
        report(total, total, "Logos");
        await preloadLogos(outOfTime);
      }
    }

    if (seen.size > SEEN_LIMIT) seen = new Set([...seen].slice(-SEEN_LIMIT));
    // Nach einem abgebrochenen oder gestörten Lauf bleibt der alte Zeitstempel
    // stehen, damit der nächste Start wieder abruft statt aus dem Cache zu leben.
    const complete = !outOfTime() && !degraded;
    if (complete) meta.lastRefresh = Date.now();
    meta.lastTry = Date.now();       // bremst Wiederholungen nach Fehlschlägen
    // Behaltene Angebote sind von gestern – sie dürfen nicht als heutiger
    // Preisstand in den Verlauf wandern.
    recordHistory(kept);
    if (degraded) meta.degradedAt = Date.now(); else delete meta.degradedAt;
    touch("meta", "seen", "cache");
    flush();
    invalidateDerived();

    if (notify && fresh.length) await sendNotification(fresh);
    if (notify) await notifyExpiring();
    return fresh;
  } finally {
    forceAllSourcesThisRun = false;   // nie über diesen Lauf hinaus wirken lassen
    clearOfferRequests();
    clearOpenPriceRequests();
  }
}

/**
 * Angebote fürs Speichern eindampfen. Angezeigt werden ohnehin nur die
 * günstigsten; ungekürzt wächst cache.json mit jedem Lauf und muss bei jedem
 * Start komplett geparst werden. Je Kette bleibt das günstigste Angebot
 * erhalten – der Warenkorb-Vergleich braucht jeden Markt –, danach wird mit
 * den nächstgünstigen aufgefüllt.
 */
function trimOffers(list) {
  if (list.length <= CACHE_KEEP) return list;
  const chains = new Set();
  const keep = [], rest = [];
  for (const o of list) {                  // list ist nach Preis sortiert
    const c = normalizeChain(o.advertiser);
    if (chains.has(c)) rest.push(o); else { chains.add(c); keep.push(o); }
  }
  const fill = Math.max(0, CACHE_KEEP - keep.length);
  return keep.concat(rest.slice(0, fill)).sort((a, b) => a.price - b.price);
}

/** Tagesbestpreis je Produkt festhalten (Grundlage für den Verlauf). */
function recordHistory(skip) {
  const day = new Date().toISOString().slice(0, 10);
  for (const item of items) {
    if (skip && skip.has(item.query)) continue;   // Stand stammt nicht von heute
    const list = activeOffers(item.query);
    // Ohne Angebot gibt es keinen Tagesstand – eine externe Preisquelle
    // gibt es nicht.
    if (!list.length) continue;
    const best = list[0].price;
    history[item.query] = history[item.query] || [];
    const entries = history[item.query];
    const last = entries[entries.length - 1];
    const advertiser = list[0].advertiser || "";
    if (last && last.d === day) {
      if (best < last.p) { last.p = best; last.a = advertiser; }
    } else {
      entries.push({ d: day, p: best, a: advertiser });
    }
    history[item.query] = entries.slice(-HISTORY_DAYS);
  }
  touch("history");
}

// ─── Auswertung (für Vergleich und Widget) ───────────────────────
let aggregateCache = null;
const ratingCache = new Map();   // memoisierte Preis-Einschätzungen

/** Zwischenergebnisse verwerfen, wenn sich die Angebote ändern. */
function invalidateDerived() {
  aggregateCache = null;
  ratingCache.clear();
}

/** Preise je Händler und je Produkt aus dem Cache aggregieren (gecacht). */
function aggregate() {
  if (aggregateCache) return aggregateCache;
  aggregateCache = computeAggregate();
  return aggregateCache;
}

function computeAggregate() {
  const byRetailer = {};
  const byProduct = {};
  for (const item of items) {
    for (const o of activeOffers(item.query)) {
      const r = (byRetailer[o.advertiser] ||= {});
      if (r[item.query] == null || o.price < r[item.query]) r[item.query] = o.price;
      if (!byProduct[item.query] || o.price < byProduct[item.query].price) {
        byProduct[item.query] = { price: o.price, advertiser: o.advertiser };
      }
    }
  }
  return { byRetailer, byProduct };
}

/** Mitteilung stellen – Ton und Skriptname sind bei allen Meldungen gleich. */
async function pushNote(title, body) {
  const n = new Notification();
  n.title = title;
  n.body = body;
  n.sound = "default";
  n.scriptName = Script.name();
  await n.schedule();
}

async function sendNotification(fresh) {
  const body = fresh.slice(0, 3)
    .map(f => {
      const v = validity(f);
      const r = priceRating(f.query, f.price);
      const extra = [
        (f.conditions || [])[0] || "",
        v && v.urgent ? "⏳ " + v.text : "",
        r && r.level === "best" ? "🟢 Bestpreis" : "",
      ].filter(Boolean).join(" · ");
      return `${f.query}: ${eur(f.price)} bei ${f.advertiser}${extra ? " – " + extra : ""}`;
    })
    .join("\n");
  await pushNote(
    fresh.length === 1 ? "Angebot: " + fresh[0].query : fresh.length + " neue Angebote",
    body);
}

/**
 * Erinnerung an Angebote, die heute oder morgen enden. Ohne sie fällt ein
 * beobachtetes Angebot still hinten runter, obwohl es noch zu holen wäre.
 * Je Angebot höchstens einmal am Tag; der Vermerk verfällt mit dem Angebot.
 */
async function notifyExpiring() {
  const day = new Date().toISOString().slice(0, 10);
  meta.expiryNotified = meta.expiryNotified || {};

  const due = [];
  for (const item of items) {
    if (item.alarm === false) continue;
    const best = bestOf(item.query);
    if (!best) continue;
    const v = validity(best);
    if (!v || v.expired || v.days > 1) continue;
    const key = `${item.query}|${best.validTo || ""}`;
    if (meta.expiryNotified[key] === day) continue;
    meta.expiryNotified[key] = day;
    due.push({ item, best, v });
  }

  // Vermerke zu Angeboten, die es nicht mehr gibt, wieder entfernen
  const live = new Set();
  items.forEach(i => activeOffers(i.query).forEach(o => live.add(`${i.query}|${o.validTo || ""}`)));
  for (const k of Object.keys(meta.expiryNotified)) {
    if (!live.has(k)) delete meta.expiryNotified[k];
  }
  touch("meta");
  if (!due.length) return;

  await pushNote(
    due.length === 1 ? "⏳ Läuft aus: " + due[0].item.query : `⏳ ${due.length} Angebote laufen aus`,
    due.slice(0, 3)
      .map(d => `${d.item.query}: ${eur(d.best.price)} bei ${d.best.advertiser} – ${d.v.text}`)
      .join("\n"));
}

// ─── Hilfen ──────────────────────────────────────────────────────
const eur = (n) => n.toFixed(2).replace(".", ",") + " €";

/** Wann wurde zuletzt erfolgreich abgerufen? Kurztext fürs Widget. */
function lastRefreshText() {
  if (!meta.lastRefresh) return "noch kein Abruf";
  const d = new Date(meta.lastRefresh);
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const day = new Date(meta.lastRefresh); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day0 - day) / 86400000);
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (diff <= 0) return "Stand " + time;
  if (diff === 1) return "Stand gestern " + time;
  return "Stand " + d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

/** "2026-08-11" -> "11.08.2026" */
function formatDateDE(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Vergleichspreis aus der eigenen Historie. Eine externe Preisquelle gibt es
 * nicht, und der zuletzt gesehene Preis taugt schlecht: er war selbst ein
 * Angebot, dadurch fiel die Ersparnis zu niedrig aus und schwankte stark.
 * Stattdessen der 75-%-Wert der letzten 90 Tage – der obere, „normale“
 * Bereich der beobachteten Preise, ohne den einen Ausreißer nach oben.
 * Der heutige Eintrag bleibt außen vor, solange ein Angebot läuft; sonst
 * vergliche sich das Angebot mit sich selbst. Rechnung ohne Netzabfrage.
 */
function fetchNormalPrice(item) {
  const all = (history[item.query] || []).filter(e => !e.n);
  if (!all.length) return null;

  const today = new Date().toISOString().slice(0, 10);
  const running = activeOffers(item.query).length > 0;
  const usable = all.filter(e => !(running && e.d === today));
  if (!usable.length) return null;

  const limit = new Date(Date.now() - NORMAL_WINDOW_D * 86400000).toISOString().slice(0, 10);
  const recent = usable.filter(e => e.d >= limit);
  const pool = recent.length >= 3 ? recent : usable;

  const sorted = [...pool].sort((a, b) => a.p - b.p);
  const ref = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];
  const solid = pool.length >= 3;
  return {
    price: ref.p,
    advertiser: ref.a || "",
    date: ref.d,
    source: solid ? `Verlauf ${NORMAL_WINDOW_D} Tage` : "zuletzt gesehen",
    // "history" nur bei belastbarem Verlauf – ein einzelner gesehener Preis
    // ist schwächer als eine gemeldete Regalpreis-Reihe (siehe resolveNormalPrice).
    src: solid ? "history" : "lastseen",
  };
}

/**
 * Alter eines Vergleichspreises: {days, stale} oder null.
 * Ab NORMAL_MAX_AGE_D taugt ein Wert nicht mehr als Grundlage einer Ersparnis
 * – Sortimente und Preisniveaus ändern sich.
 */
function normalAge(np) {
  if (!np || !np.date) return null;
  const d = new Date(np.date);
  if (isNaN(d)) return null;
  const days = Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
  return { days, stale: days > NORMAL_MAX_AGE_D };
}

/** Vergleichspreis, der jung genug für eine Ersparnis-Rechnung ist. */
function freshNormalPrice(query) {
  const np = normalPrice(query);
  if (!np) return null;
  const age = normalAge(np);
  return (age && age.stale) ? null : np;
}

/** Bekannter Vergleichspreis aus dem Zwischenspeicher. */
function normalPrice(query) {
  return normal[query] || null;
}

/**
 * Darf wieder abgerufen werden? Nach einem abgebrochenen oder gestörten Lauf
 * bleibt lastRefresh alt – ohne diese Bremse würde das Widget bei jedem
 * Neuzeichnen erneut ins Netz gehen.
 */
function retryAllowed() {
  return !meta.lastTry || (Date.now() - meta.lastTry) / 60000 > RETRY_COOLDOWN_MIN;
}

/**
 * Laufende Angebote eines Produkts – die einzige Lesestelle für Liste,
 * Detail, Widget, Verlauf und Export. Der Zwischenspeicher wird zwar beim
 * Start aufgeräumt, doch dazwischen liegt der Tageswechsel: eine Sitzung
 * über Mitternacht oder ein Widget, das Stunden später neu zeichnet, zeigte
 * sonst weiter Angebote von gestern.
 */
function activeOffers(query) {
  const list = cache[query] || [];
  if (!list.length) return list;
  const keep = list.filter(o => !offerExpired(o));
  return keep.length === list.length ? list : keep;
}

/**
 * Enddatum eines Angebots als lokaler Tag. Die Quellen liefern teils reine
 * Datumsangaben, teils Zeitstempel in UTC – „2026-08-15T22:00:00Z“ meint in
 * unserer Zeitzone das Ende des 15., wäre als Zeitpunkt gelesen aber schon
 * der 16. Deshalb zählt nur der Datumsteil.
 */
function endOfOffer(validTo) {
  const s = String(validTo);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  if (isNaN(d)) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Abgelaufene Angebote aus dem Zwischenspeicher werfen.
 * Nötig, weil zwischen zwei Abrufen Tage liegen können – erst recht, wenn
 * wegen einer gestörten Quelle der alte Stand stehen geblieben ist.
 */
function pruneExpiredCache() {
  let changed = false;
  for (const q of Object.keys(cache)) {
    const list = cache[q] || [];
    const keep = list.filter(o => !offerExpired(o));
    if (keep.length !== list.length) { cache[q] = keep; changed = true; }
  }
  if (changed) { touch("cache"); invalidateDerived(); }
  return changed;
}

/**
 * Angebot abgelaufen? Ohne Enddatum entscheidet das Alter: solche Angebote
 * blieben sonst unbegrenzt stehen und galten dauerhaft als laufend – vor
 * allem, wenn eine gestörte Quelle den alten Stand hat stehen lassen.
 */
function offerExpired(offer) {
  const v = validity(offer);
  if (v) return v.expired;
  if (!offer) return false;
  // Kein Enddatum und kein Erfassungszeitpunkt (Stand vor 0.54): einmal
  // durchgehen lassen, der nächste Abruf schreibt seenAt.
  if (!offer.seenAt) return false;
  return (Date.now() - offer.seenAt) > OFFER_MAX_AGE_D * 86400000;
}

/** Restlaufzeit eines Angebots: {days, text, urgent} oder null. */
function validity(offer) {
  if (!offer || !offer.validTo) return null;
  const end = endOfOffer(offer.validTo);
  if (!end) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((end - today) / 86400000);
  if (days < 0) return { days, text: "abgelaufen", urgent: false, expired: true };
  const text = days === 0 ? "nur noch heute!"
    : days === 1 ? "noch bis morgen"
    : `noch ${days} Tage (bis ${end.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })})`;
  return { days, text, urgent: days <= 1, expired: false };
}

/**
 * Preis-Einschätzung aus der eigenen Historie:
 * Wo liegt der aktuelle Preis im bisher beobachteten Bereich?
 */
function priceRating(query, price) {
  const key = query + "|" + price;
  if (ratingCache.has(key)) return ratingCache.get(key);
  const result = computeRating(query, price);
  ratingCache.set(key, result);
  return result;
}

function computeRating(query, price) {
  const entries = history[query] || [];
  if (entries.length < 3 || price == null) return null;
  const prices = entries.map(e => e.p);
  const min = Math.min(...prices), max = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  if (max - min < 0.02) return { label: "Preis stabil", level: "mid", min, max, avg };

  const pos = (price - min) / (max - min);   // 0 = bester je gesehener Preis
  if (price <= min + 0.001) return { label: "🟢 Bestpreis seit Beobachtung", level: "best", min, max, avg };
  if (pos <= 0.25) return { label: "🟢 sehr günstig", level: "good", min, max, avg };
  if (pos <= 0.6) return { label: "🟡 durchschnittlich", level: "mid", min, max, avg };
  return { label: "🔴 eher teuer – warten lohnt oft", level: "bad", min, max, avg };
}

/** Angebotsverlauf: wie oft war das Produkt zuletzt im Angebot? */
/** Bester je beobachteter Preis mit Datum und Händler. */
function bestEver(query) {
  // Altbestand: frühere Einträge ohne Angebot tragen n:1 und zählen nicht mit
  const entries = (history[query] || []).filter(e => !e.n);
  if (!entries.length) return null;
  return entries.reduce((best, e) => (best == null || e.p < best.p ? e : best), null);
}

function offerFrequency(query) {
  const entries = history[query] || [];
  if (!entries.length) return null;
  const days = entries.filter(e => !e.n).length;
  if (!days) return null;
  const first = entries[0].d, last = entries[entries.length - 1].d;
  const span = Math.max(1, Math.round((new Date(last) - new Date(first)) / 86400000) + 1);
  const weeks = Math.max(1, Math.round(span / 7));
  return { days, span, weeks, share: days / span };
}

/** Alphabetisch nach deutschem Alphabet (Umlaute wie a/o/u, 10 nach 9). */
function byName(a, b) {
  return String(a).localeCompare(String(b), "de", { sensitivity: "base", numeric: true });
}

/** Anzeigename inkl. Sorte, falls hinterlegt – für Export/Erinnerungen. */
function itemLabel(item) {
  return item.variant ? `${item.query} · ${item.variant}` : item.query;
}

function bestOf(query) {
  return activeOffers(query)[0] || null;
}

// ─── Open Prices: Regalpreise aus der Gemeinschaftsdatenbank ─────
// Schwesterprojekt von Open Food Facts. Gesammelt werden dort keine
// Aktions-, sondern normale Ladenpreise mit Beleg – genau die Lücke, die
// der eigene Verlauf nicht füllt. PreisApp liest nur; Preise werden nicht
// aus der App heraus gemeldet. Lesen geht ohne Anmeldung.
// Die Daten stehen unter ODbL, deshalb wird die Quelle immer genannt.

const OPEN_PRICES_API = "https://prices.openfoodfacts.org/api/v1/prices";
const OPEN_PRICES_MAX_AGE_D = 365;   // ältere Meldungen taugen nicht als Vergleich
const OPEN_PRICES_SAMPLE = 10;       // so viele jüngste Meldungen gehen in den Median

/**
 * Vom Nutzer gewünscht? Nur der Schalter in den Einstellungen.
 * Getrennt von openPricesOn(), damit der Schalter auch dann seinen eigenen
 * Stand zeigt, wenn die Quelle über SOURCES oder den Debug-Modus aus ist.
 */
function openPricesWanted() {
  return !(Keychain.contains(KEYCHAIN.openPrices) && Keychain.get(KEYCHAIN.openPrices) === "0");
}
/** Wird die Quelle tatsächlich abgefragt? Schalter UND SOURCES/Debug. */
function openPricesOn() {
  return openPricesWanted() && providerEnabled("openprices");
}
function setOpenPrices(on) {
  Keychain.set(KEYCHAIN.openPrices, on ? "1" : "0");
}

// Je Lauf höchstens eine Abfrage pro EAN – mehrere Produkte können denselben
// Barcode tragen (verschiedene Suchbegriffe, gleiche Ware).
const openPriceRequests = new Map();
function clearOpenPriceRequests() { openPriceRequests.clear(); }

/**
 * Üblichen Ladenpreis zu einer EAN holen. Genommen wird der Median der
 * jüngsten Meldungen: ein einzelner Eintrag ist oft ein Sonderposten oder
 * ein Tippfehler, der Median übersteht beides.
 * @returns {price, advertiser, date, source, src} wie fetchNormalPrice, oder null
 */
async function fetchOpenPrice(item) {
  if (!openPricesOn() || !item || !item.ean) return null;
  const key = String(item.ean).trim();
  if (!key) return null;
  if (openPriceRequests.has(key)) return openPriceRequests.get(key);
  const p = loadOpenPrice(key).catch(() => null);
  openPriceRequests.set(key, p);
  return p;
}

async function loadOpenPrice(ean) {
  // Kennzahlen wie bei den Angebotsquellen, damit die Debug-Ansicht zeigt,
  // ob die Quelle überhaupt antwortet.
  const st = providerStats.openprices
    || (providerStats.openprices = { count: 0, ms: 0, calls: 0, error: "" });
  const t0 = Date.now();
  st.calls++;

  try {
    const url = OPEN_PRICES_API
      + "?product_code=" + encodeURIComponent(ean)
      + "&order_by=-date&size=" + OPEN_PRICES_SAMPLE;
    const req = newRequest(url);
    req.headers = { "User-Agent": `PreisApp - Scriptable - iOS - Version ${APP_VERSION}` };
    const data = await loadJSONDiag(req, "Open Prices");
    const list = (data && (data.items || data.results)) || [];

    const usable = [];
    for (const p of list) {
      const price = Number(p.price);
      if (!isFinite(price) || price <= 0) continue;
      // Fremdwährungen führen sonst zu unsinnigen Ersparnissen
      if (p.currency && p.currency !== "EUR") continue;
      const date = String(p.date || "").slice(0, 10);
      if (!date) continue;
      if ((Date.now() - new Date(date).getTime()) / 86400000 > OPEN_PRICES_MAX_AGE_D) continue;
      const loc = p.location || {};
      usable.push({
        price,
        date,
        shop: loc.osm_name || loc.osm_brand || loc.osm_address_city || "",
      });
    }

    st.ms += Date.now() - t0;
    if (!usable.length) return null;
    st.count++;

    // Mittlerer Eintrag statt gemitteltem Wert: so gehören Preis, Datum und
    // Laden zusammen und stammen aus derselben Meldung.
    const sorted = [...usable].sort((a, b) => a.price - b.price);
    const mid = sorted[Math.floor((sorted.length - 1) / 2)];
    return {
      price: mid.price,
      advertiser: mid.shop,
      date: mid.date,
      source: usable.length > 1
        ? `Open Prices · Median aus ${usable.length} Meldungen`
        : "Open Prices",
      src: "openprices",
    };
  } catch (e) {
    st.error = e.message;
    st.ms += Date.now() - t0;
    console.error("Open Prices: " + e.message);
    return null;
  }
}

/**
 * Vergleichspreis eines Produkts aus allen Quellen.
 * Der eigene Verlauf hat Vorrang, sobald er auf mehreren Tagen beruht – er
 * kennt die Preise, die hier wirklich im Regal standen. Der schwache
 * Rückfall „zuletzt gesehen“ tritt dagegen hinter Open Prices zurück.
 */
async function resolveNormalPrice(item) {
  const own = fetchNormalPrice(item);
  if (own && own.src === "history") return own;
  const op = await fetchOpenPrice(item);
  return op || own;
}

/** Woher stammt ein gespeicherter Vergleichspreis? Auch für alte Einträge. */
function normalSourceId(np) {
  if (!np) return "";
  if (np.src) return np.src;
  return /^Open Prices/.test(String(np.source || "")) ? "openprices" : "history";
}

// ─── Export in die Erinnerungen-App ──────────────────────────────
// Erzeugt eine Erinnerung je Produkt mit Preis und Anbieter in den
// Notizen. Bereits vorhandene Erinnerungen (gleicher Titel, noch nicht
// erledigt) werden aktualisiert statt dupliziert.

/** Liste in „Erinnerungen“ wählen oder anlegen; Auswahl wird gemerkt. */
async function pickReminderList() {
  const lists = await Calendar.forReminders();

  if (meta.reminderList) {
    const known = lists.find(c => c.title === meta.reminderList);
    if (known) return known;   // gemerkte Liste existiert noch – kein Dialog nötig
  }

  const a = new Alert();
  a.title = "Liste in Erinnerungen";
  a.message = "Wohin sollen die Produkte exportiert werden?";
  lists.forEach(c => a.addAction(c.title));
  a.addAction("➕ Neue Liste …");
  a.addCancelAction("Abbrechen");
  const choice = await a.presentAlert();
  if (choice === -1) return null;

  let calendar;
  if (choice === lists.length) {
    const n = new Alert();
    n.title = "Neue Liste";
    n.addTextField("Name", "Einkaufsliste");
    n.addAction("Anlegen");
    n.addCancelAction("Abbrechen");
    if (await n.presentAlert() === -1) return null;
    const name = n.textFieldValue(0).trim();
    if (!name) return null;
    calendar = await Calendar.findOrCreateForReminders(name);
  } else {
    calendar = lists[choice];
  }

  meta.reminderList = calendar.title;
  touch("meta");
  flush();
  return calendar;
}

/**
 * Produkte als Erinnerungen anlegen – eine je Produkt (Titel = Produkt,
 * Notiz = Preis · Anbieter). Ein erneuter Export aktualisiert bestehende
 * Erinnerungen mit gleichem Titel statt Dubletten anzulegen.
 *
 * Hinweis zu „Abschnitten“ (Kräuter, Fleisch, Feinkost, …): Das ist Apples
 * automatische Kategorisierung für Listen vom Typ „Einkäufe“ – eine reine
 * Anzeigefunktion der Erinnerungen-App, die sich nicht über das API
 * beeinflussen lässt. Abschalten: Liste öffnen → „•••“ → „Infos zur Liste
 * anzeigen“ → Listentyp von „Einkäufe“ auf „Standard“ stellen.
 * @param entries [{ name, price, advertiser }]
 */
async function exportToReminders(entries) {
  if (!entries.length) return null;
  const calendar = await pickReminderList();
  if (!calendar) return null;

  const existing = await Reminder.allIncomplete([calendar]);
  const byTitle = new Map(existing.map(r => [r.title.trim().toLowerCase(), r]));

  let added = 0, updated = 0;
  for (const e of entries) {
    const notes = `${eur(e.price)} · ${e.advertiser}`;
    const key = e.name.trim().toLowerCase();
    const found = byTitle.get(key);
    if (found) {
      if (found.notes !== notes) { found.notes = notes; await found.save(); updated++; }
    } else {
      const r = new Reminder();
      r.calendar = calendar;
      r.title = e.name;
      r.notes = notes;
      await r.save();
      added++;
    }
  }
  return { list: calendar.title, added, updated, total: entries.length };
}

// ─── Warenart: Food / Non-Food / Tierbedarf ──────────────────────
// Benannt wie die vier Open-Facts-Datenbanken, aus denen die Zuordnung
// stammt – so heißt in der App und in der Quelle dasselbe gleich.
const CATS = [
  { id: "food",     label: "Food (Lebensmittel/Getränke)",           short: "🍎 Food",     icon: "🍎" },
  { id: "beauty",   label: "Beauty (Kosmetik/Körperpflege/Drogerie)", short: "🧴 Beauty",   icon: "🧴" },
  { id: "pet",      label: "Pet (Tierfutter)",                        short: "🐶 Pet",      icon: "🐶" },
  { id: "products", label: "Products (sonstige Produkte)",            short: "📦 Products", icon: "📦" },
];

/**
 * Bis 0.57 gab es nur „nonfood“ für Drogerie und sonstige Produkte. Der
 * Wert steckt noch in gespeicherten Produkten und im Filter, deshalb wird
 * er beim Lesen auf „products“ gedreht.
 */
function catId(id) {
  return id === "nonfood" ? "products" : (id || "");
}
/** Symbol für den Warenart-Filter – 🛍 steht für „alle Arten“. */
function catIcon(id) {
  const c = CATS.find(x => x.id === catId(id));
  return c ? c.icon : "🛍";
}
function catLabel(id) {
  const c = CATS.find(x => x.id === catId(id));
  return c ? c.label : "unbestimmt";
}
/** „1 Markt“ statt „1 Märkte“. */
function marketCount(n) {
  return n === 1 ? "1 Markt" : n + " Märkte";
}

/** Kurzform mit Symbol – für Kopfzeile und Filter, wo Platz knapp ist. */
function catShort(id) {
  const c = CATS.find(x => x.id === catId(id));
  return c ? c.short : "🛍 alle";
}

/**
 * Warenart nachfragen. Nötig, wenn die EAN in keiner Datenbank steht: dann
 * lässt sie sich nicht ableiten, und das Produkt fiele durch jeden
 * Warenart-Filter.
 * @returns Kennung oder "" (unbestimmt)
 */
async function askCategory(title) {
  const a = new Alert();
  a.title = "Warenart";
  a.message = `Wozu gehört „${title}“? Danach richtet sich der Filter in der Übersicht.`;
  CATS.forEach(c => a.addAction(c.short));
  a.addCancelAction("Unbestimmt lassen");
  const choice = await a.presentAlert();
  return choice === -1 ? "" : CATS[choice].id;
}

/** Warenart aus der Datenbank ableiten, in der die EAN gefunden wurde. */
function catFromDb(db) {
  if (db === "food") return "food";
  if (db === "petfood") return "pet";
  if (db === "beauty") return "beauty";
  if (db === "product") return "products";
  return "";
}

/** Produktbild lokal cachen und als Image laden. */
// Bilder werden dreistufig gecacht:
//   1. Speicher (memImages) – innerhalb eines Laufs kein erneutes Lesen
//   2. Datei in Scriptable/PreisApp/img – überlebt Neustarts
//   3. Netzwerk – nur, wenn 1 und 2 nichts liefern
const memImages = new Map();

/** Eindeutiger Dateiname je Produkt + Bild-URL (Wechsel wird erkannt). */
function imageFileFor(item) {
  const stamp = String(item.image).length + "_" + String(item.image).slice(-12).replace(/[^a-zA-Z0-9]/g, "");
  return FM.joinPath(IMG_DIR, encodeURIComponent(item.query).replace(/%/g, "_") + "-" + stamp + ".jpg");
}

/** Bild aus Speicher oder Datei – ohne Netzwerk, daher sofort. */
function cachedImage(item) {
  if (!item.image) return null;
  const file = imageFileFor(item);
  if (memImages.has(file)) return memImages.get(file);
  try {
    // Noch nicht geladene iCloud-Dateien gelten hier als nicht vorhanden –
    // das Herunterladen übernimmt productImage(), das warten kann.
    if (FM.fileExists(file) && (!FM.isFileStoredIniCloud(file) || FM.isFileDownloaded(file))) {
      const img = FM.readImage(file);
      memImages.set(file, img);
      return img;
    }
  } catch (e) {}
  return null;
}

/**
 * Bild besorgen; lädt nur herunter, wenn es weder im Speicher noch als Datei
 * vorliegt. Eine URL, die keinen Download liefert, wird über Läufe hinweg
 * gemerkt – sonst versucht sie jeder Lauf aufs Neue.
 */
async function productImage(item) {
  if (!item.image) return null;
  const cached = cachedImage(item);
  if (cached) return cached;
  if (blockedFor("badImage", item.image, BAD_IMAGE_RETRY_D)) return null;

  const file = imageFileFor(item);
  // Liegt die Datei in iCloud, aber noch nicht lokal: erst holen, dann lesen.
  if (await ensureLocal(file)) {
    try {
      const img = FM.readImage(file);
      if (img) { memImages.set(file, img); return img; }
    } catch (e) {}
  }
  try {
    const img = await newRequest(item.image).loadImage();
    FM.writeImage(file, img);
    memImages.set(file, img);
    return img;
  } catch (e) {
    memImages.set(file, null);        // in diesem Lauf nicht erneut versuchen
    markBlocked("badImage", item.image);
    return null;
  }
}

/** Vermerke zu Bild-URLs entfernen, die keine Beobachtung mehr benutzt. */
function pruneBadImages() {
  if (!meta.badImage) return;
  const live = new Set(items.map(i => i.image).filter(Boolean));
  let changed = false;
  for (const url of Object.keys(meta.badImage)) {
    if (!live.has(url)) { delete meta.badImage[url]; changed = true; }
  }
  if (changed) touch("meta");
}

/**
 * Fehlende Bilder einmalig herunterladen (beim Aktualisieren).
 * @param stop optionale Abbruchprüfung (Widget-Zeitlimit).
 */
async function preloadImages(stop) {
  const missing = items.filter(i => i.image && !cachedImage(i)
    && !blockedFor("badImage", i.image, BAD_IMAGE_RETRY_D));
  if (missing.length) {
    await mapLimit(missing, PARALLEL_REQUESTS,
      (i) => (stop && stop()) ? null : productImage(i));
  }
  pruneBadImages();
  cleanupImageCache();
}

// ─── Supermarkt-Logos ─────────────────────────────────────────────
// Gleiches dreistufiges Caching wie bei Produktbildern (Speicher/Datei/
// Netz), aber pro KETTE statt pro Produkt – ein Logo reicht für alle
// Angebote desselben Marktes.
// Quelle: Googles Favicon-Dienst (s2/favicons), ersatzweise DuckDuckGo –
// beide ohne Konto/Key nutzbar. (logo.clearbit.com wurde am 8.12.2025
// endgültig abgeschaltet und liefert seither nichts mehr.)
const memLogos = new Map();

function logoFileFor(domain) {
  return FM.joinPath(LOGO_DIR, domain.replace(/[^a-z0-9.\-]/gi, "_") + ".png");
}

/** Logo aus Speicher oder Datei – ohne Netzwerk, daher synchron nutzbar. */
function cachedLogo(advertiserName) {
  const domain = CHAIN_DOMAINS[normalizeChain(advertiserName)];
  if (!domain) return null;
  if (memLogos.has(domain)) return memLogos.get(domain);
  const file = logoFileFor(domain);
  try {
    // Wie bei den Produktbildern: noch nicht geladene iCloud-Dateien
    // überlässt diese Funktion dem asynchronen fetchLogo().
    if (FM.fileExists(file) && (!FM.isFileStoredIniCloud(file) || FM.isFileDownloaded(file))) {
      const img = FM.readImage(file);
      memLogos.set(domain, img);
      return img;
    }
  } catch (e) {}
  return null;
}

/**
 * Logo besorgen; lädt nur herunter, wenn es noch nicht gecacht ist.
 * Liefert keiner der beiden Dienste etwas, wird das gemerkt: sonst gehen für
 * jede unbekannte Kette bei jedem Lauf zwei Abfragen vergebens ins Netz.
 */
async function fetchLogo(domain) {
  if (memLogos.has(domain)) return memLogos.get(domain);
  if (blockedFor("noLogo", domain, NO_LOGO_RETRY_D)) { memLogos.set(domain, null); return null; }
  const file = logoFileFor(domain);
  if (await ensureLocal(file)) {
    try {
      const img = FM.readImage(file);
      if (img) { memLogos.set(domain, img); return img; }
    } catch (e) {}
  }
  const sources = [
    `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
  for (const url of sources) {
    try {
      const img = await newRequest(url).loadImage();
      FM.writeImage(file, img);
      memLogos.set(domain, img);
      return img;
    } catch (e) {}
  }
  memLogos.set(domain, null);   // kein Logo verfügbar – nicht erneut versuchen
  markBlocked("noLogo", domain);
  return null;
}

/** Liegt das Logo schon vor (Speicher oder Datei)? Ohne Netzabfrage. */
function logoCached(domain) {
  if (memLogos.has(domain)) return memLogos.get(domain);
  try { return FM.fileExists(logoFileFor(domain)) ? true : null; } catch (e) { return null; }
}

/**
 * Alle Logos zu den aktuell bekannten Ketten vorladen.
 * @param stop optionale Abbruchprüfung (Widget-Zeitlimit).
 */
async function preloadLogos(stop) {
  const domains = new Set();
  Object.values(cache).forEach(offers => (offers || []).forEach(o => {
    const d = CHAIN_DOMAINS[normalizeChain(o.advertiser)];
    if (d) domains.add(d);
  }));
  const missing = [...domains].filter(d => !logoCached(d)
    && !blockedFor("noLogo", d, NO_LOGO_RETRY_D));
  if (missing.length) {
    await mapLimit(missing, PARALLEL_REQUESTS, (d) => (stop && stop()) ? null : fetchLogo(d));
  }
}

/**
 * Logo-Zelle vor eine Zeile setzen. Ohne verfügbares Logo bleibt die Zeile
 * unverändert (Text rückt nicht künstlich ein).
 * @returns die verbleibende Breite für die restlichen Zellen (100 - logoW)
 */
function withLogo(row, advertiserName, width) {
  const img = cachedLogo(advertiserName);
  if (!img) return 100;
  const cell = row.addImage(img);
  cell.widthWeight = width;
  cell.centerAligned();
  return 100 - width;
}

/** Verwaiste Bilddateien entfernen (gelöschte Produkte, alte URLs). */
function cleanupImageCache() {
  try {
    const valid = items.filter(i => i.image).map(i => imageFileFor(i));
    FM.listContents(IMG_DIR).forEach(name => {
      const path = FM.joinPath(IMG_DIR, name);
      if (valid.indexOf(path) === -1) FM.remove(path);
    });
  } catch (e) {}
}

// ─── Produkt hinzufügen / löschen ────────────────────────────────
async function addItem(query, image, search, variant, ean, cat) {
  query = (query || "").trim();
  if (!query) return false;
  if (items.some(i => i.query.toLowerCase() === query.toLowerCase())) return false;

  const item = {
    query,
    search: (search || "").trim(),
    variant: (variant || "").trim(),
    image: image || "",
    ean: (ean || "").trim(),
    cat: catId(cat),                    // food | beauty | pet | products | "" (unbestimmt)
    alarm: true,
    updated: Date.now(),
  };
  items.push(item);
  saveItems();
  try {
    const offers = await fetchOffersFor(item);
    cache[query] = offers;
    touch("cache");
    await ensureImage(item, offers);
    // Auch mit laufendem Angebot: der Vergleichswert macht die Ersparnis
    // überhaupt erst sichtbar.
    const np = await resolveNormalPrice(item);
    if (np) { normal[query] = np; touch("normal"); }
    flush();
  } catch (e) {}
  return true;
}

/** Beobachtung bearbeiten: Name, Suchbegriff, Sorte, Bild. */
async function editItem(item) {
  const a = new Alert();
  a.title = "Produkt bearbeiten";
  a.message = "Suchbegriff geht an marktguru (breit halten), die Sorte filtert die Treffer (z. B. „Sensitiv“).";
  a.addTextField("Anzeigename", item.query);
  a.addTextField("Suchbegriff (marktguru)", searchTermOf(item));
  a.addTextField("Sorte / Variante (optional)", item.variant || "");
  a.addTextField("Bild-URL (leer = automatisch)", item.image || "");
  a.addTextField("EAN (für Produktdaten, optional)", item.ean || "");
  a.addAction("Speichern");
  a.addAction("Bild neu suchen");
  a.addCancelAction("Abbrechen");
  const choice = await a.presentAlert();
  if (choice === -1) return false;

  const newName = a.textFieldValue(0).trim() || item.query;
  const oldName = item.query;

  item.search = a.textFieldValue(1).trim();
  item.variant = a.textFieldValue(2).trim();
  item.image = a.textFieldValue(3).trim();
  const oldEan = item.ean || "";
  stampItem(item);
  item.ean = a.textFieldValue(4).replace(/[\s-]/g, "").trim();

  // Neue oder geänderte EAN: der Abgleich liegt in der EAN-App. Gemerkt
  // wird, dass hier eine Übergabe ansteht – erst nach dem Speichern, sonst
  // wären die übrigen Änderungen beim App-Wechsel verloren.
  const eanToCheck = (item.ean && item.ean !== oldEan) ? item.ean : "";
  if (eanToCheck && !/^\d{8,14}$/.test(eanToCheck)) {
    const w = new Alert();
    w.title = "⚠️ Keine gültige EAN";
    w.message = `„${item.ean}“ besteht nicht aus 8–14 Ziffern – die alte Nummer bleibt stehen.`;
    w.addAction("OK");
    await w.presentAlert();
    item.ean = oldEan;
  }

  if (newName !== oldName) {
    if (items.some(i => i !== item && i.query.toLowerCase() === newName.toLowerCase())) {
      const w = new Alert();
      w.title = "Name schon vergeben";
      w.message = `„${newName}“ wird bereits beobachtet – Name bleibt unverändert.`;
      w.addAction("OK");
      await w.presentAlert();
    } else {
      cache[newName] = cache[oldName] || [];
      history[newName] = history[oldName] || [];
      delete cache[oldName];
      delete history[oldName];
      item.query = newName;
      touch("history");
    }
  }

  saveItems();

  // Geänderte EAN gleich abgleichen lassen – der Dialog kommt aus der EAN-App
  if (eanToCheck && item.ean === eanToCheck) {
    const info = await resolveEAN(eanToCheck);
    if (info) {
      item.ean = info.ean;
      if (!item.cat) item.cat = catFromDb(info.db);
      if (!item.image && info.image) item.image = info.image;
      stampItem(item);
      saveItems();
    }
  }

  try {
    const offers = await fetchOffersFor(item);
    cache[item.query] = offers;
    touch("cache");
    flush();
    if (choice === 1) item.image = "";      // Bild neu suchen
    await ensureImage(item, offers);
  } catch (e) {}
  return true;
}

function removeItem(query) {
  tombstone(query);                     // Löschung auch auf anderen Geräten wirksam
  items = items.filter(i => i.query !== query);
  delete cache[query];
  delete history[query];
  delete normal[query];
  touch("items", "cache", "history", "normal");
  flush();
  invalidateDerived();
}

// ─── Barcode-Scan (aus der Kurzbefehle-App) ──────────────────────
/**
 * Produktdaten zu einer Nummer besorgen.
 *
 * Steht die EAN in einer der Datenbanken, läuft der Abgleich still durch
 * und es geht hier weiter. Erst wenn die Nummer nirgends steht, übernimmt
 * der EAN-Teil weiter unten mit seinen Dialogen – dort hängen Korrektur,
 * Anlegen und Foto.
 *
 * Früher lag das in einem eigenen Skript, das über importModule geholt
 * wurde. Das Laden konnte fehlschlagen (fehlender oder umbenannter
 * Skriptname), deshalb gab es hier eine Prüfung samt Fehlermeldung. Beides
 * entfällt: die Funktionen stehen in derselben Datei.
 *
 * @returns {ean, found, name, brand, quantity, image, db} oder null
 */
async function resolveEAN(ean) {
  let info = null;
  try {
    info = await lookupEAN(ean);
  } catch (e) {
    info = null;
  }
  if (info && info.found) return { ...info, ean };

  // Nicht vorhanden oder nicht erreichbar – ab hier führt der EAN-Teil
  try {
    return await runCheck(ean || "");
  } catch (e) {
    const a = new Alert();
    a.title = "Abgleich fehlgeschlagen";
    a.message = String(e && e.message ? e.message : e);
    a.addAction("OK");
    await a.presentAlert();
    return null;
  }
}

async function handleScannedEAN(rawEAN, known) {
  const ean = String(rawEAN).trim();
  // Der Abgleich läuft in der EAN-App; hier kommen nur noch fertige Daten an.
  const info = known || { found: false, error: false, name: "", brand: "", quantity: "", image: "", db: "" };

  const a = new Alert();
  a.title = "Produkt beobachten";
  a.message = (info.found
      ? `✅ EAN ${ean} gefunden: ${info.name}${info.quantity ? " · " + info.quantity : ""}`
      : `❌ EAN ${ean} nicht in der Datenbank – Namen bitte selbst eintragen.`)
    + "\n\nSuchbegriff breit halten (z. B. „Vernel Weichspüler“), Sorte separat eintragen (z. B. „Sensitiv“).";
  a.addTextField("Anzeigename", info.found ? info.name : "");
  a.addTextField("Suchbegriff für marktguru", info.found ? info.name : "");
  a.addTextField("Sorte / Variante (optional)", "");
  a.addAction("Angebote prüfen");
  a.addAction("Direkt beobachten");
  a.addCancelAction("Abbrechen");
  const choice = await a.presentAlert();
  if (choice === -1) return;

  const query = a.textFieldValue(0).trim();
  const search = a.textFieldValue(1).trim();
  const variant = a.textFieldValue(2).trim();

  // Ohne Anzeigename legt addItem stillschweigend nichts an – das sah bisher
  // aus wie „bereits vorhanden“.
  if (!query) {
    const miss = new Alert();
    miss.title = "Kein Name eingetragen";
    miss.message = "Ohne Anzeigename lässt sich nichts beobachten. Der Name ist frei wählbar – "
      + "er steht später in der Übersicht.";
    miss.addAction("Noch einmal");
    miss.addCancelAction("Abbrechen");
    if (await miss.presentAlert() === -1) return;
    return await handleScannedEAN(ean, known);
  }

  if (choice === 0) {
    let offers = [];
    try { offers = await fetchOffersFor({ query, search, variant }); } catch (e) {}
    const prev = new Alert();
    prev.title = query;
    prev.message = offers.length
      ? offers.slice(0, 5).map(o => `${o.advertiser}: ${eur(o.price)}\n${o.details}`).join("\n\n")
      : "Aktuell kein Angebot – Beobachtung lohnt trotzdem, du wirst benachrichtigt.";
    prev.addAction("Beobachten");
    prev.addCancelAction("Abbrechen");
    if (await prev.presentAlert() === -1) return;
  }

  // Ohne Datenbanktreffer ist die Warenart unbekannt – lieber einmal fragen,
  // als das Produkt aus allen Filtern fallen zu lassen.
  const cat = catFromDb(info.db) || await askCategory(query);

  const ok = await addItem(query, info.image, search, variant, ean, cat);
  const done = new Alert();
  done.title = ok ? "Hinzugefügt" : "Bereits vorhanden";
  done.message = ok
    ? `„${query}“ · ${catLabel(cat)}`
    : `„${query}“ steht schon in der Liste – die EAN wurde nicht übernommen.`;
  done.addAction("OK");
  await done.presentAlert();
}


// ═════════════════════════════════════════════════════════════════
// EAN – Abgleich und Anlage von Barcode-Nummern
// ═════════════════════════════════════════════════════════════════
// Bis Fassung 0.65 ein eigenes Skript. Alles, was mit der Nummer selbst
// zu tun hat, steht hier:
//   • Prüfziffer und Format
//   • Abgleich gegen die vier Open-Facts-Datenbanken
//   • Bestätigung durch den Nutzer
//   • Anlegen fehlender Produkte bei Open Food Facts (eigenes Konto)
//   • Fotos zu einem Produkt hochladen (Vorderseite, Zutaten, Nährwerte)
//   • eigene Einträge verwalten (Ansicht 📦)
//
// Gemeinsam mit dem übrigen Skript benutzt der Teil: FM, Farbschema,
// LAYOUT, die Zeilenformen headerRow/infoRow/backRow und newRequest.
// Eigene Ablage behält er (Scriptable/EAN), eigene Version ebenfalls.
// ═════════════════════════════════════════════════════════════════

// ─── Einstellbare Werte des EAN-Teils ────────────────────────────
const EAN_CACHE_D = 30;         // wie lange Produktdaten zu einer EAN gelten
const EAN_CACHE_MAX = 200;      // gemerkte EANs (ältere fallen heraus)

/**
 * Die vier Open-Facts-Datenbanken. Waschmittel, Kosmetik und Tierfutter
 * stehen NICHT bei Open Food Facts – deshalb wird der Reihe nach überall
 * gesucht.
 */
const OFF_DBS = [
  { id: "food",    label: "Lebensmittel (Open Food Facts)",        base: "https://world.openfoodfacts.org" },
  { id: "product", label: "Sonstige Produkte (Open Products Facts)", base: "https://world.openproductsfacts.org" },
  { id: "beauty",  label: "Kosmetik / Drogerie (Open Beauty Facts)", base: "https://world.openbeautyfacts.org" },
  { id: "petfood", label: "Tierfutter (Open Pet Food Facts)",      base: "https://world.openpetfoodfacts.org" },
];
const OFF_UA = `EAN - Scriptable - iOS - Version ${EAN_VERSION}`;

/** Registrierungsseite von Open Food Facts (deutsche Oberfläche). */
const OFF_SIGNUP_URL = "https://de.openfoodfacts.org/cgi/user.pl";

// ─── Ablage des EAN-Teils ────────────────────────────────────────
// Eigener Ordner „EAN“ neben dem Datenordner von PreisApp. Der Pfad ist
// derselbe wie zu der Zeit, als der EAN-Teil ein eigenes Skript war –
// wer beide Skripte benutzt hat, findet seine Einträge unverändert wieder.
//
// Bewusst nicht der geteilte Ordner (SHARED_BOOKMARK): die eigenen
// Einträge hängen am Open-Food-Facts-Konto, und das ist je Person eines.
// Gemerkt wird nur der Abgleich – er baut sich sonst wieder auf.
const EAN_DIR = FM.joinPath(FM.documentsDirectory(), "EAN");
if (!FM.fileExists(EAN_DIR)) FM.createDirectory(EAN_DIR, true);
const FILE_EANCACHE = FM.joinPath(EAN_DIR, "eancache.json");
const FILE_MINE = FM.joinPath(EAN_DIR, "meine.json");

/**
 * Datei bei Bedarf aus iCloud holen. Nur ausgelagerte Dateien lassen sich
 * sonst nicht lesen – der Inhalt liegt dann noch in der Wolke.
 *
 * Bewusst ohne await, anders als ensureLocal() weiter oben: die Aufrufer
 * im EAN-Teil (writeMine) sind nicht asynchron. Angestoßen wird der
 * Download trotzdem, spätestens der nächste Lauf findet die Datei.
 */
function eanEnsureLocal(path) {
  try {
    if (FM.fileExists(path) && FM.isFileStoredIniCloud(path) && !FM.isFileDownloaded(path)) {
      FM.downloadFileFromiCloud(path);
    }
  } catch (e) {}
}

// Beim Start einmal anstoßen, damit der erste Lesezugriff Inhalt vorfindet.
[FILE_EANCACHE, FILE_MINE].forEach(eanEnsureLocal);

/**
 * Eine Ablagedatei lesen. Kaputte Dateien werden nicht einfach übergangen:
 * der nächste Schreibvorgang würde sie sonst endgültig überschreiben. Sie
 * wandern deshalb zur Seite und der Nutzer erfährt einmal davon.
 */
let eanDataWarning = "";

function eanReadJSON(path, label) {
  try {
    if (!FM.fileExists(path)) return {};
    const raw = FM.readString(path);
    if (!raw || !raw.trim()) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("kein Objekt");
    return obj;
  } catch (e) {
    const bak = path.replace(/\.json$/i, "") + ".defekt.json";
    try {
      if (FM.fileExists(bak)) FM.remove(bak);
      FM.move(path, bak);
      eanDataWarning += (eanDataWarning ? "\n\n" : "")
        + `${label} war nicht lesbar und liegt jetzt unter „${bak.split("/").pop()}“. `
        + "Die Datei wurde nicht überschrieben – sie lässt sich in der Dateien-App ansehen.";
    } catch (e2) {
      eanDataWarning += (eanDataWarning ? "\n\n" : "")
        + `${label} ist nicht lesbar und ließ sich auch nicht zur Seite legen.`;
    }
    return {};
  }
}

/** Einmaliger Hinweis auf eine beschädigte Ablagedatei. */
async function showEANDataWarning() {
  if (!eanDataWarning) return;
  const text = eanDataWarning;
  eanDataWarning = "";
  await note("⚠️ Ablage", text);
}

/** Lesen ohne Nebenwirkung – für den Abgleich kurz vor dem Schreiben. */
function eanReadJSONQuiet(path) {
  try {
    if (!FM.fileExists(path)) return {};
    const obj = JSON.parse(FM.readString(path));
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch (e) { return {}; }
}

let eanCache = eanReadJSON(FILE_EANCACHE, "Der Zwischenspeicher");

/**
 * Selbst angelegte Produkte. Open Food Facts kennt zwar den Urheber, doch
 * die Liste hier ist auch ohne Netz da und überlebt einen abgelehnten
 * Abruf – deshalb wird jeder eigene Eintrag lokal festgehalten.
 */
let eanMine = eanReadJSON(FILE_MINE, "Die Liste der eigenen Einträge");

/**
 * Wie lange ein gelöschter Eintrag als Grabstein stehen bleibt. Ohne ihn
 * käme er vom anderen Gerät beim nächsten Abgleich zurück.
 */
const TOMB_D = 180;

/** Eigener Eintrag, sofern vorhanden und nicht gelöscht. */
function mineGet(ean) {
  const e = eanMine[ean];
  return e && !e.deleted ? e : null;
}

/** EANs der eigenen Liste, ohne Grabsteine. */
function mineKeys() {
  return Object.keys(eanMine).filter(k => !eanMine[k].deleted);
}

/**
 * Zwei Stände derselben Liste zusammenführen: je EAN gilt der neuere
 * Zeitstempel. iPhone, iPad und Mac schreiben dieselbe Datei in iCloud –
 * ohne Abgleich gewinnt schlicht der letzte Schreiber und die Einträge des
 * anderen Geräts wären fort. Auch das Löschen ist ein Stand: ein Grabstein
 * mit Zeitstempel, sonst käme der Eintrag von drüben zurück.
 */
function mergeMine(disk, local) {
  const out = { ...disk };
  Object.keys(local).forEach(ean => {
    const a = local[ean], b = out[ean];
    if (!b || (a.updatedAt || a.at || 0) >= (b.updatedAt || b.at || 0)) out[ean] = a;
  });
  // Alte Grabsteine fallen heraus – irgendwann hat sie jedes Gerät gesehen.
  const limit = Date.now() - TOMB_D * 86400000;
  Object.keys(out).forEach(ean => {
    if (out[ean].deleted && (out[ean].updatedAt || 0) < limit) delete out[ean];
  });
  return out;
}

function writeMine() {
  try {
    eanEnsureLocal(FILE_MINE);
    eanMine = mergeMine(eanReadJSONQuiet(FILE_MINE), eanMine);
    FM.writeString(FILE_MINE, JSON.stringify(eanMine));
  } catch (e) {}
}

/** Eigenen Eintrag festhalten bzw. fortschreiben. */
function rememberMine(ean, db, fields) {
  const old = mineGet(ean) || {};
  // Nicht übergeben heißt „unverändert“, leer übergeben heißt „gelöscht“.
  const keep = (v, o) => (v === undefined || v === null ? (o || "") : String(v));
  eanMine[ean] = {
    name: fields.name || old.name || "",
    brand: keep(fields.brand, old.brand),
    quantity: keep(fields.quantity, old.quantity),
    db: db || old.db || "food",
    alsoIn: fields.alsoIn || old.alsoIn || [],   // ginge sonst bei jedem Speichern verloren
    image: keep(fields.image, old.image),
    at: old.at || Date.now(),          // erstmals angelegt
    updatedAt: Date.now(),
  };
  writeMine();
}

/** Name der Datenbank selbst, z. B. „Open Beauty Facts“. */
function dbTitle(id) {
  const d = OFF_DBS.find(x => x.id === id) || OFF_DBS[0];
  const m = d.label.match(/\(([^)]+)\)/);
  return m ? m[1] : d.label;
}

/** Kurzname einer Datenbank – für Auswahllisten. */
function dbShort(id) {
  const d = OFF_DBS.find(x => x.id === id);
  if (!d) return "";
  return d.label.replace(/\s*\(.*\)$/, "");
}

/** Basis-Adresse einer Datenbank anhand der gemerkten Kennung. */
function dbById(id) {
  return OFF_DBS.find(d => d.id === id) || OFF_DBS[0];
}

function writeEANCacheFile() {
  try { FM.writeString(FILE_EANCACHE, JSON.stringify(eanCache)); } catch (e) {}
}

/**
 * Gemerkte Produktdaten zu einer EAN. Derselbe Barcode wird beim Einkaufen
 * oft mehrfach gescannt; ohne Speicher geht jedes Mal eine Abfrage je
 * Datenbank ins Netz.
 */
function readEANCache(ean) {
  const e = eanCache[ean];
  if (!e || !e.at || (Date.now() - e.at) > EAN_CACHE_D * 86400000) return null;
  return { ...e.info };
}

function writeEANCache(ean, info) {
  eanCache[ean] = { at: Date.now(), info };
  const keys = Object.keys(eanCache);
  if (keys.length > EAN_CACHE_MAX) {
    keys.sort((a, b) => eanCache[a].at - eanCache[b].at)
        .slice(0, keys.length - EAN_CACHE_MAX)
        .forEach(k => delete eanCache[k]);
  }
  writeEANCacheFile();
}

// ─── Nummer prüfen ───────────────────────────────────────────────

/**
 * GTIN-Prüfziffer nachrechnen (EAN-8, UPC-12, EAN-13, GTIN-14).
 * Von rechts ohne Prüfziffer abwechselnd mit 3 und 1 gewichtet; die Summe auf
 * das nächste Vielfache von 10 ergänzt muss die Prüfziffer sein.
 * @returns true (stimmt) | false (stimmt nicht) | null (Länge nicht prüfbar)
 */
function eanChecksumOK(ean) {
  const d = String(ean).replace(/[\s-]/g, "");
  if (!/^\d+$/.test(d)) return false;
  if (![8, 12, 13, 14].includes(d.length)) return null;   // z. B. 9–11 Ziffern
  const digits = d.split("").map(Number);
  const check = digits.pop();
  let sum = 0;
  digits.reverse().forEach((n, i) => { sum += n * (i % 2 === 0 ? 3 : 1); });
  return ((10 - (sum % 10)) % 10) === check;
}

// ─── Abgleich ────────────────────────────────────────────────────

/** Eine einzelne Instanz abfragen. */
async function lookupEANIn(db, ean) {
  const req = newRequest(`${db.base}/api/v2/product/${ean}.json?fields=product_name,brands,quantity,image_front_small_url`);
  req.headers = { "User-Agent": OFF_UA };
  const data = await req.loadJSON();
  if (data.status !== 1 || !data.product || !data.product.product_name) return null;
  let name = data.product.product_name;
  const brand = (data.product.brands || "").split(",")[0].trim();
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) name = brand + " " + name;
  return {
    found: true, error: false, name, brand, db: db.id, dbLabel: db.label,
    quantity: data.product.quantity || "",
    image: data.product.image_front_small_url || "",
  };
}

/**
 * Auswahl, wenn dieselbe Nummer in mehreren Instanzen steht. Das kommt
 * öfter vor, als man denkt: Zahnpasta etwa liegt oft doppelt bei
 * Lebensmitteln und bei Kosmetik.
 */
async function askWhichDb(ean, hits) {
  const a = new Alert();
  a.title = "In mehreren Datenbanken";
  a.message = "EAN " + ean + " steht in " + hits.length + " Datenbanken. Welcher Eintrag soll gelten?";
  hits.forEach(h => a.addAction(dbShort(h.db) + ": " + h.name + (h.quantity ? " · " + h.quantity : "")));
  a.addCancelAction("Erste nehmen");
  const c = await a.presentAlert();
  return c === -1 ? hits[0] : hits[c];
}

/**
 * Produktdaten zu einer EAN suchen – über alle Open-Facts-Datenbanken.
 * Es wird überall gesucht, nicht bis zum ersten Treffer: nur so fällt auf,
 * wenn dieselbe Nummer mehrfach gepflegt ist.
 * found=false -> nirgends eingetragen, error=true -> keine Instanz erreichbar.
 */
async function lookupEAN(ean, fresh) {
  // Bei einer selbst angelegten Nummer nie aus dem Speicher antworten: der
  // könnte noch den Fehlschlag von vor der Anlage enthalten.
  if (!fresh && !mineGet(ean)) {
    const cached = readEANCache(ean);
    if (cached) return cached;
  }

  // Alle vier gleichzeitig fragen. Nacheinander summierten sich im
  // schlechtesten Fall vier Zeitüberschreitungen zu knapp einer Minute –
  // an der Kasse ist das unbrauchbar. Die Reihenfolge bleibt erhalten.
  const results = await Promise.all(OFF_DBS.map(db =>
    lookupEANIn(db, ean).then(hit => ({ hit }), () => ({ failed: true }))
  ));

  const hits = [];
  let reachable = false;
  results.forEach(r => {
    if (r.failed) return;
    reachable = true;
    if (r.hit) hits.push(r.hit);
  });

  if (hits.length) {
    let chosen = hits[0];
    const own = mineGet(ean);
    if (own && hits.some(h => h.db === own.db)) {
      // Eigene Zuordnung hat Vorrang – danach nicht bei jedem Abruf fragen
      chosen = hits.find(h => h.db === own.db);
    } else if (hits.length > 1) {
      chosen = await askWhichDb(ean, hits);
    }
    const info = { ...chosen, alsoIn: hits.filter(h => h.db !== chosen.db).map(h => h.db) };
    writeEANCache(ean, info);
    // Bei einem eigenen Eintrag das Bild gleich mitnehmen: die Liste zeigt
    // es später ohne weitere Abfrage.
    if (own && (own.image !== info.image || String(own.alsoIn || "") !== String(info.alsoIn))) {
      eanMine[ean] = { ...own, image: info.image || "", alsoIn: info.alsoIn };
      writeMine();
    }
    return info;
  }

  // Selbst angelegt, aber die Datenbank meldet nichts: frisch eingetragene
  // Produkte tauchen manchmal erst verzögert auf, und ein Eintrag kann in
  // eine Schwester-Datenbank verschoben worden sein. Der eigene Stand ist
  // dann besser als „nicht gefunden“.
  const own = mineGet(ean);
  if (own) {
    return {
      found: true, error: false, own: true,
      db: own.db || "food", dbLabel: "eigener Eintrag",
      name: [own.brand, own.name].filter(Boolean).join(" ").trim(),
      brand: own.brand || "", quantity: own.quantity || "", image: own.image || "",
    };
  }

  const miss = { found: false, error: !reachable, name: "", image: "", quantity: "", brand: "", db: "", dbLabel: "" };
  if (reachable) writeEANCache(ean, miss);   // nirgends eingetragen – Netzfehler nicht merken
  return miss;
}

// ─── Anlegen bei Open Food Facts ─────────────────────────────────

function offCreds() {
  return {
    user: Keychain.contains(KEYCHAIN.offUser) ? Keychain.get(KEYCHAIN.offUser) : "",
    pass: Keychain.contains(KEYCHAIN.offPass) ? Keychain.get(KEYCHAIN.offPass) : "",
  };
}

/**
 * Produkt in einer Open-Facts-Datenbank neu anlegen.
 * Schreiben erfordert ein kostenloses Konto (Benutzername, nicht E-Mail).
 */
async function createOFFProduct(ean, db, fields) {
  const c = offCreds();
  if (!c.user || !c.pass) return { ok: false, message: "Kein Open-Food-Facts-Konto hinterlegt." };

  const body = {
    user_id: c.user,
    password: c.pass,
    code: ean,
    product_name: fields.name || "",
    brands: fields.brand || "",
    quantity: fields.quantity || "",
    lang: "de",
    comment: "Angelegt mit EAN (Scriptable)",
  };
  const params = Object.keys(body)
    .filter(k => body[k] !== "")
    .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(body[k]))
    .join("&");

  try {
    const req = newRequest(`${db.base}/cgi/product_jqm2.pl`);
    req.method = "POST";
    req.headers = { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": OFF_UA };
    req.body = params;
    const res = await req.loadJSON();
    if (res && res.status === 1) {
      return { ok: true, message: res.status_verbose || "gespeichert", url: `${db.base}/product/${ean}` };
    }
    return { ok: false, message: (res && res.status_verbose) || "Anmeldung oder Daten abgelehnt." };
  } catch (e) {
    return { ok: false, message: String(e && e.message ? e.message : e) };
  }
}

// ─── Fotos ───────────────────────────────────────────────────────
// Bilder gehen an einen eigenen Endpunkt, nicht an product_jqm2.pl. Das
// Feld mit dem Bild heißt „imgupload_“ plus dem Wert von imagefield.
// Achtung Lizenz: hochgeladene Fotos stehen unter CC BY-SA – nur eigene
// Aufnahmen, keine Hersteller- oder Netzbilder.

const IMAGE_FIELDS = [
  { id: "front",      label: "📦 Vorderseite" },
  { id: "ingredients", label: "🧾 Zutaten" },
  { id: "nutrition",  label: "📊 Nährwerte" },
];

/**
 * Ein Bild hochladen. Je nach Serverstand wird das Feld mit Sprachkürzel
 * erwartet (front_de) oder ohne (front) – deshalb beide der Reihe nach.
 */
async function uploadImage(ean, db, image, field) {
  const c = offCreds();
  if (!c.user || !c.pass) return { ok: false, message: "Kein Open-Food-Facts-Konto hinterlegt." };

  let last = "";
  for (const name of [field + "_de", field]) {
    try {
      const req = newRequest(`${db.base}/cgi/product_image_upload.pl`);
      req.method = "POST";
      req.headers = { "User-Agent": OFF_UA };
      req.timeoutInterval = 60;            // Bilder brauchen länger als eine Abfrage
      req.addParameterToMultipart("user_id", c.user);
      req.addParameterToMultipart("password", c.pass);
      req.addParameterToMultipart("code", ean);
      req.addParameterToMultipart("imagefield", name);
      req.addImageToMultipart(image, "imgupload_" + name, ean + ".jpg");
      const res = await req.loadJSON();
      if (res && (res.status === "status ok" || res.status === 1 || res.imgid)) {
        return { ok: true, imgid: res.imgid, url: `${db.base}/product/${ean}` };
      }
      last = (res && (res.error || res.status_verbose || res.status)) || "abgelehnt";
    } catch (e) {
      last = String(e && e.message ? e.message : e);
    }
  }
  return { ok: false, message: last || "Der Server hat das Bild nicht angenommen." };
}

/** Foto aufnehmen oder aus der Mediathek wählen. */
async function pickPhoto() {
  const a = new Alert();
  a.title = "Foto";
  a.message = "Nur eigene Aufnahmen – hochgeladene Bilder stehen unter einer freien Lizenz (CC BY-SA).";
  a.addAction("📷 Aufnehmen");
  a.addAction("🖼 Aus der Mediathek");
  a.addCancelAction("Abbrechen");
  const c = await a.presentAlert();
  if (c === -1) return null;
  try {
    return c === 0 ? await Photos.fromCamera() : await Photos.fromLibrary();
  } catch (e) {
    return null;                            // abgebrochen oder kein Zugriff
  }
}

/**
 * Foto zu einer EAN senden. Fragt erst, was auf dem Bild ist – die
 * Datenbank ordnet Vorderseite, Zutaten und Nährwerte getrennt zu.
 * @returns true, wenn ein Bild angekommen ist
 */
async function sendPhoto(ean, dbId) {
  const db = dbById(dbId);

  const pick = new Alert();
  pick.title = "Was zeigt das Foto?";
  pick.message = "EAN " + ean + " · " + dbShort(db.id);
  IMAGE_FIELDS.forEach(f => pick.addAction(f.label));
  pick.addCancelAction("Abbrechen");
  const which = await pick.presentAlert();
  if (which === -1) return false;

  const image = await pickPhoto();
  if (!image) return false;

  let res = await uploadImage(ean, db, image, IMAGE_FIELDS[which].id);
  if (!res.ok) {
    const retry = new Alert();
    retry.title = "❌ Foto nicht angekommen";
    retry.message = res.message + "\n\nHäufigste Ursache: E-Mail statt Benutzername.";
    retry.addAction("Login ändern und erneut senden");
    retry.addCancelAction("Abbrechen");
    if (await retry.presentAlert() === -1) return false;
    if (!await askOFFLogin()) return false;
    res = await uploadImage(ean, db, image, IMAGE_FIELDS[which].id);
  }

  await note(res.ok ? "✅ Foto gesendet" : "❌ Foto nicht angekommen",
    res.ok
      ? `${IMAGE_FIELDS[which].label} steht jetzt beim Produkt.\n${res.url}\n\n`
        + "Bis es auf der Seite auftaucht, können ein paar Minuten vergehen."
      : res.message);
  return res.ok;
}

/**
 * Läuft gerade die eigene Oberfläche? Eine vollflächige UITable liegt über
 * allem – iOS kann darüber kein weiteres Blatt einblenden.
 */
let uiPresented = false;

/**
 * Eine Adresse öffnen.
 *
 * Safari.openInApp legt ein Browser-Blatt über die App. Das klappt nur,
 * solange nichts anderes vorn liegt: aus einer laufenden UITable heraus
 * passiert schlicht nichts – der Tipp wirkt wie ein toter Knopf. Aus der
 * Oberfläche geht es deshalb in Safari selbst, dort ist der Wechsel
 * sichtbar und der Rückweg über die App-Leiste möglich.
 */
async function openURL(url) {
  if (config.runsInApp === true && !uiPresented) await Safari.openInApp(url, false);
  else Safari.open(url);
}

/** Registrierung öffnen. */
async function openOFFSignup() {
  await openURL(OFF_SIGNUP_URL);
}

/** Open-Food-Facts-Zugang abfragen und im Schlüsselbund speichern. */
async function askOFFLogin() {
  for (;;) {
    const c = offCreds();
    const a = new Alert();
    a.title = "Open Food Facts – Login";
    a.message = "Kostenloses Konto auf openfoodfacts.org. Bitte den Benutzernamen eintragen, "
      + "nicht die E-Mail-Adresse.\n\nNoch kein Konto? " + OFF_SIGNUP_URL;
    a.addTextField("Benutzername", c.user);
    a.addSecureTextField("Passwort", c.pass);
    a.addAction("Speichern");
    a.addAction("🌐 Konto anlegen (öffnet " + OFF_SIGNUP_URL.replace("https://", "") + ")");
    if (c.user || c.pass) a.addDestructiveAction("Zugang löschen");
    a.addCancelAction("Abbrechen");
    const choice = await a.presentAlert();
    if (choice === -1) return false;

    if (choice === 1) {          // Registrierung öffnen, danach zurück in den Dialog
      await openOFFSignup();
      continue;
    }
    if (choice === 2) {          // Zugang löschen
      Keychain.set(KEYCHAIN.offUser, "");
      Keychain.set(KEYCHAIN.offPass, "");
      return false;
    }

    const user = a.textFieldValue(0).trim();
    const pass = a.textFieldValue(1).trim();
    Keychain.set(KEYCHAIN.offUser, user);
    Keychain.set(KEYCHAIN.offPass, pass);
    return !!(user && pass);
  }
}

/** Dialog: fehlende EAN bei Open Food Facts anlegen. */
async function reportEAN(ean) {
  const db = OFF_DBS[0];                       // Open Food Facts
  // Zugang fehlt? Direkt hier abfragen.
  if (!offCreds().user || !offCreds().pass) {
    if (!await askOFFLogin()) return null;
  }

  const a = new Alert();
  a.title = "Bei Open Food Facts anlegen";
  a.message = "EAN " + ean + " wird unter deinem Konto in der offenen Datenbank veröffentlicht. "
    + "Open Food Facts ist für Lebensmittel – Drogerie, Kosmetik oder Tierfutter gehören in die Schwester-Datenbanken.";
  a.addTextField("Produktname", "");
  a.addTextField("Marke", "");
  a.addTextField("Menge (z. B. 500 g)", "");
  a.addAction("Anlegen");
  a.addCancelAction("Abbrechen");
  if (await a.presentAlert() === -1) return null;

  const fields = {
    name: a.textFieldValue(0).trim(),
    brand: a.textFieldValue(1).trim(),
    quantity: a.textFieldValue(2).trim(),
  };
  if (!fields.name) {
    await note("Name fehlt", "Ohne Produktnamen wird der Eintrag abgelehnt.");
    return null;
  }

  let res = await createOFFProduct(ean, db, fields);

  // Häufigster Fehler: E-Mail statt Benutzername – Login gleich korrigieren lassen
  if (!res.ok) {
    const retry = new Alert();
    retry.title = "❌ Nicht gespeichert";
    retry.message = res.message + "\n\nHäufigste Ursache: E-Mail statt Benutzername.";
    retry.addAction("Login ändern und erneut senden");
    retry.addCancelAction("Abbrechen");
    if (await retry.presentAlert() === -1) return null;
    if (!await askOFFLogin()) return null;
    res = await createOFFProduct(ean, db, fields);
  }

  await note(res.ok ? "✅ Bei Open Food Facts angelegt" : "❌ Nicht gespeichert",
    res.ok ? `„${fields.name}“ ist jetzt eingetragen.\n${res.url}` : res.message);

  if (!res.ok) return null;

  const info = {
    found: true, error: false, db: db.id, dbLabel: db.label,
    name: [fields.brand, fields.name].filter(Boolean).join(" "),
    brand: fields.brand, quantity: fields.quantity, image: "",
  };
  writeEANCache(ean, info);      // frisch angelegt – nicht gleich neu abfragen
  rememberMine(ean, db.id, fields);

  // Ein Eintrag ohne Bild bleibt für andere schwer zu erkennen – deshalb
  // gleich hier fragen, solange das Produkt noch in der Hand liegt.
  const ask = new Alert();
  ask.title = "Foto dazu?";
  ask.message = "Ein Bild der Vorderseite hilft allen, die diese Nummer später scannen.";
  ask.addAction("📷 Foto senden");
  ask.addCancelAction("Später");
  if (await ask.presentAlert() === 0) await sendPhoto(ean, db.id);

  return info;
}

// ─── Dialoge ─────────────────────────────────────────────────────

/** Kurze Meldung mit OK. */
async function note(title, message) {
  const a = new Alert();
  a.title = title;
  a.message = message;
  a.addAction("OK");
  await a.presentAlert();
}

/** Kurzer Status-Text zum Datenbankabgleich einer EAN. */
function eanStatusText(ean, info) {
  return [
    "EAN " + ean,
    info.found
      ? (info.own
          ? "📦 Aus deiner Liste: " + info.name + (info.quantity ? " · " + info.quantity : "")
            + "\nDie Datenbank liefert dazu (noch) nichts – frisch angelegte Produkte erscheinen dort manchmal verzögert."
          : `✅ Gefunden in ${info.dbLabel || "der Datenbank"}: ` + info.name + (info.quantity ? " · " + info.quantity : "")
            + (info.alsoIn && info.alsoIn.length
                ? "\nSteht außerdem bei: " + info.alsoIn.map(dbShort).join(", ")
                : ""))
      : (info.error
          ? "⚠️ Open Food Facts ist nicht erreichbar – Abgleich nicht möglich."
          : "❌ In keiner Open-Facts-Datenbank eingetragen (Lebensmittel, Produkte, Kosmetik, Tierfutter). Entweder stimmt die Nummer nicht oder das Produkt fehlt dort noch."),
    eanChecksumOK(ean) === false
      ? "⚠️ Prüfziffer stimmt nicht – vermutlich Zahlendreher."
      : (eanChecksumOK(ean) === true ? "Prüfziffer stimmt." : "Länge nicht prüfbar."),
  ].join("\n");
}

/**
 * EAN abgleichen und bestätigen lassen.
 * Rückgabe: Produktinfo (übernehmen), "retry" (neu eingeben) oder null (Abbruch).
 */
async function confirmEAN(ean, fresh) {
  const info = await lookupEAN(ean, fresh);
  const a = new Alert();
  a.title = info.own ? "📦 Eigener Eintrag"
    : (info.found ? "✅ EAN gefunden" : (info.error ? "⚠️ Abgleich nicht möglich" : "❌ EAN nicht gefunden"));
  a.message = eanStatusText(ean, info);

  // Die Knöpfe wechseln je nach Ergebnis – deshalb wird mitgeschrieben,
  // welcher Knopf an welcher Stelle steht.
  const actions = [];
  const add = (id, label) => { actions.push(id); a.addAction(label); };

  add("take", info.found ? "Übernehmen" : "Trotzdem weiter");
  add("retry", "Nummer korrigieren");
  if (!info.found && !info.error) add("create", "➕ Bei Open Food Facts anlegen");
  // Ein gemerkter Fehlschlag ist die häufigste Ursache für „nicht gefunden“
  // kurz nach dem Anlegen – deshalb der Weg an ihm vorbei.
  if (!info.found && !fresh) add("fresh", "🔄 Ohne Zwischenspeicher neu abfragen");
  a.addCancelAction("Abbrechen");

  const choice = await a.presentAlert();
  if (choice === -1) return null;

  const action = actions[choice];
  if (action === "retry") return "retry";
  if (action === "create") {
    const created = await reportEAN(ean);
    return created || "retry";
  }
  if (action === "fresh") {
    delete eanCache[ean];
    writeEANCacheFile();
    return await confirmEAN(ean, true);
  }
  return info;
}

/** Nummer eintippen – mit Format- und Prüfzifferkontrolle. */
async function askEAN(start) {
  let ean = start || "";
  let hint = "Barcode-Nummer vom Produkt (8–14 Ziffern).";
  for (;;) {
    const m = new Alert();
    m.title = "EAN eingeben";
    m.message = hint;
    m.addTextField("EAN", ean);
    m.addAction("Prüfen");
    m.addCancelAction("Abbrechen");
    if (await m.presentAlert() === -1) return "";

    ean = m.textFieldValue(0).replace(/[\s-]/g, "").trim();
    if (!/^\d{8,14}$/.test(ean)) {
      hint = "⚠️ Bitte 8–14 Ziffern eingeben (nur Zahlen).";
      continue;
    }
    if (eanChecksumOK(ean) === false) {
      hint = "⚠️ Prüfziffer stimmt nicht – meist ein Zahlendreher. Bitte noch einmal vergleichen.";
      continue;
    }
    return ean;
  }
}

// ─── Eigene Einträge ─────────────────────────────────────────────


/** "14.08.2026" */
function dateDE(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Einen eigenen Eintrag bearbeiten. Dasselbe Ziel wie beim Anlegen:
 * Open Food Facts nimmt für Neuanlage und Änderung denselben Aufruf,
 * ein bereits vorhandener Code wird dabei überschrieben.
 * @returns true, wenn gespeichert wurde
 */
async function editMine(ean) {
  const e = mineGet(ean);
  if (!e) return false;

  const a = new Alert();
  a.title = "Eintrag bearbeiten";
  a.message = "EAN " + ean + "\nÄnderungen gehen an Open Food Facts und sind dort öffentlich sichtbar.";
  a.addTextField("Produktname", e.name || "");
  a.addTextField("Marke", e.brand || "");
  a.addTextField("Menge (z. B. 500 g)", e.quantity || "");
  a.addAction("Speichern & senden");
  a.addCancelAction("Abbrechen");
  if (await a.presentAlert() === -1) return false;

  const fields = {
    name: a.textFieldValue(0).trim(),
    brand: a.textFieldValue(1).trim(),
    quantity: a.textFieldValue(2).trim(),
  };
  if (!fields.name) {
    await note("Name fehlt", "Ohne Produktnamen wird die Änderung abgelehnt.");
    return false;
  }

  const db = dbById(e.db);
  let res = await createOFFProduct(ean, db, fields);
  if (!res.ok) {
    const retry = new Alert();
    retry.title = "❌ Nicht gespeichert";
    retry.message = res.message + "\n\nHäufigste Ursache: E-Mail statt Benutzername.";
    retry.addAction("Login ändern und erneut senden");
    retry.addCancelAction("Abbrechen");
    if (await retry.presentAlert() === -1) return false;
    if (!await askOFFLogin()) return false;
    res = await createOFFProduct(ean, db, fields);
  }

  if (!res.ok) {
    await note("❌ Nicht gespeichert", res.message);
    return false;
  }

  rememberMine(ean, e.db, fields);
  // Der Zwischenspeicher hielte sonst den alten Namen fest
  writeEANCache(ean, {
    found: true, error: false, db: db.id, dbLabel: db.label,
    name: [fields.brand, fields.name].filter(Boolean).join(" "),
    brand: fields.brand, quantity: fields.quantity, image: "",
  });
  await note("✅ Gespeichert", `„${fields.name}“ ist aktualisiert.`);
  return true;
}

/** Aktuellen Stand eines Eintrags aus der Datenbank holen. */
async function refreshMine(ean) {
  const e = mineGet(ean);
  if (!e) return;
  delete eanCache[ean];                 // sonst käme der gemerkte Stand zurück
  writeEANCacheFile();
  const info = await lookupEAN(ean);
  if (!info.found) {
    await note(info.error ? "⚠️ Nicht erreichbar" : "❌ Nicht mehr gefunden",
      info.error
        ? "Open Food Facts antwortet gerade nicht."
        : "Der Eintrag ist dort nicht (mehr) vorhanden. Möglich ist auch, dass er in eine Schwester-Datenbank verschoben wurde.");
    return;
  }
  eanMine[ean] = {
    ...e,
    name: info.name || e.name,
    quantity: info.quantity || e.quantity,
    db: info.db || e.db,
    image: info.image || e.image || "",
    alsoIn: info.alsoIn || [],      // Instanzen, in denen dieselbe Nummer ebenfalls steht
    updatedAt: Date.now(),
  };
  writeMine();
  await note("✅ Stand geholt", eanStatusText(ean, info));
}

/** Eintrag aus der Liste löschen – nur lokal. */
async function forgetMine(ean) {
  const w = new Alert();
  w.title = "Nur aus dieser Liste?";
  w.message = "Der Eintrag bleibt bei Open Food Facts bestehen – dort kann er nicht gelöscht, nur überschrieben werden.";
  w.addDestructiveAction("Entfernen");
  w.addCancelAction("Abbrechen");
  if (await w.presentAlert() === -1) return false;
  // Kein echtes Löschen: ein Grabstein mit Zeitstempel. Sonst brächte das
  // nächste Gerät den Eintrag beim Abgleich wieder mit.
  eanMine[ean] = { deleted: true, updatedAt: Date.now() };
  writeMine();
  return true;
}

/**
 * Datenbank eines Eintrags wechseln und das Produkt dort anlegen.
 *
 * Die vier Instanzen sind getrennte Datenbestände – verschieben lässt sich
 * ein Produkt nicht. Es wird in der neuen Instanz angelegt; der alte
 * Eintrag bleibt dort stehen und kann nur überschrieben werden.
 * @returns true, wenn etwas geändert wurde
 */
async function changeMineDb(ean) {
  const e = mineGet(ean);
  if (!e) return false;

  const pick = new Alert();
  pick.title = "Datenbank";
  pick.message = `„${e.name || ean}“ liegt derzeit bei ${dbShort(e.db)}.\n\n`
    + "Die neue Datenbank bekommt den Eintrag mit Name, Marke und Menge geschickt.";
  OFF_DBS.forEach(d => pick.addAction((d.id === e.db ? "✓ " : "") + dbShort(d.id)));
  pick.addCancelAction("Abbrechen");
  const choice = await pick.presentAlert();
  if (choice === -1) return false;

  const db = OFF_DBS[choice];
  if (db.id === e.db) return false;

  if (!e.name) {
    await note("Name fehlt", "Ohne Produktnamen lehnt die Datenbank den Eintrag ab. Erst bearbeiten, dann wechseln.");
    return false;
  }

  const fields = { name: e.name, brand: e.brand || "", quantity: e.quantity || "" };
  let res = await createOFFProduct(ean, db, fields);
  if (!res.ok) {
    const retry = new Alert();
    retry.title = "❌ Nicht übertragen";
    retry.message = res.message + "\n\nHäufigste Ursache: E-Mail statt Benutzername.";
    retry.addAction("Login ändern und erneut senden");
    retry.addCancelAction("Abbrechen");
    if (await retry.presentAlert() === -1) return false;
    if (!await askOFFLogin()) return false;
    res = await createOFFProduct(ean, db, fields);
  }

  if (!res.ok) {
    // Übertragung gescheitert: die Zuordnung hier trotzdem ändern zu lassen
    // wäre eine Lüge – der Eintrag stünde dort nicht.
    await note("❌ Nicht übertragen", res.message + "\n\nDie Zuordnung bleibt bei " + dbShort(e.db) + ".");
    return false;
  }

  eanMine[ean] = { ...e, db: db.id, updatedAt: Date.now() };
  writeMine();
  delete eanCache[ean];          // der Abgleich muss die neue Instanz finden
  writeEANCacheFile();
  await note("✅ Übertragen", `„${e.name}“ steht jetzt bei ${dbShort(db.id)}.\n${res.url}\n\n`
    + `Der alte Eintrag bei ${dbShort(e.db)} bleibt dort bestehen – löschen lässt er sich nicht.`);
  return true;
}

/** Produktseite in der jeweiligen Datenbank öffnen. */
async function openMine(ean) {
  const e = mineGet(ean);
  if (!e) return;
  await openURL(`${dbById(e.db).base}/product/${ean}`);
}

/**
 * Einträge des eigenen Kontos nachladen. Nützlich auf einem zweiten Gerät
 * oder nach einer Neuinstallation – die lokale Liste kennt dann nichts.
 *
 * Open Food Facts bietet dafür mehrere Wege an, und welcher auf welcher
 * Instanz antwortet, ist nicht verlässlich. Deshalb werden sie der Reihe
 * nach probiert, bis einer Produkte liefert.
 */
function contributorURLs(base, user) {
  const f = "code,product_name,brands,quantity,image_front_small_url";
  const u = encodeURIComponent(user);
  return [
    `${base}/api/v2/search?creator=${u}&fields=${f}&page_size=100`,
    `${base}/api/v2/search?creators_tags=${u}&fields=${f}&page_size=100`,
    `${base}/contributor/${u}.json?fields=${f}&page_size=100`,
    `${base}/cgi/search.pl?action=process&tagtype_0=contributor&tag_contains_0=contains&tag_0=${u}&json=1&page_size=100`,
  ];
}

async function importMine() {
  const c = offCreds();
  if (!c.user) { await note("Kein Zugang", "Erst den Open-Food-Facts-Benutzernamen eintragen."); return; }

  // Benutzernamen führt Open Food Facts klein – groß geschrieben findet
  // die Abfrage sonst nichts.
  const user = c.user.trim().toLowerCase();

  let added = 0;
  let seen = 0;
  let reached = false;
  const worked = [];

  for (const db of OFF_DBS) {
    for (const url of contributorURLs(db.base, user)) {
      let list = null;
      try {
        const req = newRequest(url);
        req.headers = { "User-Agent": OFF_UA };
        const data = await req.loadJSON();
        reached = true;
        list = (data && data.products) || null;
      } catch (e) { continue; }
      if (!list || !list.length) continue;      // nächster Weg

      worked.push(db.label.split(" (")[0]);
      for (const p of list) {
        const code = String(p.code || "").trim();
        if (!code) continue;
        seen++;
        // Absichtlich ohne mineGet: ein hier entfernter Eintrag soll auch
        // entfernt bleiben und nicht beim nächsten Nachladen zurückkommen.
        if (eanMine[code]) continue;
        eanMine[code] = {
          name: p.product_name || "",
          brand: (p.brands || "").split(",")[0].trim(),
          quantity: p.quantity || "",
          db: db.id,
          image: p.image_front_small_url || "",
          alsoIn: [],
          at: 0,                       // Anlagedatum liefert die Abfrage nicht
          updatedAt: Date.now(),
        };
        added++;
      }
      break;                            // dieser Instanz reicht ein Weg
    }
  }
  writeMine();

  if (!reached) {
    await note("⚠️ Nicht erreichbar", "Keine der Datenbanken hat geantwortet.");
    return;
  }
  await note(seen ? "Abgleich fertig" : "Nichts gefunden",
    seen
      ? `${seen} Produkt(e) unter „${user}“ gefunden, ${added} neu übernommen.`
        + (worked.length ? "\nQuelle: " + [...new Set(worked)].join(", ") : "")
      : `Unter dem Benutzernamen „${user}“ liefert keine der vier Datenbanken Produkte.`
        + "\n\nStimmt der Name genau so wie bei der Anmeldung? Frisch angelegte Produkte "
        + "erscheinen in dieser Übersicht außerdem oft erst nach einiger Zeit.");
}

// ─── Zeilenformen nur für den EAN-Teil ───────────────────────────
// Kopfzeile, Textzeile und „‹ Zurück“ kommen aus dem gemeinsamen Vorrat
// weiter oben (headerRow, infoRow, backRow). Hinweiszeile und Zeile mit
// Knopf gibt es dort nur innerhalb von editSettings bzw. buildHelp –
// deshalb stehen sie hier noch einmal in der Fassung des EAN-Teils.

/** Kleingedruckter Hinweis unter einer Zeile. */
function eanNoteRow(table, T, text) {
  const row = new UITableRow();
  row.height = autoRowHeight("", 0, text, 11, 100, LAYOUT.row(26));
  row.backgroundColor = T.row;
  const t = row.addText("", "· " + text);
  t.subtitleFont = Font.systemFont(LAYOUT.font(11));
  t.subtitleColor = T.muted;
  table.addRow(row);
  return row;
}

/** Zeile mit Beschriftung links und Knopf rechts. */
function eanOptionRow(table, T, title, subtitle, button, onTap, opts) {
  const o = opts || {};
  const row = new UITableRow();
  row.height = autoRowHeight(title, 15, subtitle, 11, 68, tapRow(50));
  row.backgroundColor = o.bg || T.row;
  const t = row.addText(title, subtitle || "");
  t.widthWeight = 68;
  t.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
  t.titleColor = T.text;
  t.subtitleFont = Font.systemFont(LAYOUT.font(11));
  t.subtitleColor = o.subtitleColor || T.muted;
  const b = row.addButton(button);
  b.widthWeight = 32;
  b.rightAligned();
  b.onTap = onTap;
  // Manche Zeilen sollen auf einen Tipp irgendwo reagieren, nicht nur auf
  // den Knopf am Rand.
  if (o.tapRowToo) {
    row.dismissOnSelect = false;
    row.onSelect = onTap;
  }
  table.addRow(row);
  return row;
}

// ─── Oberfläche: meine EAN-Einträge ──────────────────────────────
// Beide Ansichten hängen in der Tabelle von showMain (Ansicht "ean" und
// "eanentry") und benutzen deren rerender. Eine eigene UITable wie im
// früheren Einzelskript gibt es nicht mehr: zwei übereinander liegende
// Vollbild-Tabellen kann iOS nicht schließen, ohne die untere zu zeigen.

/** Übersicht: Werkzeugzeile und die eigenen Einträge. */
async function buildEANList(table, T, rerender, open) {
  const c = offCreds();
  const keys = mineKeys().sort((a, b) => (eanMine[b].updatedAt || 0) - (eanMine[a].updatedAt || 0));

  // Wie in allen anderen Ansichten steht der Rückweg ganz oben – die
  // Fußzeile führt zwar auch zur Liste, aber hier sucht man ihn zuerst.
  backRow(table, T, rerender, "list");

  headerRow(table, T, "EAN " + EAN_VERSION,
    (keys.length ? keys.length + (keys.length === 1 ? " eigener Eintrag" : " eigene Einträge") : "noch keine eigenen Einträge")
    + "  ·  " + (c.user ? "angemeldet als " + c.user : "kein Konto hinterlegt"));

  // Werkzeugzeile: prüfen, anlegen, nachladen – wie die Leiste in PreisApp
  const tools = new UITableRow();
  tools.height = tapRow(46);
  tools.backgroundColor = T.row;

  const bCheck = tools.addButton("🔎 EAN prüfen");
  bCheck.widthWeight = 40;
  bCheck.centerAligned();
  bCheck.onTap = async () => { await checkOnce(""); await rerender(); };

  const bNew = tools.addButton("＋ Anlegen");
  bNew.widthWeight = 34;
  bNew.centerAligned();
  bNew.onTap = async () => {
    const ean = await askEAN("");
    if (!ean) return;
    await reportEAN(ean);
    await rerender();
  };

  const bImport = tools.addButton("⬇︎");
  bImport.widthWeight = 26;
  bImport.centerAligned();
  bImport.onTap = async () => { await importMine(); await rerender(); };
  table.addRow(tools);

  if (!keys.length) {
    infoRow(table, T, "Noch nichts angelegt",
      "Was du über „＋ Anlegen“ oder aus PreisApp heraus einträgst, erscheint hier.");
    eanNoteRow(table, T, "⬇︎ holt Produkte, die schon unter deinem Konto stehen");
    return;
  }

  headerRow(table, T, "Meine Einträge", "Antippen zum Bearbeiten");

  // Die Bildspalte gibt es entweder für alle Zeilen oder für keine: sonst
  // rutschen Name und Nummer je nach Eintrag unterschiedlich weit nach rechts.
  const anyImage = keys.some(k => eanMine[k].image);

  let alt = false;
  for (const ean of keys) {
    const e = eanMine[ean];
    const row = new UITableRow();
    row.height = tapRow(anyImage ? 64 : 58);
    row.backgroundColor = (alt = !alt) ? T.row : T.rowAlt;
    row.dismissOnSelect = false;

    if (anyImage) {
      const cell = e.image ? row.addImageAtURL(e.image) : row.addText("");
      cell.widthWeight = 14;
      cell.centerAligned();
    }

    const main = row.addText(e.name || "(ohne Namen)",
      [e.brand, e.quantity].filter(Boolean).join(" · ") || "ohne Marke und Menge");
    main.widthWeight = anyImage ? 48 : 60;
    main.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
    main.titleColor = T.text;
    main.subtitleFont = Font.systemFont(LAYOUT.font(11));
    main.subtitleColor = T.muted;

    const side = row.addText(ean, dateDE(e.updatedAt || e.at) || "Datum unbekannt");
    side.widthWeight = anyImage ? 26 : 28;
    side.rightAligned();
    side.titleFont = Font.systemFont(LAYOUT.font(12));
    side.titleColor = T.muted;
    side.subtitleFont = Font.systemFont(LAYOUT.font(11));
    side.subtitleColor = T.muted;

    const bOpen = row.addButton("›");
    bOpen.widthWeight = 12;
    bOpen.centerAligned();
    bOpen.onTap = async () => { await open(ean); };

    table.addRow(row);
  }
}

/**
 * Ein einzelner Eintrag als eigene Ansicht. Früher stand hier ein
 * Systemdialog – der zeichnet sich immer im Erscheinungsbild des Geräts
 * und stach bei hellem Farbschema auf dunklem Gerät heraus.
 */
function buildEANEntry(table, T, rerender, ean) {
  const e = mineGet(ean);
  if (!e) { rerender("ean"); return; }

  backRow(table, T, rerender, "ean", "‹ Zurück zu meinen Einträgen");
  headerRow(table, T, e.name || "(ohne Namen)", "EAN " + ean);

  // Das Bild der Vorderseite, sofern die Datenbank eines kennt. Es kommt
  // aus dem Abgleich („Stand holen“) oder vom Nachladen – nicht vom Gerät.
  if (e.image) {
    const pic = new UITableRow();
    pic.height = LAYOUT.row(150);
    pic.backgroundColor = T.row;
    pic.dismissOnSelect = false;
    const cell = pic.addImageAtURL(e.image);
    cell.centerAligned();
    table.addRow(pic);
  }

  infoRow(table, T, "Marke", e.brand || "nicht eingetragen");
  infoRow(table, T, "Menge", e.quantity || "nicht eingetragen");
  eanOptionRow(table, T, "Datenbank",
    dbById(e.db).label
    + (e.alsoIn && e.alsoIn.length ? "  ·  auch bei " + e.alsoIn.map(dbShort).join(", ") : ""),
    "Wechseln",
    async () => { await changeMineDb(ean); await rerender(); },
    { tapRowToo: true });     // Tippen auf den Namen genügt
  infoRow(table, T, "Angelegt",
    (dateDE(e.at) || "unbekannt")
    + (e.updatedAt && e.updatedAt !== e.at ? "  ·  geändert " + dateDE(e.updatedAt) : ""));

  headerRow(table, T, "Aktionen", "");
  const dbName = dbTitle(e.db);
  eanOptionRow(table, T, "✏️ Bearbeiten", `Name, Marke und Menge an ${dbName} senden`, "Öffnen",
    async () => { await editMine(ean); await rerender(); });
  eanOptionRow(table, T, "🔄 Stand holen", "Zwischenspeicher übergehen und neu abfragen", "Holen",
    async () => { await refreshMine(ean); await rerender(); });
  eanOptionRow(table, T, "📷 Foto senden", `Vorderseite, Zutaten oder Nährwerte an ${dbName} – nur eigene Aufnahmen`, "Senden",
    async () => { await sendPhoto(ean, e.db); await rerender(); });
  eanOptionRow(table, T, "🌐 Bei " + dbName, dbById(e.db).base.replace("https://", ""), "Öffnen",
    async () => { await openMine(ean); });
  eanOptionRow(table, T, "🗑 Aus meiner Liste", "Der Eintrag in der Datenbank bleibt bestehen", "Entfernen",
    async () => { if (await forgetMine(ean)) await rerender("ean"); },
    { bg: T.warnBg });
}

// ─── Eigenständiger Betrieb ──────────────────────────────────────

/** Eine Nummer prüfen und das Ergebnis anzeigen. */
async function checkOnce(start) {
  let ean = await askEAN(start);
  while (ean) {
    const res = await confirmEAN(ean);
    if (res === null) return;                    // abgebrochen
    if (res === "retry") { ean = await askEAN(ean); continue; }
    Pasteboard.copyString(ean);
    await note("Fertig", eanStatusText(ean, res) + "\n\nDie Nummer liegt in der Zwischenablage.");
    return;
  }
}

// ─── Ablauf ──────────────────────────────────────────────────────

/**
 * Eine Nummer prüfen lassen – der Weg für andere Skripte.
 * Fehlt die Nummer oder taugt sie nicht, wird hier danach gefragt.
 * @returns {ean, found, name, brand, quantity, image, db} oder null
 */
async function runCheck(startEAN) {
  await showEANDataWarning();
  let ean = String(startEAN || "").replace(/[\s-]/g, "").trim();
  if (!/^\d{8,14}$/.test(ean) || eanChecksumOK(ean) === false) ean = await askEAN(ean);

  while (ean) {
    const res = await confirmEAN(ean);
    if (res === null) return null;                       // abgebrochen
    if (res === "retry") { ean = await askEAN(ean); continue; }
    return { ...res, ean };
  }
  return null;
}

// ─── Grafiken (DrawContext) ──────────────────────────────────────
// Scriptable kann Bilder zeichnen – daraus bauen wir Balken- und
// Liniendiagramme, die in Tabellenzeilen und im Widget landen.

/**
 * Nutzbare Breite in Punkten für Diagramme in Tabellenzeilen.
 * UITable-Zellen haben links/rechts einen festen Rand – wird er nicht
 * abgezogen, skaliert iOS das Bild (unscharf) oder schneidet rechts ab.
 */
const TABLE_INSET = 36;
// Deckel gegen unnötig große Zeichenflächen. Auf dem iPad würde ein Diagramm
// über die volle Breite eine halbe Bildschirmhöhe beanspruchen, weil die Höhe
// aus dem Seitenverhältnis folgt – dort also enger deckeln.
const CHART_MAX_WIDTH = Device.isPad() ? 700 : 1200;

/**
 * Breite der Zeichenfläche. Richtet sich nach dem AKTUELLEN Fenster, nicht
 * nach der kurzen Bildschirmkante – sonst wären Diagramme im Querformat und
 * auf dem iPad zu schmal gezeichnet und würden hochskaliert (unscharf).
 */
function contentWidth() {
  const w = LAYOUT.viewWidth() - TABLE_INSET;
  return Math.max(240, Math.min(CHART_MAX_WIDTH, Math.round(w)));
}

function newCanvas(w, h, bg) {
  const ctx = new DrawContext();
  ctx.respectScreenScale = true;   // muss vor size gesetzt sein, sonst @1x = unscharf
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  if (bg) { ctx.setFillColor(bg); ctx.fillRect(new Rect(0, 0, w, h)); }
  return ctx;
}

function drawLabel(ctx, text, x, y, size, color, align, width) {
  ctx.setFont(Font.systemFont(size));
  ctx.setTextColor(color);
  if (align === "right") ctx.setTextAlignedRight();
  else if (align === "center") ctx.setTextAlignedCenter();
  else ctx.setTextAlignedLeft();
  const w = width || (align === "right" ? 90 : 200);
  ctx.drawTextInRect(clipText(text, w, size), new Rect(x, y, w, size + 6));
}

/** Text auf eine Pixelbreite kürzen (Schätzung: ~0,58 × Schriftgröße je Zeichen). */
function clipText(text, width, size) {
  const s = String(text);
  const max = Math.max(3, Math.floor(width / (size * 0.58)));
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Fortschrittsbalken als Bild – für das manuelle Aktualisieren. */
function drawProgressBar(T, fraction, label) {
  const w = contentWidth();
  const h = LAYOUT.row(30);
  const barH = Math.round(h * 0.36);
  const barY = Math.round((h - barH) / 2) + Math.round(h * 0.22);
  const ctx = newCanvas(w, h);

  const track = new Path();
  track.addRoundedRect(new Rect(0, barY, w, barH), barH / 2, barH / 2);
  ctx.addPath(track);
  ctx.setFillColor(T.rowAlt);
  ctx.fillPath();

  const fillW = Math.max(barH, Math.round(w * Math.min(1, Math.max(0, fraction))));
  const fill = new Path();
  fill.addRoundedRect(new Rect(0, barY, fillW, barH), barH / 2, barH / 2);
  ctx.addPath(fill);
  ctx.setFillColor(T.good);
  ctx.fillPath();

  drawLabel(ctx, label, 0, 0, LAYOUT.font(11), T.muted, "left", w);
  return ctx.getImage();
}

/** Waagerechtes Balkendiagramm: Warenkorb-Summe je Händler. */
function chartRetailers(retailers, T, width, formatValue) {
  const w = width || contentWidth();
  const rowH = LAYOUT.row(32);
  const h = Math.max(LAYOUT.row(60), retailers.length * rowH + 20);
  const ctx = newCanvas(w, h, T.dark ? new Color("#2c2c2e") : new Color("#ffffff"));
  if (!retailers.length) return ctx.getImage();

  const max = Math.max(...retailers.map(r => r.total)) || 1;
  const labelW = Math.round(w * 0.34);
  const valueW = Math.round(w * 0.22);
  const barMax = Math.max(30, w - labelW - valueW - 24);
  const track = T.dark ? new Color("#3a3a3c") : new Color("#eeeeee");

  retailers.forEach((r, i) => {
    const y = 10 + i * rowH;

    // Alternierender Hintergrund für bessere Lesbarkeit bei vielen Zeilen
    if (i % 2 === 1) {
      ctx.setFillColor(T.dark ? new Color("#242426") : new Color("#f8f9fa"));
      ctx.fillRect(new Rect(0, y - 4, w, rowH));
    }

    const logo = cachedLogo(r.name);
    const logoSize = 20;
    if (logo) ctx.drawImageInRect(logo, new Rect(8, y + 3, logoSize, logoSize));
    const textX = logo ? 10 + logoSize : 10;
    drawLabel(ctx, r.name, textX, y + 6, LAYOUT.font(13), i === 0 ? T.good : T.text, "left", labelW - (textX - 10) - 6);

    // Hintergrund-Track (volle Balkenbreite) für den Größenvergleich
    ctx.setFillColor(track);
    const bg = new Path();
    bg.addRoundedRect(new Rect(labelW, y + 5, barMax, 16), 4, 4);
    ctx.addPath(bg);
    ctx.fillPath();

    const barW = Math.max(4, (r.total / max) * barMax);
    ctx.setFillColor(i === 0 ? T.good : T.accent);
    const path = new Path();
    path.addRoundedRect(new Rect(labelW, y + 5, barW, 16), 4, 4);
    ctx.addPath(path);
    ctx.fillPath();

    ctx.setFont(Font.boldSystemFont(LAYOUT.font(13)));
    ctx.setTextColor(T.text);
    ctx.setTextAlignedRight();
    const label = formatValue ? formatValue(r.total) : eur(r.total);
    ctx.drawTextInRect(label, new Rect(w - valueW - 10, y + 6, valueW, 20));
  });
  return ctx.getImage();
}

/** Senkrechtes Balkendiagramm: günstigster Preis je Produkt. */
function chartProducts(byProduct, T, width) {
  const allNames = Object.keys(byProduct);
  const w = width || contentWidth();
  const h = Math.round(Math.max(LAYOUT.row(180), w * interpolate(w, [[340, 0.45], [400, 0.4], [700, 0.32], [1000, 0.26]])));
  const ctx = newCanvas(w, h, T.dark ? new Color("#2c2c2e") : new Color("#ffffff"));
  if (!allNames.length) return ctx.getImage();

  // Bei sehr vielen Produkten nur die teuersten zeigen (Balken blieben sonst zu schmal)
  const MAX_BARS = 10;
  const names = (allNames.length > MAX_BARS
    ? [...allNames].sort((a, b) => byProduct[b].price - byProduct[a].price).slice(0, MAX_BARS)
    : [...allNames]).sort(byName);

  const max = Math.max(...names.map(n => byProduct[n].price)) || 1;
  const left = 8, right = w - 8, top = 30, baseY = h - 34;
  const gap = 14;
  const barW = Math.min(70, (right - left - gap * (names.length + 1)) / names.length);

  // Horizontale Gitterlinien wie im Preisverlauf, für einheitliche Optik
  ctx.setStrokeColor(T.dark ? new Color("#3a3a3c") : new Color("#e0e0e0"));
  ctx.setLineWidth(1);
  [0, 0.5, 1].forEach(f => {
    const y = baseY - f * (baseY - top);
    const line = new Path();
    line.move(new Point(left, y));
    line.addLine(new Point(right, y));
    ctx.addPath(line);
    ctx.strokePath();
    drawLabel(ctx, eur(max * f), left, y - 12, LAYOUT.font(9), T.muted);
  });

  names.forEach((n, i) => {
    const x = left + gap + i * (barW + gap);
    const barH = Math.max(6, (byProduct[n].price / max) * (baseY - top));
    ctx.setFillColor(T.accent);
    const path = new Path();
    path.addRoundedRect(new Rect(x, baseY - barH, barW, barH), 4, 4);
    ctx.addPath(path);
    ctx.fillPath();

    ctx.setFont(Font.boldSystemFont(LAYOUT.font(12)));
    ctx.setTextColor(T.text);
    ctx.setTextAlignedCenter();
    ctx.drawTextInRect(eur(byProduct[n].price), new Rect(x - 12, baseY - barH - 20, barW + 24, 18));

    ctx.setFont(Font.systemFont(LAYOUT.font(10)));
    ctx.setTextColor(T.muted);
    ctx.drawTextInRect(clipText(n, barW + 24, LAYOUT.font(10)), new Rect(x - 12, baseY + 6, barW + 24, 16));
  });

  if (allNames.length > MAX_BARS) {
    ctx.setFont(Font.systemFont(LAYOUT.font(9)));
    ctx.setTextColor(T.muted);
    ctx.setTextAlignedRight();
    ctx.drawTextInRect(`+${allNames.length - MAX_BARS} weitere`, new Rect(right - 100, 6, 100, 16));
  }
  return ctx.getImage();
}

/** 100%-gestapelter Balken: Anteil der Bestpreis-Treffer je Markt. */
function chartShare(retailers, T, width) {
  const w = width || contentWidth();
  const total = retailers.reduce((s, r) => s + r.best, 0) || 1;
  const colors = [T.good, T.accent, new Color("#f4b400"), new Color("#e65100"), new Color("#9334e6"), T.muted];
  const barY = 30, barH = 18, left = 8, right = w - 8;
  const legendFont = LAYOUT.font(10);
  const lineH = legendFont + 8;

  // Legende vorab umbrechen, damit die Zeichenfläche hoch genug ist
  const legend = retailers.map((r, i) => {
    const text = `${r.name} ${Math.round((r.best / total) * 100)}%`;
    return { text, color: colors[i % colors.length], w: Math.min(w - 24, 14 + text.length * legendFont * 0.58) };
  });
  let lines = 1, lineW = 0;
  legend.forEach(e => {
    if (lineW && lineW + e.w > w - 16) { lines++; lineW = 0; }
    e.line = lines - 1;
    e.x = left + lineW;
    lineW += e.w + 14;
  });
  const h = Math.round(barY + barH + 12 + lines * lineH + 8);
  const ctx = newCanvas(w, h, T.dark ? new Color("#2c2c2e") : new Color("#ffffff"));
  let x = left;

  retailers.forEach((r, i) => {
    const width_ = ((right - left) * r.best) / total;
    ctx.setFillColor(colors[i % colors.length]);
    ctx.fillRect(new Rect(x, barY, Math.max(1, width_), barH));
    x += width_;
  });

  // Rahmen um den Balken
  ctx.setStrokeColor(T.dark ? new Color("#3a3a3c") : new Color("#dadce0"));
  ctx.setLineWidth(1);
  const border = new Path();
  border.addRect(new Rect(left, barY, right - left, barH));
  ctx.addPath(border);
  ctx.strokePath();

  drawLabel(ctx, "Bestpreis-Verteilung", left, 4, LAYOUT.font(11), T.muted, "left", w - 16);

  // Legende darunter (Positionen wurden oben berechnet)
  ctx.setFont(Font.systemFont(legendFont));
  ctx.setTextAlignedLeft();
  legend.forEach((e, i) => {
    const ly = barY + barH + 10 + e.line * lineH;
    const logo = cachedLogo(retailers[i].name);
    if (logo) {
      ctx.drawImageInRect(logo, new Rect(e.x, ly + 1, 12, 12));   // echtes Logo, wenn vorhanden …
    } else {
      ctx.setFillColor(e.color);                                  // … sonst der Farbpunkt aus dem Balken
      ctx.fillEllipse(new Rect(e.x, ly + 3, 8, 8));
    }
    ctx.setTextColor(T.text);
    ctx.drawTextInRect(e.text, new Rect(e.x + 15, ly, e.w - 15, lineH));
  });

  return ctx.getImage();
}

function chartHistory(query, T, width) {
  const entries = (history[query] || []).slice(-30);
  const w = width || contentWidth();
  const h = Math.round(Math.max(LAYOUT.row(180), w * interpolate(w, [[340, 0.45], [400, 0.4], [700, 0.32], [1000, 0.26]])));
  const ctx = newCanvas(w, h, T.dark ? new Color("#2c2c2e") : new Color("#ffffff"));
  if (entries.length < 2) {
    drawLabel(ctx, "Verlauf entsteht ab dem zweiten Tag", 12, h / 2 - 8, 12, T.muted);
    return ctx.getImage();
  }

  const prices = entries.map(e => e.p);
  const min = Math.min(...prices), max = Math.max(...prices);
  const span = (max - min) || 1;
  const left = Math.round(LAYOUT.font(9) * 5.2) + 8;   // Platz für „12,34 €“
  const right = w - 14, top = 18, bottom = h - 28;

  // Gitterlinien + Achsenbeschriftung
  ctx.setStrokeColor(T.dark ? new Color("#3a3a3c") : new Color("#e0e0e0"));
  ctx.setLineWidth(1);
  [0, 0.5, 1].forEach(f => {
    const y = bottom - f * (bottom - top);
    const line = new Path();
    line.move(new Point(left, y));
    line.addLine(new Point(right, y));
    ctx.addPath(line);
    ctx.strokePath();
    drawLabel(ctx, (min + f * span).toFixed(2).replace(".", ",") + " €", 4, y - 8, LAYOUT.font(9), T.muted, "left", left - 8);
  });

  const stepX = (right - left) / (entries.length - 1);
  const pointAt = (i) => new Point(
    left + i * stepX,
    bottom - ((entries[i].p - min) / span) * (bottom - top)
  );

  // gestrichelte Durchschnittslinie
  const avg = entries.reduce((s, e) => s + e.p, 0) / entries.length;
  const avgY = bottom - ((avg - min) / span) * (bottom - top);
  ctx.setStrokeColor(T.muted);
  ctx.setLineWidth(1);
  const dashCount = Math.floor((right - left) / 8);
  for (let i = 0; i < dashCount; i += 2) {
    const seg = new Path();
    seg.move(new Point(left + i * 8, avgY));
    seg.addLine(new Point(left + Math.min((i + 1) * 8, right - left), avgY));
    ctx.addPath(seg);
    ctx.strokePath();
  }
  drawLabel(ctx, "Ø " + eur(avg), right - 80, avgY - 16, LAYOUT.font(9), T.muted, "right", 80);

  const line = new Path();
  line.move(pointAt(0));
  for (let i = 1; i < entries.length; i++) line.addLine(pointAt(i));
  ctx.setStrokeColor(T.accent);
  ctx.setLineWidth(2.5);
  ctx.addPath(line);
  ctx.strokePath();

  entries.forEach((e, i) => {
    const p = pointAt(i);
    ctx.setFillColor(e.p === min ? T.good : T.accent);
    ctx.fillEllipse(new Rect(p.x - 3.5, p.y - 3.5, 7, 7));
  });

  // Tiefstpreis-Beschriftung am Punkt
  const minIdx = entries.findIndex(e => e.p === min);
  if (minIdx >= 0) {
    const mp = pointAt(minIdx);
    ctx.setFont(Font.boldSystemFont(LAYOUT.font(10)));
    ctx.setTextColor(T.good);
    ctx.setTextAlignedCenter();
    ctx.drawTextInRect(eur(min), new Rect(mp.x - 30, mp.y - 22, 60, 14));
  }

  // erste und letzte Datumsangabe
  const fmt = (d) => d.slice(8, 10) + "." + d.slice(5, 7) + ".";
  drawLabel(ctx, fmt(entries[0].d), left - 6, bottom + 8, LAYOUT.font(9), T.muted);
  ctx.setFont(Font.systemFont(LAYOUT.font(9)));
  ctx.setTextColor(T.muted);
  ctx.setTextAlignedRight();
  ctx.drawTextInRect(fmt(entries[entries.length - 1].d), new Rect(right - 90, bottom + 8, 90, 14));

  return ctx.getImage();
}

/** Bild als eigene Tabellenzeile einfügen. */
function addChartRow(table, image, height, bg) {
  const row = new UITableRow();
  row.height = height;
  row.backgroundColor = bg;
  const cell = row.addImage(image);
  cell.widthWeight = 100;
  table.addRow(row);
}


// ─── Barcode-Erfassung ───────────────────────────────────────────
// Scriptable hat keine eigene Kamera-API. Deshalb wird der Barcode aus
// einem Foto gelesen: Aufnahme bzw. Auswahl aus der Mediathek, Auswertung
// per ZXing in einer WebView. Alternativ Nummer eintippen. Beide Wege
// enden im selben Abgleich (resolveEAN). Das EAN-Skript kommt nur ins
// Spiel, wenn die Nummer in keiner Datenbank steht.
// Der zuletzt genutzte Weg wird gemerkt (meta.scanMethod).

/** Merkt sich den zuletzt genutzten Weg. */
function rememberScanMethod(id) {
  if (meta.scanMethod !== id) { meta.scanMethod = id; touch("meta"); flush(); }
}

// Bibliothek für die Bilderkennung. Version 0.18.x bewusst gewählt: ab 0.19
// wurden die Browser-Reader in ein eigenes Paket ausgelagert und fehlen im
// UMD-Build. Der Code wird EINMALIG heruntergeladen und lokal zwischen-
// gespeichert – nachladen aus der WebView heraus schlägt regelmäßig fehl.
const ZXING_URL = "https://unpkg.com/@zxing/library@0.18.6/umd/index.min.js";
// Der Cache liegt bewusst NICHT direkt im Scriptable-Ordner: dort wäre er
// eine .js-Datei neben den echten Skripten und tauchte in der Auswahlliste
// für den EAN-Abgleich auf. Eigener Unterordner, damit die Liste sauber bleibt.
const ZXING_DIR = FileManager.local().joinPath(
  FileManager.local().documentsDirectory(), "PreisApp-cache");
const ZXING_CACHE = FileManager.local().joinPath(ZXING_DIR, "zxing.js");
// Ablage vor dieser Änderung – wird beim ersten Lauf umgezogen bzw. entfernt.
const ZXING_CACHE_OLD = FileManager.local().joinPath(
  FileManager.local().documentsDirectory(), ZXING_LEGACY_NAME + ".js");
let zxingSource = null;

/**
 * Alte Cache-Datei aus dem Skriptordner räumen. Ist noch kein neuer Cache
 * vorhanden, wird sie umgezogen – der Download entfällt dann. Fehler sind
 * unkritisch: schlimmstenfalls wird die Bibliothek neu geladen.
 */
function migrateZxingCache() {
  const LF = FileManager.local();
  try {
    if (!LF.fileExists(ZXING_CACHE_OLD)) return;
    if (!LF.fileExists(ZXING_DIR)) LF.createDirectory(ZXING_DIR, true);
    if (LF.fileExists(ZXING_CACHE)) LF.remove(ZXING_CACHE_OLD);
    else LF.move(ZXING_CACHE_OLD, ZXING_CACHE);
  } catch (e) {}
}

/** Bibliothekscode holen (Speicher -> Datei -> Netz). */
async function zxingLibrary() {
  if (zxingSource) return zxingSource;
  const LF = FileManager.local();
  migrateZxingCache();
  try {
    if (LF.fileExists(ZXING_CACHE)) {
      const cached = LF.readString(ZXING_CACHE);
      if (cached && cached.length > 50000) { zxingSource = cached; return zxingSource; }
    }
  } catch (e) {}

  let txt;
  try {
    txt = await newRequest(ZXING_URL).loadString();
  } catch (e) {
    throw new Error("Die Bilderkennung konnte nicht geladen werden – Internetverbindung prüfen.");
  }
  if (!txt || txt.length < 50000) throw new Error("Die Bilderkennung wurde unvollständig geladen.");
  try {
    if (!LF.fileExists(ZXING_DIR)) LF.createDirectory(ZXING_DIR, true);
    LF.writeString(ZXING_CACHE, txt);
  } catch (e) {}
  zxingSource = txt;
  return txt;
}

/** Bild verkleinern – große Fotos machen die Erkennung langsam und instabil. */
function shrinkImage(img, maxSide) {
  const w = img.size.width, h = img.size.height;
  const f = Math.min(1, maxSide / Math.max(w, h));
  if (f >= 1) return img;
  const ctx = new DrawContext();
  ctx.respectScreenScale = false;
  ctx.size = new Size(Math.round(w * f), Math.round(h * f));
  ctx.drawImageInRect(img, new Rect(0, 0, ctx.size.width, ctx.size.height));
  return ctx.getImage();
}

/**
 * Barcode aus einem Bild lesen. ZXing wird als Quelltext in die Seite
 * eingebettet, damit die WebView nichts nachladen muss.
 * Liefert die Ziffernfolge oder "" – wirft bei technischen Problemen.
 */
async function decodeBarcode(img) {
  const lib = (await zxingLibrary()).replace(/<\/script/gi, "<\\/script");
  const b64 = Data.fromJPEG(shrinkImage(img, 1600)).toBase64String();

  // Bewusst Verkettung statt Template-String: der Bibliothekscode enthält
  // selbst Backticks und ${…} und würde sonst interpoliert.
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>'
    + '<img id="pic" src="data:image/jpeg;base64,' + b64 + '">'
    + '<script>' + lib + '</' + 'script>'
    + '</body></html>';

  const wv = new WebView();
  await wv.loadHTML(html);
  await wv.waitForLoad();

  // WICHTIG: Der Rückgabewert des Skripts muss ein einfacher Typ sein.
  // Eine async-Funktion liefert ein Promise – Scriptable meldet dann
  // „Nicht unterstützter Typ“. Deshalb die Auswertung starten und
  // sofort einen String zurückgeben; das Ergebnis kommt über completion().
  const js = `
    (function () {
      (async function () {
        try {
          if (typeof ZXing === "undefined") { completion("__NOLIB__"); return; }
          const pic = document.getElementById("pic");
          if (!pic.complete) await new Promise(function (r) { pic.onload = r; pic.onerror = r; });
          if (!pic.naturalWidth) { completion("__NOIMG__"); return; }

          const hints = new Map();
          hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

          // Je nach Version heißt die Methode anders – beide probieren.
          const reader = new ZXing.BrowserMultiFormatReader(hints);
          let res = null;
          try {
            res = await (reader.decodeFromImageElement
              ? reader.decodeFromImageElement(pic)
              : reader.decodeFromImage(pic));
          } catch (e) { res = null; }

          completion(res && res.text ? String(res.text) : "");
        } catch (e) { completion("__ERR__" + (e && e.message ? e.message : e)); }
      })();
      return "gestartet";
    })();`;

  let out = "";
  try { out = await wv.evaluateJavaScript(js, true); } catch (e) {
    throw new Error("Die Auswertung ließ sich nicht starten: " + e.message);
  }

  out = String(out || "");
  if (out === "__NOLIB__") throw new Error("Die Bilderkennung ließ sich nicht starten (Bibliothek nicht geladen).");
  if (out === "__NOIMG__") throw new Error("Das Foto konnte nicht gelesen werden.");
  if (out.startsWith("__ERR__")) throw new Error("Fehler bei der Auswertung: " + out.slice(7));

  const hit = out.replace(/[\s-]/g, "").match(/\d{8,14}/);
  return hit ? hit[0] : "";
}

/** Foto aufnehmen oder auswählen und auswerten. Liefert EAN oder "". */
async function scanFromPhoto(fromCamera) {
  let img;
  try {
    img = fromCamera ? await Photos.fromCamera() : await Photos.fromLibrary();
  } catch (e) { return ""; }          // abgebrochen
  if (!img) return "";

  try {
    const ean = await decodeBarcode(img);
    if (ean) return ean;
    return await scanFallback("Kein Barcode erkannt",
      "Tipp: Barcode formatfüllend und scharf aufnehmen, möglichst gerade und gut ausgeleuchtet.");
  } catch (e) {
    return await scanFallback("Auswertung fehlgeschlagen", e.message);
  }
}

/** Bei fehlgeschlagener Erkennung direkt Alternativen anbieten. */
async function scanFallback(title, message) {
  const a = new Alert();
  a.title = title;
  a.message = message;
  a.addAction("🔁 Neues Foto");
  a.addAction("⌨︎ Nummer eintippen");
  a.addCancelAction("Abbrechen");
  const c = await a.presentAlert();
  if (c === 0) return await scanFromPhoto(true);
  if (c === 1) { await askEANManually(); return ""; }
  return "";
}

/**
 * Nummer eintippen. Geprüft wird hier nur die Form (8–14 Ziffern) – die
 * Prüfziffer und der Abgleich gehören der EAN-App, sie fragt bei einer
 * unbrauchbaren Nummer selbst nach.
 */
async function askEANManually() {
  let ean = "";
  let hint = "Barcode-Nummer vom Produkt (8–14 Ziffern).";
  for (;;) {
    const m = new Alert();
    m.title = "EAN eingeben";
    m.message = hint;
    m.addTextField("EAN", ean);
    m.addAction("Weiter");
    m.addCancelAction("Abbrechen");
    if (await m.presentAlert() === -1) return false;

    ean = m.textFieldValue(0).replace(/[\s-]/g, "").trim();
    if (!/^\d{8,14}$/.test(ean)) {
      hint = "⚠️ Bitte 8–14 Ziffern eingeben (nur Zahlen).";
      continue;
    }
    const info = await resolveEAN(ean);
    if (!info) return false;
    await handleScannedEAN(info.ean, info);
    return true;
  }
}

/**
 * Einstiegsmenü für die Barcode-Erfassung.
 * @returns true (Produkt übernommen) | false (nichts passiert)
 */
async function startBarcodeScan() {
  if (config.runsInApp !== true) return false;    // Dialoge nur in der App möglich

  const last = meta.scanMethod || "";
  const label = (id, text) => (last === id ? text + "  ·  zuletzt" : text);

  const a = new Alert();
  a.title = "Barcode erfassen";
  a.message = "Barcode formatfüllend und scharf fotografieren – die Nummer wird daraus gelesen.";
  a.addAction(label("camera", "📷 Foto aufnehmen"));
  a.addAction(label("library", "🗂 Bild aus der Mediathek"));
  a.addAction(label("manual", "⌨︎ Nummer eintippen"));
  a.addCancelAction("Abbrechen");
  const choice = await a.presentAlert();

  if (choice === 0 || choice === 1) {
    const ean = await scanFromPhoto(choice === 0);
    if (!ean) return false;
    rememberScanMethod(choice === 0 ? "camera" : "library");
    const info = await resolveEAN(ean);
    if (!info) return false;
    await handleScannedEAN(info.ean, info);
    return true;
  }
  if (choice === 2) {
    rememberScanMethod("manual");
    return await askEANManually();
  }
  return false;
}

// ─── Wiederverwendbare Tabellenzeilen ────────────────────────────
/** Textspalte auf schmalen Geräten verbreitern – sonst wird der Text abgeschnitten. */
/**
 * „Schmal“ heißt: wenig Platz in der aktuellen Ausrichtung. Im Querformat
 * hat auch ein kleines iPhone genug Breite für alle Spalten.
 */
function narrowView() { return LAYOUT.viewWidth() < 414; }

/**
 * Karten-Ansicht aktiv? Vorgabe: ja.
 *
 * Der Schalter liegt im Keychain und nicht in meta.json: meta.json wandert
 * über iCloud auf alle Geräte, der Keychain bleibt auf diesem einen. So kann
 * das iPad Karten zeigen und das iPhone gleichzeitig Tabellenzeilen.
 * Der Wert wird je Lauf einmal gelesen – cardsOn() läuft pro Zeile.
 */
let cardViewCache;                   // undefined = noch nicht gelesen
function cardsOn() {
  if (cardViewCache === undefined) {
    cardViewCache = Keychain.contains(KEYCHAIN.cardView)
      ? Keychain.get(KEYCHAIN.cardView) === "1"
      : meta.cardView !== false;     // Altbestand aus meta.json als Startwert
  }
  return cardViewCache;
}

/** Ansicht nur für dieses Gerät merken. */
function setCardView(on) {
  cardViewCache = on;
  Keychain.set(KEYCHAIN.cardView, on ? "1" : "0");
}

/**
 * Spaltenbreiten einer Produktkarte, stufenlos über die Fensterbreite.
 * Auf dem iPad würden feste Werte riesige Bilder und Preise ergeben, auf dem
 * mini wäre der Name abgeschnitten – deshalb interpoliert statt hart gesetzt.
 */
function cardWeights(showCheck) {
  const w = LAYOUT.viewWidth();
  const pick = (pts) => Math.round(interpolate(w, pts));
  const chk = showCheck ? pick([[320, 13], [390, 11], [428, 10], [744, 7], [1024, 5]]) : 0;
  const img = pick([[320, 18], [390, 17], [428, 15], [744, 10], [1024, 7]]);
  const price = pick([[320, 28], [390, 26], [428, 24], [744, 18], [1024, 15]]);
  const btn = pick([[320, 13], [390, 12], [428, 11], [744, 8], [1024, 6]]);
  return { chk, img, price, btn, name: 100 - chk - img - price };
}

/**
 * Preisschrift, die auch bei dreistelligen Beträgen in die Spalte passt.
 * „129,99 €“ braucht bei 19 pt mehr Platz, als die Preisspalte auf einem
 * 428-pt-Gerät hergibt – dann wird zwei Stufen kleiner gesetzt statt
 * abgeschnitten oder über den Produktnamen geschoben.
 */
function priceFont(text, base, bold) {
  const len = String(text).length;
  // Stufen so gewählt, dass auch „− 1.299,99 €“ auf einem 320-pt-Gerät
  // vollständig in seine Spalte passt.
  const size = LAYOUT.font(
    len > 11 ? Math.max(11, Math.round(base * 0.62))
    : len > 9 ? Math.max(11, Math.round(base * 0.74))
    : len > 8 ? base - 3
    : len > 6 ? base - 1
    : base);
  return bold ? Font.boldSystemFont(size) : Font.systemFont(size);
}

/** Abstandszeile in Seitenfarbe – trennt zwei Karten voneinander. */
function gapRow(table, T, h) {
  const row = new UITableRow();
  row.height = LAYOUT.row(h || 9);
  row.backgroundColor = T.bg;
  table.addRow(row);
  return row;
}

function textW(base) { return narrowView() ? Math.min(78, base + 6) : base; }
function priceW(base) { return 100 - textW(100 - base); }

/** Abschnittsüberschrift. */
/**
 * Wie viele Zeilen braucht ein Text in seiner Spalte?
 * UITable bricht Untertitel um, schneidet die Zeile aber an ihrer festen Höhe
 * ab. 0,52 × Schriftgröße ist die mittlere Zeichenbreite der Systemschrift.
 */
function fitLines(text, ptSize, widthPct) {
  const width = (LAYOUT.viewWidth() - TABLE_INSET) * ((widthPct || 100) / 100);
  const perLine = Math.max(10, Math.floor(width / (ptSize * 0.52)));
  return Math.max(1, Math.ceil(String(text || "").length / perLine));
}

/**
 * Zeilenhöhe, in die Titel und Untertitel vollständig passen.
 * Beide brechen um, UITable schneidet aber an der festen Zeilenhöhe ab –
 * deshalb wird die Höhe aus der Zahl der nötigen Zeilen berechnet.
 * maxTitleLines begrenzt den Titel (Vorgabe 2); bei Zeilen, deren ganzer
 * Inhalt im Titel steht (Hinweise, Änderungsliste), darf er höher liegen.
 */
function autoRowHeight(title, tPt, subtitle, sPt, widthPct, min, maxTitleLines) {
  const t = LAYOUT.font(tPt);
  const sub = subtitle ? LAYOUT.font(sPt) : 0;
  const tLines = Math.min(maxTitleLines || 2, fitLines(title, t, widthPct));
  const h = tLines * t * 1.3 + (subtitle ? fitLines(subtitle, sub, widthPct) * sub * 1.3 : 0) + 18;
  return Math.max(min || 0, Math.round(h));
}

/**
 * Breite der Schaltflächenspalte in Prozent: nur so viel, wie der Knopftext
 * tatsächlich braucht. Fest vergebene 30 % ließen auf breiten Geräten ein
 * Drittel der Zeile leer, während der Text links umbrach.
 */
function actionWeight(label, ptSize) {
  const width = LAYOUT.viewWidth() - TABLE_INSET;
  const pt = LAYOUT.font(ptSize || 15);
  const need = String(label || "").length * pt * 0.60 + 14;
  return Math.min(38, Math.max(16, Math.ceil((need / width) * 100)));
}

function headerRow(table, T, title, subtitle) {
  if (cardsOn()) gapRow(table, T, 6);   // Abschnitte wie Karten voneinander lösen
  const row = new UITableRow();
  row.isHeader = true;
  // Ohne eigene Schriften nimmt Scriptable die Systemschrift der
  // Bedienungshilfen – bei großer Textgröße sprengt das jede feste Höhe.
  row.height = autoRowHeight(title, 17, subtitle, 12, 100, LAYOUT.row(subtitle ? 50 : 40));
  row.backgroundColor = T.bg;
  const t = row.addText(title, subtitle || "");
  t.titleFont = Font.boldSystemFont(LAYOUT.font(17));
  t.titleColor = T.text;
  t.subtitleFont = Font.systemFont(LAYOUT.font(12));
  t.subtitleColor = T.muted;
  table.addRow(row);
  return row;
}

/**
 * „Zurück zur Übersicht“.
 * Ziel und Beschriftung sind wählbar: aus einem eigenen EAN-Eintrag geht
 * es zurück in dessen Liste, nicht in die Produktliste.
 */
function backRow(table, T, rerender, target, label) {
  const row = new UITableRow();
  row.height = tapRow(44);
  row.backgroundColor = T.bg;
  const b = row.addButton(label || "‹ Zurück zur Übersicht");
  b.onTap = async () => { await rerender(target || "list"); };
  table.addRow(row);
  return row;
}

/** Einfache Textzeile. */
function infoRow(table, T, title, subtitle, bg) {
  const row = new UITableRow();
  row.height = autoRowHeight(title, 15, subtitle, 11, 100, tapRow(44));
  row.backgroundColor = bg || T.row;
  const t = row.addText(title, subtitle || "");
  t.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
  t.titleColor = T.text;
  t.subtitleFont = Font.systemFont(LAYOUT.font(11));
  t.subtitleColor = T.muted;
  table.addRow(row);
  return row;
}

/**
 * Diagramm-Zeile mit automatischer Höhe.
 * Die Höhe wird aus dem Seitenverhältnis berechnet – image.size liefert bei
 * respectScreenScale Pixel statt Punkte, sonst wäre die Zeile 2–3× zu hoch.
 */
function chartRow(table, T, image) {
  addChartRow(table, image, chartRowHeight(image), T.row);
}

function chartRowHeight(image) {
  const w = contentWidth();
  return Math.round(w * (image.size.height / image.size.width)) + 10;
}

/** Zeigt einen Fehler samt Rückweg, statt das Skript zu beenden. */
function addErrorRow(table, T, error, rerender) {
  backRow(table, T, rerender);
  const row = infoRow(table, T,
    "Diese Ansicht konnte nicht geladen werden",
    String(error && error.message ? error.message : error),
    T.warnBg);
  row.height = LAYOUT.row(70);
}

// ─── Oberfläche: Übersicht ───────────────────────────────────────
async function showMain() {
  const table = new UITable();
  table.showSeparators = true;
  let filter = "";   // Suchtext für die Produktliste
  // Anzeigemodus: alle Produkte | nur mit Angebot | nur ohne EAN
  let listMode = meta.listMode || (meta.onlyOffers === true ? "offers" : "all");
  const MODES = ["all", "offers", "noean"];
  let catFilter = catId(meta.catFilter || "");            // "" = alle Warenarten
  const CAT_CYCLE = ["", ...CATS.map(c => c.id)];
  const marked = new Set();   // markierte Produkte für den Export – nur für diesen Aufruf, nicht gespeichert
  const exportOn = () => meta.exportEnabled !== false;   // live lesen – kann sich über editSettings ändern

  /** Beobachtungen nach Suchtext filtern (Produktname oder Händler) – alphabetisch. */
  function visibleItems() {
    const q = filter.trim().toLowerCase();
    return items.filter(i => {
      if (listMode === "offers" && !activeOffers(i.query).length) return false;
      if (listMode === "noean" && (i.ean || "").trim()) return false;
      if (catFilter && catId(i.cat) !== catFilter) return false;
      if (!q) return true;
      if (i.query.toLowerCase().includes(q)) return true;
      return activeOffers(i.query).some(o =>
        (o.advertiser || "").toLowerCase().includes(q) ||
        (o.details || "").toLowerCase().includes(q)
      );
    }).sort((a, b) => byName(a.query, b.query));
  }

  /** Anzahl Produkte, die aktuell ein Angebot haben. */
  function offerCount() {
    return items.filter(i => activeOffers(i.query).length).length;
  }

  /** Anzahl Produkte ohne hinterlegte EAN. */
  function noEanCount() {
    return items.filter(i => !(i.ean || "").trim()).length;
  }

  async function askFilter() {
    const a = new Alert();
    a.title = "Produkte durchsuchen";
    a.message = "Sucht in Produktnamen, Händlern und Angebotstexten.";
    a.addTextField("Suchbegriff", filter);
    a.addAction("Suchen");
    if (filter) a.addDestructiveAction("Filter zurücksetzen");
    a.addCancelAction("Abbrechen");
    const choice = await a.presentAlert();
    if (choice === -1) return false;
    filter = (choice === 1) ? "" : a.textFieldValue(0).trim();
    return true;
  }

  let view = "list";      // list | detail | compare | savings | help | ean | eanentry
  let current = null;     // aktuell geöffnetes Produkt
  let currentEAN = "";    // aktuell geöffneter eigener EAN-Eintrag

  /** Ansicht wechseln und Tabelle neu zeichnen. */
  async function rerender(nextView, item) {
    if (nextView) view = nextView;
    if (item !== undefined) current = item;
    await build();
    table.reload();
  }

  async function build() {
    const T = theme();
    trackHeights(table);

    if (view === "detail" && current) {
      table.removeAllRows();
      try {
        await buildDetail(table, T, current, rerender);
      } catch (e) {
        addErrorRow(table, T, e, rerender);
      }
      padToBottom(table, T);
      return;
    }
    if (view === "compare") {
      table.removeAllRows();
      try {
        await buildCompare(table, T, rerender);
      } catch (e) {
        addErrorRow(table, T, e, rerender);
      }
      padToBottom(table, T);
      return;
    }
    if (view === "savings") {
      table.removeAllRows();
      try {
        await buildSavings(table, T, rerender);
      } catch (e) {
        addErrorRow(table, T, e, rerender);
      }
      padToBottom(table, T);
      return;
    }
    if (view === "help") {
      table.removeAllRows();
      try {
        await buildHelp(table, T, rerender);
      } catch (e) {
        addErrorRow(table, T, e, rerender);
      }
      padToBottom(table, T);
      return;
    }
    // Eigene EAN-Einträge: Liste und Einzelansicht. Beide zeichnen in
    // dieselbe Tabelle wie alles andere – die Fußzeile bleibt stehen.
    if (view === "eanentry" && mineGet(currentEAN)) {
      table.removeAllRows();
      try {
        buildEANEntry(table, T, rerender, currentEAN);
      } catch (e) {
        addErrorRow(table, T, e, rerender);
      }
      padToBottom(table, T, tapRow(46));
      addFooter(table, T);
      return;
    }
    if (view === "ean" || view === "eanentry") {
      view = "ean";
      table.removeAllRows();
      try {
        await buildEANList(table, T, rerender, async (ean) => {
          currentEAN = ean;
          await rerender("eanentry");
        });
      } catch (e) {
        addErrorRow(table, T, e, rerender);
      }
      padToBottom(table, T, tapRow(46));
      addFooter(table, T);
      return;
    }

    const shown = visibleItems();
    table.removeAllRows();

    // Kopf
    const head = new UITableRow();
    head.isHeader = true;
    head.backgroundColor = T.bg;
    const age = meta.lastRefresh
      ? (() => {
          const m = Math.round((Date.now() - meta.lastRefresh) / 60000);
          return m < 60 ? `vor ${m} Min.` : `vor ${Math.round(m / 60)} Std.`;
        })()
      : "noch nie";
    const parts = [];
    if (filter) parts.push(`Filter: „${filter}“`);
    if (listMode === "offers") parts.push("nur Angebote");
    if (listMode === "noean") parts.push("nur ohne EAN");
    if (catFilter) parts.push(catShort(catFilter));
    // Alte Angebote stehen noch in der Liste, weil eine Quelle ausgefallen ist
    if (meta.degradedAt) parts.push("Quelle gestört – alter Stand");
    const headIcon = preisAppIcon();
    if (headIcon) {
      const hi = head.addImage(headIcon);
      hi.widthWeight = 14;
      hi.imageSize = new Size(34, 34);
    }

    // Höhe erst hier: der Untertitel wächst mit Filter und Warenart und
    // wurde bei fester Höhe abgeschnitten.
    const headSub = parts.length
      ? `${shown.length} von ${items.length} · ${parts.join(" · ")}`
      : `${items.length} Produkte · Stand ${age}`;
    head.height = autoRowHeight("PreisApp", 18, headSub, 12, headIcon ? 86 : 100, LAYOUT.row(50));

    const title = head.addText("PreisApp", headSub);
    title.widthWeight = 86;
    title.titleFont = Font.boldSystemFont(LAYOUT.font(18));
    title.titleColor = T.text;
    title.subtitleFont = Font.systemFont(LAYOUT.font(12));
    title.subtitleColor = (filter || listMode !== "all" || catFilter) ? T.accent : T.muted;
    table.addRow(head);

    // Eine Werkzeugzeile: Suche, Filter, Produkt anlegen, Aktualisieren.
    // Suche und Aktualisieren nur als Symbol, damit alles nebeneinander passt.
    const toolRow = new UITableRow();
    toolRow.height = LAYOUT.row(46);
    toolRow.backgroundColor = (filter || listMode !== "all" || catFilter) ? T.goodBg : T.row;

    const searchBtn = toolRow.addButton(filter ? "🔍 ✓" : "🔍");
    searchBtn.widthWeight = 13;
    searchBtn.centerAligned();
    searchBtn.onTap = async () => {
      if (await askFilter()) { await build(); table.reload(); }
    };

    // Angebote/EAN: alle -> nur Angebote -> ohne EAN
    const mode = toolRow.addButton(
      listMode === "offers" ? `🏷️ Angebote (${offerCount()}) ✓`
      : listMode === "noean" ? `🔢 Ohne EAN (${noEanCount()}) ✓`
      : `🏷️ Alle (${items.length})`
    );
    mode.widthWeight = 38;
    mode.centerAligned();
    mode.onTap = async () => {
      listMode = MODES[(MODES.indexOf(listMode) + 1) % MODES.length];
      meta.listMode = listMode;
      delete meta.onlyOffers;
      touch("meta");
      flush();
      await build();
      table.reload();
    };


    // Produkt anlegen – Eingabe oder Barcode, in einem Menü zusammengefasst
    const bAdd = toolRow.addButton("＋ Produkt");
    bAdd.widthWeight = 34;
    bAdd.centerAligned();
    bAdd.onTap = async () => {
      const pick = new Alert();
      pick.title = "Produkt hinzufügen";
      pick.message = "Suchbegriff eintippen oder den Barcode erfassen – beides landet in derselben Beobachtung.";
      pick.addAction("✏️ Suchbegriff eingeben");
      pick.addAction("📷 Barcode erfassen");
      pick.addCancelAction("Abbrechen");
      const how = await pick.presentAlert();
      if (how === -1) return;

      if (how === 1) {
        const result = await startBarcodeScan();
        if (result === true) { await build(); table.reload(); }
        return;
      }

      const a = new Alert();
      a.title = "Produkt beobachten";
      a.message = "Suchbegriff breit halten (z. B. „Vernel Weichspüler“), Sorte separat (z. B. „Sensitiv“). Die EAN ist freiwillig – ohne sie funktionieren Angebote und Alarm, nur Produktname und Bild fehlen.";
      a.addTextField("Suchbegriff", "");
      a.addTextField("Sorte / Variante (optional)", "");
      a.addTextField("EAN (optional, für Produktdaten)", "");
      a.addAction("Hinzufügen");
      a.addCancelAction("Abbrechen");
      if (await a.presentAlert() === -1) return;
      const q = a.textFieldValue(0).trim();
      const v = a.textFieldValue(1).trim();
      if (!q) return;

      // EAN ist freiwillig – wenn eine eingetragen wurde, gleich abgleichen
      let ean = a.textFieldValue(2).replace(/[\s-]/g, "").trim();
      let image = "";
      let cat = "";
      if (ean) {
        if (!/^\d{8,14}$/.test(ean)) {
          const w = new Alert();
          w.title = "⚠️ Keine gültige EAN";
          w.message = `„${ean}“ besteht nicht aus 8–14 Ziffern.`;
          w.addAction("Ohne EAN hinzufügen");
          w.addCancelAction("Abbrechen");
          if (await w.presentAlert() === -1) return;
          ean = "";
        } else {
          // Mit EAN übernimmt die EAN-App den Abgleich; Name und Sorte
          // stehen hier schon fest.
          const info = await resolveEAN(ean);
          if (!info) return;
          ean = info.ean;
          image = info.image || "";
          cat = catFromDb(info.db);
        }
      }

      await addItem(v ? q + " " + v : q, image, q, v, ean, cat);
      await build();
      table.reload();
    };
    const bRefresh = toolRow.addButton("🔄");
    bRefresh.widthWeight = 15;
    bRefresh.centerAligned();
    bRefresh.onTap = async () => {
      providerErrors.clear();
      providerStats = {};          // Statistik je Lauf neu erheben

      /** Fortschritt in die laufende Liste schreiben. Die Zeile selbst ist nicht
          änderbar, deshalb wird die Liste neu aufgebaut – aber ohne eigene Ansicht,
          die Produkte bleiben stehen. Läufe werden serialisiert, damit sich zwei
          Neuaufbauten nicht überholen; Zwischenschritte dürfen dabei ausfallen. */
      let progressBusy = false;
      function renderProgress(done, total, stage) {
        refreshProgress = { done, total, stage };
        if (progressBusy) return;
        progressBusy = true;
        build()
          .then(() => table.reload())
          .catch(() => {})
          .then(() => { progressBusy = false; });
      }

      renderProgress(0, items.length, "Start");
      try {
        await refreshAll(true, {
          allSources: true,        // jedes Produkt bei jeder aktiven Quelle versuchen
          onProgress: renderProgress,
        });
      } finally {
        refreshProgress = null;    // Balken wieder ausblenden, auch bei Fehlern
      }

      // Kein Popup bei Erfolg – das Ergebnis steht direkt in der Liste.
      // Nur wenn eine Quelle nicht erreichbar war, gibt es einen Hinweis.
      const problems = [...providerErrors.entries()]
        .map(([id, msg]) => (PROVIDERS.find(p => p.id === id) || {}).name + ": " + msg);
      if (problems.length) {
        const a = new Alert();
        a.title = "Quelle nicht erreichbar";
        a.message = problems.join("\n");
        a.addAction("OK");
        await a.presentAlert();
      }
      await build();
      table.reload();
    };
    table.addRow(toolRow);

    // Fortschritt des Aktualisierens – als Zeile in der Liste, nicht als eigene
    // Ansicht: die Produkte bleiben sichtbar, der Balken sitzt unter der Werkzeugzeile.
    if (refreshProgress) {
      const { done, total, stage } = refreshProgress;
      const frac = total ? done / total : 0;
      const pr = new UITableRow();
      pr.height = LAYOUT.row(56);
      pr.backgroundColor = T.goodBg || T.row;
      const pi = pr.addImage(
        drawProgressBar(T, frac, `${stage}: ${done}/${total}  ·  ${Math.round(frac * 100)}%`));
      pi.widthWeight = 100;
      table.addRow(pr);
    }

    // Auswahlleiste – erscheint nur, wenn Export aktiv ist und Produkte markiert sind
    if (exportOn() && marked.size) {
      const selRow = new UITableRow();
      selRow.height = tapRow(44);
      selRow.backgroundColor = T.goodBg;

      const exp = selRow.addButton(`📋 ${marked.size} markierte exportieren`);
      exp.widthWeight = 72;
      exp.onTap = async () => {
        const entries = [];
        const missing = [];
        for (const q of marked) {
          const it = items.find(i => i.query === q);
          if (!it) continue;
          const label = itemLabel(it);
          const best = bestOf(q);
          const np = !best && normalPrice(q);
          if (best) entries.push({ name: label, price: best.price, advertiser: best.advertiser });
          else if (np) entries.push({ name: label, price: np.price, advertiser: np.advertiser || np.source });
          else missing.push(label);
        }
        const res = entries.length ? await exportToReminders(entries) : null;
        const a = new Alert();
        if (res) {
          a.title = "✅ Exportiert";
          a.message = `„${res.list}“: ${res.added} neu, ${res.updated} aktualisiert.`
            + (missing.length ? `\n\nOhne Preis übersprungen: ${missing.join(", ")}` : "");
        } else if (!entries.length) {
          a.title = "Kein Preis bekannt";
          a.message = "Zu den markierten Produkten liegt aktuell kein Preis vor.";
        } else {
          a.title = "Abgebrochen";
          a.message = "Keine Liste ausgewählt.";
        }
        a.addAction("OK");
        await a.presentAlert();
        if (res) { marked.clear(); await build(); table.reload(); }
      };

      const clr = selRow.addButton("✕ Auswahl aufheben");
      clr.widthWeight = 28;
      clr.rightAligned();
      clr.onTap = async () => { marked.clear(); await build(); table.reload(); };

      table.addRow(selRow);
    }

    if (debugOn() && PROVIDERS.some(p => debugDisabled(p.id))) {
      const dbg = new UITableRow();
      dbg.height = tapRow(38);
      dbg.backgroundColor = T.warnBg;
      const d = dbg.addButton("🐞 Debug: "
        + PROVIDERS.filter(p => debugDisabled(p.id)).map(p => p.name).join(", ") + " abgeschaltet");
      d.onTap = async () => { if (await editSettings()) { await refreshAll(false); await build(); table.reload(); } };
      table.addRow(dbg);
    }

    if (!configComplete()) {
      const warn = new UITableRow();
      warn.backgroundColor = T.warnBg;
      const w = warn.addButton("⚠️ PLZ und marktguru-Keys eintragen");
      w.onTap = async () => { if (await editSettings()) { await refreshAll(false); await build(); table.reload(); } };
      table.addRow(warn);
    }

    // Produktzeilen
    if (!shown.length) {
      const emptyTitle = items.length ? "Kein Treffer" : "Noch nichts beobachtet";
      const emptySub = !items.length
        ? "Mit ＋ Produkt starten – Suchbegriff eingeben oder Barcode erfassen."
        : ((listMode !== "all" || catFilter) && !filter
            ? (catFilter ? `Kein Produkt ist als „${catLabel(catFilter)}“ eingetragen.`
                : listMode === "noean" ? "Bei allen Produkten ist eine EAN hinterlegt."
                : "Aktuell hat kein beobachtetes Produkt ein Angebot.")
            : `Nichts passt zu „${filter}“.`);
      const empty = new UITableRow();
      empty.height = autoRowHeight(emptyTitle, 15, emptySub, 12, 100, tapRow(56));
      empty.backgroundColor = T.row;
      const e = empty.addText(emptyTitle, emptySub);
      e.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
      e.titleColor = T.text;
      e.subtitleFont = Font.systemFont(LAYOUT.font(12));
      e.subtitleColor = T.muted;
      table.addRow(empty);
    }

    // Spaltenaufteilung: auf schmalen iPhones entfällt ✏️ (steckt im Detail),
    // damit Produktname und Untertitel nicht abgeschnitten werden.
    const narrow = narrowView();
    const showCheck = exportOn();
    const wCheck = showCheck ? (narrow ? 11 : 9) : 0;
    const wImg = narrow ? 12 : imageColWeight();
    const wPrice = narrow ? 22 : Math.round(interpolate(LAYOUT.viewWidth(), [[428, 19], [744, 18], [1024, 17]]));
    const wInfo = 100 - wCheck - wImg - wPrice - (narrow ? (showCheck ? 16 : 10) : (showCheck ? 28 : 20));

    let idx = 0;
    // Karten statt Zeilen: eine Karte besteht aus zwei Zeilen mit gleichem
    // Hintergrund plus einer schmalen Lückenzeile in Seitenfarbe. Runde Ecken
    // kennt UITable nicht – die Trennung entsteht allein über die Farbe.
    const cards = cardsOn();

    // ── Mehrspaltige Kartenanordnung ──
    // Ab iPhone-Max-Breite passen zwei Produkte nebeneinander, im iPad-
    // Querformat drei. Eine UITable-Zeile kann nur flache Zellen aufnehmen,
    // deshalb besteht ein Produkt hier aus Bild, antippbarem Namen und Preis;
    // Bearbeiten und Löschen stecken im Detail.
    const cols = cards ? columns() : 1;
    if (cards && cols > 1 && shown.length) {
      const share = Math.floor(100 / cols);          // Breite je Produkt
      // Auf zwei Spalten reicht die Breite knapp: Bild kleiner, Preisspalte
      // größer, damit auch „1.299,99 €“ vollständig stehen bleibt.
      const wImgC = Math.max(5, Math.round(share * (cols > 2 ? 0.16 : 0.12)));
      const wPriceC = Math.round(share * (cols > 2 ? 0.34 : 0.42));
      const wNameC = share - wImgC - wPriceC;

      for (let i = 0; i < shown.length; i += cols) {
        const group = shown.slice(i, i + cols);
        const row = new UITableRow();
        row.height = tapRow(62);
        row.cellSpacing = 6;
        row.backgroundColor = T.row;
        row.dismissOnSelect = false;

        for (const item of group) {
          const best = bestOf(item.query);
          const np = normalPrice(item.query);
          const npHigher = best && freshNormalPrice(item.query) && np.price > best.price;

          const img = cachedImage(item);
          if (img) {
            const c = row.addImage(img);
            c.widthWeight = wImgC;
            c.centerAligned();
          } else {
            const c = row.addText("📦");
            c.widthWeight = wImgC;
            c.centerAligned();
            c.titleFont = Font.systemFont(LAYOUT.font(20));
            c.titleColor = T.muted;
          }

          // Der Name ist die Schaltfläche – großes Ziel, klarer Zweck.
          const nameBtn = row.addButton(item.query);
          nameBtn.widthWeight = wNameC;
          nameBtn.titleFont = Font.semiboldSystemFont(LAYOUT.font(15));
          nameBtn.titleColor = T.text;
          nameBtn.onTap = async () => { await rerender("detail", item); };

          const priceText = best ? eur(best.price) : (np ? eur(np.price) : "–");
          const price = row.addText(priceText,
            best ? (npHigher ? `statt ${eur(np.price)}` : best.advertiser)
                 : (np ? "üblicher Preis" : ""));
          price.widthWeight = wPriceC;
          price.rightAligned();
          price.titleFont = priceFont(priceText, 17, !!best);
          price.titleColor = best ? T.good : T.muted;
          price.subtitleFont = Font.systemFont(LAYOUT.font(10));
          price.subtitleColor = npHigher ? T.good : T.muted;
        }

        // Fehlende Produkte in der letzten Reihe auffüllen, damit die
        // vorhandenen nicht über die volle Breite auseinandergezogen werden
        for (let f = group.length; f < cols; f++) {
          const filler = row.addText("");
          filler.widthWeight = share;
        }

        table.addRow(row);
        gapRow(table, T, 8);
      }
    } else {

    for (const item of shown) {
      const best = bestOf(item.query);
      const np = normalPrice(item.query);
      // Vergleich nur mit einem jungen Normalpreis – ein Jahre alter Wert
      // würde eine Ersparnis ausweisen, die es so nicht gibt
      const npHigher = best && freshNormalPrice(item.query) && np.price > best.price;
      const isMarked = marked.has(item.query);
      const bg = (showCheck && isMarked) ? T.goodBg : T.row;

      /** Markierhaken – gleiche Zelle in beiden Darstellungen. */
      const addCheck = (row, w) => {
        // Ballot-Box-Zeichen statt Emoji: die Emoji-Variante (⬜️/☑️) wird je
        // nach iOS-Version/Theme nicht immer farbig gerendert und kann auf
        // hellem Grund praktisch unsichtbar sein.
        const chk = row.addButton(isMarked ? "☑" : "☐");
        chk.widthWeight = w;
        chk.centerAligned();
        chk.titleFont = Font.systemFont(LAYOUT.font(22));
        chk.titleColor = isMarked ? T.good : T.muted;
        chk.onTap = async () => {
          if (marked.has(item.query)) marked.delete(item.query); else marked.add(item.query);
          await build();
          table.reload();
        };
      };

      const addImage = (row, w) => {
        const img = cachedImage(item);   // nur Speicher/Datei -> Liste baut sofort auf
        if (img) {
          const cell = row.addImage(img);
          cell.widthWeight = w;
          cell.centerAligned();
        } else {
          const cell = row.addText("📦");
          cell.widthWeight = w;
          cell.centerAligned();
          cell.titleFont = Font.systemFont(LAYOUT.font(20));
          cell.titleColor = T.muted;
        }
      };

      const addEdit = (row, w) => {
        const edit = row.addButton("✏️");
        edit.widthWeight = w;
        edit.rightAligned();
        edit.onTap = async () => {
          if (await editItem(item)) { await build(); table.reload(); }
        };
      };

      const addDelete = (row, w) => {
        const del = row.addButton("🗑");
        del.widthWeight = w;
        del.rightAligned();
        del.onTap = async () => {
          const a = new Alert();
          a.title = "Löschen?";
          a.message = `„${item.query}“ nicht mehr beobachten.`;
          a.addDestructiveAction("Löschen");
          a.addCancelAction("Abbrechen");
          if (await a.presentAlert() === -1) return;
          removeItem(item.query);
          await build();
          table.reload();
        };
      };

      /** Zweite Zeile einer Karte: Details klein und gedämpft unter dem Namen. */
      const metaText = () => {
        if (best) {
          const v = validity(best);
          const r = priceRating(item.query, best.price);
          return [best.advertiser, (best.conditions || [])[0], v && v.text, r && r.label]
            .filter(Boolean).join("  ·  ");
        }
        if (!np) return "Aktuell kein Angebot";
        const age = normalAge(np);
        const r = priceRating(item.query, np.price);
        return ["Kein Angebot", np.source + (age && age.stale ? " (veraltet)" : ""),
          np.advertiser, formatDateDE(np.date), r && r.label].filter(Boolean).join("  ·  ");
      };

      const openDetail = (row) => {
        // WICHTIG: ohne dismissOnSelect=false schließt Scriptable die Tabelle beim Antippen
        row.dismissOnSelect = false;
        row.onSelect = async () => { await rerender("detail", item); };
      };

      if (cards) {
        // ── Kopfzeile: Bild, Name, Preis ──
        const head = new UITableRow();
        head.height = tapRow(narrow ? 58 : 56);   // ≥ 44 pt Trefferfläche
        head.cellSpacing = narrow ? 4 : 6;
        head.backgroundColor = bg;

        const W = cardWeights(showCheck);

        if (showCheck) addCheck(head, W.chk);
        addImage(head, W.img);

        const nameSub = item.variant || (item.ean ? "" : "keine EAN hinterlegt");
        head.height = Math.max(head.height,
          autoRowHeight(item.query, 16, nameSub, 11, W.name, tapRow(narrow ? 58 : 56)));
        const name = head.addText(item.query, nameSub);
        name.widthWeight = W.name;
        name.titleFont = Font.semiboldSystemFont(LAYOUT.font(16));
        name.titleColor = T.text;
        name.subtitleFont = Font.systemFont(LAYOUT.font(11));
        name.subtitleColor = T.muted;

        // Text vorher bilden – die Schriftgröße hängt an seiner Länge
        const priceText = best ? eur(best.price) : (np ? eur(np.price) : "–");
        const price = head.addText(
          priceText,
          best
            ? (npHigher ? `statt ${eur(np.price)}` : marketCount(activeOffers(item.query).length))
            : (np ? "üblicher Preis" : "")
        );
        price.widthWeight = W.price;
        price.rightAligned();
        price.titleFont = priceFont(priceText, best ? 19 : 17, !!best);
        price.titleColor = best ? T.good : T.muted;    // Angebot grün, Normalpreis grau
        price.subtitleFont = Font.systemFont(LAYOUT.font(10));
        price.subtitleColor = npHigher ? T.good : T.muted;
        openDetail(head);
        table.addRow(head);

        // ── Fußzeile: Händler, Laufzeit, Einschätzung – dazu die Schaltflächen ──
        const foot2 = new UITableRow();
        foot2.height = Math.max(TAP_MIN, LAYOUT.row(narrow ? 34 : 32));   // Stiftsymbol/Papierkorb
        foot2.cellSpacing = narrow ? 4 : 6;
        foot2.backgroundColor = bg;

        const lead = foot2.addText("");        // schiebt den Text unter den Namen
        lead.widthWeight = W.chk + W.img;

        const footText = metaText();
        const footW = 100 - lead.widthWeight - (narrow ? W.btn : W.btn * 2);
        foot2.height = autoRowHeight(footText, 12, "", 0, footW,
          Math.max(TAP_MIN, LAYOUT.row(narrow ? 34 : 32)));
        const line = foot2.addText(footText);
        line.widthWeight = footW;
        line.titleFont = Font.systemFont(LAYOUT.font(12));
        line.titleColor = T.muted;

        if (!narrow) addEdit(foot2, W.btn);
        addDelete(foot2, W.btn);
        openDetail(foot2);
        table.addRow(foot2);

        gapRow(table, T, 9);   // trennt die Karten optisch
      } else {
        // ── Klassische Zeile ──
        const row = new UITableRow();
        row.height = tapRow(narrow ? 66 : 62);
        row.cellSpacing = narrow ? 4 : 6;
        row.backgroundColor = (showCheck && isMarked) ? T.goodBg : ((idx % 2) ? T.rowAlt : T.row);
        idx++;

        if (showCheck) addCheck(row, wCheck);
        addImage(row, wImg);

        const infoTitle = (narrow && !item.variant)
          ? item.query : item.query + (item.variant ? "  ·  " + item.variant : "");
        const infoSub = narrow ? metaText().split("  ·  ").slice(0, 2).join(" · ") : metaText();
        row.height = autoRowHeight(infoTitle, 15, infoSub, 11, wInfo, tapRow(narrow ? 66 : 62));
        const info = row.addText(infoTitle, infoSub);
        info.widthWeight = wInfo;
        info.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
        info.titleColor = T.text;
        info.subtitleFont = Font.systemFont(LAYOUT.font(11));
        info.subtitleColor = T.muted;

        const price = row.addText(
          best ? eur(best.price) : (np ? eur(np.price) : "–"),
          best
            ? (npHigher ? `statt ${eur(np.price)}` : marketCount(activeOffers(item.query).length))
            : (np ? "üblicher Preis" : "")
        );
        price.widthWeight = wPrice;
        price.rightAligned();
        price.titleFont = priceFont(best ? eur(best.price) : (np ? eur(np.price) : "–"), 15, !!best);
        price.titleColor = best ? T.good : T.muted;
        price.subtitleFont = Font.systemFont(LAYOUT.font(10));
        price.subtitleColor = T.muted;

        if (!narrow) addEdit(row, 10);
        addDelete(row, 10);
        openDetail(row);
        table.addRow(row);
      }
    }
    }   // Ende der einspaltigen Darstellung

    // Rest der Höhe auffüllen, damit die Symbolleiste unten sitzt und
    // unter der Liste kein Streifen im Systemhintergrund stehen bleibt
    padToBottom(table, T, tapRow(46));

    addFooter(table, T);
    // Hinweis: „Alarm für alle Produkte“ steckt jetzt als Schalter
    // in den Einstellungen direkt unter der PLZ.
  }

  /**
   * Fuß – nur Symbole. Reihenfolge und Auswahl kommen aus den Einstellungen
   * (⚙︎ → Fußzeile), solange nichts eingestellt ist aus FOOTER_ICONS.
   * Eigene Funktion, weil auch die EAN-Ansichten damit enden.
   */
  function addFooter(table, T) {
    const foot = new UITableRow();
    foot.backgroundColor = T.row;

    /** Was hinter den Kennungen aus dem Fußzeilen-Katalog steckt. */
    const footerActions = {
      ean: {
        icon: () => "📦",
        tap: async () => { await rerender("ean"); },
      },
      savings: {
        icon: () => "💰",
        tap: async () => { await rerender("savings"); },
      },
      help: {
        icon: () => "❓",
        tap: async () => { helpTopic = null; await rerender("help"); },
      },
      compare: {
        icon: () => "🛒",
        tap: async () => { await rerender("compare"); },
      },
      category: {
        icon: () => catIcon(catFilter) + (catFilter ? " ✓" : ""),
        tap: async () => {
          catFilter = CAT_CYCLE[(CAT_CYCLE.indexOf(catFilter) + 1) % CAT_CYCLE.length];
          meta.catFilter = catFilter;
          touch("meta");
          flush();
          await build();
          table.reload();
        },
      },
      settings: {
        icon: () => "⚙︎",
        tap: async () => {
          if (await editSettings()) { await refreshAll(false); await build(); table.reload(); }
        },
      },
      theme: {
        icon: () => themeIcon(getThemeMode()),
        tap: async () => {
          setThemeMode(nextThemeMode(getThemeMode()));
          await build();
          table.reload();
        },
      },
    };

    const wanted = footerOrder().filter(id => footerActions[id]);

    if (wanted.length) {
      // Symbole rechtsbündig: der Rest der Breite bleibt als Abstand davor
      const each = Math.min(15, Math.floor(100 / (wanted.length + 1)));
      const lead = 100 - each * wanted.length;
      if (lead > 0) {
        const spacer = foot.addText("");
        spacer.widthWeight = lead;
      }
      wanted.forEach(id => {
        const a = footerActions[id];
        const b = foot.addButton(a.icon());
        b.widthWeight = each;
        b.centerAligned();
        b.onTap = a.tap;
      });
      table.addRow(foot);
    }
  }

  await build();
  // Solange diese Tabelle im Vollbild liegt, kann iOS kein Browser-Blatt
  // darüber einblenden – openURL() im EAN-Teil weicht dann nach Safari aus.
  uiPresented = true;
  try {
    await table.present(true);   // true = Vollbild (volle Höhe und Breite)
  } finally {
    uiPresented = false;
  }
}

// ─── Oberfläche: Produktdetail ───────────────────────────────────
async function buildDetail(table, T, item, rerender) {
  backRow(table, T, rerender);

  const offers = activeOffers(item.query);
  const npRef = normalPrice(item.query);            // immer, auch mit Angebot
  const np = offers.length ? null : npRef;          // Hero/Ersatzanzeige wie bisher

  // ── Kopf: nur Name und Sorte, keine Datenwurst ──
  headerRow(table, T, item.query,
    [item.variant ? "Sorte: " + item.variant : "", catLabel(item.cat)].filter(Boolean).join("  ·  "));

  // ── Großes Produktbild ──
  const bigImg = cachedImage(item) || await productImage(item);
  if (bigImg) {
    const imgRow = new UITableRow();
    // Im Querformat ist wenig Höhe da – dann kleiner, damit die Liste sichtbar bleibt
    imgRow.height = LAYOUT.heightFraction(LAYOUT.landscape() ? 0.32 : 0.25,
      Math.round(interpolate(LAYOUT.viewWidth(), [[375, 210], [428, 230], [744, 280], [1024, 340]])));
    imgRow.backgroundColor = T.row;
    const c = imgRow.addImage(bigImg);
    c.widthWeight = 100;
    c.centerAligned();
    table.addRow(imgRow);
  }

  // ── Aktueller Preis, groß und als Erstes ──
  const hero = new UITableRow();
  hero.backgroundColor = offers.length ? T.goodBg : T.row;
  const heroBest = offers.length ? offers[0] : null;
  const heroValid = heroBest ? validity(heroBest) : null;
  const heroTitle = heroBest ? "Bester Preis jetzt" : (np ? "Üblicher Preis" : "Kein Angebot");
  const heroSub = heroBest
    ? ["📍 " + heroBest.advertiser, heroValid ? "⏳ " + heroValid.text : ""].filter(Boolean).join("  ·  ")
    : (np ? [np.source, np.advertiser].filter(Boolean).join("  ·  ")
          : "Du wirst benachrichtigt, sobald eines erscheint.");
  const ht = hero.addText(heroTitle, heroSub);
  ht.widthWeight = textW(60);
  hero.height = autoRowHeight(heroTitle, 13, heroSub, 13, ht.widthWeight, LAYOUT.row(72));
  ht.titleFont = Font.systemFont(LAYOUT.font(13));
  ht.titleColor = T.muted;
  ht.subtitleFont = Font.mediumSystemFont(LAYOUT.font(13));
  ht.subtitleColor = heroValid && heroValid.urgent ? new Color("#e65100") : T.text;
  const heroText = heroBest ? eur(heroBest.price) : (np ? eur(np.price) : "–");
  const hp = hero.addText(heroText);
  hp.widthWeight = priceW(40);
  hp.rightAligned();
  hp.titleFont = priceFont(heroText, 26, true);
  hp.titleColor = heroBest ? T.good : T.muted;
  if (heroBest && heroBest.advertiser) {
    hero.dismissOnSelect = false;
    hero.onSelect = async () => { await showMarkets(heroBest.advertiser); };
  }
  table.addRow(hero);

  // ── Üblicher Preis als Vergleich, wenn ein Angebot läuft ──
  if (heroBest && npRef) {
    const age = normalAge(npRef);
    const usable = !age || !age.stale;
    const diff = npRef.price - heroBest.price;
    const pct = npRef.price > 0 ? Math.round((diff / npRef.price) * 100) : 0;
    const npMeta = [
      npRef.source,
      npRef.advertiser,
      age ? `${formatDateDE(npRef.date)} (${age.days} Tage alt)` : formatDateDE(npRef.date),
    ].filter(Boolean).join("  ·  ");
    const verdict = !usable
      ? "zu alt für einen Vergleich"
      : diff > 0 ? `${eur(diff)} gespart (−${pct} %)`
      : diff < 0 ? "Angebot liegt darüber"
      : "kein Preisvorteil";
    infoRow(table, T,
      `Üblicher Preis: ${eur(npRef.price)}`,
      verdict + "  ·  " + npMeta,
      usable && diff > 0 ? T.goodBg : undefined);
  }

  // ── Angebote ──
  if (offers.length) {
    const span = offers.length > 1
      ? `${eur(offers[0].price)} – ${eur(offers[offers.length - 1].price)}`
      : eur(offers[0].price);
    headerRow(table, T, `Angebote (${offers.length})`,
      `Preisspanne ${span}  ·  📍 antippen zeigt Filialen in der Nähe`);

    offers.forEach((o, i) => {
      const r = new UITableRow();
      // Angebotstexte sind oft lang; die Höhe wird unten aus dem Untertitel
      // berechnet, sobald Laufzeit und Bedingungen bekannt sind.
      r.backgroundColor = i === 0 ? T.goodBg : (i % 2 ? T.rowAlt : T.row);
      const v = validity(o);
      const cond = (o.conditions || []).join(" · ");
      const rest = withLogo(r, o.advertiser, 12);        // 100 ohne Logo, sonst 88

      // 📍 zeigt an, dass hinter dem Händler die Filialsuche liegt
      const t = r.addText(
        "📍 " + o.advertiser,
        [o.details || "", v ? "⏳ " + v.text : "", cond].filter(Boolean).join("  ·  ")
      );
      t.widthWeight = textW(Math.round(rest * 0.7));
      r.height = autoRowHeight("📍 " + o.advertiser, 15,
        [o.details || "", v ? v.text : "", cond].filter(Boolean).join("  ·  "),
        11, t.widthWeight, LAYOUT.row(66));
      t.titleFont = i === 0 ? Font.boldSystemFont(LAYOUT.font(15)) : Font.systemFont(LAYOUT.font(15));
      t.titleColor = T.text;
      t.subtitleFont = Font.systemFont(LAYOUT.font(11));
      t.subtitleColor = (v && v.urgent) ? new Color("#e65100") : T.muted;

      const p = r.addText(eur(o.price), i === 0 ? "günstigster" : "");
      p.widthWeight = rest - t.widthWeight;
      p.rightAligned();
      p.titleFont = Font.boldSystemFont(LAYOUT.font(15));
      p.titleColor = i === 0 ? T.good : T.text;
      p.subtitleFont = Font.systemFont(LAYOUT.font(10));
      p.subtitleColor = T.good;
      // Logo und Händlername sind Teil der Zeile – ein Tipp darauf öffnet
      // die Filialsuche. dismissOnSelect=false, sonst schlösse Scriptable
      // die Detailansicht dahinter.
      if (o.advertiser) {
        r.dismissOnSelect = false;
        r.onSelect = async () => { await showMarkets(o.advertiser); };
      }
      table.addRow(r);
    });
  } else if (np) {
    infoRow(table, T, "Aktuell kein Angebot", "Du wirst benachrichtigt, sobald es eines gibt.");
  }

  // ── Einschätzung ──
  // Ohne Angebot wird der letzte bekannte Preis eingeschätzt – dann sieht man,
  // wo der aktuelle Regalpreis im beobachteten Bereich liegt.
  const bestNow = offers.length ? offers[0].price : (npRef ? npRef.price : null);
  const rating = priceRating(item.query, bestNow);
  const freq = offerFrequency(item.query);
  if (rating || freq) {
    headerRow(table, T, "Einschätzung",
      offers.length ? "jetzt kaufen oder warten?" : "letzter Preis im beobachteten Bereich");
    if (rating) {
      const ratingSub = `bisher ${eur(rating.min)} – ${eur(rating.max)}  ·  Schnitt ${eur(rating.avg)}`;
      const row = new UITableRow();
      row.height = autoRowHeight(rating.label, 15, ratingSub, 11, 100, LAYOUT.row(58));
      row.backgroundColor = rating.level === "best" || rating.level === "good" ? T.goodBg
        : rating.level === "bad" ? T.warnBg : T.row;
      const t = row.addText(rating.label, ratingSub);
      t.widthWeight = 100;
      t.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
      t.titleColor = T.text;
      t.subtitleFont = Font.systemFont(LAYOUT.font(11));
      t.subtitleColor = T.muted;
      table.addRow(row);
    }
    if (freq) {
      infoRow(table, T,
        `Angebotstage: ${freq.days} von ${freq.span}`,
        freq.share >= 0.5
          ? "häufig im Angebot – auf die nächste Aktion warten ist meist unproblematisch"
          : "eher selten im Angebot – zugreifen lohnt sich"
      );
    }
  }

  // ── Preisverlauf ──
  headerRow(table, T, "Preisverlauf", "günstigster Preis je Tag");
  chartRow(table, T, chartHistory(item.query, T));

  // ── Statistik ──
  const be = bestEver(item.query);
  const hist = history[item.query] || [];
  if (be || hist.length) {
    headerRow(table, T, "Statistik",
      hist.length ? `beobachtet seit ${formatDateDE(hist[0].d)}  ·  ${hist.length} Preisstände` : "seit Beobachtungsbeginn");

    if (be) {
      const beSub = [be.a, formatDateDE(be.d)].filter(Boolean).join("  ·  ");
      const row = new UITableRow();
      row.height = autoRowHeight("🏅 Bester je gesehener Preis", 13, beSub, 11, textW(70), LAYOUT.row(52));
      row.backgroundColor = T.row;
      const t = row.addText("🏅 Bester je gesehener Preis", beSub);
      t.widthWeight = textW(70);
      t.titleFont = Font.systemFont(LAYOUT.font(13));
      t.titleColor = T.text;
      t.subtitleFont = Font.systemFont(LAYOUT.font(11));
      t.subtitleColor = T.muted;
      const p = row.addText(eur(be.p));
      p.widthWeight = priceW(30);
      p.rightAligned();
      p.titleFont = Font.boldSystemFont(LAYOUT.font(15));
      p.titleColor = T.good;
      table.addRow(row);
    }

    const recent = hist.slice(-5).reverse();
    if (recent.length > 1) {
      recent.forEach((e, i) => {
        const row = new UITableRow();
        row.height = LAYOUT.row(34);
        row.backgroundColor = cardsOn() ? T.row : ((i % 2) ? T.rowAlt : T.row);
        const t = row.addText(formatDateDE(e.d) + (e.a ? "  ·  " + e.a : ""));
        t.widthWeight = textW(70);
        t.titleFont = Font.systemFont(LAYOUT.font(11));
        t.titleColor = T.muted;
        const p = row.addText(eur(e.p));
        p.widthWeight = priceW(30);
        p.rightAligned();
        p.titleFont = Font.systemFont(LAYOUT.font(12));
        p.titleColor = T.text;
        table.addRow(row);
      });
    }
  }

  // ── Produktdaten: Einstellungen zum Produkt, gebündelt ans Ende ──
  headerRow(table, T, "Produktdaten", "was PreisApp für dieses Produkt sucht");

  /** Einheitliche Zeile: Bezeichnung, Wert, Aktionsknopf. */
  function dataRow(label, value, dim, btnText, onTap) {
    const row = new UITableRow();
    // Wächst mit dem Wert – „Food (Lebensmittel/Getränke)“ oder ein langer
    // Suchbegriff passte in die feste Höhe nicht mehr.
    row.height = autoRowHeight(label, 12, value, 13, 70, LAYOUT.row(48));
    row.backgroundColor = T.row;
    const t = row.addText(label, value);
    t.widthWeight = 70;
    t.titleFont = Font.systemFont(LAYOUT.font(12));
    t.titleColor = T.muted;
    t.subtitleFont = Font.mediumSystemFont(LAYOUT.font(13));
    t.subtitleColor = dim ? T.muted : T.text;
    const b = row.addButton(btnText);
    b.widthWeight = 30;
    b.rightAligned();
    b.onTap = onTap;
    table.addRow(row);
  }

  dataRow("Suchbegriff", searchTermOf(item)
    + (item.variant ? "  ·  Sorte „" + item.variant + "“" : ""), false,
    narrowView() ? "✏️ Ändern" : "✏️ Bearbeiten",
    async () => { if (await editItem(item)) await rerender("detail"); });

  dataRow("EAN", item.ean ? item.ean : "nicht hinterlegt", !item.ean, "✏️ Ändern",
    async () => { if (await editItem(item)) await rerender("detail"); });

  dataRow("Warenart", catLabel(item.cat), !item.cat, "🏷️ Ändern", async () => {
    const a = new Alert();
    a.title = "Warenart";
    a.message = `„${item.query}“ – aktuell: ${catLabel(item.cat)}`;
    CATS.forEach(c => a.addAction(c.short));
    a.addDestructiveAction("unbestimmt");
    a.addCancelAction("Abbrechen");
    const choice = await a.presentAlert();
    if (choice === -1) return;
    item.cat = choice < CATS.length ? CATS[choice].id : "";
    stampItem(item);
    saveItems();
    await rerender("detail");
  });

  dataRow("Preisalarm", item.alarm === false ? "aus" : "an", item.alarm === false,
    item.alarm === false ? "🔕 Einschalten" : "🔔 Ausschalten", async () => {
      item.alarm = item.alarm === false;
      stampItem(item);
      saveItems();
      await rerender("detail");
    });
}

// ─── Oberfläche: Ersparnis ───────────────────────────────────────
// Vergleicht den aktuellen Bestpreis mit dem Vergleichswert aus dem eigenen
// Verlauf (75-%-Wert der letzten 90 Tage). Eine externe Preisquelle gibt es
// nicht – das ist also eine Schätzung aus eigener Beobachtung, keine Abrechnung.

async function buildSavings(table, T, rerender) {
  backRow(table, T, rerender);
  headerRow(table, T, "Ersparnis", `Bestpreis gegen den üblichen Preis der letzten ${NORMAL_WINDOW_D} Tage`);

  // Je Produkt: laufendes Angebot und bekannter Vergleichspreis
  const rows = [];
  for (const item of items) {
    const best = bestOf(item.query);
    const np = freshNormalPrice(item.query);   // veraltete Werte taugen nicht zum Rechnen
    if (!best || !np || np.price <= best.price) continue;
    rows.push({
      item, best, np,
      diff: np.price - best.price,
      pct: (np.price - best.price) / np.price,
    });
  }
  rows.sort((a, b) => b.diff - a.diff);

  if (!rows.length) {
    infoRow(table, T, "Noch keine Ersparnis berechenbar",
      "Dafür braucht es ein laufendes Angebot und einen bekannten Normalpreis.");
    infoRow(table, T, "So kommt der Vergleichswert zustande",
      `Aus dem eigenen Verlauf: der 75-%-Wert der letzten ${NORMAL_WINDOW_D} Tage, also der übliche obere Preis ohne Ausreißer. Älter als ${NORMAL_MAX_AGE_D} Tage wird nicht mehr verglichen.`, T.rowAlt);
    return;
  }

  const sum = rows.reduce((a, r) => a + r.diff, 0);
  const sumNormal = rows.reduce((a, r) => a + r.np.price, 0);

  // Kopfzahl
  const saveSub = `${rows.length} von ${items.length} Produkten im Angebot  ·  ${Math.round(sum / sumNormal * 100)} % unter Normalpreis`;
  const hero = new UITableRow();
  hero.height = autoRowHeight("Wenn du jetzt alles kaufst", 13, saveSub, 12, textW(58), LAYOUT.row(72));
  hero.backgroundColor = T.goodBg;
  const ht = hero.addText("Wenn du jetzt alles kaufst", saveSub);
  ht.widthWeight = textW(58);
  ht.titleFont = Font.systemFont(LAYOUT.font(13));
  ht.titleColor = T.muted;
  ht.subtitleFont = Font.mediumSystemFont(LAYOUT.font(12));
  ht.subtitleColor = T.text;
  const sumText = "− " + eur(sum);
  const hp = hero.addText(sumText);
  hp.widthWeight = priceW(42);
  hp.rightAligned();
  hp.titleFont = priceFont(sumText, 26, true);
  hp.titleColor = T.good;
  table.addRow(hero);

  // Je Produkt
  headerRow(table, T, "Je Produkt", "größte Ersparnis zuerst");
  const cards = cardsOn();
  rows.forEach((r, i) => {
    const rowSub = `${eur(r.best.price)} statt ${eur(r.np.price)}  ·  ${r.best.advertiser}`;
    const row = new UITableRow();
    row.height = autoRowHeight(itemLabel(r.item), cards ? 15 : 14, rowSub, 11,
      textW(66), LAYOUT.row(cards ? 54 : 58));
    row.backgroundColor = cards ? T.row : ((i % 2) ? T.rowAlt : T.row);
    row.dismissOnSelect = false;
    row.onSelect = async () => { await rerender("detail", r.item); };

    const t = row.addText(itemLabel(r.item), rowSub);
    t.widthWeight = textW(66);
    t.titleFont = cards ? Font.semiboldSystemFont(LAYOUT.font(15)) : Font.systemFont(LAYOUT.font(14));
    t.titleColor = T.text;
    t.subtitleFont = Font.systemFont(LAYOUT.font(11));
    t.subtitleColor = T.muted;

    const diffText = "− " + eur(r.diff);
    const p = row.addText(diffText, Math.round(r.pct * 100) + " %");
    p.widthWeight = priceW(34);
    p.rightAligned();
    p.titleFont = priceFont(diffText, cards ? 17 : 15, true);
    p.titleColor = T.good;
    p.subtitleFont = Font.systemFont(LAYOUT.font(10));
    p.subtitleColor = T.good;
    table.addRow(row);
    if (cards) gapRow(table, T, 7);
  });

  // Bestwerte aus dem Verlauf
  const potential = [];
  for (const item of items) {
    const be = bestEver(item.query);
    const np = freshNormalPrice(item.query);
    if (!be || !np || np.price <= be.p) continue;
    potential.push({ item, diff: np.price - be.p, be, np });
  }
  potential.sort((a, b) => b.diff - a.diff);

  if (potential.length) {
    headerRow(table, T, "Bestwerte im Verlauf",
      `größte je gesehene Ersparnis  ·  bis zu ${HISTORY_DAYS} Tage`);
    potential.slice(0, 5).forEach((r, i) => {
      const potSub = `Bestpreis ${eur(r.be.p)} am ${formatDateDE(r.be.d)}`;
      const row = new UITableRow();
      row.height = autoRowHeight(itemLabel(r.item), 13, potSub, 11, textW(70), LAYOUT.row(46));
      row.backgroundColor = cardsOn() ? T.row : ((i % 2) ? T.rowAlt : T.row);
      const t = row.addText(itemLabel(r.item), potSub);
      t.widthWeight = textW(70);
      t.titleFont = Font.systemFont(LAYOUT.font(13));
      t.titleColor = T.text;
      t.subtitleFont = Font.systemFont(LAYOUT.font(11));
      t.subtitleColor = T.muted;
      const p = row.addText("− " + eur(r.diff));
      p.widthWeight = priceW(30);
      p.rightAligned();
      p.titleFont = Font.mediumSystemFont(LAYOUT.font(14));
      p.titleColor = T.good;
      table.addRow(row);
    });
  }

  infoRow(table, T, "Wie das gerechnet wird",
    `Vergleichswert ist der zuletzt selbst beobachtete Preis. Älter als ${NORMAL_MAX_AGE_D} Tage wird nicht mehr verglichen.`,
    T.bg);
}

// ─── Oberfläche: Einrichtung & Hilfe ─────────────────────────────
// Erklärt die Symbole und Funktionen. Bewusst eine eigene Ansicht statt
// Tooltips: In einer UITable gibt es keine Hilfetexte an den Knöpfen.

// Gewähltes Hilfe-Thema (null = Übersichtsmenü).
let helpTopic = null;

// Aufgeklappte Version in der Änderungshistorie (null = alle eingeklappt).
let openChangelogVersion = null;

async function buildHelp(table, T, rerender) {
  // UITable bricht Text nicht um: alles, was nicht in EINE Zeile passt, wird
  // abgeschnitten. Daher kurze Titel, Erklärungen als eigene Zeile darunter.
  let alt = false;
  const nextBg = () => (alt = !alt) ? T.row : T.rowAlt;

  /**
   * Grundform aller Hilfezeilen: Marke links (Symbol, Nummer oder „!“),
   * Bezeichnung und Kurztext rechts. iconRow, stepRow und warnRow
   * unterscheiden sich nur in Schrift und Farbe der Marke.
   */
  function markerRow(marker, title, text, opts) {
    const o = opts || {};
    const row = new UITableRow();
    row.height = autoRowHeight(title, 14, text, 11, 86, LAYOUT.row(o.height || (text ? 50 : 42)));
    row.backgroundColor = o.bg || nextBg();
    const m = row.addText(marker);
    m.widthWeight = 14;
    m.centerAligned();
    m.titleFont = o.markerFont || Font.systemFont(LAYOUT.font(19));
    m.titleColor = o.markerColor || T.text;
    const t = row.addText(title, text || "");
    t.widthWeight = 86;
    t.titleFont = Font.mediumSystemFont(LAYOUT.font(14));
    t.titleColor = T.text;
    t.subtitleFont = Font.systemFont(LAYOUT.font(11));
    t.subtitleColor = T.muted;
    table.addRow(row);
  }

  /** Symbol links, Bezeichnung und Kurztext rechts. */
  function iconRow(icon, title, text, bg) {
    markerRow(icon, title, text, { bg });
  }

  /** Eingerückte Folgezeile – gleiche Farbe wie die Zeile darüber. */
  function noteRow(text) {
    const row = new UITableRow();
    row.height = autoRowHeight("– " + text, 11, "", 0, 86, LAYOUT.row(28), 4);
    row.backgroundColor = alt ? T.row : T.rowAlt;
    const pad = row.addText("");
    pad.widthWeight = 14;
    const t = row.addText("– " + text);
    t.widthWeight = 86;
    t.titleFont = Font.systemFont(LAYOUT.font(11));
    t.titleColor = T.muted;
    table.addRow(row);
  }

  /** Nummerierter Schritt. */
  function stepRow(nr, title, text) {
    markerRow(String(nr), title, text, {
      height: 50,
      markerFont: Font.boldSystemFont(LAYOUT.font(18)),
      markerColor: T.accent,
    });
  }

  /** Warnung – farbig hinterlegt, damit Fehlerquellen auffallen. */
  function warnRow(title, text) {
    markerRow("!", title, text, {
      bg: T.warnBg,
      markerFont: Font.boldSystemFont(LAYOUT.font(19)),
      markerColor: new Color("#a3690a"),
    });
    alt = false;   // die nächste Zeile beginnt den Wechsel neu
  }

  /** Einleitungstext eines Abschnitts. */
  function leadRow(text) {
    const row = new UITableRow();
    row.height = autoRowHeight(text, 12, "", 0, 100, LAYOUT.row(34), 4);
    row.backgroundColor = T.bg;
    const t = row.addText(text);
    t.titleFont = Font.systemFont(LAYOUT.font(12));
    t.titleColor = T.muted;
    table.addRow(row);
  }

  // ── Übersichtsmenü ──
  if (!helpTopic) {
    backRow(table, T, rerender);
    headerRow(table, T, "Einrichtung & Hilfe", "Thema auswählen");

    const topics = [
      ["symbols", "🧭", "Symbole der App", "Was die Knöpfe bedeuten"],
      ["functions", "⚙️", "Funktionen", "Alarm, EAN, Verlauf, Einschätzung"],
      ["sources", "📰", "Woher die Preise kommen", "marktguru"],
      ["setup", "🚀", "Ersteinrichtung", "PLZ, Keys, erstes Produkt"],
      ["shared", "👥", "Geteilter Ordner", "Mit zweiter Apple-ID teilen"],
      ["off", "🏷️", "EAN und Barcode", "Abgleich, Anlegen, eigene Einträge"],
      ["changes", "📜", "Änderungen", "Was in welcher Fassung dazukam"],
    ];
    topics.forEach(([id, icon, title, sub]) => {
      const row = new UITableRow();
      row.height = autoRowHeight(title, 15, sub, 11, 78, tapRow(54));
      row.backgroundColor = nextBg();
      row.dismissOnSelect = false;
      const i = row.addText(icon);
      i.widthWeight = 14;
      i.centerAligned();
      i.titleFont = Font.systemFont(LAYOUT.font(20));
      const t = row.addText(title, sub);
      t.widthWeight = 78;
      t.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
      t.titleColor = T.text;
      t.subtitleFont = Font.systemFont(LAYOUT.font(11));
      t.subtitleColor = T.muted;
      const c = row.addText("›");
      c.widthWeight = 8;
      c.titleFont = Font.systemFont(LAYOUT.font(15));
      c.rightAligned();
      c.titleColor = T.muted;
      row.onSelect = async () => { helpTopic = id; await rerender("help"); };
      table.addRow(row);
    });

    // Über PreisApp – Icon + Versionsstand
    const about = new UITableRow();
    about.height = autoRowHeight("PreisApp – Angebote & Preisalarm", 15,
      `Version ${APP_VERSION}  ·  ${APP_COPYRIGHT}`, 11, 76, LAYOUT.row(92));
    about.backgroundColor = T.bg;
    const aboutImg = preisAppIcon();
    if (aboutImg) {
      const ai = about.addImage(aboutImg);
      ai.widthWeight = 24;
    }
    const at = about.addText(
      "PreisApp – Angebote & Preisalarm",
      `Version ${APP_VERSION}  ·  ${APP_COPYRIGHT}`
    );
    at.widthWeight = 76;
    at.titleFont = Font.boldSystemFont(LAYOUT.font(15));
    at.titleColor = T.text;
    at.subtitleFont = Font.systemFont(LAYOUT.font(11));
    at.subtitleColor = T.accent;
    table.addRow(about);

    // Rechtliches am Fuß der Übersicht
    const legal = new UITableRow();
    legal.height = autoRowHeight(`PreisApp ${APP_VERSION}  ·  ${APP_COPYRIGHT}`, 11,
      "Privater Eigengebrauch · ohne Gewähr · maßgeblich ist der Preis im Markt",
      10, 100, LAYOUT.row(58), 3);
    legal.backgroundColor = T.bg;
    const lg = legal.addText(
      `PreisApp ${APP_VERSION}  ·  ${APP_COPYRIGHT}`,
      "Privater Eigengebrauch · ohne Gewähr · maßgeblich ist der Preis im Markt"
    );
    lg.titleFont = Font.systemFont(LAYOUT.font(11));
    lg.titleColor = T.muted;
    lg.subtitleFont = Font.systemFont(LAYOUT.font(10));
    lg.subtitleColor = T.muted;
    lg.centerAligned();
    table.addRow(legal);

    const credits = new UITableRow();
    const crTitle = `Angebote: marktguru · Ladenpreise: Open Prices (ODbL) · EAN-Teil ${EAN_VERSION}`;
    const crSub = "Produktdaten: Open Food Facts (ODbL) · Barcode: ZXing (Apache 2.0) · Logos: Marken der Händler";
    credits.height = autoRowHeight(crTitle, 10, crSub, 10, 100, tapRow(44), 3);
    credits.backgroundColor = T.bg;
    const cr = credits.addText(crTitle, crSub);
    cr.titleFont = Font.systemFont(LAYOUT.font(10));
    cr.titleColor = T.muted;
    cr.subtitleFont = Font.systemFont(LAYOUT.font(10));
    cr.subtitleColor = T.muted;
    cr.centerAligned();
    table.addRow(credits);
    return;
  }

  // ── Unterseite: zurück ins Themenmenü ──
  const back = new UITableRow();
  back.height = tapRow(44);
  back.backgroundColor = T.bg;
  const bb = back.addButton("‹ Alle Themen");
  bb.onTap = async () => {
    helpTopic = null;
    openChangelogVersion = null;
    await rerender("help");
  };
  table.addRow(back);

  if (helpTopic === "symbols") {
    headerRow(table, T, "Obere Zeile", "");
    iconRow("🔍", "Suchen", "Name, Sorte, Händler, Angebotstext");
    noteRow("✓ am Symbol = Suche aktiv");
    iconRow("🏷️", "Angebots-Filter", "Alle → nur Angebote → ohne EAN");
    noteRow("Zahl in Klammern = Treffer");
    iconRow("＋", "Produkt hinzufügen", "Suchbegriff oder Barcode");
    iconRow("🔄", "Aktualisieren", "Alle Quellen sofort neu abrufen");
    noteRow("Automatisch, wenn älter als 3 Stunden");

    headerRow(table, T, "Untere Zeile", "");
    iconRow("📦", "Meine EAN-Einträge", "Eigene Nummern, Stand holen, Foto senden");
    iconRow("💰", "Ersparnis", "Bestpreis gegen Normalpreis");
    iconRow("🛒", "Warenkorb-Vergleich", "Ganzer Einkauf je Markt gerechnet");
    iconRow("🛍", "Warenart-Filter", "Alle → 🍎 Food → 🧽 Non-Food → 🐶 Pet");
    iconRow("⚙︎", "Einstellungen", "PLZ, Keys, Alarm, Export, Speicherort");
    iconRow("◐", "Darstellung", "◐ automatisch → ☀︎ hell → ☾ dunkel");
    iconRow("❓", "Diese Seite", "Hilfe und Einrichtung");
    noteRow("Reihenfolge und Auswahl: ⚙︎ Einstellungen → 🦶 Fußzeile");
    noteRow("⚙︎ bleibt immer sichtbar – sonst gäbe es keinen Weg zurück");

    headerRow(table, T, "In der Produktliste", "");
    iconRow("☐", "Markieren", "Auswahl für den Export");
    noteRow("Nur sichtbar, wenn Export eingeschaltet ist");
    iconRow("📋", "Exportieren", "Eine Erinnerung je Produkt");
    noteRow("Titel: Produkt · Sorte, Notiz: Preis · Anbieter");
    iconRow("👆", "Zeile antippen", "Einzelheiten zum Produkt");
    return;
  }

  if (helpTopic === "functions") {
    leadRow("Was im Hintergrund passiert.");
    iconRow("🔔", "Preisalarm", "Mitteilung bei neuen Angeboten");
    noteRow("Neu = Händler und Preis noch nie gesehen");
    noteRow("Je Produkt oder für alle in den Einstellungen");
    iconRow("🔢", "EAN-Abgleich", "Prüfziffer und Datenbanksuche");
    noteRow("Food, Products, Beauty und Pet Food Facts");
    noteRow("Fehlende EAN lässt sich selbst anlegen");
    iconRow("📈", "Einschätzung", "Vergleich mit allen bisherigen Preisen");
    noteRow("🟢 Bestpreis · 🟡 durchschnittlich · 🔴 eher teuer");
    noteRow("Erst ab 3 erfassten Preisständen");
    iconRow("📊", "Preisverlauf", "Günstigster Preis je Tag");
    noteRow("Bis zu 60 Tage werden gespeichert");
    iconRow("☁️", "Abgleich der Geräte", "Produkte liegen in iCloud");
    noteRow("Zusammengeführt statt überschrieben");
    iconRow("💰", "Ersparnis", "Was Angebote gegenüber Normalpreis bringen");
    noteRow("Nur Produkte mit Angebot UND bekanntem Normalpreis");
    noteRow("Eine Schätzung, keine Abrechnung");
    iconRow("🚫", "Händler ausschließen", "Einstellungen → Händler ausschließen");
    noteRow("Deren Angebote werden überall ausgeblendet");
    iconRow("🐞", "Debug-Modus", "Quellen einzeln abschalten");
    noteRow("Einstellungen → Debug-Modus einschalten");
    noteRow("Zeigt Treffer, Dauer und Fehler je Quelle");
    noteRow("Warnhinweis in der Liste, solange etwas aus ist");
    iconRow("💾", "Sicherung", "Kopie der Produktliste im Ordner backups");
    noteRow("Die letzten 10 bleiben erhalten");
    noteRow("Vor dem Wiederherstellen wird automatisch gesichert");
    return;
  }

  if (helpTopic === "sources") {
    leadRow("Zwei Preisquellen, dazu die eigene Beobachtung.");
    iconRow("📰", "marktguru", "Prospektangebote fast aller Ketten");
    noteRow("Aldi, Lidl, Edeka, Penny … – braucht die Keys");
    noteRow("Aktionspreise, keine Regalpreise");
    iconRow("💶", "Open Prices", "Gemeldete Ladenpreise über die EAN");
    noteRow("Schwesterprojekt von Open Food Facts, Daten unter ODbL");
    noteRow("Median der jüngsten Meldungen, nur Euro, höchstens ein Jahr alt");
    iconRow("🌍", "Open Food Facts", "Produktname und Bild über die EAN");
    noteRow("Liefert keine Preise – nur Produktdaten");

    headerRow(table, T, "Vergleichswert", "woher das „statt …“ kommt");
    stepRow(1, "Eigener Verlauf", `75-%-Wert der letzten ${NORMAL_WINDOW_D} Tage`);
    noteRow("Der übliche obere Preis, ohne einzelne Ausreißer");
    noteRow("Ein laufendes Angebot zählt für sich selbst nicht mit");
    stepRow(2, "Open Prices", "Wenn der Verlauf noch zu dünn ist");
    noteRow("Braucht eine EAN am Produkt");
    stepRow(3, "Zuletzt gesehen", "Notlösung aus ein bis zwei Beobachtungen");
    noteRow("Im Debug-Modus steht, woher die Standardpreise kommen");
    return;
  }

  if (helpTopic === "setup") {
    leadRow("Einmalig nötig, damit Angebote gefunden werden.");
    stepRow(1, "PLZ eintragen", "In den Einstellungen (⚙︎)");
    noteRow("Bestimmt, welche Märkte abgefragt werden");
    stepRow(2, "marktguru-Keys hinterlegen", "x-clientkey und x-apikey");
    noteRow("marktguru.de am PC → F12 → Netzwerk");
    noteRow("Produkt suchen → Request an api.marktguru.de");
    noteRow("Beide Header kopieren und eintragen");
    stepRow(3, "Erstes Produkt anlegen", "Über ＋");
    noteRow("Breit suchen: „Vernel Weichspüler“");
    noteRow("Sorte separat: „Sensitiv“");
    stepRow(4, "Optional: OFF-Konto", "Nur zum Anlegen fehlender EANs");
    stepRow(5, "Automation für den Abruf", "Kurzbefehle-App → Automation");
    noteRow("Tageszeit wählen, z. B. stündlich 7–20 Uhr");
    noteRow("Aktion: Skript ausführen → PreisApp");
    noteRow("Das Widget selbst ruft nicht ab – es zeigt den letzten Stand");
    return;
  }

  if (helpTopic === "shared") {
    leadRow("Produkte mit einer zweiten Apple-ID teilen.");
    infoRow(table, T, "Wozu das gut ist",
      "Ohne Freigabe sieht jede Apple-ID nur ihre eigenen Produkte.");
    noteRow("Fünf Schritte, danach teilen beide Geräte alles");

    headerRow(table, T, "Teil 1: Ordner freigeben", "einmalig, auf einem Gerät");
    stepRow(1, "Ordner anlegen", "Dateien-App → Durchsuchen → iCloud Drive");
    noteRow("Name frei wählbar, z. B. „PreisApp-Geteilt“");
    noteRow("Muss in iCloud Drive liegen, nicht lokal");
    stepRow(2, "Ordner freigeben", "Gedrückt halten → Teilen → Personen einladen");
    noteRow("Berechtigung: „Kann Änderungen vornehmen“");
    noteRow("Mit „Nur ansehen“ speichert das 2. Gerät nichts");
    stepRow(3, "Einladung annehmen", "Auf dem zweiten Gerät akzeptieren");
    noteRow("Danach steht der Ordner dort unter „Geteilt“");

    headerRow(table, T, "Teil 2: Bookmark setzen", "auf JEDEM Gerät einzeln");
    infoRow(table, T, "Warum das nötig ist",
      "Scriptable darf sonst nur in seinen eigenen Ordner schreiben.");
    noteRow("Das Bookmark gilt lokal – wird nie mitübertragen");
    stepRow(4, "Bookmark anlegen", "Scriptable-App öffnen, nicht das Skript");
    noteRow("Zahnrad oben links → „File Bookmarks“ → „+“");
    noteRow("„Pick Folder“ wählen – nicht „Pick File“");
    noteRow("Geteilten Ordner öffnen, oben rechts bestätigen");
    noteRow("Name eintragen: PreisAppShared → sichern");
    stepRow(5, "Skript übertragen", "PreisApp.js auf das zweite Gerät");
    noteRow("PLZ und Keys dort einmal neu eintragen");

    headerRow(table, T, "Beim Namen aufpassen", "");
    warnRow("Ein Wort, keine Leerzeichen", "Nicht „PreisApp Shared“");
    warnRow("Groß-/Kleinschreibung zählt", "Großes P, großes A, großes S");
    warnRow("Kein Bindestrich", "Nicht „PreisApp-Shared“");
    noteRow("Bei Abweichung nutzt die App still ihren eigenen Ordner");

    headerRow(table, T, "Kontrolle", "");
    iconRow("👥", "Status prüfen", "Einstellungen ganz unten");
    noteRow("„Geteilter Ordner aktiv“ = alles richtig");
    noteRow("„iCloud-Abgleich aktiv“ = Bookmark fehlt");
    iconRow("🔀", "Gleichzeitige Änderungen", "Werden zusammengeführt");
    noteRow("Gleiches Produkt: neuere Änderung gewinnt");
    noteRow("Löschungen wirken auf beiden Geräten");
    iconRow("🔑", "Nicht geteilt", "PLZ, Keys und OFF-Login");
    noteRow("Die liegen im Schlüsselbund des Geräts");
    iconRow("⏳", "Nichts kommt an?", "iCloud braucht einen Moment");
    noteRow("Ordner in der Dateien-App öffnen stößt es an");

    headerRow(table, T, "Häufige Fehler", "");
    warnRow("Nur auf einem Gerät gesetzt", "Das andere arbeitet für sich weiter");
    warnRow("Datei statt Ordner gewählt", "Es muss der Ordner selbst sein");
    warnRow("Einladung noch nicht angenommen", "Ordner fehlt sonst im Dateiwähler");
    iconRow("↺", "Bookmark ändern/löschen", "In derselben Liste per Wischen");
    noteRow("Danach nutzt die App wieder ihren eigenen Ordner");
    return;
  }

  if (helpTopic === "off") {
    leadRow("Barcode-Nummern erledigt diese App selbst – ein zweites Skript "
      + "ist dafür nicht mehr nötig.");
    infoRow(table, T, "Wann läuft der Abgleich?",
      "Beim Scannen, beim Eintippen und beim Nachtragen einer EAN. Steht die Nummer in einer Datenbank, geht es ohne Rückfrage weiter.");
    eanNoteRow(table, T, "Gefundene Nummern werden " + EAN_CACHE_D + " Tage gemerkt");
    eanNoteRow(table, T, "Leeren in den Einstellungen unter „EAN-Zwischenspeicher“");

    headerRow(table, T, "Datenbanken", "In dieser Reihenfolge wird gesucht");
    OFF_DBS.forEach((db, i) => infoRow(table, T, (i + 1) + ". " + db.label, db.base.replace("https://", "")));
    eanNoteRow(table, T, "Alle vier werden gleichzeitig gefragt – steht die Nummer mehrfach, fragt die App nach");

    headerRow(table, T, "Was möglich ist", "");
    iconRow("🔢", "Prüfziffer", "Zahlendreher fallen sofort auf");
    iconRow("➕", "Anlegen", "Fehlende Produkte bei Open Food Facts eintragen");
    noteRow("Dafür ist ein kostenloses Konto nötig – Login in den Einstellungen");
    iconRow("📷", "Foto senden", "Vorderseite, Zutaten oder Nährwerte");
    noteRow("Nur eigene Aufnahmen – hochgeladene Bilder stehen unter CC BY-SA");
    iconRow("📦", "Meine Einträge", "Symbol in der Fußzeile");
    noteRow("Bearbeiten, Stand holen, Foto senden, Datenbank wechseln");
    noteRow("⬇︎ holt Produkte, die schon unter deinem Konto stehen");

    headerRow(table, T, "Ablauf", "");
    stepRow(1, "Scannen oder eintippen", "Über ＋ in der Produktliste");
    stepRow(2, "Abgleich läuft still", "Bekannte Nummern gehen direkt weiter");
    stepRow(3, "Nur wenn unbekannt", "Korrigieren, anlegen, Foto senden");
    stepRow(4, "Weiter in der Liste", "Produkt anlegen oder EAN nachtragen");

    headerRow(table, T, "Häufige Fehler", "");
    warnRow("E-Mail statt Benutzername", "Open Food Facts lehnt die Anmeldung ab");
    warnRow("Frisch angelegt, nicht gefunden", "Der gemerkte Fehlschlag von vorher");
    noteRow("Im Dialog „Ohne Zwischenspeicher neu abfragen“ wählen");
    warnRow("Nachladen bleibt leer", "Der Benutzername muss genau dem Konto entsprechen");
    noteRow("Neue Produkte erscheinen in der Übersicht dort oft verzögert");
    warnRow("Eintrag löschen geht nicht", "In der Datenbank bleibt er bestehen");
    noteRow("Aus der eigenen Liste entfernen geht – überschreiben auch");
    return;
  }

  if (helpTopic === "changes") {
    leadRow("Neueste Fassung zuerst – Version antippen für Details.");
    CHANGELOG.forEach((v, i) => {
      const open = openChangelogVersion === v.version;
      const head = new UITableRow();
      head.height = autoRowHeight("Version " + v.version, 14,
        [v.date, v.note].filter(Boolean).join("  ·  "), 11, 90, tapRow(46));
      head.backgroundColor = nextBg();
      head.dismissOnSelect = false;
      const arrow = head.addText(open ? "▾" : "▸");
      arrow.widthWeight = 10;
      arrow.centerAligned();
      arrow.titleFont = Font.systemFont(LAYOUT.font(15));
      arrow.titleColor = T.accent;
      const ht = head.addText(
        "Version " + v.version + (i === 0 ? "  ·  aktuell" : ""),
        [v.date, v.note].filter(Boolean).join("  ·  "));
      ht.widthWeight = 90;
      ht.titleFont = Font.mediumSystemFont(LAYOUT.font(14));
      ht.titleColor = T.text;
      ht.subtitleFont = Font.systemFont(LAYOUT.font(11));
      ht.subtitleColor = T.muted;
      head.onSelect = async () => {
        openChangelogVersion = open ? null : v.version;
        await rerender("help");
      };
      table.addRow(head);
      if (!open) return;
      v.changes.forEach(c => {
        const row = new UITableRow();
        row.height = autoRowHeight(c, 12, "", 0, 90, LAYOUT.row(34), 5);
        row.backgroundColor = nextBg();
        const b = row.addText("•");
        b.widthWeight = 10;
        b.titleFont = Font.systemFont(LAYOUT.font(13));
        b.centerAligned();
        b.titleColor = T.accent;
        const t = row.addText(c);
        t.widthWeight = 90;
        t.titleFont = Font.systemFont(LAYOUT.font(12));
        t.titleColor = T.text;
        table.addRow(row);
      });
    });
    return;
  }
}

// ─── Oberfläche: Warenkorb-Vergleich ─────────────────────────────
async function buildCompare(table, T, rerender) {
  const { byRetailer, byProduct } = aggregate();

  const products = Object.keys(byProduct).sort(byName);   // Produkte, die es überhaupt im Angebot gibt
  const mixTotal = products.reduce((s, p) => s + byProduct[p].price, 0);
  const mixMarkets = new Set(products.map(p => byProduct[p].advertiser)).size;

  /**
   * Warenkorb-Rechnung wie bei smhaggle: Für jeden Markt zählt der GESAMTE
   * Einkauf. Produkte ohne Angebot dort werden mit dem Bestpreis anderswo
   * angesetzt und als „fehlend“ ausgewiesen – so sind die Summen vergleichbar.
   */
  function basketFor(names) {
    let own = 0, missing = 0, missingList = [];
    for (const p of products) {
      let best = null;
      for (const n of names) {
        const price = byRetailer[n] && byRetailer[n][p];
        if (price != null && (best == null || price < best)) best = price;
      }
      if (best != null) own += best;
      else { missing += byProduct[p].price; missingList.push(p); }
    }
    return { own, missing, total: own + missing, missingList, covered: products.length - missingList.length };
  }

  /**
   * Bewertung je Markt – Gewinner ist, wo es die meisten Produkte
   * zum besten Preis gibt:
   *   covered   = Produkte, die es dort im Angebot gibt
   *   best      = davon zum absoluten Bestpreis (kein anderer Markt ist günstiger)
   *   surcharge = Aufpreis der übrigen Produkte gegenüber dem Bestpreis
   *   ownTotal  = Summe der dort erhältlichen Angebote
   * Sortierung: mehr Bestpreise > mehr Abdeckung > kleinerer Aufpreis.
   */
  const retailers = Object.keys(byRetailer).map(name => {
    const b = basketFor([name]);
    let best = 0, surcharge = 0, ownTotal = 0, advantage = 0;
    for (const p of products) {
      const price = byRetailer[name][p];
      if (price == null) continue;
      ownTotal += price;
      const bestAnywhere = byProduct[p].price;
      if (price <= bestAnywhere + 0.001) {
        best++;
        // Vorsprung gegenüber dem nächstbesten Markt
        const others = Object.keys(byRetailer)
          .filter(n => n !== name && byRetailer[n][p] != null)
          .map(n => byRetailer[n][p]);
        if (others.length) advantage += Math.min(...others) - price;
      } else {
        surcharge += price - bestAnywhere;
      }
    }
    return { name, ...b, best, surcharge, ownTotal, advantage };
  }).sort((a, b) =>
    (b.best - a.best) ||                 // 1. die meisten Produkte zum Bestpreis
    (b.covered - a.covered) ||           // 2. die breiteste Auswahl
    (a.surcharge - b.surcharge) ||       // 3. der geringste Aufpreis beim Rest
    (a.ownTotal - b.ownTotal)            // 4. günstigere Angebotssumme
  );

  // Für die Kostenfrage weiterhin der günstigste Einzelmarkt
  const cheapestSingle = [...retailers].sort((a, b) => a.total - b.total)[0];

  // Beste Zweier-Kombination („lohnt sich der zweite Markt?“)
  let bestPair = null;
  const top = retailers.slice(0, 8);
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const b = basketFor([top[i].name, top[j].name]);
      if (!bestPair || b.total < bestPair.total) {
        bestPair = { names: [top[i].name, top[j].name], ...b };
      }
    }
  }

  const winner = retailers[0];
  const single = cheapestSingle;
  const savingPair = single && bestPair ? single.total - bestPair.total : null;
  const savingMix = single ? single.total - mixTotal : null;

  // ── Kopf ──
  backRow(table, T, rerender);
  headerRow(table, T, "Warenkorb-Vergleich", `${products.length} von ${items.length} Produkten aktuell im Angebot`);

  if (!products.length) {
    infoRow(table, T, "Aktuell keine Angebote", "Mit 🔄 aktualisieren oder Produkte hinzufügen.");
    return;
  }

  // Export: Produkt, Bestpreis und Anbieter je Produkt in die Erinnerungen-App
  // – nur wenn in den Einstellungen aktiviert
  if (meta.exportEnabled !== false) {
    const exportRow = new UITableRow();
    exportRow.height = tapRow(44);
    exportRow.backgroundColor = T.row;
    const expText = exportRow.addText(
      meta.reminderList ? `📋 In „${meta.reminderList}“ exportieren (${products.length})` : `📋 In Erinnerungen exportieren (${products.length})`,
      "alle Produkte mit aktuellem Angebot – Auswahl nur einzelner Produkte: in der Produktliste markieren"
    );
    expText.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
    expText.subtitleFont = Font.systemFont(LAYOUT.font(10));
    expText.subtitleColor = T.muted;
    expText.widthWeight = 76;
    const exp = exportRow.addButton("Export");
    exp.widthWeight = 24;
    exp.rightAligned();
    exp.onTap = async () => {
      const entries = products.map(p => {
        const it = items.find(i => i.query === p);
        return { name: it ? itemLabel(it) : p, price: byProduct[p].price, advertiser: byProduct[p].advertiser };
      });
      const res = await exportToReminders(entries);
      const a = new Alert();
      if (res) {
        a.title = "✅ Exportiert";
        a.message = `„${res.list}“: ${res.added} neu, ${res.updated} aktualisiert, ${res.total} gesamt.`;
      } else {
        a.title = "Abgebrochen";
        a.message = "Keine Liste ausgewählt.";
      }
      a.addAction("OK");
      await a.presentAlert();
    };
    table.addRow(exportRow);
  }

  // ── Sieger: die meisten Angebote am günstigsten ──
  headerRow(table, T, "Bester Markt", "die meisten Angebote zum besten Preis");

  const winRow = new UITableRow();
  winRow.backgroundColor = T.goodBg;
  const winRest = withLogo(winRow, winner.name, 14);
  const winTitle = (winRest === 100 ? "🏆 " : "") + winner.name;
  const winSub = `${winner.best} von ${products.length} Produkten zum Bestpreis`
    + ` · ${winner.covered} im Angebot`
    + (winner.advantage > 0 ? ` · Vorsprung ${eur(winner.advantage)} gegenüber dem nächstbesten Markt` : "")
    + (winner.surcharge > 0 ? ` · übrige Produkte dort ${eur(winner.surcharge)} teurer` : "");
  const wt = winRow.addText(winTitle, winSub);
  wt.widthWeight = textW(Math.round(winRest * 0.66));
  winRow.height = autoRowHeight(winTitle, 17, winSub, 11, wt.widthWeight,
    LAYOUT.row(narrowView() ? 84 : 72));
  wt.titleFont = Font.boldSystemFont(LAYOUT.font(17));
  wt.titleColor = T.text;
  wt.subtitleFont = Font.systemFont(LAYOUT.font(11));
  wt.subtitleColor = T.good;
  const winTotalText = eur(winner.ownTotal);
  const wp = winRow.addText(winTotalText, "dort im Angebot");
  wp.widthWeight = winRest - wt.widthWeight;
  wp.rightAligned();
  wp.titleFont = priceFont(winTotalText, 16, true);
  wp.titleColor = T.good;
  wp.subtitleFont = Font.systemFont(LAYOUT.font(10));
  wp.subtitleColor = T.muted;
  table.addRow(winRow);

  // Verteilung: wer hat wie viele Bestpreise?
  const withWins = retailers.filter(r => r.best > 0);
  if (withWins.length > 1) {
    const img = chartShare(withWins, T);
    addChartRow(table, img, chartRowHeight(img), T.row);
  }

  // ── Kostenfrage: ein Markt / zwei Märkte / alle Bestpreise ──
  headerRow(table, T, "Gesamtkosten", "kompletter Einkauf, fehlende Produkte zum Bestpreis");

  function recRow(title, subtitle, value, highlight) {
    const row = new UITableRow();
    row.height = autoRowHeight(title, 15, subtitle, 11, textW(68), LAYOUT.row(cardsOn() ? 62 : 58));
    row.backgroundColor = highlight ? T.goodBg : T.row;
    const t = row.addText(title, subtitle);
    t.widthWeight = textW(68);
    t.titleFont = Font.mediumSystemFont(LAYOUT.font(15));
    t.titleColor = T.text;
    t.subtitleFont = Font.systemFont(LAYOUT.font(11));
    t.subtitleColor = highlight ? T.good : T.muted;
    const valText = eur(value);
    const p = row.addText(valText, highlight ? "günstigste Wahl" : "");
    p.widthWeight = priceW(32);
    p.rightAligned();
    p.titleFont = priceFont(valText, 16, true);
    p.titleColor = highlight ? T.good : T.text;
    p.subtitleFont = Font.systemFont(LAYOUT.font(10));
    p.subtitleColor = T.good;
    table.addRow(row);
    if (cardsOn()) gapRow(table, T, 7);
  }

  const options = [
    { kind: "single", total: single.total },
    ...(bestPair && bestPair.total < single.total - 0.001 ? [{ kind: "pair", total: bestPair.total }] : []),
    ...(mixMarkets > 2 ? [{ kind: "mix", total: mixTotal }] : []),
  ];
  const cheapestTotal = Math.min(...options.map(o => o.total));

  recRow(
    "1 Markt: " + single.name,
    single.missingList.length
      ? `${single.covered} von ${products.length} dort · ${single.missingList.length} woanders`
      : "alle Produkte in einem Markt",
    single.total,
    Math.abs(single.total - cheapestTotal) < 0.001
  );

  if (bestPair && bestPair.total < single.total - 0.001) {
    recRow(
      "2 Märkte: " + bestPair.names.join(" + "),
      savingPair > 0 ? `spart ${eur(savingPair)} gegenüber ${single.name}` : "zweiter Markt lohnt kaum",
      bestPair.total,
      Math.abs(bestPair.total - cheapestTotal) < 0.001
    );
  }

  if (mixMarkets > 2) {
    recRow(
      `Bestpreis-Mix: ${mixMarkets} Märkte`,
      savingMix > 0 ? `spart ${eur(savingMix)} – dafür ${mixMarkets} Märkte anfahren` : "kein Vorteil",
      mixTotal,
      Math.abs(mixTotal - cheapestTotal) < 0.001
    );
  }

  // ── Ranking aller Märkte ──
  headerRow(table, T, "Alle Märkte", "sortiert nach Produkten zum Bestpreis");
  // Balken zeigen die Produkte zum Bestpreis je Markt
  chartRow(table, T, chartRetailers(
    retailers.map(r => ({ name: r.name, total: r.best })), T, null, (v) => `${v} ×`
  ));

  retailers.forEach((r, i) => {
    const row = new UITableRow();
    row.backgroundColor = i === 0 ? T.goodBg : (i % 2 ? T.rowAlt : T.row);
    const rkRest = withLogo(row, r.name, 12);
    const rkTitle = `${i + 1}. ${r.name}`;
    const rkSub = `${r.best}× Bestpreis · ${r.covered}/${products.length} im Angebot`
      + (r.surcharge > 0 ? ` · +${eur(r.surcharge)} Aufpreis` : " · alles zum Bestpreis");
    const t = row.addText(rkTitle, rkSub);
    t.widthWeight = textW(Math.round(rkRest * 0.64));
    row.height = autoRowHeight(rkTitle, 15, rkSub, 11, t.widthWeight, LAYOUT.row(58));
    t.titleFont = i === 0 ? Font.boldSystemFont(LAYOUT.font(15)) : Font.systemFont(LAYOUT.font(15));
    t.titleColor = T.text;
    t.subtitleFont = Font.systemFont(LAYOUT.font(11));
    t.subtitleColor = i === 0 ? T.good : T.muted;
    const p = row.addText(eur(r.ownTotal), `Gesamt ${eur(r.total)}`);
    p.widthWeight = rkRest - t.widthWeight;
    p.rightAligned();
    p.titleFont = Font.boldSystemFont(LAYOUT.font(15));
    p.titleColor = i === 0 ? T.good : T.text;
    p.subtitleFont = Font.systemFont(LAYOUT.font(10));
    p.subtitleColor = T.muted;
    table.addRow(row);
  });

  // ── Einkaufsplan: je Produkt der günstigste Markt ──
  headerRow(table, T, "Einkaufsplan", "je Produkt der günstigste Markt");
  chartRow(table, T, chartProducts(byProduct, T));

  products.forEach((p, i) => {
    const row = new UITableRow();
    row.backgroundColor = cardsOn() ? T.row : ((i % 2) ? T.rowAlt : T.row);
    const singlePrice = byRetailer[single.name] && byRetailer[single.name][p];
    const offerHere = activeOffers(p).find(o => o.advertiser === byProduct[p].advertiser);
    const condHere = offerHere && (offerHere.conditions || [])[0];
    const planSub = [
      byProduct[p].advertiser + (condHere ? " " + condHere : ""),
      (singlePrice != null && singlePrice > byProduct[p].price ? `bei ${single.name}: ${eur(singlePrice)}` : ""),
    ].filter(Boolean).join(" · ");
    row.height = autoRowHeight(p, 14, planSub, 11, textW(70), LAYOUT.row(46));
    const t = row.addText(p, planSub);
    t.widthWeight = textW(70);
    t.titleFont = Font.mediumSystemFont(LAYOUT.font(14));
    t.titleColor = T.text;
    t.subtitleFont = Font.systemFont(LAYOUT.font(11));
    t.subtitleColor = T.muted;
    const pr = row.addText(eur(byProduct[p].price));
    pr.widthWeight = priceW(30);
    pr.rightAligned();
    pr.titleFont = Font.boldSystemFont(LAYOUT.font(15));
    pr.titleColor = T.text;
    table.addRow(row);
  });

  // ── Angebotsverlauf: wie oft war was im Angebot ──
  const withHistory = items
    .map(i => ({ item: i, freq: offerFrequency(i.query) }))
    .filter(e => e.freq && e.freq.span >= 7)
    .sort((a, b) => b.freq.share - a.freq.share);

  if (withHistory.length) {
    headerRow(table, T, "Angebotsverlauf", "wie häufig war ein Produkt im Angebot?");
    withHistory.forEach((e, i) => {
      const row = new UITableRow();
      row.backgroundColor = cardsOn() ? T.row : ((i % 2) ? T.rowAlt : T.row);
      const pct = Math.round(e.freq.share * 100);
      const bars = "▮".repeat(Math.max(1, Math.round(e.freq.share * 10)));
      const freqSub = `${e.freq.days} von ${e.freq.span} Tagen  ${bars}`;
      row.height = autoRowHeight(e.item.query, 14, freqSub, 11, textW(74), tapRow(44));
      const t = row.addText(e.item.query, freqSub);
      t.widthWeight = textW(74);
      t.titleFont = Font.mediumSystemFont(LAYOUT.font(14));
      t.titleColor = T.text;
      t.subtitleFont = Font.systemFont(LAYOUT.font(11));
      t.subtitleColor = T.accent;
      const p = row.addText(pct + " %", pct >= 50 ? "oft" : "selten");
      p.widthWeight = priceW(26);
      p.rightAligned();
      p.titleFont = Font.boldSystemFont(LAYOUT.font(14));
      p.titleColor = T.text;
      p.subtitleFont = Font.systemFont(LAYOUT.font(10));
      p.subtitleColor = T.muted;
      table.addRow(row);
    });
  }

  const sum = new UITableRow();
  sum.backgroundColor = T.goodBg;
  const st = sum.addText("Summe Bestpreis-Mix", `${mixMarkets} Märkte`);
  st.widthWeight = textW(70);
  st.titleFont = Font.boldSystemFont(LAYOUT.font(15));
  st.titleColor = T.text;
  st.subtitleFont = Font.systemFont(LAYOUT.font(11));
  st.subtitleColor = T.good;
  const sp = sum.addText(eur(mixTotal));
  sp.widthWeight = priceW(30);
  sp.rightAligned();
  sp.titleFont = Font.boldSystemFont(LAYOUT.font(15));
  sp.titleColor = T.accent;
  table.addRow(sum);
}

// ─── Widget ──────────────────────────────────────────────────────
/** Kleiner Balken fürs Widget (Anteil 0..1). */
function miniBar(ratio, T, isOffer) {
  const w = 108, h = 16;
  const ctx = newCanvas(w, h);
  ctx.setFillColor(T.dark ? new Color("#3a3a3c") : new Color("#e8eaed"));
  const bg = new Path();
  bg.addRoundedRect(new Rect(0, 4, w, 8), 4, 4);
  ctx.addPath(bg);
  ctx.fillPath();

  ctx.setFillColor(isOffer === false ? T.muted : T.good);
  const fg = new Path();
  fg.addRoundedRect(new Rect(0, 4, Math.max(8, w * ratio), 8), 4, 4);
  ctx.addPath(fg);
  ctx.fillPath();
  return ctx.getImage();
}

function buildWidget() {
  const T = theme();
  const w = new ListWidget();
  // Tap aufs Widget startet das Skript (Aktualisieren in der App)
  w.url = "scriptable:///run/" + encodeURIComponent(Script.name());
  w.backgroundColor = T.dark ? new Color("#1c1c1e") : new Color("#ffffff");
  w.setPadding(14, 14, 14, 14);

  const withOffers = items
    .map(i => ({ item: i, best: bestOf(i.query), np: normalPrice(i.query) }))
    .filter(e => e.best || e.np)
    // Auswahl weiterhin nach Angebot/Preis, damit im Widget das Wichtigste steht …
    .sort((a, b) => (a.best ? 0 : 1) - (b.best ? 0 : 1)
      || (((a.best || a.np).price || 0) - ((b.best || b.np).price || 0)));

  // Der Titel sagt, was tatsächlich in der Liste steht: reine Angebote,
  // reine Normalpreise oder beides gemischt.
  const nOffers = withOffers.filter(e => e.best).length;
  const title = w.addText(
    nOffers === withOffers.length ? `🏷️ Angebote (${nOffers})`
    : nOffers ? `🏷️ Angebote (${nOffers}) · Preise`
    : "🏷️ Preise");
  title.font = Font.boldSystemFont(LAYOUT.font(13));
  title.textColor = T.text;
  w.addSpacer(6);


  if (!withOffers.length) {
    const t = w.addText("Aktuell keine Angebote");
    t.font = Font.systemFont(LAYOUT.font(12));
    t.textColor = T.muted;
  } else {
    const max = LAYOUT.widgetRows();
    // … angezeigt wird die Auswahl dann alphabetisch nach Produktnamen
    const shownList = withOffers.slice(0, max)
      .map(e => ({ ...e, shown: e.best || e.np }))
      .sort((a, b) => byName(a.item.query, b.item.query));
    const priceMax = Math.max(...shownList.map(e => e.shown.price)) || 1;
    shownList.forEach(e => {
      const row = w.addStack();
      row.layoutHorizontally();
      row.centerAlignContent();
      const name = row.addText(e.item.query);
      name.font = Font.systemFont(LAYOUT.font(12));
      name.textColor = T.text;
      name.lineLimit = 1;
      row.addSpacer(6);

      // Mini-Balken als visueller Preisvergleich
      if (config.widgetFamily !== "small") {
        const bar = row.addImage(miniBar(e.shown.price / priceMax, T, !!e.best));
        bar.imageSize = new Size(54, 8);
        row.addSpacer(6);
      }

      const price = row.addText(eur(e.shown.price));
      price.font = e.best ? Font.boldSystemFont(LAYOUT.font(12)) : Font.systemFont(LAYOUT.font(12));
      price.textColor = e.best ? T.good : T.muted;   // Angebot grün, Normalpreis grau
      w.addSpacer(3);

      if (config.widgetFamily !== "small") {
        if (!e.best) {
          const sub = w.addText("Normalpreis · " + (e.np.source || ""));
          sub.font = Font.systemFont(LAYOUT.font(9));
          sub.textColor = T.muted;
          w.addSpacer(4);
          return;
        }
        const v = validity(e.best);
        const r = priceRating(e.item.query, e.best.price);
        const parts = [e.best.advertiser];
        if ((e.best.conditions || []).length) parts.push(e.best.conditions[0]);
        if (v && v.days <= 2) parts.push("⏳ " + v.text);
        if (r && r.level === "best") parts.push("🟢 Bestpreis");
        const sub = w.addText(parts.join(" · "));
        sub.font = Font.systemFont(LAYOUT.font(9));
        sub.textColor = (v && v.urgent) ? new Color("#ff9f0a") : T.muted;
        w.addSpacer(4);
      }
    });
  }

  w.addSpacer();
  // Zeitpunkt des letzten Abrufs – nicht der des Neuzeichnens. Wird der
  // Stand alt, fällt das so auf (das Widget ruft selbst nicht mehr ab).
  const ageH = meta.lastRefresh ? (Date.now() - meta.lastRefresh) / 3600000 : Infinity;
  const stamp = w.addText(lastRefreshText());
  stamp.font = Font.systemFont(LAYOUT.font(9));
  stamp.textColor = ageH > 24 ? new Color("#ff9f0a") : T.muted;
  return w;
}

// ─── Einstieg ────────────────────────────────────────────────────

pruneExpiredCache();   // gilt für alle drei Betriebsarten

if (config.runsInWidget) {
  let widget;
  try {
    // Das Widget zeichnet aus dem Zwischenspeicher; abgerufen wird im stillen
    // Lauf (Automation). iOS bricht Widget-Läufe nach wenigen Sekunden ab –
    // ein dort begonnener Abruf bliebe halb fertig. Über WIDGET_MAY_REFRESH
    // lässt sich der Abruf im Widget wieder einschalten.
    const ageH = meta.lastRefresh ? (Date.now() - meta.lastRefresh) / 3600000 : Infinity;
    if (WIDGET_MAY_REFRESH && configComplete() && items.length
        && ageH > REFRESH_MAX_AGE_H && retryAllowed()) {
      await refreshAll(true);
    }
    await ensureAppIcon();
    widget = buildWidget();
  } catch (e) {
    // Fehler im Widget nicht als roter Block stehen lassen
    widget = new ListWidget();
    widget.url = "scriptable:///run/" + encodeURIComponent(Script.name());
    const t = widget.addText("PreisApp");
    t.font = Font.boldSystemFont(13);
    const m = widget.addText("Konnte nicht laden – zum Öffnen tippen");
    m.font = Font.systemFont(10);
    m.textColor = Color.gray();
    console.error(e.message);
  }
  Script.setWidget(widget);

} else if (String(args.queryParameters.ean || "").trim()) {
  // Mit Nummer gestartet (z. B. aus einem Kurzbefehl): nur prüfen und
  // zeigen – wie der frühere Start des EAN-Skripts mit ?ean=…
  const startEAN = String(args.queryParameters.ean).replace(/[\s-]/g, "").trim();
  const info = await runCheck(startEAN);
  if (info) {
    Pasteboard.copyString(info.ean);
    Script.setShortcutOutput(info.ean);
    await note("Fertig", eanStatusText(info.ean, info) + "\n\nDie Nummer liegt in der Zwischenablage.");
  }

} else if (config.runsWithSiri || args.queryParameters.silent === "1") {
  // stiller Lauf (z. B. per Automation) – ohne Dialoge
  const fresh = await refreshAll(true);
  Script.setShortcutOutput(fresh.length + " neue Angebote");

} else {
  pruneTombstones();                    // abgelaufene Löschvermerke entfernen
  await ensureAppIcon();                // appicon.png bei Bedarf nachladen
  await showEANDataWarning();           // Hinweis auf eine beschädigte EAN-Ablage
  if (!configComplete()) await editSettings();

  // Nur abrufen, wenn die Daten älter als REFRESH_MAX_AGE_H sind –
  // sonst startet die App sofort aus dem Cache.
  const ageH = meta.lastRefresh ? (Date.now() - meta.lastRefresh) / 3600000 : Infinity;
  if (items.length && ageH > REFRESH_MAX_AGE_H && retryAllowed()) await refreshAll(false);
  await showMain();
}

flush();          // offene Änderungen sichern
Script.complete();

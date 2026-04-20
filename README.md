# Eigenbeleg Generator · HYPEUP GmbH

Interne Web-App zum Erstellen von Eigenbelegen — als Einzel-Formular oder im Batch-Modus aus einer Excel-Vorlage. Läuft vollständig im Browser, keine Server, alles statisch über GitHub Pages.

## Features

- **Einzel-Formular** mit allen Pflichtangaben nach deutschen Finanzamt-Anforderungen
- **Batch-Verarbeitung** über editierbare Tabelle oder Excel-Upload (Vorlage als Download)
- **PDF-Export** mit HYPEUP-Branding — einzeln oder als ZIP
- **Signaturfeld** zum digitalen Unterzeichnen (oder leer lassen für handschriftliche Unterschrift)
- **Passwortschutz** (shared password, gehashed im Code)
- **Kategorien & Gründe** vorgefüllt für schnelles Ausfüllen
- **Warnung bei Beträgen ≥ 150 €** (Finanzamt prüft kritischer)
- Daten bleiben vollständig lokal (localStorage) — kein Backend

## Pflichtangaben eines Eigenbelegs

Die App bildet alle vom Finanzamt geforderten Angaben ab:

1. Belegnummer (fortlaufend)
2. Ausstellungsdatum
3. Name des Ausstellers / Unterschrift
4. Datum der Ausgabe
5. Name & Anschrift des Zahlungsempfängers
6. Art der Aufwendung
7. Betrag
8. Zahlungsart
9. Grund für den Eigenbeleg

## Lokal entwickeln

```bash
npm install
npm run dev
```

Öffnet unter http://localhost:5173.

```bash
npm run build     # Produktions-Build
npm run preview   # Preview des Produktions-Builds
```

## Deployment auf GitHub Pages

1. Repo auf GitHub unter dem Namen `eigenbeleg-generator` anlegen (Private oder Public — bei Public ist der Quellcode einsehbar, das **Passwort ist nur als SHA-256-Hash** gespeichert).
2. Code pushen:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin git@github.com:<org>/eigenbeleg-generator.git
   git push -u origin main
   ```
3. In den Repo-Settings → **Pages** → Source auf **GitHub Actions** stellen.
4. Der Workflow `.github/workflows/deploy.yml` läuft automatisch bei jedem Push auf `main` und deployed die App unter:
   `https://<org>.github.io/eigenbeleg-generator/`

### Custom Domain

Wenn ihr eine eigene Domain nutzen wollt (z. B. `eigenbeleg.hypeup.de`):

1. In `vite.config.ts` `base: "/"` setzen.
2. Datei `public/CNAME` mit der Domain anlegen (z. B. `eigenbeleg.hypeup.de`).
3. DNS CNAME-Record auf `<org>.github.io` setzen.

## Passwort ändern

Aktuelles Passwort: **Campuskeller**

So änderst du es:

```bash
printf "%s" "NeuesPasswort" | shasum -a 256
```

Den ausgegebenen Hex-String in `src/config.ts` als `PASSWORD_HASH` einsetzen und committen.

**Wichtig**: Das Klartext-Passwort **nie** ins Repo committen. Nur der Hash landet im Code.

### Sicherheitshinweis

Der Passwortschutz ist client-seitig. Der gehashed Wert ist im gebauten JavaScript sichtbar. Für ein geteiltes internes Passwort mit Low-Stakes-Inhalten (Beleg-Formular ohne sensible Daten) ist das angemessen. Brute-Force gegen SHA-256 ist machbar — daher: **starkes Passwort wählen**. Für eine spätere Ausbaustufe mit echten User-Accounts empfehle ich **Cloudflare Access** vor GitHub Pages (kostenlos bis 50 User).

## Firmendaten ändern

Die Standard-Adresse steht in `src/config.ts` unter `COMPANY_DEFAULTS`. Im UI ist die Adresse pro Session editierbar — der Button "Auf aktuelle Adresse zurücksetzen" stellt den Default wieder her.

## Logo tauschen

Logo liegt unter `public/logo.png`. Einfach ersetzen und committen.

## Datensicherheit & Aufbewahrung

- Alle Eingaben bleiben lokal im Browser (localStorage für Zähler/Aussteller/Firma).
- PDFs werden client-seitig erzeugt und direkt heruntergeladen — nichts wird an einen Server gesendet.
- **Eigenbelege müssen 10 Jahre aufbewahrt werden** (GoBD). Die App archiviert nichts automatisch — die erzeugten PDFs müssen manuell abgelegt werden (z. B. in DATEV, SharePoint o. ä.).

## Ausbau-Ideen (nicht implementiert)

- Echte User-Accounts (Cloudflare Access oder Supabase)
- Zentrale Beleg-Historie über Geräte hinweg
- DATEV-Export als CSV
- Mehrere Firmenprofile
- Automatischer Upload in DMS

## Stack

- Vite + React 18 + TypeScript
- jsPDF (PDF-Generierung)
- SheetJS/xlsx (Excel Import + Template)
- JSZip (Batch → ZIP)
- GitHub Pages + GitHub Actions

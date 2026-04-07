# DSGVO-Konformitätsanalyse — kamdi24 Videoberatung

**Stand:** März 2026  
**Methode:** Statische Code-Analyse aller Quelldateien  
**Ergebnis:** Die App ist in der aktuellen Form **NICHT datenschutzkonform** für den produktiven Einsatz in Deutschland.

---

## Gesamtbewertung

| Bereich | Status | Bewertung |
|---------|--------|-----------|
| WebRTC Video/Audio (P2P, verschlüsselt) | Konform | Gute Architektur |
| Keine Cookies / kein Tracking / kein localStorage | Konform | Vorbildlich |
| Keine serverseitige Aufzeichnung | Konform | Vorbildlich |
| Chat-/Datei-Daten nicht persistent gespeichert | Konform | Gut |
| Passwort-Hashing (bcrypt) | Konform | Gut implementiert |
| API-Endpunkte mit Auth geschützt | Konform | Gut implementiert |
| Rate-Limiting bei Login | Konform | Gut implementiert |
| Fonts lokal gehostet (kein Google Fonts CDN) | Konform | Korrekt umgesetzt |
| PeerJS lokal gehostet (kein CDN) | Konform | Korrekt umgesetzt |
| Datenschutzerklärung vorhanden und verlinkt | Konform | Umfassend |
| **Externe Google STUN-Server** | **NICHT konform** | **Kritisch** |
| **TURN-Zugangsdaten im Client-Code** | **NICHT konform** | **Kritisch** |
| **Impressum unvollständig** | **NICHT konform** | **Kritisch** |
| **Keine Security-Header** | **NICHT konform** | **Hoch** |
| **Keine Einwilligung vor Kamera-/Mikrofon-Zugriff** | **NICHT konform** | **Hoch** |
| **Datenschutzerklärung enthält falsche Aussage** | **NICHT konform** | **Hoch** |
| **Session-Tokens laufen nie ab** | **NICHT konform** | **Mittel** |
| **Datei-Upload ohne Einschränkungen** | **NICHT konform** | **Mittel** |
| **Berater-Dashboard ohne Rechtslinks** | **NICHT konform** | **Mittel** |
| **users.json enthält noch Klartext-Passwörter** | **NICHT konform** | **Mittel** |

---

## Kritische Verstöße (sofort beheben)

### 1. Google STUN-Server übermitteln IP-Adressen an Google

**Dateien:** `public/js/customer.js` (Zeile 22–23), `public/js/berater.js` (Zeile 24–25)

```javascript
{ urls: 'stun:stun.l.google.com:19302' },
{ urls: 'stun:stun1.l.google.com:19302' },
```

**Problem:** Bei jedem Verbindungsaufbau wird die IP-Adresse des Nutzers an Google-Server in den USA übermittelt. Dies geschieht ohne Einwilligung und ohne Rechtsgrundlage. Die Datenschutzerklärung (`datenschutz.html`, §6) behauptet ausdrücklich: *"Diese Anwendung lädt keine externen Ressourcen von Drittanbietern"* — das ist **nachweislich falsch**.

**Verstoß gegen:** Art. 44 ff. DSGVO (Drittlandtransfer), TDDDG § 25 (Zugriff auf Endeinrichtung), Art. 13 DSGVO (falsche Information)

**Lösung:** Google STUN-Server entfernen. Ausschließlich den eigenen STUN/TURN-Server unter `46.225.130.183:3478` verwenden.

---

### 2. TURN-Server-Zugangsdaten im Client-Code sichtbar

**Dateien:** `public/js/customer.js` (Zeile 27–39), `public/js/berater.js` (Zeile 27–45)

```javascript
{
    urls: 'turn:46.225.130.183:3478',
    username: 'kamdi24',
    credential: 'K4md1Turn2025!'
},
```

**Problem:** Benutzername (`kamdi24`) und Passwort (`K4md1Turn2025!`) des TURN-Servers sind im Klartext im öffentlich zugänglichen JavaScript-Code eingebettet. Jeder Besucher der Website kann diese Zugangsdaten einsehen und den TURN-Server missbrauchen.

**Verstoß gegen:** Art. 32 DSGVO (Sicherheit der Verarbeitung)

**Lösung:** Temporäre TURN-Credentials serverseitig generieren (time-limited TURN credentials via API-Endpunkt) und erst nach Authentifizierung an den Client übergeben. Alternativ: coturn mit ephemeral credentials konfigurieren.

---

### 3. Impressum ist unvollständig — Pflichtangaben fehlen

**Datei:** `public/impressum.html`

**Problem:** Das Impressum enthält nur Platzhalter:

```html
[Straße und Hausnummer]
[PLZ Ort]
[Name des Geschäftsführers]
[Amtsgericht]
[HRB-Nummer]
[USt-ID]
[Name] (Verantwortlicher nach § 55 RStV)
```

Zudem verweist das Impressum auf **§ 5 TMG**, das seit Mai 2024 durch das **Digitale-Dienste-Gesetz (DDG)** ersetzt wurde. Korrekt wäre: **§ 5 DDG**.

**Verstoß gegen:** § 5 DDG (Impressumspflicht) — Bußgeld bis 50.000 € möglich

**Lösung:** Alle Platzhalter mit echten Unternehmensdaten befüllen. Rechtsgrundlage auf § 5 DDG aktualisieren.

---

## Hohe Priorität (zeitnah beheben)

### 4. Keine Einwilligung vor Kamera-/Mikrofon-Zugriff

**Dateien:** `public/js/customer.js` (Funktion `startCall`), `public/js/berater.js` (Funktion `login`)

**Problem:** Beim Klick auf "Videoanruf" oder "Audioanruf" wird sofort `navigator.mediaDevices.getUserMedia()` aufgerufen — ohne vorherige DSGVO-konforme Einwilligung. Der Browser fragt zwar technisch um Erlaubnis, aber eine **informierte Einwilligung** nach Art. 6/7 DSGVO (Zweck, Rechtsgrundlage, Widerrufsmöglichkeit) wird nicht eingeholt.

**Verstoß gegen:** Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), Art. 7 DSGVO (Bedingungen für die Einwilligung)

**Lösung:** Vor dem `getUserMedia`-Aufruf einen Einwilligungsdialog anzeigen mit:
- Zweck der Datenverarbeitung (Videoberatung)
- Hinweis auf P2P-Übertragung (keine Aufzeichnung)
- Hinweis auf Freiwilligkeit (Audioanruf als Alternative)
- Link zur Datenschutzerklärung
- Expliziter "Einverstanden"-Button

---

### 5. Datenschutzerklärung enthält nachweislich falsche Aussagen

**Datei:** `public/datenschutz.html` (§6 und §3.7)

**Falsche Aussagen im Code:**

| Behauptung in der DSE | Tatsächlicher Code |
|---|---|
| *"keine externen Ressourcen von Drittanbietern"* (§6) | Google STUN-Server werden kontaktiert (`stun.l.google.com`) |
| *"Dateien werden über WebRTC DataChannel direkt übertragen"* (§3.7) | Dateien werden über Socket.IO via Server weitergeleitet (`socket.on('file-share', ...)` in `server/index.js`, Zeile 345–354) |

**Verstoß gegen:** Art. 13 DSGVO (korrekte Informationspflicht)

**Lösung:**
1. Google STUN-Server entfernen (dann stimmt die Aussage in §6)
2. In §3.7 klarstellen, dass Dateien via Server (Socket.IO) weitergeleitet werden — oder die Dateiübertragung auf WebRTC DataChannel umstellen

---

### 6. Keine Security-Header gesetzt

**Datei:** `server/index.js`

**Problem:** Der Express-Server setzt keinerlei Security-Header. Es fehlen:

| Header | Zweck | Status |
|--------|-------|--------|
| `Content-Security-Policy` | XSS-Schutz, verhindert Laden externer Ressourcen | Fehlt |
| `Strict-Transport-Security` (HSTS) | Erzwingt HTTPS im Browser | Fehlt |
| `X-Frame-Options` | Clickjacking-Schutz | Fehlt |
| `X-Content-Type-Options` | MIME-Sniffing-Schutz | Fehlt |
| `Referrer-Policy` | Kontrolle über Referrer-Informationen | Fehlt |
| `Permissions-Policy` | Einschränkung von Kamera/Mikrofon auf eigene Domain | Fehlt |

**Verstoß gegen:** Art. 32 DSGVO (technische Schutzmaßnahmen)

**Lösung:** `helmet` NPM-Paket einbinden oder Header manuell setzen:

```javascript
app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    next();
});
```

---

## Mittlere Priorität

### 7. Session-Tokens laufen nie ab

**Datei:** `server/index.js` (Zeile 19)

```javascript
const sessionTokens = new Map();
```

**Problem:** Einmal erstellte Session-Tokens werden nie invalidiert oder aufgeräumt. Ein abgefangenes Token gewährt unbegrenzten Zugriff auf die API (User-Management).

**Verstoß gegen:** Art. 32 DSGVO (angemessene Sicherheit)

**Lösung:** Token-Ablaufzeit implementieren (z. B. 8 Stunden), regelmäßige Bereinigung abgelaufener Tokens, Token bei Logout invalidieren.

---

### 8. Datei-Upload ohne Einschränkungen

**Dateien:** `public/js/customer.js` (Funktion `handleFileSelect`), `public/js/berater.js` (Funktion `handleFileSelect`)

**Problem:** Beim Datei-Sharing über den Chat gibt es keine Beschränkungen bezüglich:
- Dateigröße (beliebig große Dateien möglich)
- Dateityp (ausführbare Dateien wie `.exe`, `.bat`, `.js` möglich)
- Keine Warnung vor potenziell gefährlichen Dateien

**Verstoß gegen:** Art. 32 DSGVO (Sicherheit)

**Lösung:** Maximale Dateigröße (z. B. 10 MB), Whitelist erlaubter Dateitypen, Warnung bei unbekannten Dateitypen.

---

### 9. Berater-Dashboard ohne Datenschutz-/Impressum-Links

**Datei:** `public/berater/index.html`

**Problem:** Die Berater-Seite (Dashboard) enthält keinen Link zur Datenschutzerklärung oder zum Impressum. Diese müssen auf **jeder Seite** der Anwendung erreichbar sein.

**Verstoß gegen:** § 5 DDG (Impressum), Art. 13 DSGVO (Informationspflicht)

**Lösung:** Footer mit Links zu `/datenschutz.html` und `/impressum.html` auf der Berater-Seite ergänzen.

---

### 10. users.json enthält noch Klartext-Passwörter

**Datei:** `server/users.json`

```json
{
    "username": "Max Mustermann",
    "password": "kamdi2024"
}
```

**Problem:** Obwohl die automatische Migration in `server/index.js` implementiert ist, enthält `users.json` aktuell noch Klartext-Passwörter. Die Migration läuft erst beim nächsten Serverstart. Falls die Datei in ein Git-Repository committed wurde, sind die Klartext-Passwörter in der Git-History permanent gespeichert.

**Verstoß gegen:** Art. 32 DSGVO (Vertraulichkeit)

**Lösung:**
1. Server einmal starten, damit die Migration ausgeführt wird
2. `users.json` in `.gitignore` aufnehmen
3. Git-History bereinigen (`git filter-branch` oder `BFG Repo-Cleaner`)
4. Allen Nutzern neue Passwörter zuweisen

---

### 11. Server-Logs enthalten personenbezogene Daten

**Datei:** `server/index.js`

```javascript
console.log('Berater authenticated successfully');  // Zeile 138
console.log('Failed login attempt');                 // Zeile 142
console.log('Berater disconnected:', berater.name);  // Zeile 367
```

**Problem:** Berater-Namen werden in Server-Logs geschrieben. Bei Hosting auf Render.com werden diese Logs gespeichert und sind über das Render-Dashboard einsehbar.

**Verstoß gegen:** Art. 5 Abs. 1 lit. c DSGVO (Datenminimierung)

**Lösung:** Personenbezogene Daten aus Logs entfernen oder pseudonymisieren. Stattdessen IDs oder generische Meldungen verwenden.

---

### 12. Copyright-Jahr veraltet

**Dateien:** `public/index.html`, `public/customer.html`, `public/datenschutz.html`

```html
© 2024 kamdi24
```

**Problem:** Nicht direkt datenschutzrelevant, aber signalisiert mangelnde Pflege. Sollte auf 2026 aktualisiert werden.

---

## Zusammenfassung: Was fehlt bis zur vollständigen DSGVO-Konformität?

```
KRITISCH (blockiert Go-Live)
├── [1] Google STUN-Server entfernen
├── [2] TURN-Credentials aus Client-Code entfernen  
└── [3] Impressum vollständig ausfüllen

HOCH (innerhalb von 2 Wochen)
├── [4] Einwilligungsdialog vor Kamera/Mikrofon implementieren
├── [5] Falsche Aussagen in der Datenschutzerklärung korrigieren
└── [6] Security-Header setzen (helmet o. Ä.)

MITTEL (innerhalb von 4 Wochen)
├── [7] Session-Token-Ablauf implementieren
├── [8] Datei-Upload einschränken (Größe, Typ)
├── [9] Datenschutz-/Impressum-Links auf Berater-Seite
├── [10] users.json migrieren + aus Git-History entfernen
├── [11] Server-Logs anonymisieren
└── [12] Copyright-Jahr aktualisieren

NICHT GEPRÜFT (organisatorisch — außerhalb des Codes)
├── [ ] AVV mit Render.com tatsächlich abgeschlossen?
├── [ ] Verarbeitungsverzeichnis (Art. 30 DSGVO) vorhanden?
├── [ ] Datenschutzbeauftragter bestellt (falls erforderlich)?
├── [ ] Incident-Response-Plan vorhanden?
├── [ ] Berater datenschutzrechtlich geschult?
└── [ ] DSFA durchgeführt (Art. 35 DSGVO)?
```

---

> **Fazit:** Die Grundarchitektur der App (P2P, kein Recording, keine Cookies, lokale Assets) ist datenschutzfreundlich. Die 3 kritischen Punkte (Google STUN, TURN-Credentials im Client, unvollständiges Impressum) blockieren jedoch den produktiven Einsatz. Nach Behebung der kritischen und hohen Punkte ist die Software im Wesentlichen DSGVO-konform — vorausgesetzt, die organisatorischen Pflichten (AVV, Verarbeitungsverzeichnis etc.) werden parallel erfüllt.

# Kritische Datenschutz-Verstöße: kamdi24 Videoberatung

**Grundlage:** „DSGVO – BDSG: Texte und Erläuterungen" (BfDI, Juli 2025)
**Prüfungsdatum:** 24. März 2026

> Dieses Dokument enthält ausschließlich die als **kritisch (❌)** eingestuften Befunde aus der vollständigen Analyse (`Datenschutz-PDF.md`). Jeder Punkt stellt einen Verstoß oder ein schwerwiegendes Defizit dar, das dringend behoben werden muss.

---

## 1. Google STUN-Server: Undokumentierte Drittlandsübermittlung

**Verletzte Artikel:** Art. 5 Abs. 1 lit. a DSGVO (Transparenz), Art. 13 Abs. 1 lit. f DSGVO (Informationspflicht bei Drittlandsübermittlung), Art. 44–49 DSGVO (Übermittlung in Drittländer)

**PDF-Grundlage:** *Kapitel 1.4.2 (S. 23):* „Besondere Bedeutung kommt dem Grundsatz der Verarbeitung ‚in einer für die betroffene Person nachvollziehbaren Weise' (Transparenz) zu." — *Kapitel 4.1 (S. 50):* „Ausfluss des Transparenzgebotes sind die weitgehenden Informationspflichten der Verantwortlichen (Art. 13 und 14 DSGVO), u. a. darüber, zu welchen Zwecken und in welchem Umfang die Daten verarbeitet, an wen sie übermittelt werden."

**Befund:** Der Code verwendet Google STUN-Server (`stun.l.google.com`, `stun1.l.google.com`), die bei jedem WebRTC-Verbindungsaufbau die IP-Adresse des Nutzers empfangen. Google LLC hat Sitz in den USA — dies ist eine Drittlandsübermittlung personenbezogener Daten. Die Datenschutzerklärung behauptet das Gegenteil:

- §6 (Zeile 379): *„Diese Anwendung lädt keine externen Ressourcen von Drittanbietern"*
- Zusammenfassung (Zeile 265): *„keine externen Dienste eingebunden"*
- §6 (Zeile 384): *„Keine Übermittlung Ihrer IP-Adresse an Drittanbieter beim Seitenaufruf"*

**Code-Referenz:**

```javascript
// customer.js, Zeilen 21–23
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
```

```javascript
// berater.js, Zeilen 23–25 — identische Konfiguration
```

**Empfehlung:**
- **Option A (bevorzugt):** Google STUN-Server entfernen und durch den eigenen STUN-Server (`46.225.130.183:3478`) ersetzen, der bereits konfiguriert ist.
- **Option B:** Google STUN in der Datenschutzerklärung offenlegen mit Rechtsgrundlage (EU-U.S. Data Privacy Framework) und die falschen Behauptungen korrigieren.

---

## 2. TURN-Server-Zugangsdaten öffentlich im JavaScript

**Verletzter Artikel:** Art. 32 DSGVO (Sicherheit der Verarbeitung)

**PDF-Grundlage:** *Kapitel 1.4.5 (S. 24):* „Die Verantwortlichen und ggf. die Auftragsverarbeiter haben geeignete technische und organisatorische Maßnahmen zu treffen, um einen Schutz etwa vor unbefugter oder unrechtmäßiger Verarbeitung [...] zu gewährleisten."

**Befund:** TURN-Server-Credentials stehen in öffentlich ausgelieferten JavaScript-Dateien. Jeder Webseitenbesucher kann sie über die Browser-Entwicklertools auslesen. Dies ermöglicht Missbrauch des TURN-Servers (Bandbreitenmissbrauch, Relay für fremde Verbindungen).

**Code-Referenz:**

```javascript
// customer.js, Zeilen 26–39
{
    urls: 'turn:46.225.130.183:3478',
    username: 'kamdi24',
    credential: 'K4md1Turn2025!'
},
{
    urls: 'turn:46.225.130.183:3478?transport=tcp',
    username: 'kamdi24',
    credential: 'K4md1Turn2025!'
},
{
    urls: 'turns:kamdi24-call.data-agents.de:5349',
    username: 'kamdi24',
    credential: 'K4md1Turn2025!'
}
```

```javascript
// berater.js, Zeilen 27–40 — identische Credentials
```

**Empfehlung:** Einen serverseitigen API-Endpoint implementieren, der temporäre TURN-Credentials mit kurzer Gültigkeit (z. B. 5 Minuten) erzeugt und an authentifizierte Clients ausliefert (TURN REST API / time-limited credentials nach RFC 8location). Die statischen Credentials sofort aus dem Client-Code entfernen und auf dem TURN-Server ändern.

---

## 3. Klartext-Passwörter im Git-Repository

**Verletzter Artikel:** Art. 32 DSGVO (Sicherheit der Verarbeitung)

**PDF-Grundlage:** *Kapitel 1.4.5 (S. 24):* „[...] geeignete technische und organisatorische Maßnahmen zu treffen, um einen Schutz etwa vor unbefugter oder unrechtmäßiger Verarbeitung oder dem unbeabsichtigten Verlust der Daten zu gewährleisten. [...] Danach kann u. a. eine Pseudonymisierung oder Verschlüsselung der Daten geboten sein."

**Befund:** Die Datei `server/users.json` enthält Berater-Passwörter im Klartext. Obwohl der Server diese zur Laufzeit in bcrypt-Hashes migriert, bleibt der Klartext in der aktuellen Datei und dauerhaft in der Git-History erhalten.

**Code-Referenz:**

```json
// server/users.json (aktuelle Datei auf Festplatte)
[
  {
    "id": "1",
    "username": "Max Mustermann",
    "password": "kamdi2024",
    "createdAt": "2026-02-24T16:07:43.943Z"
  },
  {
    "id": "2",
    "username": "Anna Schmidt",
    "password": "kamdi2024",
    "createdAt": "2026-02-24T16:07:43.944Z"
  }
]
```

**Empfehlung:**
1. **Sofort:** Alle Berater-Passwörter ändern (aktuelle sind kompromittiert).
2. Den Server einmalig starten, damit die bcrypt-Migration durchläuft, dann die migrierte `users.json` committen.
3. Git-History bereinigen (`git filter-branch` oder BFG Repo-Cleaner), um Klartext-Passwörter aus allen Commits zu entfernen.
4. `server/users.json` in `.gitignore` aufnehmen, damit Credentials nicht erneut committed werden.

---

## 4. Datenschutzerklärung enthält falsche Tatsachenbehauptungen

**Verletzter Artikel:** Art. 5 Abs. 1 lit. a DSGVO (Transparenz, Verarbeitung nach Treu und Glauben)

**PDF-Grundlage:** *Kapitel 1.4.2 (S. 23):* „Ausfluss des Transparenzgebotes sind die weitgehenden Informationspflichten [...]. Diese soll nämlich präzise, leicht zugänglich und verständlich sein sowie in klarer und einfacher Sprache erfolgen." — *Kapitel 1.6 (S. 28–29):* „Die betroffene Person soll jederzeit wissen können, wer was wann bei welcher Gelegenheit und aus welchem Grund über sie weiß."

**Befund:** Drei inhaltliche Fehler in `datenschutz.html`:

| # | Behauptung in Datenschutzerklärung | Tatsache im Code |
|---|-----------------------------------|-----------------|
| a | §6: „Diese Anwendung lädt **keine externen Ressourcen** von Drittanbietern" (Zeile 379) | Code nutzt Google STUN-Server (`customer.js` Z. 22–23) und externe TURN-Server (`customer.js` Z. 26–39) |
| b | §6: „**Keine Übermittlung** Ihrer IP-Adresse an Drittanbieter" (Zeile 384) | STUN-Anfragen übermitteln zwingend die IP-Adresse an Google (USA) |
| c | §3.6: „**Weiterleitung via Server** (Socket.IO)" für Chat (Zeile 339) | Chat läuft über PeerJS DataChannel (P2P), nicht über den Server (`customer.js` Z. 940–951, `berater.js` Z. 891–903) |

**Empfehlung:** Die Datenschutzerklärung wie folgt korrigieren:
1. §6 aktualisieren: STUN- und TURN-Server als externe Infrastrukturdienste benennen, Betreiber und Zweck (ICE-Verbindungsaufbau) erklären, Standort und Rechtsgrundlage angeben.
2. Zusammenfassung (Zeile 263–265) anpassen: Die pauschale Aussage „keine externen Dienste eingebunden" streichen oder präzisieren.
3. §3.6 korrigieren: Chat-Übertragung als P2P via WebRTC DataChannel beschreiben (nicht Server-Relay).

---

## 5. TURN-Server-Betreiber: Fehlender Auftragsverarbeitungsvertrag

**Verletzter Artikel:** Art. 28 DSGVO (Auftragsverarbeitung)

**PDF-Grundlage:** *Kapitel 3.2 (S. 47–49):* Anforderungen an die Auftragsverarbeitung — jede Datenverarbeitung durch Dritte im Auftrag muss vertraglich geregelt werden.

**Befund:** Der TURN-Server (`46.225.130.183`, `kamdi24-call.data-agents.de`) wird von einem externen Betreiber (data-agents.de) bereitgestellt. Wenn P2P-Verbindungen scheitern, fungiert der TURN-Server als Relay und verarbeitet dabei IP-Adressen sowie verschlüsselte Mediendaten der Nutzer. In der Datenschutzerklärung wird dieser Dienstleister weder genannt noch existiert ein erkennbarer Auftragsverarbeitungsvertrag (AV-Vertrag).

**Code-Referenz:**

```javascript
// customer.js, Zeilen 24–39 — drei TURN-Einträge mit gleichem Betreiber
{ urls: 'stun:46.225.130.183:3478' },
{ urls: 'turn:46.225.130.183:3478', username: 'kamdi24', credential: '...' },
{ urls: 'turns:kamdi24-call.data-agents.de:5349', username: 'kamdi24', credential: '...' }
```

**Empfehlung:**
1. AV-Vertrag (Art. 28 DSGVO) mit dem TURN-Server-Betreiber (data-agents.de) abschließen.
2. Den TURN-Server-Betreiber als Empfänger in `datenschutz.html` §9 aufnehmen.
3. Serverstandort klären — falls außerhalb der EU: Rechtsgrundlage für Drittlandsübermittlung sicherstellen.

---

## 6. Google STUN: Fehlende Rechtsgrundlage für Drittlandsübermittlung

**Verletzter Artikel:** Art. 44–49 DSGVO (Übermittlung in Drittländer)

**PDF-Grundlage:** *Anhang 1, Art. 44 ff. DSGVO:* Übermittlung personenbezogener Daten an Drittländer ist nur auf Grundlage eines Angemessenheitsbeschlusses, geeigneter Garantien oder Ausnahmetatbestände zulässig.

**Befund:** STUN-Anfragen an `stun.l.google.com` und `stun1.l.google.com` übermitteln die IP-Adresse des Nutzers an Google-Server in den USA. Für diese Drittlandsübermittlung existiert keine dokumentierte Rechtsgrundlage. Google ist weder als Empfänger in der Datenschutzerklärung genannt (§9), noch ist eine Rechtsgrundlage nach Art. 44 ff. DSGVO benannt.

**Code-Referenz:** `customer.js` Zeilen 22–23; `berater.js` Zeilen 24–25

**Empfehlung:** Siehe Punkt 1 — Google STUN entfernen (bevorzugt) oder mit Rechtsgrundlage in die Datenschutzerklärung aufnehmen.

---

## 7. Datenschutzbeauftragter nicht benannt / nicht dokumentiert

**Verletzter Artikel:** Art. 37–39 DSGVO, § 38 Abs. 1 BDSG, Art. 13 Abs. 1 lit. b DSGVO

**PDF-Grundlage:** *Kapitel 3.1 (S. 44–47):* „Bei den nichtöffentlichen Stellen hängt die Verpflichtung zur Benennung einer/s Beauftragten von der Zahl der in der Regel mit der automatisierten Verarbeitung personenbezogener Daten beschäftigten Personen ab. § 38 Abs. 1 BDSG legt hierbei eine Grenze von 20 Personen fest."

**Befund:** In der Datenschutzerklärung (`datenschutz.html`) fehlt jeglicher Hinweis auf einen Datenschutzbeauftragten (DSB). Art. 13 Abs. 1 lit. b DSGVO verlangt, dass die Kontaktdaten des DSB bei der Datenerhebung mitgeteilt werden — sofern ein DSB benannt ist oder benannt werden muss.

Falls die kamdi24 GmbH:
- mindestens 20 Personen ständig mit automatisierter Verarbeitung beschäftigt (§ 38 Abs. 1 BDSG), **oder**
- Verarbeitungen durchführt, die eine Datenschutz-Folgenabschätzung erfordern (Art. 37 Abs. 1 lit. b DSGVO),

ist die Benennung eines DSB **Pflicht**.

**Code-Referenz:** `datenschutz.html` — Abschnitt fehlt vollständig.

**Empfehlung:**
1. Prüfen, ob die Schwelle nach § 38 Abs. 1 BDSG erreicht wird.
2. Falls ja: DSB benennen und dessen Kontaktdaten in der Datenschutzerklärung veröffentlichen.
3. Falls nein: Kurze Feststellung in interner Dokumentation aufnehmen, warum kein DSB erforderlich ist.

---

## 8. Impressum: Pflichtangaben fehlen (§ 5 DDG)

**Verletztes Gesetz:** § 5 Digitale-Dienste-Gesetz (DDG)

**Befund:** Die Datei `impressum.html` enthält vier Platzhalter statt der gesetzlich vorgeschriebenen Angaben:

| Pflichtangabe | Aktueller Inhalt | Zeile |
|---------------|-----------------|-------|
| Vertretungsberechtigter (Geschäftsführer) | `[Name des Geschäftsführers]` | 81 |
| Handelsregisternummer | `[HRB-Nummer]` | 96 |
| Umsatzsteuer-ID | `[USt-ID]` | 103 |
| Verantwortlicher nach § 18 Abs. 2 MStV | `[Name]` | 109 |

**Empfehlung:** Alle Platzhalter umgehend durch die echten Angaben ersetzen. Ein unvollständiges Impressum kann abgemahnt werden und stellt einen Rechtsverstoß dar.

---

## 9. Verzeichnis der Verarbeitungstätigkeiten fehlt (Art. 30 DSGVO)

**Verletzter Artikel:** Art. 30 DSGVO, Art. 5 Abs. 2 DSGVO (Rechenschaftspflicht)

**PDF-Grundlage:** *Kapitel 1.4 (S. 23):* „Die Verantwortlichen [...] müssen die Einhaltung nachweisen können (sogenannte Rechenschaftspflicht, Art. 5 Abs. 2 DSGVO)."

**Befund:** Es existiert kein Verzeichnis der Verarbeitungstätigkeiten (VVT). Art. 30 Abs. 1 DSGVO verpflichtet jeden Verantwortlichen, ein solches Verzeichnis zu führen. Die Ausnahme für Unternehmen mit weniger als 250 Mitarbeitern (Art. 30 Abs. 5) greift nicht, wenn die Verarbeitung ein Risiko für die Rechte und Freiheiten der Betroffenen birgt — was bei Echtzeit-Video/Audio der Fall sein kann.

**Empfehlung:** Ein VVT erstellen, das mindestens folgende Verarbeitungen dokumentiert:
- Kundenname (Anzeige, RAM-only)
- Video-/Audio-Streams (P2P, keine Speicherung)
- WebRTC-Signaling (transient, RAM)
- Chat-Nachrichten (P2P DataChannel)
- Dateiübertragung (P2P DataChannel)
- Berater-Accounts (users.json)
- Server-Logs (Hosting-Provider)
- Login-Versuche (IP, Rate-Limiting)

---

## Zusammenfassung: 9 kritische Punkte nach Priorität

| Priorität | # | Problem | Maßnahme |
|-----------|---|---------|----------|
| **Sofort** | 3 | Klartext-Passwörter im Git | Passwörter ändern, Git-History bereinigen, `.gitignore` anpassen |
| **Sofort** | 2 | TURN-Credentials öffentlich | Serverseitigen Endpoint für temporäre Credentials implementieren |
| **Kurzfristig** | 1, 4, 6 | Google STUN undokumentiert + falsche Datenschutzerklärung | STUN-Server ersetzen oder offenlegen, Datenschutzerklärung korrigieren |
| **Kurzfristig** | 8 | Impressum unvollständig | Platzhalter durch echte Angaben ersetzen |
| **Mittelfristig** | 5 | TURN-Betreiber ohne AV-Vertrag | AV-Vertrag abschließen, Betreiber in Datenschutzerklärung aufnehmen |
| **Mittelfristig** | 7 | DSB nicht dokumentiert | Prüfung und ggf. Benennung eines DSB |
| **Mittelfristig** | 9 | Kein Verarbeitungsverzeichnis | VVT erstellen |

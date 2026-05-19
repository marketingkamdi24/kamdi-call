# Datenschutz-Checkliste: kamdi24 Video Call System

## Status-Legende
- [ ] Offen / Handlungsbedarf
- [x] Erledigt / Kein Handlungsbedarf

---

## 1. Bestandsaufnahme: Welche Daten werden verarbeitet?

### Serverseitig (server/index.js)
- [x] **Berater-Login-Daten** — Benutzername + Passwort in `users.json` (Klartext!)
- [x] **Socket-IDs** — temporär im Arbeitsspeicher, werden bei Disconnect gelöscht
- [x] **Kundenname** — wird vom Kunden eingegeben, nur im Arbeitsspeicher
- [x] **PeerJS-IDs** — temporär für WebRTC-Verbindung, nur im Arbeitsspeicher
- [x] **Chat-Nachrichten** — werden über Socket.IO weitergeleitet, NICHT gespeichert
- [x] **Datei-Sharing** — Dateien werden über Socket.IO weitergeleitet, NICHT gespeichert

### Clientseitig
- [x] **WebRTC Video/Audio** — Peer-to-Peer, läuft NICHT über den Server
- [x] **Screen-Share** — Peer-to-Peer, läuft NICHT über den Server
- [x] **Keine Cookies** gesetzt
- [x] **Kein localStorage/sessionStorage** verwendet
- [x] **Keine Analytics/Tracking-Scripts**

### Externe Dienste
- [ ] **Google Fonts** (`fonts.googleapis.com`) — lädt Schriftart "Inter" von Google-Servern → **IP-Adresse wird an Google übermittelt!**
- [ ] **unpkg.com** — PeerJS-Bibliothek wird von unpkg CDN geladen → **IP-Adresse wird an unpkg übermittelt!**
- [x] **PeerJS-Server** — selbst gehostet auf Render (kein externer PeerJS-Cloud-Service)
- [x] **Socket.IO** — selbst gehostet auf Render

---

## 2. DSGVO-Anforderungen

### 2.1 Rechtsgrundlage (Art. 6 DSGVO)
- [ ] **Einwilligung einholen** — Vor Nutzung der App muss der Kunde einwilligen (Kamera, Mikrofon, Datenverarbeitung)
- [ ] **Berechtigtes Interesse dokumentieren** — Falls keine Einwilligung: Dokumentation warum berechtigtes Interesse vorliegt (Art. 6 Abs. 1 lit. f)

### 2.2 Informationspflichten (Art. 13/14 DSGVO)
- [ ] **Datenschutzerklärung erstellen** — Muss folgendes enthalten:
  - Verantwortlicher (kamdi24, Adresse, Kontakt)
  - Zweck der Datenverarbeitung (Videoberatung)
  - Rechtsgrundlage
  - Empfänger der Daten (Render.com als Hoster, Google Fonts, unpkg)
  - Speicherdauer
  - Rechte der Betroffenen
  - Hinweis auf Beschwerderecht bei Aufsichtsbehörde
- [ ] **Datenschutzerklärung verlinken** — Auf Kunden- UND Beraterseite sichtbar
- [ ] **Impressum** — Muss auf der Seite vorhanden sein (TMG §5)

### 2.3 Technische & Organisatorische Maßnahmen (Art. 32 DSGVO)
- [ ] **KRITISCH: Passwörter hashen!** — Passwörter werden aktuell im KLARTEXT in `users.json` gespeichert → bcrypt oder argon2 verwenden
- [ ] **KRITISCH: API-Endpunkte absichern** — `/api/users` ist OHNE Authentifizierung zugänglich → jeder kann alle User + Passwörter abrufen!
- [ ] **HTTPS erzwingen** — Render bietet HTTPS, aber ggf. HTTP→HTTPS Redirect prüfen
- [x] **WebRTC verschlüsselt** — WebRTC nutzt standardmäßig DTLS-SRTP (Ende-zu-Ende-Verschlüsselung)
- [x] **Keine serverseitige Aufzeichnung** — Video/Audio wird nicht gespeichert
- [x] **Keine Chat-Protokollierung** — Chat-Nachrichten werden nicht gespeichert

### 2.4 Auftragsverarbeitung (Art. 28 DSGVO)
- [ ] **AV-Vertrag mit Render.com** — Der Hosting-Provider verarbeitet Daten im Auftrag → AV-Vertrag abschließen
- [ ] **AV-Vertrag mit Google** (falls Google Fonts weiter genutzt wird)
- [ ] **Serverstandort prüfen** — Render.com: Wo stehen die Server? (US/EU?) → Drittlandtransfer?

### 2.5 Verzeichnis der Verarbeitungstätigkeiten (Art. 30 DSGVO)
- [ ] **Verarbeitungsverzeichnis erstellen** — Dokumentation aller Datenverarbeitungen

---

## 3. Konkrete Handlungsempfehlungen (priorisiert)

### KRITISCH (sofort umsetzen)
1. **Passwörter hashen** — `users.json` speichert Klartext-Passwörter → bcrypt verwenden
2. **API absichern** — `GET /api/users` gibt ALLE User mit Passwörtern zurück, OHNE Auth-Check
3. **Google Fonts lokal hosten** — Font "Inter" herunterladen und selbst hosten (EuGH: Google Fonts = Datenschutzverstoß, LG München 2022)
4. **PeerJS lokal hosten** — `peerjs.min.js` von unpkg.com lokal einbinden statt CDN

### WICHTIG (zeitnah umsetzen)
5. **Datenschutzerklärung** erstellen und auf allen Seiten verlinken
6. **Impressum** hinzufügen
7. **Cookie-/Einwilligungsbanner** — Zumindest Hinweis auf Kamera/Mikrofon-Nutzung VOR dem Zugriff
8. **AV-Vertrag mit Render.com** abschließen

### EMPFOHLEN (mittelfristig)
9. **Rate-Limiting** für Login-Versuche (Brute-Force-Schutz)
10. **Session-Management** — Aktuell keine echte Session-Verwaltung
11. **Logging minimieren** — Server loggt Benutzernamen bei Login/Disconnect → prüfen ob nötig
12. **TURN-Server** — Falls WebRTC über TURN-Relay läuft: Wo steht der Server?

---

## 4. Zusammenfassung

| Bereich | Status |
|---------|--------|
| Video/Audio Peer-to-Peer | ✅ Gut (verschlüsselt, kein Server-Recording) |
| Chat-Daten | ✅ Gut (nicht gespeichert) |
| Externe Ressourcen | ❌ Google Fonts + unpkg CDN |
| Passwort-Sicherheit | ❌ Klartext-Speicherung |
| API-Sicherheit | ❌ Keine Authentifizierung |
| Datenschutzerklärung | ❌ Fehlt komplett |
| Impressum | ❌ Fehlt komplett |
| AV-Verträge | ❌ Nicht vorhanden |

**Gesamtbewertung: Die App hat eine gute Grundarchitektur (P2P, kein Recording), aber es gibt kritische Sicherheitslücken (Klartext-Passwörter, ungeschützte API) und fehlende rechtliche Pflichtangaben (Datenschutzerklärung, Impressum).**

# Projekt online verfügbar machen – sicher

## Empfehlung: **ngrok verwenden**

| | ngrok | Öffentliche IP |
|---|---|---|
| **Sicherheit** | Server-IP bleibt verborgen | IP direkt im Internet sichtbar → Angriffsfläche |
| **HTTPS** | Automatisch dabei | Manuelles SSL-Zertifikat nötig |
| **Firewall/Router** | Keine Änderung nötig | Portweiterleitung + Firewall-Regeln nötig |
| **Zugriffskontrolle** | Basic Auth (`--basic-auth`) möglich | Keine eingebaute Authentifizierung |
| **An/Aus** | Tunnel nur aktiv solange ngrok läuft | Dauerhaft offen |

## Start

```bash
ngrok http 3000
```

→ Gibt eine sichere `https://xxxx.ngrok-free.app` URL. Zugriff widerrufen = ngrok stoppen.

**Fazit**: ngrok ist sicherer, einfacher und schneller als eine offene IP.

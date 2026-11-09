# Rakeza HR

Bilingual (Arabic/English) human resources application for Windows desktop and responsive web. The desktop app supports a standalone device, a local-network host, and client devices. SQLite and document files remain on the host computer; clients communicate with its API over HTTPS.

## Development

Requirements: Windows and Node.js LTS.

```powershell
npm install
npm run dev:desktop
```

Build a Windows installer with `npm run package:desktop`. Electron downloads its official runtime on first launch/build, so network access to GitHub is required for that step.

## Deployment modes

- **Standalone:** application and SQLite database on one computer.
- **Host:** stores the shared database and files locally and serves client devices on the company LAN. Requires a trusted TLS certificate and an inbound Windows Firewall rule for port `47820`.
- **Client:** connects to the host using its HTTPS address. Each person signs in with an individual account.

Data is stored under `%LOCALAPPDATA%\Rakeza HR\data`. Do not share the SQLite file directly over a network drive. The current database file is not encrypted; protect the host with Windows account permissions and BitLocker before using real HR data.

## Documentation

- [Arabic setup and operations guide](README-التسليم.md)
- [Visual and engineering analysis](docs/01-الملخص-والتحليل.md)
- [Design tokens and responsive wireframes](design/)
- [OpenAPI specification](engineering/openapi.yaml)

The Windows installer is currently unsigned. Review the operational and production-readiness notes in the Arabic guide before distributing it.

# opnForm

Internal form builder (Zoho Forms style) for the travel team.

Stack: React + Vite + MUI (free), Laravel REST API + Sanctum, MySQL, SurveyJS Form Library (MIT)
with a custom builder, PDF via headless Chromium (phase 6), file storage via Flysystem
(local / Nextcloud WebDAV / S3).

## Requirements (Windows)

- Docker Desktop (WSL2 backend) running
- Git
- PowerShell 5.1 or 7

## Run

```powershell
# first time only (creates .env, scaffolds Laravel, starts everything, migrates)
.\dev.ps1 init

# every day
.\dev.ps1 up
```

If PowerShell blocks scripts: `powershell -ExecutionPolicy Bypass -File .\dev.ps1 init`

| Service  | URL                    |
|----------|------------------------|
| Frontend | http://localhost:5173  |
| API      | http://localhost:8000  |
| MySQL    | localhost:3307         |

Other commands: `.\dev.ps1 down | logs | ps | artisan <args> | composer <args> | npm <args> | nextcloud`

Local Nextcloud (optional, for integration tests): `.\dev.ps1 nextcloud` then open http://localhost:8080.

## Notes

- Secrets live only in `.env` (git-ignored). Copy `.env.example` if you prefer manual setup.
- Config for Laravel comes from the root `.env` through docker compose; there is no `api/.env`.
- Line endings are forced to LF by `.gitattributes`. Do not save `.env`, `*.conf` or `*.yml` with CRLF/BOM.
- Frontend `node_modules` lives in a Docker volume (fast on Windows). Your editor will not see it on the
  host; run `npm install` locally too if you want IntelliSense.
- Bind-mounted PHP code is slowest when the repo is on `C:\`. If Laravel feels slow, clone the repo inside WSL2
  (`\\wsl$\...`) instead.
- The browser only talks to `:5173`; Vite proxies `/api`, `/sanctum`, `/up` to nginx (no CORS needed in dev).

## Git

Branch `develop`. Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). Never force-push.

# rim-updater — Settings › อัปเดตระบบ

A small container next to RIM that installs new versions when a SUPER_ADMIN presses the button.
The backend (`modules/system`) forwards requests to it on the app's Docker network with a shared secret.

## Channels (Docker Hub tags)

| Tag       | Who follows it        | Published by                                            |
|-----------|-----------------------|---------------------------------------------------------|
| `:latest` | Test Server           | `.\build-release.ps1 -Version X.Y.Z` (every build)       |
| `:stable` | customers (WS Server) | `.\build-release.ps1 -Version X.Y.Z -VerifyOnly -Promote` |

Release notes come from `frontend/src/data/releases.json` — build-release copies the file into the
backend image (`/app/releases.json`). An entry may list `"manual": ["..."]` steps (e.g. SQL to run
by hand); the update screen shows them and asks for confirmation before installing.

## One-time setup on a server

```bash
# from the dev PC
scp -r deploy/updater <user>@<server>:<app folder>/rim-updater
# on the server
cd <app folder>/rim-updater && chmod +x setup-updater.sh
./setup-updater.sh latest    # Test Server
./setup-updater.sh stable    # WS / customers
```

The script finds the running app (folder, compose project, network) from the `rim-backend`
container, writes `rim-updater/.env` (secret, channel), starts `rim-updater`, adds
`UPDATER_URL` / `UPDATER_SECRET` to the app's backend environment and restarts backend + nginx.
Run it again after changing files in this folder (keeps the secret).

## What an install does

prepare (disk, compose sanity) → **backup** (`<app>/backups/before_<ver>_<time>.sql.gz`) →
set tags in `docker-compose.yml` + `RIM_VERSION` in `.env`, pull, verify image version/commit →
recreate backend, wait until healthy and running the new commit → recreate frontend + nginx →
prune old images. Any failure restores `docker-compose.yml` / `.env` and starts the previous images
again. The database is not restored automatically (the backup is kept and shown on the screen).

`ws-update.sh` still works as a manual fallback.

## Tests

```bash
node --test deploy/updater/updater.test.mjs
```

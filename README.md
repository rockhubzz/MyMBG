# MyMBG Monorepo

MyMBG is a livestock management application consisting of a Next.js web app, an
ASP.NET Core API, and a PostgreSQL database (restored from a checked-in dump on
first boot). Everything ships as one Docker Swarm stack.

## Repository layout

```
MyMBG/
├── apps/
│   ├── web/            Next.js frontend (React 19, Tailwind 4)   → mymbg-web:local
│   └── backend/        ASP.NET Core 10 API + EF Core (Npgsql)    → mymbg-backend:local
├── packages/
│   └── db/             PostgreSQL schema/seed SQL (canonical dump: mymbg.sql)
├── deploy/
│   ├── postgres.Dockerfile     postgres:18 image with first-boot restore
│   └── postgres/00-restore.sh  init script: restore dump + app role grants
├── scripts/
│   └── setup.sh        First-run setup wizard
├── docker-stack.yml    Swarm stack definition (db + backend + web)
├── Makefile            make setup / build / deploy / status / logs / stop
└── .env.example        Template for stack configuration
```

## Quick start (first-run wizard)

On a fresh machine with Docker installed, from the repository root run:

```bash
make setup        # or: ./scripts/setup.sh
```

The wizard walks you through, in order:

1. **Preflight** — verifies Docker Engine, daemon access, disk space, and the
   repository layout.
2. **Swarm mode** — runs `docker swarm init` if the node is not yet in a Swarm.
3. **Database secret** — creates `mymbg_postgres_password` as a Docker secret
   (generated random password, or one you type). Skipped if it already exists.
4. **`.env`** — created from `.env.example`; it asks for the published web port
   (default `3000`). Skipped if `.env` already exists.
5. **Image build** — builds `mymbg-backend:local`, `mymbg-web:local`, and
   `mymbg-postgres:local` with the correct build contexts.
6. **Deploy + verify** — `docker stack deploy mymbg`, waits for healthy
   replicas, and prints the URL.

Every step is idempotent — re-running the wizard never recreates an existing
secret, `.env`, or image, and never touches the database volume, unless the
volume is deleted manually.

Useful flags:

```bash
./scripts/setup.sh --no-build    # skip image builds (use existing images)
./scripts/setup.sh --no-deploy   # stop after building images
./scripts/setup.sh --yes         # assume yes at confirm prompts
```

## Everyday commands

| Command              | What it does                                        |
| -------------------- | --------------------------------------------------- |
| `make setup`         | First-run wizard (steps above)                       |
| `make build`         | Build all three images                               |
| `make deploy`        | (Re)deploy the stack using current `.env`            |
| `make rebuild`       | Build, then deploy                                   |
| `make status`        | Service and task status                              |
| `make logs-web`      | Follow web logs                                      |
| `make logs-backend`  | Follow backend logs                                  |
| `make logs-db`       | Follow database logs                                 |
| `make stop`          | Remove the stack (keeps the `postgres_data` volume)  |
| `make clean`         | Remove the stack **and delete the database volume**  |

## How the pieces fit together

- **Requests** arrive at `web:3000`. Browser calls stay same-origin
  (`/api/...`); a Next.js rewrite forwards them to `backend:5292`, so the API
  needs no public port.
- **Database** boots from `mymbg-postgres:local`, which restores
  `packages/db/mymbg.sql` once, on an empty volume, and grants the `mymbg` app
  role (`deploy/postgres/00-restore.sh`).
- **Secrets** — the PostgreSQL superuser and app role passwords both come from
  the Docker secret named by `POSTGRES_PASSWORD_SECRET` (default
  `mymbg_postgres_password`). Never commit passwords; `mymbg-db/sql creds.txt`
  was local-only scratch and should not be relied on.

## Local development

```bash
# Web (hot reload, API calls proxied to localhost:5292)
cd apps/web && npm install && npm run dev

# Backend (requires a local PostgreSQL)
cd apps/backend && dotnet run
```

## Multi-node Swarm

Build and push registry-qualified images, then point `BACKEND_IMAGE`,
`WEB_IMAGE`, and `POSTGRES_IMAGE` in `.env` at them before `make deploy`. See
`DOCKER.md` for the full deployment reference, including manual secret
creation and stack teardown.

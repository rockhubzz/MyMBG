# Docker Stack deployment

This deployment runs the complete MyMBG application as three Swarm services:
- `web`: Next.js production server on port `3000`.
- `backend`: ASP.NET Core API on the private Swarm network.
- `db`: PostgreSQL with the checked-in database dump restored on first startup.

The database password is supplied as a Docker secret. Do not put the password in
`docker-stack.yml`, `.env`, or a committed file.

## Prerequisites

- Docker Engine with Swarm mode enabled.
- A machine with enough disk space for the PostgreSQL volume.

Initialize Swarm once on a single-node host:

```bash
docker swarm init
```

If the host is already part of a Swarm, do not run `docker swarm init` again.

## Build the images

Run these commands from the repository root:

```bash
docker build \
  --tag mymbg-backend:local \
  --file apps/backend/Dockerfile \
  apps/backend

docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://backend:5292 \
  --tag mymbg-web:local \
  apps/web

docker build \
  --tag mymbg-postgres:local \
  --file deploy/postgres.Dockerfile \
  .
```

`NEXT_PUBLIC_API_URL=http://backend:5292` is the internal Swarm DNS address
used by the Next.js rewrite. Browser requests remain same-origin requests to
`/api/...`, and the rewrite forwards them to the backend's `/api/...` routes.
The backend therefore does not need a public port.

For a multi-node Swarm, push all three images to a registry and set
`BACKEND_IMAGE`, `WEB_IMAGE`, and `POSTGRES_IMAGE` to registry-qualified image
names in a copied `.env` file before deploying.

## Create the database secret

Create the external secret once. The same secret is used by the PostgreSQL
bootstrap user and the application database role created by the init script.

```bash
read -r -s POSTGRES_PASSWORD
printf '%s' "$POSTGRES_PASSWORD" | docker secret create mymbg_postgres_password -
unset POSTGRES_PASSWORD
```

If the secret already exists, keep it and skip this command. To use another
secret name, set `POSTGRES_PASSWORD_SECRET` before deploying.

## Deploy the stack

Copy the example environment file and load it into the shell used for
`docker stack deploy`:

```bash
cp .env.example .env        # or use make setup, which does this for you
set -a
. ./.env
set +a

docker stack deploy --compose-file docker-stack.yml mymbg
```

Check service and task status:

```bash
docker stack services mymbg
docker stack ps mymbg
```

Open the application at `http://<swarm-manager>:3000`.

The first database startup restores `packages/db/mymbg.sql` into the persistent
`postgres_data` volume, then grants the application role the required schema
privileges. The restore runs only when PostgreSQL initializes an empty volume.

## Updating the application

Build new image tags, update the image variables, and deploy again:

```bash
docker stack deploy --compose-file docker-stack.yml mymbg
```

For a multi-node Swarm, push the new tags before running the deploy command.

## Stop the stack

```bash
docker stack rm mymbg
```

Removing the stack does not remove `postgres_data`. Delete that volume only if
the database contents should be permanently discarded.

#!/usr/bin/env bash
# MyMBG first-run setup wizard.
# Guides a fresh machine from zero to a running Docker Stack:
#   preflight checks -> Swarm -> database secret -> .env -> build images -> deploy -> health check
#
# Usage:  ./scripts/setup.sh [--no-build] [--no-deploy] [--yes]
# Re-running the wizard is safe: every step is idempotent.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

STACK_NAME="${STACK_NAME:-mymbg}"
BACKEND_IMAGE_DEFAULT="mymbg-backend:local"
WEB_IMAGE_DEFAULT="mymbg-web:local"
POSTGRES_IMAGE_DEFAULT="mymbg-postgres:local"
SECRET_NAME_DEFAULT="mymbg_postgres_password"

NO_BUILD=0
NO_DEPLOY=0
ASSUME_YES=0

for arg in "$@"; do
  case "$arg" in
    --no-build)  NO_BUILD=1 ;;
    --no-deploy) NO_DEPLOY=1 ;;
    --yes|-y)    ASSUME_YES=1 ;;
    -h|--help)
      sed -n '2,6p' "$0"
      exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

STEP_TOTAL=6
STEP=0

info()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
ok()    { printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
warn()  { printf '  \033[0;33m!\033[0m %s\n' "$*"; }
fail()  { printf '  \033[0;31m✗\033[0m %s\n' "$*" >&2; exit 1; }
banner(){ printf '\n\033[1;35m%s\033[0m\n' "$*"; }

step() {
  STEP=$((STEP + 1))
  printf '\n\033[1;34m[Step %d/%d]\033[0m %s\n' "$STEP" "$STEP_TOTAL" "$*"
}

confirm() {
  if [ "$ASSUME_YES" -eq 1 ]; then return 0; fi
  local answer
  read -r -p "$1 [Y/n] " answer
  case "${answer:-Y}" in
    [Yy]*|"") return 0 ;;
    *)        return 1 ;;
  esac
}

banner "╔══════════════════════════════════════════╗"
banner "║        MyMBG — First-Run Setup            ║"
banner "║  web + backend + PostgreSQL (Swarm stack) ║"
banner "╚══════════════════════════════════════════╝"

# ── Step 1: preflight ──────────────────────────────────────────────
step "Preflight checks"

command -v docker >/dev/null 2>&1 \
  || fail "Docker is not installed. Install Docker Engine first: https://docs.docker.com/engine/install/"

docker info >/dev/null 2>&1 \
  || fail "Docker daemon is not reachable. Start Docker and log in to the docker group, then re-run."

ok "Docker $(docker --version | sed 's/Docker Engine //;s/, build.*//') detected"

AVAILABLE_MB=$(df -Pm "$REPO_ROOT" | awk 'NR==2 {print $4}')
if [ "$AVAILABLE_MB" -lt 5120 ]; then
  warn "Only ${AVAILABLE_MB} MB free on $REPO_ROOT — images + data may need more space"
else
  ok "${AVAILABLE_MB} MB disk space available"
fi

for path in apps/web/Dockerfile apps/backend/Dockerfile deploy/postgres.Dockerfile packages/db/mymbg.sql docker-stack.yml; do
  [ -f "$path" ] || fail "Repository file missing: $path — run this script from the repo root"
done
ok "Repository layout verified"

# ── Step 2: Swarm mode ─────────────────────────────────────────────
step "Docker Swarm"

SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}')
if [ "$SWARM_STATE" = "active" ]; then
  ok "Node is already in Swarm mode"
else
  if confirm "Enable Swarm mode on this host now (docker swarm init)?"; then
    docker swarm init
    ok "Swarm initialized"
  else
    fail "Swarm mode is required for docker stack deploy. Enable it later and re-run."
  fi
fi

# ── Step 3: database secret ────────────────────────────────────────
step "PostgreSQL password secret"

SECRET_NAME="$SECRET_NAME_DEFAULT"
if [ -f .env ]; then
  # shellcheck disable=SC1091
  SECRET_NAME="$(source .env 2>/dev/null && echo "${POSTGRES_PASSWORD_SECRET:-$SECRET_NAME_DEFAULT}")"
fi

if docker secret inspect "$SECRET_NAME" >/dev/null 2>&1; then
  ok "Secret '$SECRET_NAME' already exists — keeping it"
else
  printf "No secret '%s' found.\n" "$SECRET_NAME"
  echo "  1) Generate a strong random password (recommended)"
  echo "  2) Enter a password yourself"
  choice=""
  read -r -p "Choose [1]: " choice
  chosen="${choice:-1}"
  if [ "$chosen" = "2" ]; then
    read -r -s -p "Password: " secret_value; echo
    [ -n "$secret_value" ] || fail "Password cannot be empty"
  else
    secret_value="$(openssl rand -base64 24 2>/dev/null || head -c 32 /dev/urandom | base64)"
    echo "Generated password stored only in the Docker secret."
  fi
  printf '%s' "$secret_value" | docker secret create "$SECRET_NAME" -
  unset secret_value
  ok "Secret '$SECRET_NAME' created"
fi

# ── Step 4: environment file ───────────────────────────────────────
step "Environment configuration (.env)"

if [ -f .env ]; then
  ok ".env already exists — keeping current values"
  ok "(edit values there and re-deploy if you need to change them)"
else
  cp .env.example .env
  WEB_PORT_SUGGESTED="$(source .env 2>/dev/null && echo "${WEB_PORT:-3000}")"
  printf "Web UI port for http://<host>:<port>  [%s]: " "$WEB_PORT_SUGGESTED"
  read -r WEB_PORT_ANSWER
  WEB_PORT="${WEB_PORT_ANSWER:-$WEB_PORT_SUGGESTED}"
  case "$WEB_PORT" in
    ''|*[!0-9]*) fail "Port must be numeric" ;;
  esac
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$WEB_PORT" <<'PY'
import re, sys
value = sys.argv[1]
text = open(".env").read()
text = re.sub(r'^WEB_PORT=.*$', f'WEB_PORT={value}', text, flags=re.M)
open(".env", "w").write(text)
PY
  else
    sed -i.bak -e "s/^WEB_PORT=.*/WEB_PORT=${WEB_PORT}/" .env && rm .env.bak
  fi
  ok ".env written (WEB_PORT=${WEB_PORT})"
fi

# ── Step 5: build images ───────────────────────────────────────────
step "Build images"

load_env() { set -a; . ./.env; set +a; }

BACKEND_IMAGE="$(load_env && echo "${BACKEND_IMAGE:-$BACKEND_IMAGE_DEFAULT}")"
WEB_IMAGE="$(load_env && echo "${WEB_IMAGE:-$WEB_IMAGE_DEFAULT}")"
POSTGRES_IMAGE="$(load_env && echo "${POSTGRES_IMAGE:-$POSTGRES_IMAGE_DEFAULT}")"

build_image() {
  local tag="$1"; shift
  if docker image inspect "$tag" >/dev/null 2>&1 && [ "$NO_BUILD" -eq 1 ]; then
    ok "Skipping existing image $tag"
    return 0
  fi
  echo "  docker build -t $tag $*"
  docker build --pull --tag "$tag" "$@"
}

build_image "$BACKEND_IMAGE"  --file apps/backend/Dockerfile apps/backend
build_image "$WEB_IMAGE"      --build-arg NEXT_PUBLIC_API_URL=http://backend:5292 --file apps/web/Dockerfile apps/web
build_image "$POSTGRES_IMAGE" --file deploy/postgres.Dockerfile .
printf '\n'
ok "All three images built: $BACKEND_IMAGE, $WEB_IMAGE, $POSTGRES_IMAGE"

# ── Step 6: deploy + verify ────────────────────────────────────────
step "Deploy stack '$STACK_NAME'"

if [ "$NO_DEPLOY" -eq 1 ]; then
  warn "Deployment skipped (--no-deploy). Deploy later with:"
  echo "    set -a; . ./.env; set +a; docker stack deploy --compose-file docker-stack.yml $STACK_NAME"
else
  confirm "Deploy the stack now?" || { warn "Deployment skipped — re-run without --no-deploy, or run the manual command."; exit 0; }
  set -a; . ./.env; set +a
  docker stack deploy --compose-file docker-stack.yml "$STACK_NAME"
  ok "Stack deployed"

  echo
  info "Waiting for services to become healthy (first boot restores the database dump, this can take a few minutes)…"
  deadline=$((SECONDS + 600))
  while [ $SECONDS -lt "$deadline" ]; do
    pending=0
    while IFS=$'\t' read -r name replicas; do
      case "$replicas" in
        1/1) ok "$name: $replicas" ;;
        *)   warn "$name: $replicas"; pending=1 ;;
      esac
    done < <(docker stack services --format '{{.Name}}\t{{.Replicas}}' "$STACK_NAME")
    [ "$pending" -eq 0 ] && break
    sleep 5
  done

  WEB_PUBLISHED="$(docker service inspect "${STACK_NAME}_web" --format '{{(index .Endpoint.Ports 0).PublishedPort}}' 2>/dev/null || true)"
  WEB_PUBLISHED="${WEB_PUBLISHED:-3000}"

  if curl --output /dev/null --silent --fail "http://127.0.0.1:${WEB_PUBLISHED}/" 2>/dev/null; then
    ok "Web responded on port ${WEB_PUBLISHED}"
  else
    warn "Web not reachable yet on port ${WEB_PUBLISHED} — DB restore may still be running."
    echo "  Follow logs:   docker service logs -f ${STACK_NAME}_db ${STACK_NAME}_web"
  fi

  banner "Setup complete 🎉"
  echo "  Open:      http://<this-host>:${WEB_PUBLISHED}"
  echo "  Services:  docker stack services $STACK_NAME"
  echo "  Logs:      $ make logs-web   |   $ make logs-backend   |   $ make logs-db"
  echo "  Stop:      $ make stop (keeps database volume)"
fi

printf '\n'

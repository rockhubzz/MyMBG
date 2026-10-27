#!/bin/sh
set -e

POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-mymbg_db}"
POSTGRES_APP_USER="${POSTGRES_APP_USER:-mymbg}"

# Get password from Docker secret if available
if [ -n "${POSTGRES_PASSWORD_FILE:-}" ] && [ -f "${POSTGRES_PASSWORD_FILE}" ]; then
    export PGPASSWORD="$(cat "${POSTGRES_PASSWORD_FILE}")"
fi

echo "Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_APP_USER" 2>/dev/null; do
    echo "  PostgreSQL not ready yet, retrying..."
    sleep 2
done

echo "PostgreSQL is accepting connections, starting backend..."
exec dotnet MyMBG.dll

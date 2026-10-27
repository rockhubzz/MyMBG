#!/bin/sh
set -eu

: "${POSTGRES_APP_USER:?POSTGRES_APP_USER must be set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be loaded from the Docker secret}"

app_password="${POSTGRES_PASSWORD}"

psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --set=ON_ERROR_STOP=1 \
  --file /seed/mymbg.sql

# Patch chain, applied in dependency order (all idempotent):
#   1. keuangan_schema.sql         finance table + timestamp trigger
#   2. triggers_keuangan.sql       auto-create keuangan rows on produksi/distribusi
#   3. fix_keuangan_triggers.sql   corrected produksi trigger
#   4. add_kode_fields.sql         kode_produksi / kode_distribusi sequences
for patch in \
  keuangan_schema.sql \
  triggers_keuangan.sql \
  fix_keuangan_triggers.sql \
  add_kode_fields.sql
do
  echo "Applying patch: /seed/$patch"
  psql \
    --username "${POSTGRES_USER}" \
    --dbname "${POSTGRES_DB}" \
    --set=ON_ERROR_STOP=1 \
    --file "/seed/$patch"
done

psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --set=ON_ERROR_STOP=1 \
  --variable app_user="${POSTGRES_APP_USER}" \
  --variable db_name="${POSTGRES_DB}" \
  --variable app_password="${app_password}" <<'SQL'
SELECT format(
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'app_user'
        ) THEN 'ALTER ROLE %I WITH LOGIN PASSWORD %L'
        ELSE 'CREATE ROLE %I LOGIN PASSWORD %L'
        END,
    :'app_user',
    :'app_password'
)
\gexec

GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";
GRANT CREATE, USAGE ON SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO :"app_user";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO :"app_user";

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT ALL PRIVILEGES ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT ALL PRIVILEGES ON SEQUENCES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO :"app_user";
SQL

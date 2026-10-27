FROM python:3.12-alpine AS seed
WORKDIR /seed

COPY packages/db/mymbg.sql ./mymbg-utf16.sql
COPY packages/db/keuangan_schema.sql packages/db/triggers_keuangan.sql \
     packages/db/fix_keuangan_triggers.sql packages/db/add_kode_fields.sql ./
COPY deploy/postgres/normalize_sql.py .

# Normalize every SQL file to plain UTF-8 with LF line endings so psql can
# read them (the canonical dump is UTF-16, patch files may carry a BOM or
# CRLF line endings).
RUN python normalize_sql.py && mv mymbg-utf16.sql mymbg.sql

FROM postgres:18-alpine

COPY --from=seed /seed/mymbg.sql /seed/mymbg.sql
COPY --from=seed \
     /seed/keuangan_schema.sql \
     /seed/triggers_keuangan.sql \
     /seed/fix_keuangan_triggers.sql \
     /seed/add_kode_fields.sql \
     /seed/
COPY deploy/postgres/00-restore.sh /docker-entrypoint-initdb.d/00-restore.sh
RUN chmod 0755 /docker-entrypoint-initdb.d/00-restore.sh

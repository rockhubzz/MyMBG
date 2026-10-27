FROM python:3.12-alpine AS seed
WORKDIR /seed

COPY packages/db/mymbg.sql ./mymbg-utf16.sql
RUN python -c "from pathlib import Path; Path('mymbg.sql').write_text(Path('mymbg-utf16.sql').read_text(encoding='utf-16'), encoding='utf-8', newline='\\n')"

FROM postgres:18-alpine

COPY --from=seed /seed/mymbg.sql /seed/mymbg.sql
COPY deploy/postgres/00-restore.sh /docker-entrypoint-initdb.d/00-restore.sh
RUN chmod 0755 /docker-entrypoint-initdb.d/00-restore.sh

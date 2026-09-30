#!/usr/bin/env bash
# Ensure the Pazengo PostgreSQL is running, with schema + seed applied.
# Idempotent and safe to run on every `npm run dev` / `build` / `start`.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$HOME/.local/pgsql/usr/lib/postgresql/18/bin"
PG_LIB="$HOME/.local/pgsql/usr/lib/x86_64-linux-gnu"
PGDATA="$HOME/.local/pgsql-data"
PGLOG="$HOME/.local/pgsql.log"
PGHOST="localhost"
PGPORT="5432"
PGUSER="carmarket"
PGPASSWORD_VAL="carmarket"
PGDB="carmarketplace"

export PATH="$PG_BIN:$PATH"
export LD_LIBRARY_PATH="$PG_LIB:${LD_LIBRARY_PATH:-}"
export PGPASSWORD="$PGPASSWORD_VAL"

if [ ! -x "$PG_BIN/pg_ctl" ]; then
  echo "[db:ensure] ERROR: postgres binaries not found at $PG_BIN" >&2
  echo "[db:ensure] Re-install them (see README or re-run manual setup)." >&2
  exit 1
fi

# 1. Start server if not already accepting connections
if "$PG_BIN/pg_isready" -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1; then
  echo "[db:ensure] postgres already running at $PGHOST:$PGPORT"
else
  # Prefer systemd user service when available (keeps `systemctl --user status` in sync)
  if command -v systemctl >/dev/null 2>&1 && systemctl --user cat carmarket-db.service >/dev/null 2>&1; then
    echo "[db:ensure] starting postgres via systemd (carmarket-db.service)..."
    systemctl --user start carmarket-db.service || true
  fi
fi

# Fallback to direct pg_ctl if systemd didn't bring it up (e.g. fresh data dir)
if ! "$PG_BIN/pg_isready" -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1; then
  echo "[db:ensure] starting postgres (PGDATA=$PGDATA)..."
  mkdir -p "$PGDATA"
  # init if data dir is empty (fresh machine)
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "[db:ensure] initialising new cluster..."
    "$PG_BIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null
  fi
  "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$PGLOG" -o "-p $PGPORT -k /tmp" start
  # wait up to 15s
  for i in $(seq 1 15); do
    if "$PG_BIN/pg_isready" -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  "$PG_BIN/pg_isready" -h "$PGHOST" -p "$PGPORT"
fi

# 2. Ensure role + database exist (uses postgres superuser over trust auth)
"$PG_BIN/psql" -h "$PGHOST" -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$PGUSER') THEN
    CREATE ROLE "$PGUSER" WITH LOGIN SUPERUSER PASSWORD '$PGPASSWORD_VAL';
  END IF;
END
\$\$;
SQL
if ! "$PG_BIN/psql" -h "$PGHOST" -p "$PGPORT" -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PGDB'" | grep -q 1; then
  echo "[db:ensure] creating database $PGDB..."
  "$PG_BIN/psql" -h "$PGHOST" -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$PGDB\" OWNER \"$PGUSER\";"
fi

# 3. Ensure schema exists — only run `prisma db push` when tables are missing
HAS_USER_TABLE=$("$PG_BIN/psql" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -tAc "SELECT to_regclass('public.\"User\"');" || true)
if [ -z "$HAS_USER_TABLE" ] || [ "$HAS_USER_TABLE" = "" ]; then
  echo "[db:ensure] schema missing — running prisma db push..."
  (cd "$PROJECT_DIR" && npx prisma db push)
else
  echo "[db:ensure] schema present, skipping db push"
fi

# 4. Ensure seed data exists — only seed when User table is empty
USER_COUNT=$("$PG_BIN/psql" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -tAc 'SELECT count(*) FROM "User";' 2>/dev/null || echo "0")
USER_COUNT="$(echo "$USER_COUNT" | tr -d ' ')"
if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" = "0" ]; then
  echo "[db:ensure] empty database — running seed..."
  (cd "$PROJECT_DIR" && npm run -s db:seed)
else
  echo "[db:ensure] database already seeded ($USER_COUNT users), skipping seed"
fi

echo "[db:ensure] OK — database ready at $PGHOST:$PGPORT/$PGDB"

#!/bin/bash
# Dump the Travel Tracker database to context/backups/.
#
# Dev and production use *separate* Docker volumes (pgdata_dev vs pgdata), so
# starting the production stack never touches development data — but nothing
# protects either from `docker compose down -v`, which deletes volumes. Run
# this before any deploy, migration or stack change.
#
# Usage:
#   ./scripts/backup-db.sh            # dev container (default)
#   ./scripts/backup-db.sh prod       # production container
set -euo pipefail

TARGET="${1:-dev}"
case "$TARGET" in
  dev)  CONTAINER=travel_tracker_db_dev ;;
  prod) CONTAINER=travel_tracker_db ;;
  *) echo "Usage: $0 [dev|prod]"; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/context/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$OUT_DIR/${TARGET}-${STAMP}.sql"

mkdir -p "$OUT_DIR"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: container '$CONTAINER' is not running."
  exit 1
fi

USER_NAME="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-travel_tracker}"

echo "==> Dumping $DB_NAME from $CONTAINER"
docker exec "$CONTAINER" pg_dump -U "$USER_NAME" "$DB_NAME" > "$OUT"

# A dump that failed halfway still leaves a file, so check it looks complete.
if ! grep -q "PostgreSQL database dump complete" "$OUT"; then
  echo "ERROR: dump looks truncated — not keeping it."
  rm -f "$OUT"
  exit 1
fi

# Row counts straight from the dump, so the file itself is what gets verified
# rather than the database it came from.
count_rows() {
  sed -n "/^COPY public.$1 /,/^\\\\\./p" "$OUT" | grep -c "^[0-9]" || true
}
echo "==> Wrote $OUT ($(wc -c < "$OUT") bytes)"
echo "    visits:          $(count_rows visits)"
echo "    flight_journeys: $(count_rows flight_journeys)"
echo "    flight_legs:     $(count_rows flight_legs)"
echo "    users:           $(count_rows users)"
echo
echo "Restore into production with:"
echo "  cat $OUT | docker exec -i travel_tracker_db psql -U $USER_NAME -d $DB_NAME"

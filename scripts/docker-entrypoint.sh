#!/bin/sh
set -eu

PORT="${PORT:-10000}"
BACKUP_DIR="${BACKUP_DIR:-/var/data/backups}"

echo "Checking PostgreSQL client tools"
pg_dump --version
pg_restore --version
psql --version

echo "Preparing backup directory"
mkdir -p "$BACKUP_DIR"
probe="$BACKUP_DIR/.write-test"
echo ok > "$probe"
rm -f "$probe"

echo "Generating Prisma client"
npx prisma generate

echo "Running database migrations"
npx prisma migrate deploy

echo "Ensuring admin account"
npx tsx scripts/ensure-admin.ts

echo "Starting WEPS Backup Center on 0.0.0.0:${PORT}"
export HOSTNAME=0.0.0.0
exec node server.js

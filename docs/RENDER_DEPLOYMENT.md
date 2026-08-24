# Render deployment

Blueprint: `render.yaml`.

Creates:

- Web Service `weps-backup-center` (`runtime: docker`, plan `starter`)
- Persistent Disk 10 GB mounted at `/var/data`
- PostgreSQL `weps-backup-center-db` for Backup Center metadata

Persistent disks force a **single instance** and disable zero-downtime deploys.

## Steps

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Open `https://dashboard.render.com/blueprint/new?repo=<YOUR_REPO_URL>`.
3. Apply the Blueprint.
4. Fill secrets marked `sync: false`:
   - `SOURCE_DATABASE_URL`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD` (min 12 characters)
   - `BACKUP_ENCRYPTION_KEY` (32-byte hex or base64)
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `APP_URL` (full `https://...` service URL)
5. Confirm the disk mount is `/var/data`.
6. Wait for health checks on `/api/health`.
7. Sign in at `/login`.

`DATABASE_URL` is wired from the Blueprint database. Use the **internal** connection string on Render.

Source PostgreSQL is a different instance. Grant the backup role permission to `pg_dump` and `CREATE DATABASE` for restore tests.

If `pg_dump` is older than the source server major version, rebuild the Docker image with a newer `postgresql-client`.

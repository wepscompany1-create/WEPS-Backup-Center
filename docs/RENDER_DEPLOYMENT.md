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

## Production URL and Auth.js

- `APP_URL` is the canonical origin and must be the exact public HTTPS origin, for example
  `https://weps-backup-center.onrender.com` (no path).
- Remove any Render value that points `APP_URL`, `AUTH_URL`, or `NEXTAUTH_URL` to
  `localhost`. The application synchronizes the Auth.js aliases from `APP_URL` at startup.
- Redeploy after changing environment variables, clear the production-domain session
  cookie, and sign in again.

Verify the logged-out page redirect:

```sh
curl -sI https://weps-backup-center.onrender.com/
```

`Location` must stay on `https://weps-backup-center.onrender.com` and must never contain
`localhost`. An unauthenticated `POST /api/backups` must return 401 JSON without a
`Location` header.

## Source database connectivity

If the dashboard reports that the source database is disconnected:

1. Check service logs for `Source database health check failed`; the sanitized PostgreSQL
   error distinguishes DNS, timeout, TLS, and credential failures.
2. Confirm `SOURCE_DATABASE_URL` is a PostgreSQL connection string, not an HTTP service URL.
3. Use a Render private URL only when the database is reachable through the service's
   private network. Otherwise use the provider's external TLS URL and allow Render egress.
4. Confirm the backup user can connect and run `SHOW server_version`.
5. Confirm the installed `pg_dump` major version is not older than the source server.

## Secret rotation

Screenshots and support messages must mask secret values. If a secret was exposed:

- Rotate `ADMIN_PASSWORD`.
- Rotate `AUTH_SECRET` and expect all active sessions to be signed out.
- Do not rotate `BACKUP_ENCRYPTION_KEY` until old encrypted backups have either been
  migrated with the old key retained securely or intentionally removed.

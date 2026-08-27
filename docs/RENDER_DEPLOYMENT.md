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
   - `SOURCE_DATABASE_URL` — Internal URL of the source PostgreSQL, never `localhost`
   - `SOURCE_MAINTENANCE_DATABASE` — non-production database on the same instance, normally `postgres`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD` (min 12 characters; not a placeholder)
   - `BACKUP_ENCRYPTION_KEY` — generate locally with `npm run keygen` and paste the **hex** value (64 characters). No quotes, spaces, or `hex:` prefix.
   - `AUTH_SECRET` — generate a **separate** random value (min 32 characters). Do not reuse the backup encryption key.
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `APP_URL` (full `https://...` service URL)
5. Confirm the disk mount is `/var/data` and `BACKUP_DIR=/var/data/backups`.
6. Wait for health checks on `/api/health`. `status` should be `ok` and `backupReady` should be `true`.
7. Sign in at `/login`.

`DATABASE_URL` is wired from the Blueprint database. Use the **internal** connection string on Render.

Source PostgreSQL is a different instance. Grant the backup role permission to `pg_dump` and `CREATE DATABASE` for restore tests.

Production Restore also requires the source role to connect to `SOURCE_MAINTENANCE_DATABASE`, create candidate databases, and rename databases it owns. Do not grant superuser solely for this feature. Backup Center never terminates live-production sessions and never drops the live source database.

Maintenance window and rollback-retention values are stored in `SystemSettings` and edited in the application Settings page; they are not Render environment variables. Retention controls only when manual deletion of a registered `prod_previous_*` becomes available. No Render cron job should delete previous databases.

If `pg_dump` is older than the source server major version, rebuild the Docker image with a newer `postgresql-client`.

## Generating secrets

```sh
npm run keygen
# hex: <64 hex characters>   ← paste this into BACKUP_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# paste that independent value into AUTH_SECRET
```

Placeholder strings such as `REPLACE_WITH_...` are rejected. The dashboard stays available so you can see the blocking reason, but backup is disabled until real values are set.

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

## Production Restore on Render

Before enabling the workflow:

1. Set `SOURCE_MAINTENANCE_DATABASE=postgres` (or another provider-approved maintenance database) on the Backup Center web service and redeploy.
2. Verify the source role can connect to it and create a disposable database.
3. Check whether the provider permits `ALTER DATABASE ... RENAME`. Managed providers may restrict it.
4. Configure the Production Restore maintenance window and rollback retention in Settings.
5. Ensure the source application's service can be stopped and its connection pools drained before cutover.

The first action restores only to a registered `prod_restore_*` candidate. Controlled rename cutover is a second, independently re-authenticated action. Persistent Disk stores the encrypted artifact and controlled temporary dump, but the candidate and previous databases live on the source PostgreSQL instance.

### External URL-switch fallback

If rename permission is unavailable or policy forbids rename:

1. Leave the validated candidate in `AWAITING_EXTERNAL_CUTOVER`.
2. Suspend the source application service and workers.
3. In that source service's Render **Environment** tab, replace its `DATABASE_URL` with the candidate's provider connection string. Do not put this URL into Backup Center.
4. Redeploy/restart the source service and run full smoke tests.
5. Retain the former database according to provider policy and delete it only through a reviewed manual process.

If the source application is not hosted on Render, perform the equivalent secret update in its platform. Backup Center does not call the Render API or mutate another service's environment.

Render deploy/restart during an active Production Restore results in an interrupted job. Recovery never drops `prod_restore_*` or `prod_previous_*`; operators must review `INTERRUPTED`, `AWAITING_EXTERNAL_CUTOVER`, or `ROLLBACK_REQUIRED` against the runbook before retrying.

## Secret rotation

Screenshots and support messages must mask secret values. If a secret was exposed:

- Rotate `ADMIN_PASSWORD`. The next deploy runs `ensure-admin` and updates the stored hash.
- Rotate `AUTH_SECRET` and expect all active sessions to be signed out.
- Rotate database passwords in the Render Dashboard, then update `DATABASE_URL` and
  `SOURCE_DATABASE_URL`. Prefer Internal URLs on Render.
- Do not rotate `BACKUP_ENCRYPTION_KEY` until old encrypted backups have either been
  migrated with the old key retained securely or intentionally removed. If no successful
  encrypted backup exists yet, generate the first real key with `npm run keygen`.

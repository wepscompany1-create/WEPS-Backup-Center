# Security

- Single admin, no signup.
- Passwords hashed with Argon2id (`@node-rs/argon2`).
- Session cookies: HttpOnly, SameSite=Lax, Secure in production.
- Idle timeout via JWT `lastActivity`.
- Login rate limit + lockout after failed attempts.
- Zod validation on settings and credentials.
- `pg_dump` / `pg_restore` / `psql` spawned without a shell. Secrets go through `PG*` environment variables.
- Backup paths are resolved inside `BACKUP_DIR` only.
- Temp restore databases must match `restore_test_YYYYMMDD_<rand>` and a `RestoreTest` row before `DROP DATABASE`.
- Encryption key never stored in the database.
- Logger redacts URLs, passwords, cookies, and keys.
- Security headers: CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS in production.

## Production Restore threat model

Production Restore is an intentionally destructive administrative capability, but it never runs `pg_restore` against the live production database name.

- Eligibility requires a `SUCCESS` backup with `VALID` integrity, complete cryptographic metadata, an existing encrypted file, and a successful Restore Test for the same backup. There is no override.
- The first request requires an authenticated admin session, exact confirmation phrase and backup number, overwrite acknowledgement, and current-password re-authentication. A strict rate limit and the shared heavy-job lock prevent accidental or concurrent execution.
- Restore always targets a server-generated `prod_restore_YYYYMMDD_<rand>` candidate registered to its `ProductionRestore` row. Database names are never accepted from the client.
- Cutover is a second independent action after candidate validation. It requires fresh password re-authentication and a new confirmation. The first confirmation can never trigger cutover automatically.
- `DROP DATABASE` and `pg_terminate_backend` are always forbidden for the live source database. The only live-name mutation is the narrowly controlled cutover rename, after row, stage, current source name, candidate name, and maintenance-window checks.
- Cutover renames the original to a registered `prod_previous_*`, then the candidate to the original name. Intent and completion are journaled around each rename. If the second rename fails, the service attempts one compensating rename; failure enters `ROLLBACK_REQUIRED` and raises a critical audit event/notification.
- Open production sessions are not terminated by Backup Center. Operators must stop the source application and drain its pools. Missing rename permission or active sessions leave the validated candidate intact in `AWAITING_EXTERNAL_CUTOVER`.
- The external fallback requires an operator to update the source application's `DATABASE_URL` to the candidate and restart that application. Backup Center never reads, displays, or changes that external secret.
- `prod_previous_*` is retained for rollback and is never deleted by a scheduler or startup recovery. After the configured retention period, deletion remains a separate manual action with fresh re-authentication, exact confirmation, registry matching, and safety checks.
- Startup recovery never drops `prod_restore_*` or `prod_previous_*`. It reconciles journal and database existence into safe states such as `INTERRUPTED`, `AWAITING_CUTOVER`, `AWAITING_EXTERNAL_CUTOVER`, or `ROLLBACK_REQUIRED`.
- Event metadata is allowlisted. Passwords, connection strings, encryption material, dump paths, command arguments, and raw PostgreSQL output must not enter UI, audit metadata, email, or logs.

Residual risk: the application has one admin and no 2FA/two-person approval. Independent actions and re-auth reduce mistakes but do not provide true separation of duties. PostgreSQL database renames are also not one atomic multi-rename transaction; journaling and compensation reduce, but cannot eliminate, partial-cutover risk.

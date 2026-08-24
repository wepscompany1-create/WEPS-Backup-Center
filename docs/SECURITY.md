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
- No Production Restore API or UI control.

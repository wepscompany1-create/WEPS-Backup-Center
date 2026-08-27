# Backup flow

1. Validate configuration (source URL, encryption key, disk, pg tools).
2. Acquire `backup` lock. Fail if restore or backup already running.
3. Create `Backup` row (`PENDING` → `RUNNING`).
4. `pg_dump --format=custom --compress=9 --no-owner --no-privileges`.
5. Reject empty files.
6. `pg_restore --list` on the plaintext dump.
7. SHA-256 of the plaintext dump.
8. AES-256-GCM stream encrypt to `weps-backup-<ISO>-<id>.dump.enc` with mode `0600` when the OS allows it.
9. Delete the plaintext temp file in `finally`.
10. Keep the newest 7 successful files. Retention delete failure is a warning, not a backup failure.
11. Email + audit. Email failure does not mark the backup FAILED.

Statuses: `PENDING | RUNNING | SUCCESS | FAILED | INTERRUPTED`.

Stages: `PREPARING → DUMPING → VALIDATING → ENCRYPTING → SAVING → FINALIZING`.

## Production Restore eligibility

A successful backup is not automatically eligible for Production Restore. Before candidate creation, the production workflow independently requires:

- `status = SUCCESS` and `integrityStatus = VALID`;
- an existing encrypted file and complete SHA-256/IV/auth-tag metadata;
- a successful Restore Test for the same backup;
- no backup, Restore Test, or Production Restore holding the shared heavy-job lock;
- the configured maintenance window when that setting is enabled.

Retention must not delete a backup file used by an active Production Restore. Backup retention and production rollback retention are separate: `BACKUP_RETENTION_COUNT` governs encrypted files, while the database-backed production setting governs when a retained `prod_previous_*` becomes eligible for manual deletion. Neither retention policy automatically deletes a previous production database.

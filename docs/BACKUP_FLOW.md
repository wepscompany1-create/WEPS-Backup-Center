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

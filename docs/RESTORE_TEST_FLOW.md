# Restore Test flow

Manual only. Never scheduled after a backup.

1. Confirm the encrypted file exists inside `BACKUP_DIR`.
2. Decrypt to a temp dump using IV + auth tag from metadata.
3. Recompute SHA-256 and compare with the stored value. Mismatch aborts.
4. `pg_restore --list`.
5. Persist `tempDatabaseName` on `RestoreTest` (`restore_test_YYYYMMDD_<rand>`).
6. `CREATE DATABASE` on the source instance.
7. `pg_restore --no-owner --no-privileges` into the temp database.
8. Generic validation: connect, count user tables, `SELECT 1`.
9. `DROP DATABASE` after verifying prefix, registry row, and that the name is not the source or Backup Center database.
10. Delete plaintext temp file.

Restore Test remains non-destructive and separate from Production Restore:

- It never creates `prod_restore_*` or `prod_previous_*`, never renames production, and never changes an application's `DATABASE_URL`.
- It may drop only its registered `restore_test_*` database after all existing name and registry checks.
- A successful completed Restore Test for the same backup is a mandatory Production Restore eligibility gate. There is no administrative override.
- Restore Test success proves that the encrypted artifact can be decrypted, verified, restored, and queried. It does not approve cutover or replace the second cutover confirmation.
- Restore Test and Production Restore participate in the same heavy-job exclusion policy, so neither can overlap a backup or the other restore workflow.

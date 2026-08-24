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

There is no production restore path in this application.

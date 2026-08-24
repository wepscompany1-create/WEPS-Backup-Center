# Production restore runbook

This application will not restore onto the production database. Perform the cutover manually with a second engineer reviewing each step.

1. Sign in to WEPS Backup Center and download the encrypted file (`.dump.enc`) for a backup whose integrity is `VALID` and that passed a Restore Test.
2. On a trusted workstation, copy `BACKUP_ENCRYPTION_KEY` from the secret store (not from chat or tickets).
3. Decrypt with OpenSSL-compatible tooling or a short Node script using AES-256-GCM, the IV, and the auth tag stored in Backup Center metadata (hex fields `encryptionIv` and `encryptionAuthTag`).
4. Hash the decrypted dump with SHA-256 and compare to the value shown in Backup details.
5. Restore into a **new** database on the same instance or a clone, not onto the live production name:

```bash
pg_restore --no-owner --no-privileges --dbname=app_restore_candidate dump_file.dump
```

6. Run application smoke tests against the candidate database.
7. Perform cutover (rename databases / switch `DATABASE_URL`) only after validation, during a maintenance window.
8. Keep the previous production database until rollback is no longer needed.

Never paste connection strings, the encryption key, or dumps into tickets.

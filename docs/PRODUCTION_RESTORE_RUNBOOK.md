# Production restore runbook

Production Restore is manual-only and candidate-first. It never runs `pg_restore` over the live production name. The in-app cutover remains a separate action after validation and requires a second independent confirmation plus current-password re-authentication.

## Before starting

1. Announce a maintenance window and identify the source application owner.
2. Confirm the backup is `SUCCESS`, integrity is `VALID`, and the same backup has a successful Restore Test. There is no override.
3. Confirm free capacity for the decrypted temporary dump, candidate database, and retained previous database.
4. Confirm `SOURCE_DATABASE_URL` still identifies the expected production database and `SOURCE_MAINTENANCE_DATABASE` identifies a maintenance database such as `postgres`.
5. Confirm the source role can connect to the maintenance database, create a database, and rename databases it owns. Superuser access is not required and must not be added only for this feature.
6. Review notification delivery, audit access, and the configured maintenance window and previous-database retention period in Settings.

Never paste connection strings, passwords, encryption keys, decrypted dumps, or raw command output into tickets, chat, screenshots, or audit notes.

## Create and validate the candidate

1. Sign in and select **استعادة الإنتاج** on the eligible backup.
2. Review backup number, date, size, SHA-256, integrity, and successful Restore Test.
3. Keep the safe default, `RESTORE_ONLY`, unless the intent includes a later cutover. Neither mode performs cutover during this first action.
4. Complete the overwrite acknowledgement, exact phrase, backup-number check, and password re-authentication.
5. Monitor the record through decrypt, verify, create candidate, restore, and validate stages.
6. At `AWAITING_CUTOVER`, record the generated `prod_restore_*` candidate and review validation results. Run source-application smoke tests against the candidate where operationally possible.

If this phase fails, production is untouched. The service may delete only the registered candidate. A `CLEANING_FAILED` state requires an operator to inspect and remove that candidate safely; do not delete production or any `prod_previous_*` database.

## Controlled rename cutover

1. Stop the source application, workers, schedulers, and migration jobs. Drain connection pools and verify there are no active sessions to the live database.
2. Recheck the maintenance window and create a provider snapshot if available.
3. Open the ready restore record and choose the cutover action.
4. Review the exact original, candidate, and planned `prod_previous_*` names.
5. Complete the new downtime acknowledgement, exact cutover phrase, backup-number check, and fresh password re-authentication.
6. Backup Center connects through the maintenance database and performs only:
   - original database → registered `prod_previous_*`
   - registered candidate → original database name
7. Start the source application and run login, read, write, worker, and health checks.
8. Confirm audit events and production-restore notification delivery.

Backup Center never terminates sessions on the live database. If sessions remain, the cutover must fail safely. Do not bypass this by granting broad termination privileges.

## External `DATABASE_URL` fallback

Use this path when the provider blocks database rename, the source role lacks permission, or operational policy forbids the rename.

1. Leave the validated `prod_restore_*` candidate intact in `AWAITING_EXTERNAL_CUTOVER`.
2. Stop the source application and workers.
3. In the source application's hosting/provider settings—not Backup Center—change its `DATABASE_URL` to the candidate database using the provider's secure secret editor.
4. Redeploy or restart the source application, then perform complete smoke tests.
5. Preserve the former production database for rollback according to provider policy. The in-app `prod_previous_*` deletion workflow does not apply unless that database was created and registered by controlled rename.

Never put the external URL into Backup Center logs or record it as event metadata.

## Partial rename and recovery states

- `AWAITING_CUTOVER`: candidate validated; production name unchanged.
- `AWAITING_EXTERNAL_CUTOVER`: candidate validated, but rename cannot safely proceed. Use the external fallback.
- `INTERRUPTED`: the service restarted while work was active. Do not retry blindly; inspect the restore journal and database names.
- `ROLLBACK_REQUIRED`: original rename succeeded but candidate rename and automatic compensation could not safely complete. Keep the source application stopped and escalate immediately.
- `ROLLBACK_AVAILABLE`: cutover completed and the registered previous database remains inside its retention period.
- `CLEANING_FAILED`: cleanup of a failed candidate or later previous deletion failed. The named database requires reviewed manual action.

For `ROLLBACK_REQUIRED`, connect through the maintenance database, compare the actual database names with the restore record, and restore the original name only if the original name is absent and the registered `prod_previous_*` exists. Never issue `DROP`, never terminate production sessions, and never guess names. Preserve logs and obtain a second engineer's review where available.

Startup recovery does not drop or silently resume production candidates/previous databases. It reconciles recorded rename timestamps with database existence and chooses a safe state.

## Rollback after completed cutover

Keep the source application stopped. Prefer the provider's recovery process. For a rename rollback, verify the registered previous database and current database identities, move the current database to a new reviewed candidate name, rename the registered previous database back to the original name, then restart and test. This application does not expose an automatic rollback button.

## Delete the previous database

Deletion is never automatic. After `rollbackAvailableUntil` has passed:

1. Obtain application-owner confirmation that rollback is no longer required and required snapshots exist.
2. Verify the source application is healthy on the restored production database.
3. Use the separate **حذف قاعدة التراجع** action.
4. Complete its no-rollback acknowledgement, exact phrase, backup number, and fresh re-authentication.
5. Confirm the record reaches `previousDroppedAt` and review audit/email results.

The action may terminate sessions only on the registered `prod_previous_*`, never on the live source database. A retention expiry makes deletion eligible; it does not schedule or authorize automatic deletion.

## Emergency manual restore (historical fallback)

If Backup Center is unavailable, the previous manual process remains an emergency option: download the encrypted file on a trusted workstation, decrypt using secret-store material, verify SHA-256 and `pg_restore --list`, restore to a **new** candidate database with `--no-owner --no-privileges`, validate it, and perform a reviewed external URL switch. Never restore directly to the live database name.

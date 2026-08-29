# Production Restore flow

Production Restore is manual-only, candidate-first, and separate from Restore Test. Its invariant is:

> No decrypted dump is restored to the live database name, and no first-step confirmation can perform cutover.

## Preconditions

- Backup is `SUCCESS`, integrity is `VALID`, encrypted file and cryptographic metadata exist.
- The same backup has a successful Restore Test; no override is available.
- No backup, Restore Test, or Production Restore holds the shared heavy-job lock.
- The maintenance window permits the operation when enabled.
- `SOURCE_DATABASE_URL` and Backup Center `DATABASE_URL` identify different databases.
- `SOURCE_MAINTENANCE_DATABASE` is a non-production maintenance database on the source instance.

## Candidate phase

1. Validate eligibility and first destructive confirmation, including current-password re-authentication.
2. Persist the required successful Restore Test and a snapshot of the original database name.
3. Generate and register `prod_restore_YYYYMMDD_<rand>`; never accept a database name from the request.
4. Decrypt to a controlled temporary file.
5. Verify SHA-256 and run `pg_restore --list`.
6. Create the candidate through the maintenance database.
7. Run `pg_restore --no-owner --no-privileges` against the candidate only.
8. Validate connectivity, catalogs, table count, and configured safe checks.
9. Delete the plaintext file in `finally`.
10. Persist `AWAITING_CUTOVER`, release the heavy-job lock, and notify the admin.

Failure before candidate creation touches no database. Failure after creation may clean only the registered candidate after regex, row, and protected-name checks. Cleanup failure becomes `CLEANING_FAILED`; production remains unchanged.

## Cutover phase

Cutover is always a second independent request with a new phrase, backup-number check, downtime acknowledgement, and password re-authentication.

Preflight rechecks:

- status/stage is `AWAITING_CUTOVER`;
- candidate validation completed;
- current source database name still matches the recorded original;
- generated candidate/previous names match their record and regex;
- Backup Center database is not involved;
- maintenance window and heavy-job exclusion pass;
- original has no active sessions (the service does not terminate them);
- no target-name collision exists.

The rename journal and operations are ordered:

1. persist `originalRenameStartedAt`;
2. rename original → registered `prod_previous_YYYYMMDD_<rand>`;
3. persist `originalRenamedAt`;
4. persist `candidateRenameStartedAt`;
5. rename candidate → original;
6. persist successful cutover, `previousDatabaseName`, and `rollbackAvailableUntil`.

The only permitted mutation of the live source name is step 2 inside this controlled cutover. Production `DROP DATABASE` and production `pg_terminate_backend` are forbidden.

## Rename failure and compensation

- First rename fails: original remains live and candidate remains intact. Active-connection failures stay retryable in `AWAITING_CUTOVER`; only permission or provider rename denial moves to `AWAITING_EXTERNAL_CUTOVER`.
- First rename succeeds, second fails: attempt exactly one checked compensation rename from the registered previous name back to the now-absent original name.
- Compensation succeeds: production returns to its original name; record failure and keep the candidate.
- Compensation fails: enter `ROLLBACK_REQUIRED`, emit critical audit/email/UI signals, and perform no DROP or speculative retry.

## External cutover fallback

When rename cannot safely run:

1. keep the validated candidate in `AWAITING_EXTERNAL_CUTOVER`;
2. stop and drain the source application;
3. change that application's `DATABASE_URL` in its provider secret settings to the candidate;
4. restart and smoke test the source application;
5. preserve the former production database under provider policy.

Backup Center neither stores nor updates the external `DATABASE_URL`.

## Previous database retention

After controlled rename, `prod_previous_*` remains available for rollback. `productionRestoreRollbackRetentionHours` determines the earliest deletion time, not an automatic deletion time.

Deletion is a separate manual job after retention with a fresh password, exact phrase, no-rollback acknowledgement, heavy-job lock, registry/regex/protected-name checks, audit, and notification. Sessions may be terminated only for that registered previous database. Startup and the scheduler never delete it.

## Recovery after restart

Active records become `INTERRUPTED`; production databases are not automatically dropped. Recovery compares the journal with database existence:

- original + candidate, no previous: pre-cutover interruption; retain candidate and return to reviewed waiting state;
- no original + candidate + previous: partial rename; attempt checked compensation once or enter `ROLLBACK_REQUIRED`;
- original + previous, no candidate: rename likely completed; validate original read-only before reconciling success;
- any ambiguous combination: `ROLLBACK_REQUIRED`.

Recovery never uses prefix matching alone and never drops `prod_restore_*` or `prod_previous_*`.

## State summary

- `PENDING` / `RUNNING`: an active candidate, cutover, or deletion job owns the lock.
- `AWAITING_CUTOVER`: candidate is ready for the independent cutover action.
- `AWAITING_EXTERNAL_CUTOVER`: operator must switch the source application URL externally.
- `SUCCESS`: requested operation completed; after rename, previous retention may still be active.
- `INTERRUPTED`: restart interrupted active work; reconciliation is required.
- `FAILED`: failure ended safely with no unresolved rename.
- `ROLLBACK_REQUIRED` stage: database names need immediate reviewed intervention.
- `ROLLBACK_AVAILABLE` stage: previous database is retained and deletion is not yet allowed.
- `CLEANING_FAILED` stage: a registered non-live database requires manual cleanup review.

## Secret and logging rules

Events may include backup number, table count, safe database names, timestamps, stages, and error reference IDs. They must not include passwords, connection strings, encryption keys, IV/auth tags, dump paths, raw process arguments, or raw PostgreSQL stdout/stderr.

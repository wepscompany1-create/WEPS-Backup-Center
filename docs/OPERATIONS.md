# Operations

## First test after deploy

1. Login
2. Settings → اختبار الاتصال
3. Dashboard → إنشاء نسخة احتياطية الآن
4. Confirm integrity `صالح`
5. Download the `.dump.enc` file while signed in
6. Run Restore Test from the backups table
7. Confirm the temp database was dropped
8. Send a test email
9. Check سجل التدقيق

## Scheduler

Every ~30 seconds the process compares `nextScheduledBackupAt` with the current time. Default: every 2 days at 03:00 `Asia/Aden`. Changing the time recalculates the next run. After restart, at most one catch-up backup runs.

## Disk

Warning at 80%, critical at 90%. Backups are blocked when free space is very low. Retention never deletes an old file before the new backup is verified.

## Interrupted jobs

On startup, `RUNNING`/`PENDING` jobs become `INTERRUPTED`, leftover `weps-*` temp files are removed, and `restore_test_*` databases registered in `RestoreTest` are dropped.

Production Restore is different: startup recovery never drops `prod_restore_*` or `prod_previous_*`. It uses the persisted rename journal and actual database existence to select a conservative recovery state. `ROLLBACK_REQUIRED` is a critical human-intervention state; keep the source application stopped and follow `PRODUCTION_RESTORE_RUNBOOK.md`.

## Production Restore maintenance

Before candidate creation:

1. Confirm the selected backup is eligible and has a successful Restore Test.
2. Check space for the plaintext dump, candidate database, and retained previous database.
3. Verify source maintenance-database connectivity and provider rename permissions.
4. Ensure notification delivery and audit access are available.

Before cutover:

1. Enter the configured maintenance window when enabled.
2. Stop the source application, workers, schedulers, and migration processes.
3. Drain all source database connection pools. Backup Center does not call `pg_terminate_backend` on production.
4. Run the independent cutover confirmation and re-authentication.
5. Restart the source application only after a completed cutover or verified compensation, then run read/write smoke tests.

The Settings values are stored in `SystemSettings`, not environment variables:

- `productionRestoreMaintenanceEnabled`
- `productionRestoreMaintenanceStart` / `productionRestoreMaintenanceEnd` (`HH:mm`, using the configured timezone; overnight windows are supported)
- `productionRestoreRollbackRetentionHours` (default 24)

The retention value controls when manual previous-database deletion becomes eligible. It never schedules deletion.

## Production Restore operational states

- `AWAITING_CUTOVER`: validated candidate is ready; production remains unchanged.
- `AWAITING_EXTERNAL_CUTOVER`: keep the candidate and update the source application's `DATABASE_URL` externally.
- `ROLLBACK_AVAILABLE`: controlled rename succeeded and the previous database is retained.
- `INTERRUPTED`: inspect the journal/database state before retrying.
- `ROLLBACK_REQUIRED`: partial rename could not be compensated; keep source workloads stopped and escalate.
- `CLEANING_FAILED`: registered candidate/previous cleanup needs reviewed manual attention.

Only the registered candidate can be cleaned after a pre-cutover failure. Only a registered `prod_previous_*` can be manually deleted after retention and fresh confirmation. Never issue production `DROP` or terminate production sessions.

## Logs

JSON in production via Pino. Secrets are redacted. User-facing errors include an Arabic message and a reference id such as `WBC-...`.

## Test email (Resend)

Required environment variables — set them in `.env` locally and in the Render service Environment tab. `render.yaml` only declares the names with `sync: false`; that does **not** copy values onto the running service.

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` — must belong to a domain verified in Resend (for example `notifications@yourdomain.com`). `onboarding@resend.dev` only works for Resend’s own test recipients.

Do not put these values in Git, logs, or API responses.

The **إرسال رسالة اختبار** button sends the address currently in the field. You do not need to save the field first, and the test does not save it implicitly.

### Local diagnosis

1. Confirm both variables are set in `.env` (empty values count as missing).
2. Restart `npm run dev` after changing env.
3. Sign in → Settings → enter a recipient → إرسال رسالة اختبار.
4. Read the toast and `NotificationLog`:
   - `503` / `MISSING_API_KEY` or `MISSING_FROM_EMAIL`: env not loaded.
   - `502` / `RESEND_FAILED`: Resend rejected the message (unverified domain, disallowed From, or provider error). Details stay in server logs, not the browser.
   - `400`: invalid recipient in the field.
   - `429`: too many test requests from the same user.

### Render diagnosis

1. Open the web service → Environment and confirm `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are actually set.
2. Verify the sending domain in the Resend dashboard before testing production.
3. After deploy, repeat the same in-app test, then check the deploy log, app log, `NotificationLog`, and the recipient inbox (including Spam).

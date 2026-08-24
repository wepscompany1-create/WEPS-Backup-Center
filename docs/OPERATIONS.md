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

## Logs

JSON in production via Pino. Secrets are redacted. User-facing errors include an Arabic message and a reference id such as `WBC-...`.

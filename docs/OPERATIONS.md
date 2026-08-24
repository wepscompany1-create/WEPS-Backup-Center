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

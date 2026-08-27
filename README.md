# WEPS Backup Center

مركز داخلي آمن لإدارة النسخ الاحتياطية لقاعدة PostgreSQL: نسخ كامل مشفّر، جدولة كل يومين، اختبار Restore على قاعدة مؤقتة، ولوحة عربية RTL.

يوفر النظام مسارين منفصلين: **اختبار الاستعادة** غير المدمر على قاعدة مؤقتة، و**استعادة الإنتاج** اليدوية تشغيليًا إلى قاعدة مرشحة جديدة ثم تبديل مستقل ومؤكد. لا يستعيد النظام مباشرة فوق قاعدة الإنتاج الحية. راجع `docs/PRODUCTION_RESTORE_RUNBOOK.md` و`docs/PRODUCTION_RESTORE_FLOW.md`.

## الفكرة

- Source PostgreSQL منفصلة عبر `SOURCE_DATABASE_URL` (للقراءة أثناء `pg_dump` واختبار الاستعادة المؤقت).
- قاعدة صيانة على instance المصدر عبر `SOURCE_MAINTENANCE_DATABASE` (الافتراضي `postgres`) لتنفيذ أوامر إنشاء/إعادة تسمية القواعد دون الاتصال بقاعدة الإنتاج نفسها.
- قاعدة Backup Center مستقلة عبر `DATABASE_URL` للبيانات الوصفية والمصادقة والسجلات.
- الملفات النهائية المشفرة تُحفظ على Persistent Disk في `/var/data/backups`.

## المتطلبات

- Node.js 22
- PostgreSQL 14+ للمصدر ومركز النسخ
- أدوات العميل: `pg_dump`, `pg_restore`, `psql` (مضمّنة في صورة Docker)
- مفتاح AES-256 بطول 32 بايت

## التطوير المحلي

```bash
cp .env.example .env
# املأ القيم، وولّد المفتاح:
npx tsx scripts/generate-encryption-key.ts

docker compose -f docker-compose.dev.yml up -d
npx prisma migrate deploy
npx tsx scripts/bootstrap-admin.ts
npm run dev
```

عناوين التطوير المقترحة:

```env
DATABASE_URL=postgresql://weps:weps@localhost:5433/weps_backup_center
SOURCE_DATABASE_URL=postgresql://source:source@localhost:5434/source_app
BACKUP_DIR=./data/backups
```

## متغيرات البيئة

انظر `.env.example`. الأسماء فقط: `NODE_ENV`, `APP_URL`, `AUTH_URL`, `NEXTAUTH_URL`, `AUTH_SECRET`, `DATABASE_URL`, `SOURCE_DATABASE_URL`, `SOURCE_MAINTENANCE_DATABASE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `BACKUP_ENCRYPTION_KEY`, `BACKUP_DIR`, `BACKUP_RETENTION_COUNT`, `APP_TIMEZONE`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `MAX_LOGIN_ATTEMPTS`, `LOGIN_LOCK_MINUTES`, `SESSION_MAX_AGE_MINUTES`, `SESSION_IDLE_TIMEOUT_MINUTES`.

توليد `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Prisma

```bash
npx prisma generate
npx prisma migrate deploy
```

لا تستخدم `prisma db push` في الإنتاج.

المدير الأول يُنشأ مرة واحدة من `ADMIN_EMAIL` / `ADMIN_PASSWORD` عبر `scripts/bootstrap-admin.ts`. إذا وُجد حساب لا تُغيَّر كلمة المرور من البيئة.

## Backup

تدفق إلزامي: تحقق الإعدادات → قفل → `pg_dump` custom compress → `pg_restore --list` → SHA-256 → AES-256-GCM → كتابة القرص → الاحتفاظ بـ 7 نسخ → بريد → تدقيق.

## Restore Test

يدوي فقط. يفك التشفير، يطابق SHA-256، ينشئ `restore_test_YYYYMMDD_<rand>` على instance المصدر، يستعيد، يفحص، ثم يحذف قاعدة الاختبار. نجاحه لنفس النسخة شرط إلزامي قبل استعادة الإنتاج.

## Production Restore

يدوي فقط ولا يشغله المجدول. يفك النظام النسخة ويتحقق منها ثم يستعيدها إلى `prod_restore_YYYYMMDD_<rand>`؛ لا يمرر اسم الإنتاج الحي إلى `pg_restore`. تبقى القاعدة المرشحة بانتظار خطوة cutover بشرية ثانية تتطلب re-auth وتأكيداً جديداً.

يسمح cutover بإعادة تسمية مضبوطة فقط: قاعدة الإنتاج الحالية إلى `prod_previous_*` ثم المرشحة إلى الاسم الأصلي. يحظر دائماً `DROP` و`pg_terminate_backend` على قاعدة الإنتاج. إذا تعذرت إعادة التسمية، تبقى المرشحة ويُستخدم fallback خارجي لتغيير `DATABASE_URL` في التطبيق المصدر. قاعدة previous لا تُحذف تلقائياً؛ يحذفها المدير يدوياً فقط بعد انتهاء مدة الاحتفاظ.

## Docker

```bash
docker build -t weps-backup-center .
```

الصورة تثبّت PostgreSQL client tools وتشغّل migrations ثم bootstrap ثم `next start` على `0.0.0.0:$PORT`.

## Render

راجع `docs/RENDER_DEPLOYMENT.md` وملف `render.yaml`: Web Service + Docker + قرص 10GB على `/var/data` + Postgres لمركز النسخ.

## الاختبارات

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## الأمان

- Auth.js + Argon2id
- لا تسجيل عام
- تنزيل مشفّر عبر جلسة فقط
- لا أسرار في السجلات أو الواجهة
- تفاصيل إضافية في `docs/SECURITY.md`

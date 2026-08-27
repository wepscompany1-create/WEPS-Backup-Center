# PROMPT — Build `WEPS Backup Center` in Cursor

## الدور المطلوب منك

أنت مهندس برمجيات Senior Full-Stack + DevOps + Security Engineer.  
مهمتك هي **إنشاء مشروع كامل Production-Ready من الصفر** باسم:

**WEPS Backup Center**

المشروع عبارة عن منصة داخلية آمنة لإدارة النسخ الاحتياطية لقاعدة بيانات PostgreSQL أساسية لمشروع آخر، مع لوحة تحكم عربية RTL، وجدولة تلقائية، تشفير، فحص سلامة النسخ، واختبار Restore آمن على قاعدة مؤقتة.

> **مهم جدًا:** لا تكتفِ بإنشاء Scaffold أو واجهات شكلية. نفّذ المشروع فعليًا End-to-End، مع قاعدة البيانات، المصادقة، أوامر `pg_dump` و`pg_restore`، التشفير، الجدولة، السجلات، البريد، Docker، Prisma، وملفات النشر على Render.

---

# 1. الهدف الرئيسي

لدينا مشروع أساسي لديه قاعدة بيانات:

- PostgreSQL
- مستضافة على Render PostgreSQL
- حجمها الحالي أقل من 1 GB

نريد إنشاء مشروع مستقل باسم **WEPS Backup Center** يقوم بـ:

1. أخذ **Full Backup** من قاعدة البيانات الأساسية.
2. استخدام `pg_dump`.
3. إنشاء PostgreSQL Custom Format مضغوط.
4. التحقق من سلامة ملف النسخة.
5. حساب SHA-256.
6. تشفير النسخة باستخدام AES-256-GCM.
7. حفظ النسخة المشفرة على Render Persistent Disk.
8. الاحتفاظ بآخر **7 نسخ فقط**.
9. تنفيذ Backup تلقائي **كل يومين**.
10. السماح بإنشاء Backup يدوي من Dashboard.
11. إرسال تنبيهات بريدية عبر Resend.
12. السماح بتنزيل النسخة المشفرة بعد تسجيل الدخول فقط.
13. السماح بعمل Restore Test يدوي على قاعدة PostgreSQL مؤقتة.
14. حذف قاعدة Restore Test تلقائيًا بعد انتهاء الفحص.
15. **عدم السماح نهائيًا بعمل Restore مباشر على Production من لوحة التحكم أو API.**

---

# 2. الـ Tech Stack

استخدم:

- Next.js — App Router
- TypeScript strict mode
- React
- PostgreSQL
- Prisma ORM
- Auth.js
- Argon2 لتشفير كلمات المرور
- Docker
- PostgreSQL Client Tools:
  - `pg_dump`
  - `pg_restore`
  - `psql`
  - `createdb` / SQL `CREATE DATABASE`
  - `dropdb` / SQL `DROP DATABASE`
- Tailwind CSS
- shadcn/ui عند الحاجة
- Lucide Icons
- Resend
- Zod
- مكتبة مناسبة وآمنة للجدولة داخل Node.js أو Scheduler داخلي موثوق
- Node.js runtime، وليس Edge Runtime، لجميع العمليات التي تستخدم filesystem / child_process / crypto / PostgreSQL CLI.

يمكن استخدام مكتبات إضافية عند الحاجة، لكن:
- لا تستخدم مكتبات غير موثوقة أو غير ضرورية.
- استخدم أحدث نسخ Stable المتوافقة وقت التنفيذ.
- ثبّت الإصدارات في lockfile.
- لا تستخدم أي dependency Deprecated إذا يوجد بديل Stable.

---

# 3. UI / UX — UI UX Pro Max

يجب استخدام **UI UX Pro Max** فعليًا لتصميم المشروع.

المطلوب:

1. تثبيت UI UX Pro Max بالطريقة الرسمية الصحيحة المناسبة لبيئة Cursor.
2. لا تخترع أوامر تثبيت من عندك؛ تحقق من الطريقة الصحيحة المتاحة في البيئة أو الوثائق.
3. إنشاء Design System للمشروع.
4. إنشاء الملف:

```text
design-system/MASTER.md
```

5. يجب أن يكون `MASTER.md` هو المرجع الرئيسي لجميع:
   - الألوان
   - Typography
   - Spacing
   - Cards
   - Tables
   - Forms
   - Buttons
   - Dialogs
   - Status Indicators
   - Success / Warning / Error states
   - Light Mode
   - Dark Mode
   - RTL

نوع التصميم المطلوب:

> Enterprise Infrastructure / Database Management / SaaS Admin Dashboard

التصميم يجب أن يكون:
- احترافي جدًا.
- هادئ.
- واضح.
- غير مبالغ في المؤثرات.
- مناسب لنظام حساس خاص بقواعد البيانات.
- Accessibility جيدة.
- Responsive.
- Arabic-first.
- RTL بالكامل.
- يدعم Light Mode وDark Mode مع زر تبديل.

لا تستخدم Gradient أو Animations بشكل زائد.

---

# 4. اللغة والاتجاه

الواجهة بالكامل:

- اللغة: العربية.
- `dir="rtl"`
- Locale عربي.
- جميع النصوص الظاهرة للمستخدم بالعربية.
- أسماء المتغيرات والكود وقاعدة البيانات بالإنجليزية.
- استخدم تنسيق تواريخ واضح للمستخدم العربي.
- Timezone الافتراضي:

```text
Asia/Aden
```

---

# 5. البنية المعمارية

لدينا قاعدتا PostgreSQL منفصلتان:

## A. Source Database

قاعدة بيانات المشروع الأساسي.

Environment Variable:

```env
SOURCE_DATABASE_URL=
```

هذه القاعدة:
- مصدر النسخ الاحتياطية.
- لا تخزن فيها أي بيانات تخص Backup Center.
- لا تعدّل عليها أثناء Backup.
- لا تنفذ عليها Production Restore من التطبيق.

---

## B. Backup Center Database

قاعدة PostgreSQL مستقلة خاصة بمشروع WEPS Backup Center على Render.

Environment Variable:

```env
DATABASE_URL=
```

تستخدم لـ:
- Admin account.
- Backup metadata.
- Restore Test history.
- Audit logs.
- Scheduler settings.
- Notification logs.
- System settings.
- Job coordination / locking.

---

# 6. Render Architecture

المشروع سيتم نشره حاليًا على Render.

استخدم:

- Render Web Service.
- Docker deployment.
- Render PostgreSQL منفصل للمشروع.
- Render Persistent Disk.
- حجم القرص المبدئي:

```text
10 GB
```

Mount Path المقترح:

```text
/var/data
```

مجلد النسخ:

```text
/var/data/backups
```

أنشئ المجلد تلقائيًا عند التشغيل إذا لم يكن موجودًا.

## مهم

لا تعتمد على filesystem المؤقت لحفظ النسخ النهائية.

يمكن استخدام `/tmp` فقط بشكل مؤقت أثناء:
- إنشاء الـdump قبل التشفير.
- فك التشفير أثناء Restore Test.

يجب حذف الملفات المؤقتة في `finally` حتى لو فشلت العملية.

---

# 7. Docker

أنشئ Dockerfile Production-Ready.

يجب أن يتضمن:

- Node.js runtime مناسب.
- تثبيت PostgreSQL client tools.
- Prisma generate.
- Next.js production build.
- تشغيل migrations.
- Bootstrap admin.
- تشغيل التطبيق.

يفضل Multi-stage build.

لا تضع Secrets داخل Docker image.

تأكد من أن:

```bash
pg_dump --version
pg_restore --version
psql --version
```

تعمل داخل الـcontainer.

في Startup:
- تحقق من وجود مجلد Persistent Disk.
- تحقق من إمكانية الكتابة.
- تحقق من PostgreSQL client.
- لا تمنع تشغيل UI بالكامل إذا كانت Source DB غير متاحة؛ اعرض الحالة كـ Offline في Dashboard.

---

# 8. Environment Variables

أنشئ `.env.example` كاملًا بدون أي أسرار حقيقية.

استخدم على الأقل:

```env
# Application
NODE_ENV=production
APP_URL=
AUTH_SECRET=

# Backup Center DB
DATABASE_URL=

# Source PostgreSQL
SOURCE_DATABASE_URL=

# Initial Admin
ADMIN_EMAIL=
ADMIN_PASSWORD=

# Encryption
BACKUP_ENCRYPTION_KEY=

# Storage
BACKUP_DIR=/var/data/backups
BACKUP_RETENTION_COUNT=7

# Timezone
APP_TIMEZONE=Asia/Aden

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Optional operational configuration
MAX_LOGIN_ATTEMPTS=
LOGIN_LOCK_MINUTES=
SESSION_MAX_AGE_MINUTES=
SESSION_IDLE_TIMEOUT_MINUTES=
```

## Encryption Key

`BACKUP_ENCRYPTION_KEY` يجب أن يكون مفتاحًا مناسبًا لـ AES-256.

لا تستخدم Password مباشرة كمفتاح.

إما:
- Base64 encoded 32-byte key
أو
- Hex encoded 32-byte key.

تحقق من طول المفتاح عند Startup.

إذا كان غير صالح:
- لا تسمح بإنشاء Backup.
- اعرض Configuration Error واضح.
- لا تعرض قيمة المفتاح في Logs.

---

# 9. Admin Authentication

يوجد حاليًا **مدير واحد فقط**.

تسجيل الدخول:

- Email
- Password

استخدم:
- Auth.js.
- Argon2id لتشفير كلمة المرور.
- Secure HttpOnly cookies.
- SameSite.
- Secure cookies في Production.
- CSRF protection.
- Session management آمن.
- Auto logout بعد inactivity.
- Rate limiting لمحاولات تسجيل الدخول.
- تسجيل المحاولات الفاشلة في Audit Log.
- عدم وجود Public Registration.
- عدم وجود Signup page.

## إنشاء المدير الأول

المدير الأول يُنشأ من:

```env
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

اعمل Bootstrap script آمن.

السلوك المطلوب:

- إذا لا يوجد Admin:
  - أنشئ Admin من Environment Variables.
  - Hash password بـ Argon2id.
- إذا Admin موجود:
  - لا تغيّر Password تلقائيًا من Environment Variables.
  - لا تنشئ Duplicate.
- لا تسجل `ADMIN_PASSWORD` في Log.
- لا تخزن Password plaintext أبدًا.

مثال Startup:

```text
prisma migrate deploy
bootstrap admin
start application
```

لا يوجد 2FA حاليًا.

---

# 10. Prisma Data Model

صمم Prisma Schema نظيفًا وقابلًا للتوسع مستقبلًا.

على الأقل أنشئ Models/Enums تغطي:

## AdminUser

حقول مقترحة:
- id
- email
- passwordHash
- isActive
- lastLoginAt
- createdAt
- updatedAt

---

## Backup

حقول مقترحة:

- id
- backupNumber
- type
  - MANUAL
  - SCHEDULED
- status
  - PENDING
  - RUNNING
  - SUCCESS
  - FAILED
- integrityStatus
  - NOT_CHECKED
  - VALID
  - INVALID
- fileName
- storagePath
- originalDumpSizeBytes
- encryptedSizeBytes
- sha256
- encryptionIv
- encryptionAuthTag
- pgDumpVersion
- postgresServerVersion
- startedAt
- completedAt
- durationMs
- errorCode
- errorMessage
- initiatedById
- createdAt
- updatedAt

لا تحفظ أي Database Password هنا.

---

## RestoreTest

حقول مقترحة:

- id
- backupId
- status
  - PENDING
  - RUNNING
  - SUCCESS
  - FAILED
- tempDatabaseName
- startedAt
- completedAt
- durationMs
- integrityVerified
- databaseCreated
- restoreCompleted
- validationCompleted
- tempDatabaseDropped
- tableCount
- validationSummary
- errorCode
- errorMessage
- initiatedById
- createdAt

---

## AuditLog

سجل:

- id
- actorId
- action
- resourceType
- resourceId
- result
- ipAddress
- userAgent
- metadata
- createdAt

لا تضع Secrets أو Passwords أو Connection URLs الكاملة داخل metadata.

---

## SystemSettings

استخدم Singleton pattern.

على الأقل:

- id
- scheduleEnabled
- backupIntervalDays = 2
- backupLocalTime = "03:00"
- timezone = "Asia/Aden"
- nextScheduledBackupAt
- notificationEmail
- notifyOnBackupSuccess
- notifyOnBackupFailure
- notifyOnRestoreSuccess
- notifyOnRestoreFailure
- notifyOnIntegrityFailure
- createdAt
- updatedAt

البريد المستلم للتنبيهات يجب أن يكون قابلًا للتغيير من Dashboard.

لكن:

```env
RESEND_API_KEY
RESEND_FROM_EMAIL
```

تبقى Environment Variables فقط.

---

# 11. Backup Flow

أنشئ Backup Service مستقل ونظيف.

المراحل:

```text
START
↓
Validate configuration
↓
Check source DB connectivity
↓
Acquire backup lock
↓
Create Backup DB record
↓
Run pg_dump
↓
Validate dump
↓
Calculate SHA-256
↓
Encrypt using AES-256-GCM
↓
Write encrypted file to Persistent Disk
↓
Verify written file
↓
Update database metadata
↓
Apply retention
↓
Send email
↓
Audit log
↓
Release lock
↓
END
```

---

# 12. pg_dump

Backup يجب أن يكون:

- Full Database Backup.
- PostgreSQL Custom Format.
- Compressed.

استخدم `spawn` أو `execFile`.

**لا تستخدم shell command concatenation.**

لا تمرر Secrets في أوامر قابلة للحقن.

يفضل تحويل `SOURCE_DATABASE_URL` إلى PostgreSQL environment variables للعملية child process:

- PGHOST
- PGPORT
- PGUSER
- PGPASSWORD
- PGDATABASE
- PGSSLMODE

بدل بناء shell string.

مثال المفهوم:

```bash
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file=<temp-file>
```

عدّل خيارات `pg_dump` حسب النسخة الحديثة الفعلية إذا تغيّر syntax، لكن حافظ على:
- Custom Format.
- Compression.
- portability.
- no shell injection.

لا تستخدم plain `.sql` كصيغة النسخ الأساسية.

---

# 13. Backup File Naming

استخدم أسماء منظمة وغير متصادمة، مثل:

```text
weps-backup-2026-08-23T03-00-00-000Z-<short-id>.dump.enc
```

لا تستخدم اسم قاعدة البيانات أو Username إذا كان قد يكشف معلومات حساسة غير ضرورية.

---

# 14. Integrity Check

بعد إنشاء الـdump وقبل/أثناء حفظه:

قم تلقائيًا بـ:

1. التأكد أن الملف موجود.
2. التأكد أن حجمه > 0.
3. تنفيذ:

```bash
pg_restore --list <dump-file>
```

4. إذا فشل:
   - لا تعتبر Backup ناجحًا.
   - لا ترسل النسخة كنسخة صالحة.
   - سجل الخطأ.
5. حساب:

```text
SHA-256
```

على ملف الـdump الأصلي قبل التشفير.

6. خزّن checksum في Backup record.

في Restore Test:
- فك التشفير.
- احسب SHA-256 مرة أخرى.
- قارنه بالقيمة المسجلة.
- إذا اختلف:
  - أوقف Restore.
  - اعتبر النسخة Corrupted.

---

# 15. Encryption

استخدم:

```text
AES-256-GCM
```

المطلوب:

- Random IV لكل Backup.
- Auth Tag.
- لا تعيد استخدام IV.
- خزّن IV وAuth Tag في metadata.
- لا تخزن Encryption Key في DB.
- Encryption Key موجود فقط في Render Environment Variables.

يفضل تنفيذ encryption كـstream لتقليل الذاكرة.

التسلسل:

```text
pg_dump
↓
temporary custom dump
↓
integrity check
↓
SHA-256
↓
AES-256-GCM encryption
↓
/var/data/backups/*.dump.enc
↓
delete plaintext temp dump
```

تأكد من حذف Plaintext temporary dump حتى عند exception.

Permissions للملفات:
- اجعلها restrictive قدر الإمكان، مثل `0600`.

---

# 16. Retention Policy

الاحتفاظ بآخر:

```text
7 backups
```

فقط.

عند إنشاء Backup ثامن ناجح:

- حدد أقدم Backup ناجح.
- احذف ملفه من Persistent Disk.
- سجل عملية الحذف.
- احتفظ بسجل مناسب في Audit Log.

**لا تحذف Backup قديم قبل التأكد أن Backup الجديد نجح وتم تشفيره وكتابته والتحقق منه.**

إذا فشل حذف ملف قديم:
- لا تعتبر Backup الجديد فاشلًا.
- سجّل Maintenance Warning.
- أرسل/اعرض تنبيه.

Retention تشمل النسخ اليدوية والتلقائية معًا.

---

# 17. Automatic Backup Schedule

Backup تلقائي:

```text
كل يومين
```

الوقت الافتراضي:

```text
03:00
```

Timezone:

```text
Asia/Aden
```

لكن وقت النسخ يجب أن يكون **قابلًا للتغيير من Dashboard**.

المستخدم يستطيع:
- Enable / Disable auto backup.
- تغيير الوقت.
- رؤية موعد النسخة القادمة.

## لا تعتمد على Cron Job منفصل يحتاج الوصول إلى Persistent Disk

نفّذ Scheduler داخل نفس الخدمة التي لديها الوصول إلى القرص.

## Scheduler Reliability

لا تستخدم مجرد `setInterval(48 hours)`.

استخدم تصميم يعتمد على DB:

- `nextScheduledBackupAt`
- worker/scheduler loop يفحص الموعد بشكل دوري.
- بعد Backup ناجح أو محاولة مقررة، احسب الموعد التالي بطريقة صحيحة.
- استعمل Timezone `Asia/Aden`.
- تعامل مع restart بدون فقد schedule.

## Concurrency Lock

لا تسمح بتشغيل Backupين في نفس الوقت.

استخدم:
- PostgreSQL advisory lock
أو
- Job lock موثوق في Backup Center DB.

نفس الشيء بالنسبة لـ Restore Test.

إذا يوجد Backup جاري:
- Disable زر Backup Now.
- اعرض أن هناك عملية قيد التنفيذ.

---

# 18. Manual Backup

في Dashboard:

زر واضح:

```text
إنشاء نسخة احتياطية الآن
```

عند الضغط:

1. افتح Confirmation Dialog.
2. بعد التأكيد:
   - أنشئ العملية.
3. اعرض Progress/Status حقيقي:
   - Preparing
   - Dumping
   - Validating
   - Encrypting
   - Saving
   - Completed / Failed

لا تعرض Progress وهمي بنسبة مئوية إذا لم يكن لديك قياس حقيقي.

يمكن استخدام Step-based status.

---

# 19. Restore Test

Restore Test يجب أن يكون **يدويًا فقط**.

لا تنفذ Restore Test تلقائيًا بعد كل Backup.

من قائمة Backups:

زر:

```text
اختبار الاستعادة
```

عند الضغط:

- Confirmation Dialog واضح.
- وضح أن العملية ستنشئ Database مؤقتة ثم تحذفها.

## Restore Test Flow

```text
Select backup
↓
Verify encrypted file exists
↓
Decrypt to secure temp file
↓
Verify SHA-256
↓
Run pg_restore --list
↓
Create temporary PostgreSQL database
↓
Restore backup
↓
Run validation queries
↓
Save test results
↓
Drop temporary database
↓
Delete plaintext temp file
↓
Show result
```

---

# 20. Temporary Restore Database

قاعدة الاختبار المؤقتة تكون على **نفس Render PostgreSQL instance الخاص بقاعدة المشروع الأساسية**.

اسم آمن مثل:

```text
restore_test_20260823_<random>
```

يجب:
- منع SQL injection في database names.
- اسم database يكون مولدًا من النظام فقط.
- لا تسمح للمستخدم بإدخال اسم database.

إنشاء وحذف DB يجب أن يكون خارج transaction إذا PostgreSQL يتطلب ذلك.

---

# 21. Restore Validation

بعد `pg_restore` بنجاح، نفّذ فحوصات عامة لا تعتمد على Schema محدد:

- الاتصال بالقاعدة.
- التأكد من وجود public schema أو schemas المتوقعة.
- حساب عدد الجداول.
- التأكد أن عدد الجداول > 0 إذا النسخة الأصلية ليست فارغة.
- قراءة system catalogs.
- التأكد أن PostgreSQL لا يعيد errors.
- إمكانية تنفيذ SELECT بسيط.
- مقارنة معلومات عامة مع metadata إذا كانت متاحة.

لا تفترض أسماء جداول المشروع الأساسي.

احفظ:
- tableCount
- restore duration
- validation status
- summary

بعد انتهاء الفحص:
- احذف قاعدة الاختبار تلقائيًا.
- حتى إذا فشل restore حاول cleanup.
- إذا فشل DROP:
  - سجل Critical Warning.
  - اعرض اسم القاعدة المؤقتة للإدارة في سجل آمن حتى يمكن حذفها يدويًا.

---

# 22. Production Restore — ممنوع داخل التطبيق

هذه قاعدة حاسمة:

**لا تنشئ أي زر أو API أو Service يسمح باستعادة النسخة مباشرة إلى Production Database.**

لا يوجد:

```text
Promote to Production
Restore Production
Overwrite Production
```

ولا endpoint مخفي لهذا الغرض.

Production Restore يكون يدويًا خارج النظام فقط.

أنشئ في README:

```text
docs/PRODUCTION_RESTORE_RUNBOOK.md
```

يشرح للإدارة/مهندس النظام كيفية:
- تنزيل النسخة المشفرة.
- فك تشفيرها بشكل آمن.
- التحقق من SHA-256.
- استعادتها يدويًا إلى Database جديدة.
- التحقق منها.
- تنفيذ cutover يدوي إذا لزم.

لا تضع Secrets داخل الوثيقة.

---

# 23. Download Backup

من Dashboard يستطيع Admin تنزيل النسخة المشفرة:

```text
.dump.enc
```

المتطلبات:

- يجب أن يكون Logged In.
- لا يوجد public static URL.
- لا تضع ملفات backup تحت `/public`.
- استخدم authenticated streaming endpoint.
- تحقق من Backup id.
- تحقق أن الملف ضمن `BACKUP_DIR`.
- امنع Path Traversal.
- استخدم Content-Disposition.
- سجل Download في Audit Log.
- لا تفك التشفير أثناء التنزيل.
- المستخدم ينزل النسخة المشفرة فقط.

---

# 24. Delete Backup

Admin يستطيع حذف Backup يدويًا.

قبل الحذف:

- Confirmation Dialog.
- اعرض اسم النسخة والتاريخ.
- يفضل Confirmation قوي مثل كتابة كلمة:
  `حذف`
  أو كتابة اسم النسخة.

عند الحذف:
- احذف الملف.
- حدّث DB.
- Audit Log.
- لا تسمح بحذف Backup حالي قيد الإنشاء.
- لا تسمح بحذف Backup مستخدم حاليًا في Restore Test.

---

# 25. Email Notifications — Resend

استخدم:

```text
Resend
```

Environment Variables:

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

البريد المستلم للتنبيهات:
- مخزن في SystemSettings.
- قابل للتغيير من Dashboard.

أرسل Email عند:

1. Backup Success.
2. Backup Failure.
3. Restore Test Success.
4. Restore Test Failure.
5. Integrity Check Failure.
6. يمكن أيضًا إرسال تحذير مهم عند قرب امتلاء القرص.

رسائل البريد:
- عربية.
- مختصرة.
- احترافية.
- لا تحتوي Secrets.
- لا تحتوي Database URL.
- تحتوي:
  - نوع العملية.
  - الوقت.
  - النتيجة.
  - Backup ID.
  - الحجم عند النجاح.
  - Error reference ID عند الفشل.

أنشئ زر:

```text
إرسال رسالة اختبار
```

في إعدادات التنبيهات.

---

# 26. Disk Monitoring

Dashboard يجب أن يعرض:

- Disk total.
- Disk used.
- Disk available.
- Usage percentage.

استخدم Node/system API آمن لمعرفة مساحة `/var/data`.

إذا تجاوز الاستخدام Threshold مناسب مثل:
- Warning >= 80%
- Critical >= 90%

اعرض الحالة.

لا تحذف نسخًا إضافية خارج Retention تلقائيًا بسبب القرص بدون سياسة واضحة.

---

# 27. Dashboard

أنشئ Dashboard عربي احترافي.

## Header

- اسم المشروع: WEPS Backup Center
- حالة النظام.
- زر Light/Dark.
- Admin menu.
- Logout.

---

## Overview Cards

اعرض:

### 1. حالة قاعدة البيانات الأساسية
- متصلة
- غير متصلة

### 2. آخر Backup ناجح
- التاريخ
- الوقت
- منذ كم

### 3. موعد Backup القادم

### 4. عدد النسخ

مثال:

```text
5 / 7
```

### 5. إجمالي حجم النسخ

### 6. حالة آخر Backup

### 7. حالة آخر Restore Test

### 8. مساحة Persistent Disk
- Used
- Available
- Percentage

---

# 28. Dashboard Actions

أضف:

```text
إنشاء نسخة احتياطية الآن
```

مع حالة Disabled أثناء وجود Backup جاري.

أضف Quick Status:
- Auto backup enabled/disabled.
- Schedule.
- Alert email.
- System health.

---

# 29. Backups Page

أنشئ صفحة:

```text
/backup
```

أو اسم route مناسب.

Table احترافي يحتوي:

- Backup ID مختصر.
- النوع: يدوي / تلقائي.
- التاريخ.
- الوقت.
- الحالة.
- Integrity.
- الحجم.
- Duration.
- Initiated by.
- Actions.

Actions:
- التفاصيل.
- تنزيل.
- اختبار الاستعادة.
- حذف.

Filters:
- Status.
- Type.
- Date.
- Search by backup ID.

Pagination إذا لزم.

---

# 30. Backup Details

صفحة/Drawer/Modal تعرض:

- ID.
- Type.
- Status.
- Created time.
- Completed time.
- Duration.
- Dump size.
- Encrypted size.
- SHA-256.
- Integrity check.
- pg_dump version.
- server version.
- Restore tests history.
- errors sanitized.

لا تعرض:
- Encryption Key.
- DB Password.
- Full connection URL.

---

# 31. Restore Tests Page

صفحة تعرض:

- Restore Test ID.
- Backup.
- Started At.
- Completed At.
- Status.
- Duration.
- Temp DB cleanup status.
- Tables count.
- Integrity verification.
- Validation result.
- Error summary.

---

# 32. Audit Log Page

سجل جميع العمليات الحساسة:

- LOGIN_SUCCESS
- LOGIN_FAILED
- LOGOUT
- BACKUP_MANUAL_STARTED
- BACKUP_SCHEDULED_STARTED
- BACKUP_SUCCESS
- BACKUP_FAILED
- BACKUP_DOWNLOADED
- BACKUP_DELETED
- RESTORE_TEST_STARTED
- RESTORE_TEST_SUCCESS
- RESTORE_TEST_FAILED
- SETTINGS_UPDATED
- SCHEDULE_CHANGED
- EMAIL_TEST_SENT

اعرض:

- الوقت.
- Admin.
- الإجراء.
- النتيجة.
- IP.
- User Agent مختصر.
- Resource.

Filters:
- action
- result
- date

---

# 33. Settings Page

أنشئ صفحة إعدادات.

## Backup Schedule

- Enable automatic backup.
- Interval:
  - يعرض حاليًا `كل يومين`.
  - لا يحتاج المستخدم تغييره الآن إذا لم ترغب.
- Time picker.
- Timezone:
  - Asia/Aden
- Next run preview.

## Notifications

- Alert Email.
- toggles لأنواع التنبيهات.
- Send Test Email.

## System

اعرض read-only:
- Backup path.
- Retention = 7.
- Encryption = AES-256-GCM.
- Disk mount status.
- PostgreSQL client version.
- Application version.

لا تعرض Secret values.

---

# 34. Audit Logging

أنشئ helper/service مركزي:

```text
audit()
```

كل Action حساس يجب أن يمر به.

IP:
- تعامل بشكل صحيح مع Reverse Proxy / Render.
- لا تثق عشوائيًا في spoofed headers.
- استخدم header strategy مناسبة للمنصة.

metadata:
- sanitized.
- لا Secrets.
- لا Passwords.
- لا API Keys.
- لا encryption keys.

---

# 35. Error Handling

أنشئ Error taxonomy.

مثال:

- `SOURCE_DB_UNREACHABLE`
- `PG_DUMP_FAILED`
- `BACKUP_FILE_EMPTY`
- `INTEGRITY_CHECK_FAILED`
- `ENCRYPTION_FAILED`
- `DISK_WRITE_FAILED`
- `RETENTION_DELETE_FAILED`
- `RESTORE_DECRYPT_FAILED`
- `CHECKSUM_MISMATCH`
- `TEMP_DB_CREATE_FAILED`
- `PG_RESTORE_FAILED`
- `RESTORE_VALIDATION_FAILED`
- `TEMP_DB_DROP_FAILED`
- `RESEND_FAILED`

كل error:
- Internal detailed log.
- User-friendly Arabic message.
- Error reference ID.

لا تعرض raw stack traces للمستخدم في Production.

---

# 36. Logging

استخدم Structured Logger مثل Pino أو بديل موثوق.

المطلوب:
- JSON logs في Production.
- Pretty logs في development إذا مناسب.
- Correlation/request IDs.
- Job IDs.

Redaction mandatory:
- password
- authorization
- cookies
- `DATABASE_URL`
- `SOURCE_DATABASE_URL`
- `RESEND_API_KEY`
- `BACKUP_ENCRYPTION_KEY`
- `ADMIN_PASSWORD`

---

# 37. Database Connectivity Health

أنشئ health checks منفصلة:

## App DB
- Backup Center DB connection.

## Source DB
- Source PostgreSQL connection.

Dashboard يعرض الحالة بدون كشف credentials.

أنشئ endpoint مناسب مثل:

```text
/api/health
```

لكن:
- لا يعرض معلومات حساسة.
- يمكن أن يعطي:
  - app status
  - source db connected boolean
  - disk writable boolean
  - pg tools available boolean

إذا كان endpoint public، اجعل المعلومات محدودة جدًا.

---

# 38. Security Requirements

طبّق:

- Authentication على كل Dashboard routes.
- Authorization على كل API/action.
- Server-side validation بـZod.
- No shell interpolation.
- No arbitrary command execution.
- No arbitrary file path input.
- No arbitrary DB name input.
- Path traversal protection.
- CSRF protection.
- Rate limiting login.
- Secure cookies.
- Security headers.
- CSP مناسبة.
- `X-Content-Type-Options`.
- `Referrer-Policy`.
- `Permissions-Policy`.
- HSTS في Production إذا مناسب.
- لا expose source maps للعامة إذا غير ضرورية.
- لا تستخدم `dangerouslySetInnerHTML` بدون سبب.
- لا تخزن secrets في client bundle.
- لا تستخدم `NEXT_PUBLIC_` لأي Secret.
- Server Components/Server Actions يجب ألا تسرب بيانات حساسة.

---

# 39. Backup Operation Security

عملية Backup يجب ألا:
- تعدّل البيانات الأساسية.
- تنفذ migrations.
- lock tables بشكل غير ضروري.
- تستخدم Superuser إذا غير مطلوب.

`pg_dump` يجب أن يستخدم حسابًا لديه الصلاحيات الضرورية للقراءة.

لا تسجل SQL data أو customer data.

---

# 40. File Security

Backup directory:
- ليس public.
- permissions restrictive.

عند بناء path:
- استخدم backup ID من DB.
- Resolve path.
- تحقق أن resolved path داخل `BACKUP_DIR`.

لا تقبل اسم ملف مباشر من query parameter لتنزيل ملف.

---

# 41. Scheduler + Restart Safety

المشروع قد يعاد تشغيله على Render.

لذلك:

- schedule يجب ألا يعتمد على RAM فقط.
- `nextScheduledBackupAt` محفوظ في DB.
- عند Startup:
  - load settings.
  - إذا الموعد فات:
    - طبّق سياسة Catch-up محسوبة.
    - لا تشغل عدة Backups متراكمة.
    - شغل واحدة فقط إذا مناسب ثم schedule التالي.
- استخدم lock.
- لا تشغل Backup duplicate بسبب restart.

Persistent Disk قد يجعل الخدمة Single Instance؛ مع ذلك لا تعتمد على ذلك وحده.

---

# 42. Job State Recovery

إذا أعيد تشغيل السيرفر أثناء Backup أو Restore Test:

عند Startup:

- ابحث عن jobs حالتها RUNNING بشكل قديم.
- حدّثها إلى FAILED/INTERRUPTED إذا لم تعد هناك عملية.
- سجل Audit/System event.
- نظف temporary files القديمة بأمان.
- لا تحذف backup files السليمة.

يمكن إضافة status:
- `INTERRUPTED`

إذا كان ذلك يحسن الموديل.

---

# 43. Restore Test Cleanup

كل Restore Test يجب أن يستخدم `try/finally`.

حتى عند الخطأ:
- حاول Drop temp DB.
- حاول حذف decrypted temp dump.
- release lock.

أضف Startup cleanup آمن لـ:
- temp files القديمة.
- temp restore DBs التي تتبع naming prefix الخاص بالنظام فقط.

لا تحذف أي Database لا يبدأ بالprefix المعتمد.

---

# 44. UI States

كل صفحة يجب أن تدعم:

- Loading state.
- Empty state.
- Error state.
- Success state.
- Disabled state.
- Skeletons عند الحاجة.

لا تستخدم Toast فقط للعمليات المهمة؛ اعرض status دائم في الصفحة أيضًا.

---

# 45. Arabic Copy

استخدم مصطلحات عربية واضحة مثل:

- النسخ الاحتياطية
- النسخ التلقائي
- النسخ اليدوي
- اختبار الاستعادة
- سلامة النسخة
- قاعدة البيانات الأساسية
- مساحة التخزين
- سجل التدقيق
- إعدادات التنبيهات
- العملية قيد التنفيذ
- فشلت العملية
- اكتملت العملية بنجاح

يمكن إبقاء الكلمات التقنية المعروفة بجانب العربية عند الحاجة:
- Backup
- Restore
- PostgreSQL
- SHA-256
- AES-256-GCM

---

# 46. Light / Dark Mode

نفّذ Light + Dark Mode.

- احترم System preference أول مرة.
- خزّن preference.
- لا يحدث Flash مزعج أثناء load.
- كل Status colors يجب أن تكون واضحة في الوضعين.

---

# 47. Accessibility

طبّق:

- Keyboard navigation.
- Focus states.
- aria labels.
- Proper dialogs.
- Semantic HTML.
- Contrast مناسب.
- لا تعتمد على اللون وحده لشرح الحالة.

---

# 48. Responsive Design

Dashboard يجب أن يعمل على:

- Desktop.
- Laptop.
- Tablet.
- Mobile.

الجداول على Mobile:
- إما responsive cards
- أو horizontal scroll منظم.

لا تكسر RTL.

---

# 49. API / Server Architecture

استخدم Architecture واضحة مثل:

```text
src/
  app/
  components/
  features/
    auth/
    backup/
    restore/
    audit/
    settings/
    notifications/
  lib/
    db/
    auth/
    crypto/
    postgres/
    storage/
    scheduler/
    audit/
    logger/
    security/
  server/
  types/
```

يمكن تعديل الهيكل حسب أفضل ممارسة في Next.js الحالية.

لا تضع Business Logic معقد داخل React components.

افصل:
- backup service
- restore service
- encryption service
- storage service
- notification service
- scheduler service
- audit service

---

# 50. PostgreSQL Command Runner

أنشئ abstraction آمن:

```text
PostgresCommandRunner
```

مسؤول عن:
- `pg_dump`
- `pg_restore`
- version checks

متطلبات:
- spawn بدون shell.
- capture stdout/stderr بحدود آمنة.
- timeouts مناسبة.
- kill child process عند timeout.
- sanitized errors.
- لا logs للأسرار.

---

# 51. Database URL Parsing

استخدم parser موثوق لـ PostgreSQL URL.

يجب أن يدعم:
- ssl.
- encoded username/password.
- special characters.

لا تعمل split يدويًا على `:` و`@`.

عند إنشاء URL مؤقت لـ Restore Test:
- Parse safely.
- غيّر فقط database name.
- حافظ على host/port/user/password/ssl config.
- لا تعرض الناتج في logs.

---

# 52. Resend Failure Behavior

إذا Backup نجح لكن إرسال email فشل:

- Backup يبقى SUCCESS.
- Notification تسجل FAILED.
- اعرض Warning.
- لا تحول Backup إلى FAILED.

نفس المبدأ لRestore Test.

---

# 53. Disk Failure Behavior

قبل Backup:
- تحقق من مساحة كافية بشكل تقريبي.
- لا تفترض أن compression سيقلل دائمًا.

إذا المساحة منخفضة:
- امنع backup إذا الخطر مرتفع جدًا.
- اعرض warning.
- لا تحذف النسخ الحالية قبل نجاح النسخة الجديدة.

---

# 54. Source Database Version

اعرض:
- PostgreSQL server version.
- pg_dump client version.

تحقق من compatibility.

إذا client أقدم بشكل غير متوافق:
- امنع العملية.
- اعرض رسالة configuration.
- وثّق طريقة تحديث Docker image/client.

---

# 55. Initial Setup UX

لا يوجد Setup page عامة.

بعد النشر:
- Admin يأتي من env.
- يفتح `/login`.
- يدخل.
- Dashboard تعرض Configuration Checklist إذا أي شيء ناقص:
  - source DB
  - persistent disk
  - encryption key
  - Resend
  - notification email

لكن لا تعرض secret values.

---

# 56. Render Blueprint / Deployment Files

أنشئ ملفات مساعدة للنشر على Render، مثل:

```text
render.yaml
```

إذا كان مناسبًا.

لكن:
- لا تضع secrets.
- لا تفترض أن كل resource يمكن إنشاؤه تلقائيًا إذا Render Blueprint لا يدعم configuration معينة.
- وثّق ما يجب إنشاؤه يدويًا.

يجب توضيح:
- Web Service.
- Persistent Disk.
- 10 GB.
- mount path `/var/data`.
- Backup Center PostgreSQL.
- Environment Variables.
- Health check.
- Docker deployment.

---

# 57. README

أنشئ README شامل:

```text
README.md
```

يتضمن:

1. فكرة المشروع.
2. Architecture.
3. Requirements.
4. Local development.
5. Environment variables.
6. Prisma migration.
7. Docker.
8. Render deployment.
9. Persistent Disk setup.
10. Resend setup.
11. Encryption key generation.
12. Initial admin setup.
13. Backup workflow.
14. Restore Test workflow.
15. Retention policy.
16. Troubleshooting.
17. Security notes.
18. Production restore policy.
19. PostgreSQL client compatibility.

---

# 58. Documentation

أنشئ:

```text
docs/
  ARCHITECTURE.md
  SECURITY.md
  BACKUP_FLOW.md
  RESTORE_TEST_FLOW.md
  PRODUCTION_RESTORE_RUNBOOK.md
  RENDER_DEPLOYMENT.md
  OPERATIONS.md
```

---

# 59. Tests

أنشئ Test Suite حقيقية.

## Unit Tests

اختبر:
- encryption/decryption.
- checksum.
- filename generation.
- path validation.
- retention selection.
- schedule calculation.
- timezone logic.
- error sanitization.
- DB URL parsing.
- admin bootstrap logic.

## Integration Tests

عند الإمكان:
- backup service command builder.
- restore flow.
- Prisma repository.
- auth protections.

لا تحتاج اختبار PostgreSQL Production حقيقي.

يمكن استخدام test database محلي أو Docker/Testcontainers فقط في development إذا مناسب.

---

# 60. E2E

استخدم Playwright أو بديل مناسب.

على الأقل:
- login.
- invalid login.
- dashboard protected.
- settings update.
- backup list rendering.
- confirmation dialogs.
- audit page.

يمكن Mock العمليات الثقيلة في E2E.

---

# 61. Quality Gates

قبل اعتبار المشروع مكتملًا، شغّل:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

إذا استخدمت pnpm/yarn غيّر الأوامر بما يناسب المشروع.

لا تنهِ العمل مع:
- TypeScript errors.
- ESLint errors المهمة.
- Build failure.
- Broken Prisma migrations.

---

# 62. Database Migration

استخدم Prisma migrations.

أنشئ migration أولية.

في Production استخدم:

```bash
prisma migrate deploy
```

لا تستخدم:

```bash
prisma db push
```

كبديل دائم للProduction migrations.

---

# 63. Seed / Bootstrap

لا تضع Password ثابت في Seed.

استخدم:

```text
scripts/bootstrap-admin
```

ويقرأ من env.

اجعله idempotent.

---

# 64. Backup Status Lifecycle

استخدم حالات واضحة:

```text
PENDING
RUNNING
SUCCESS
FAILED
INTERRUPTED
```

ويمكن إضافة مراحل داخل `progressStage` مثل:

```text
PREPARING
DUMPING
VALIDATING
ENCRYPTING
SAVING
FINALIZING
```

UI يعرض المرحلة.

---

# 65. Restore Status Lifecycle

```text
PENDING
RUNNING
SUCCESS
FAILED
INTERRUPTED
```

Stages:

```text
PREPARING
DECRYPTING
VERIFYING
CREATING_DATABASE
RESTORING
VALIDATING
CLEANING_UP
COMPLETED
```

---

# 66. No Fake Progress

لا تستخدم progress percentage وهمية.

إما:
- stages فقط
أو
- percentage مبني على قياس حقيقي.

---

# 67. Concurrency

في أي وقت:

- Backup واحد فقط.
- Restore Test واحد فقط.

ويفضل:
- لا تسمح Backup وRestore Test معًا إذا سيؤثران على الموارد.

اعرض سبب تعطيل الأزرار.

---

# 68. Source Connection Testing

في Settings/System status:

زر:

```text
اختبار الاتصال
```

يعمل Server-side.

يعرض فقط:
- نجاح.
- فشل.
- latency تقريبية.
- PostgreSQL version.

لا يعرض:
- host secret details.
- username.
- password.
- connection string.

---

# 69. Notification Email Settings

المستخدم يستطيع تعديل:

```text
notificationEmail
```

تحقق منه بـZod.

بعد التغيير:
- Audit log.
- لا ترسل تلقائيًا إلا إذا اختار Test.

---

# 70. Important Destructive Action UX

للعمليات:
- Delete Backup.
- Restore Test.

استخدم Confirmation Dialog احترافي.

Restore Test ليس Production Restore، لكن قد يستهلك موارد.

وضح:
- العملية مؤقتة.
- سيتم إنشاء قاعدة مؤقتة.
- سيتم حذفها بعد الفحص.

---

# 71. No Production Restore UI

أكرر:

**ممنوع إنشاء Production Restore داخل Dashboard.**

حتى لو كان سهلًا تقنيًا، لا تنفذه.

ضع ملاحظة واضحة في UI:

> لأسباب أمنية، استعادة قاعدة البيانات الأساسية تتم يدويًا خارج النظام بعد التحقق من النسخة.

---

# 72. Source Database Safety

لا تنفذ على Source DB:
- DROP.
- TRUNCATE.
- ALTER.
- DELETE.
- migrations.

الاستثناء الوحيد:
- إنشاء/حذف قاعدة Restore Test إذا كانت الصلاحيات والمضيف يسمحان بذلك، وباسم prefix الخاص بالنظام.

يجب التأكد بشكل صارم أن DROP يستهدف فقط database مولدة بواسطة النظام.

---

# 73. Temporary Database Registry

لزيادة الأمان، لا تعتمد فقط على prefix.

سجل temp database في `RestoreTest` قبل استخدامها.

قبل DROP:
- تحقق من restoreTest record.
- تحقق من الاسم.
- تحقق من prefix.
- تحقق أنها ليست Source database name.
- تحقق أنها ليست Backup Center database name.

---

# 74. Prevent Self-Backup Mistakes

عند Startup:
- Parse `SOURCE_DATABASE_URL`
- Parse `DATABASE_URL`

إذا كانا يشيران لنفس database بالضبط:
- اعرض Critical Configuration Error.
- امنع backup jobs.
- لا تمنع login حتى يستطيع Admin رؤية الخطأ.

---

# 75. File Metadata

لا تعتمد على اسم الملف فقط.

Database record هو source of truth.

عند startup:
- يمكن عمل reconciliation بسيط:
  - DB records missing files.
  - orphan files.
- لا تحذف orphan files تلقائيًا في البداية.
- اعرض warning.

---

# 76. Backup Download Filename

Content-Disposition filename يمكن أن يكون:

```text
weps-backup-<date>.dump.enc
```

Sanitize filename.

---

# 77. Data Privacy

لا تعرض محتوى قاعدة المشروع الأساسي في UI.

Backup Center لا يحتاج قراءة business tables.

فقط:
- backup metadata.
- restore validation metadata.

لا تعرض sample rows من Source DB.

---

# 78. Performance

قاعدة Source أقل من 1 GB حاليًا.

لا تحمل backup كامل إلى RAM.

استخدم:
- file streams.
- crypto streams.
- streaming downloads.

---

# 79. Future Extensibility

النسخة الحالية تدعم Source Database واحدة فقط.

لكن صمم services بحيث يمكن مستقبلًا دعم أكثر من Source.

لا تضف multi-database UI الآن.

يمكن abstraction داخلي بسيط مثل:

```text
BackupTarget
```

لكن لا تعقد المشروع بدون حاجة.

---

# 80. UX Dashboard Navigation

Sidebar عربية مثل:

- الرئيسية
- النسخ الاحتياطية
- اختبارات الاستعادة
- سجل التدقيق
- الإعدادات

وفي الأسفل:
- حالة النظام.
- المستخدم.
- تسجيل الخروج.

---

# 81. Dashboard Visual Language

استخدم Status badges:

- ناجح
- فشل
- قيد التنفيذ
- صالح
- غير صالح
- متصل
- غير متصل

استخدم icons مناسبة من Lucide.

لا تستخدم Emoji كعنصر UI أساسي.

---

# 82. Confirmation After Backup

بعد Backup ناجح:
- Toast.
- Update cards.
- Add row.
- Email.
- No full page reload.

---

# 83. Long Running Jobs

Backup وRestore قد يستغرقان وقتًا أطول من request/response العادي.

لا تجعل HTTP request يبقى مفتوحًا طوال العملية.

نفذ job server-side:

```text
POST action
↓
create job record
↓
start asynchronous in-process job safely
↓
return job ID
↓
UI polls status or uses SSE
```

اختر Polling أو SSE.

يفضل حل بسيط وموثوق.

**مهم:** هذا asynchronous داخل نفس الخدمة الحالية، وليس خدمة خلفية منفصلة لا تصل إلى Persistent Disk.

عالج restart عبر job recovery.

---

# 84. Job Trigger Security

Endpoints التي تبدأ jobs:
- POST فقط.
- Auth required.
- CSRF.
- rate limit معقول.
- لا تقبل DB URL من request.
- تستخدم env config فقط.

---

# 85. Scheduler Trigger

Scheduler نفسه يستدعي service داخلي مباشرة وليس public endpoint إذا أمكن.

لا تعتمد على secret cron URL إذا غير مطلوب.

---

# 86. Email Templates

أنشئ قوالب عربية:

## Backup Success

العنوان مثال:

```text
نجاح النسخ الاحتياطي — WEPS Backup Center
```

## Backup Failure

```text
فشل النسخ الاحتياطي — WEPS Backup Center
```

## Restore Test Success

```text
نجاح اختبار الاستعادة — WEPS Backup Center
```

## Integrity Failure

```text
تحذير: فشل التحقق من سلامة نسخة احتياطية
```

لا تضع تفاصيل تقنية حساسة.

---

# 87. Settings Validation

Time:
- `HH:mm`

Timezone:
- default fixed Asia/Aden.

Backup interval:
- 2 days.

عند تغيير الوقت:
- احسب nextScheduledBackupAt.
- سجل Audit.
- اعرض الموعد الجديد.

---

# 88. Local Development

يجب أن يعمل المشروع محليًا.

قدم:
- Docker Compose اختياريًا لـ Backup Center DB + Source test DB.
- Sample source DB فقط للتطوير.
- لا تضع بيانات Production.

يمكن أن يكون:

```text
docker-compose.dev.yml
```

---

# 89. Development Mock Mode

إذا أضفت Mock mode للواجهة:
- يجب أن يكون Development-only.
- لا يعمل في Production.
- لا يسمح بتجاوز auth.
- لا يستخدم تلقائيًا إذا missing secrets في Production.

---

# 90. Code Comments

اكتب Comments فقط حيث منطق الأمان/التشفير/locking يحتاج شرح.

لا تملأ المشروع بتعليقات بديهية.

---

# 91. Naming

اسم المنتج في UI:

```text
WEPS Backup Center
```

Subtitle عربي مناسب مثل:

```text
مركز إدارة النسخ الاحتياطية لقواعد البيانات
```

---

# 92. First Release Scope

لا تضف حاليًا:

- 2FA.
- Multi-user roles.
- Multi-source database UI.
- Incremental backups.
- S3/R2.
- Automated Production Restore.
- Public API.
- Mobile app.

هذه أشياء مستقبلية وليست ضمن MVP الحالي.

---

# 93. Acceptance Criteria

لا تعتبر المشروع مكتملًا إلا إذا تحققت كل النقاط التالية:

- [ ] Next.js App Router يعمل.
- [ ] TypeScript strict.
- [ ] Prisma + مستقل PostgreSQL.
- [ ] Admin bootstrap من env.
- [ ] Auth.js login يعمل.
- [ ] Argon2id password hashing.
- [ ] Dashboard protected.
- [ ] UI عربية RTL.
- [ ] Light/Dark.
- [ ] UI UX Pro Max design system موجود.
- [ ] `design-system/MASTER.md` موجود.
- [ ] Source DB connectivity check.
- [ ] Manual Backup يعمل فعليًا.
- [ ] Scheduled Backup كل يومين.
- [ ] وقت schedule قابل للتغيير.
- [ ] pg_dump Custom Format.
- [ ] compression.
- [ ] integrity validation.
- [ ] SHA-256.
- [ ] AES-256-GCM.
- [ ] encrypted backup saved to Persistent Disk.
- [ ] plaintext temp removed.
- [ ] آخر 7 نسخ فقط.
- [ ] authenticated encrypted download.
- [ ] manual delete.
- [ ] Restore Test يدوي.
- [ ] temp DB created.
- [ ] checksum verified قبل restore.
- [ ] pg_restore يعمل.
- [ ] validation queries.
- [ ] temp DB deleted automatically.
- [ ] لا يوجد Production Restore endpoint.
- [ ] Resend emails.
- [ ] editable notification email.
- [ ] Audit Logs.
- [ ] Disk monitoring.
- [ ] Health status.
- [ ] Docker production image.
- [ ] PostgreSQL CLI installed.
- [ ] `.env.example`.
- [ ] Render deployment docs.
- [ ] README.
- [ ] Security docs.
- [ ] Unit tests.
- [ ] E2E basic tests.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Production build passes.

---

# 94. طريقة التنفيذ داخل Cursor

نفّذ المشروع على مراحل داخليًا، لكن **لا تتوقف بعد كل مرحلة لطلب موافقتي**.

رتب عملك تقريبًا بهذا الشكل:

## Phase 1 — Discovery
- افحص المجلد الحالي.
- إذا المشروع غير موجود، أنشئه.
- افحص الأدوات المتاحة.
- افحص UI UX Pro Max.
- أنشئ خطة داخلية.

## Phase 2 — Foundation
- Next.js.
- TypeScript.
- Tailwind.
- shadcn.
- RTL.
- Theme.
- Design system.

## Phase 3 — Database
- Prisma.
- schema.
- migrations.
- bootstrap admin.

## Phase 4 — Authentication
- Auth.js.
- Argon2.
- middleware.
- rate limiting.
- audit.

## Phase 5 — Core Infrastructure
- logger.
- config.
- crypto.
- filesystem.
- PostgreSQL command runner.
- health.

## Phase 6 — Backup Engine
- pg_dump.
- validation.
- checksum.
- encryption.
- storage.
- retention.

## Phase 7 — Scheduler
- every two days.
- configurable time.
- next run.
- locks.
- restart recovery.

## Phase 8 — Restore Test
- decrypt.
- checksum.
- temp DB.
- pg_restore.
- validate.
- cleanup.

## Phase 9 — Notifications
- Resend.
- templates.
- settings.

## Phase 10 — UI
- dashboard.
- backups.
- restore tests.
- audit logs.
- settings.

## Phase 11 — Render
- Docker.
- render.yaml if suitable.
- persistent disk docs.
- env.

## Phase 12 — Tests
- unit.
- integration.
- E2E.

## Phase 13 — Verification
شغّل:
- lint.
- typecheck.
- tests.
- build.

وأصلح أي خطأ قبل إنهاء المهمة.

---

# 95. قواعد مهمة لك كـAI Agent

1. لا تسألني أسئلة إضافية إلا إذا كان هناك مانع حقيقي لا يمكن حله هندسيًا.
2. اتخذ قرارات تقنية معقولة ضمن هذه المواصفات.
3. لا تترك `TODO` في وظائف Core.
4. لا تنشئ UI وهمي بدون backend.
5. لا تنشئ API وهمي.
6. لا تستخدم fake data في Production.
7. لا تضع secrets في git.
8. لا تطبع secrets في terminal output.
9. لا تعرض كلمات مرور.
10. لا تنشئ Production Restore.
11. لا تحذف بيانات Source DB.
12. نفّذ cleanup في كل failure path.
13. لا تعتبر backup ناجحًا قبل:
    - pg_dump success
    - file validation
    - pg_restore list success
    - checksum
    - encryption
    - encrypted file successfully written
14. لا تعتبر Restore Test ناجحًا قبل:
    - checksum match
    - temp DB creation
    - pg_restore success
    - validation success
    - cleanup attempted
15. اجعل error messages للمستخدم بالعربية.
16. اجعل logs التقنية بالإنجليزية إذا كان ذلك أفضل.
17. حافظ على بنية Codebase نظيفة وقابلة للصيانة.

---

# 96. النتيجة النهائية المطلوبة منك

بعد تنفيذ المشروع، أعطني تقريرًا نهائيًا مختصرًا داخل Cursor يوضح:

## ما تم إنجازه
- Features.
- Architecture.
- Security.
- Backup.
- Restore Test.
- Scheduler.
- UI.
- Docker.
- Render.

## الملفات المهمة

مثل:

```text
Dockerfile
render.yaml
.env.example
README.md
prisma/schema.prisma
design-system/MASTER.md
docs/...
```

## Environment Variables المطلوبة

اذكر أسماءها فقط، بدون قيم حقيقية.

## خطوات النشر على Render

بشكل واضح ومرتب.

## خطوات أول اختبار

1. Login.
2. Source connection.
3. Manual Backup.
4. Integrity check.
5. Download.
6. Restore Test.
7. Verify cleanup.
8. Verify email.
9. Verify Audit Log.

## Quality Gate Results

اعرض نتيجة:
- lint
- typecheck
- tests
- build

---

# 97. ملاحظة أمنية نهائية

هذا النظام مسؤول عن نسخ احتياطية لقاعدة بيانات Production، لذلك:

> **الأمان وصحة النسخة أهم من السرعة أو اختصار الكود.**

أي قرار يتعلق بـ:
- encryption
- filesystem
- database commands
- authentication
- restore
- cleanup
- secrets

يجب أن يكون محافظًا وآمنًا ومناسبًا لبيئة Production.

ابدأ الآن في إنشاء مشروع **WEPS Backup Center** كاملًا من الصفر وتنفيذ جميع المتطلبات المذكورة أعلاه.

---

# 98. قرار منتج لاحق — Production Restore داخل التطبيق (2026-08-27)

هذا القسم **لا يمحو النص التاريخي** في الأقسام 22 و71 و72 و92 و93. كانت تلك الأقسام تصف حظر الإصدار الأول، وتبقى مرجعًا لسبب غياب المسار سابقًا. بقرار منتج لاحق معتمد، يُستبدل الحظر المطلق لمسار Production Restore بضوابط التنفيذ التالية:

- Restore Test يبقى مسارًا منفصلًا وغير مدمر، ونجاحه لنفس النسخة شرط إلزامي بلا override.
- Production Restore يدوي فقط، ولا يشغله scheduler.
- ممنوع `pg_restore` مباشرة إلى اسم الإنتاج. الاستعادة تكون أولًا إلى `prod_restore_YYYYMMDD_<rand>` مسجلة ومتحققًا منها.
- cutover لا يحدث ضمن الطلب الأول حتى مع `RESTORE_AND_CUTOVER`. يتطلب إجراءً بشريًا ثانيًا مستقلاً وre-auth وتأكيدًا جديدًا.
- الاستثناء الضيق الوحيد لحظر `ALTER` على المصدر هو controlled rename داخل cutover: الإنتاج إلى `prod_previous_*` المسجلة، ثم candidate إلى الاسم الأصلي.
- يظل `DROP DATABASE` و`pg_terminate_backend` على قاعدة الإنتاج ممنوعين دائمًا. يجب على المشغل إيقاف التطبيق المصدر وتصريف الاتصالات.
- إذا تعذر rename بسبب الصلاحيات أو provider أو الاتصالات، تبقى candidate في `AWAITING_EXTERNAL_CUTOVER` ويُغيَّر `DATABASE_URL` للتطبيق المصدر خارجيًا.
- إذا فشلت rename الثانية، تُحاول compensation واحدة مضبوطة لإعادة previous إلى الاسم الأصلي. فشلها ينتج `ROLLBACK_REQUIRED` وإنذارًا حرجًا، بلا DROP أو retry أعمى.
- لا تُحذف `prod_previous_*` تلقائيًا عند انتهاء مدة الاحتفاظ أو عند startup. تصبح مؤهلة فقط لحذف يدوي مستقل مع re-auth وتأكيد جديد.
- startup recovery لا يحذف `prod_restore_*` أو `prod_previous_*`؛ يسوي الحالات من journal ووجود القواعد.
- تُستخدم قاعدة صيانة مثل `postgres` عبر `SOURCE_MAINTENANCE_DATABASE` لتنفيذ lifecycle، مع إعدادات نافذة الصيانة ومدة rollback في `SystemSettings`.

وبذلك تُقرأ معايير القبول القديمة التالية كمعايير **للإصدار الأول التاريخي**:

- «لا يوجد Production Restore endpoint» لم تعد معيار الحالة النهائية الجديدة.
- «No Production Restore UI» لم تعد قاعدة تصميم حالية.
- «Automated Production Restore» يبقى خارج النطاق: المسار الجديد يدوي، وcandidate/cutover إجراءان منفصلان.

معايير القبول الإضافية:

- [ ] لا direct overwrite لقاعدة الإنتاج.
- [ ] Restore Test ناجح إلزامي لنفس النسخة.
- [ ] candidate مسجلة وآمنة قبل restore.
- [ ] cutover بتأكيد مستقل ثانٍ وre-auth.
- [ ] لا production DROP أو terminate.
- [ ] rename journal + compensation + recovery states.
- [ ] external `DATABASE_URL` fallback موثق.
- [ ] previous deletion يدوي فقط بعد retention.
- [ ] maintenance database/env/settings موثقة.

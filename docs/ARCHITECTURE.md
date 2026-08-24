# Architecture

WEPS Backup Center is a single Next.js App Router process.

```
Admin UI (RTL Arabic)
        │
        ▼
Next.js (Node runtime)
  ├── Auth.js session
  ├── Prisma → Backup Center PostgreSQL
  ├── pg_dump/pg_restore/psql → Source PostgreSQL
  ├── AES-256-GCM files → /var/data/backups
  └── Resend
```

Scheduler, backup jobs, and restore tests run **in-process**. Render Persistent Disk is attached only to this web service, so a separate Cron Job cannot see the files.

Job progress is stored in PostgreSQL. The UI polls `/api/jobs/:id`.

Locks live in the `JobLock` table so a restart cannot start a second dump while another row still claims the lock (stale locks expire after 3 hours).

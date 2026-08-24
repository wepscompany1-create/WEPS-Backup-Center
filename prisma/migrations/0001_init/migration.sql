-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'INTERRUPTED');

-- CreateEnum
CREATE TYPE "IntegrityStatus" AS ENUM ('NOT_CHECKED', 'VALID', 'INVALID');

-- CreateEnum
CREATE TYPE "BackupProgressStage" AS ENUM ('PREPARING', 'DUMPING', 'VALIDATING', 'ENCRYPTING', 'SAVING', 'FINALIZING');

-- CreateEnum
CREATE TYPE "RestoreProgressStage" AS ENUM ('PREPARING', 'DECRYPTING', 'VERIFYING', 'CREATING_DATABASE', 'RESTORING', 'VALIDATING', 'CLEANING_UP', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE', 'WARNING');

-- CreateEnum
CREATE TYPE "NotificationEvent" AS ENUM ('BACKUP_SUCCESS', 'BACKUP_FAILURE', 'RESTORE_SUCCESS', 'RESTORE_FAILURE', 'INTEGRITY_FAILURE', 'DISK_WARNING', 'TEST');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "backupNumber" INTEGER NOT NULL,
    "type" "BackupType" NOT NULL,
    "status" "JobStatus" NOT NULL,
    "progressStage" "BackupProgressStage",
    "integrityStatus" "IntegrityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "fileName" TEXT,
    "storagePath" TEXT,
    "originalDumpSizeBytes" BIGINT,
    "encryptedSizeBytes" BIGINT,
    "sha256" TEXT,
    "encryptionIv" TEXT,
    "encryptionAuthTag" TEXT,
    "pgDumpVersion" TEXT,
    "postgresServerVersion" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorReferenceId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "initiatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestoreTest" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "progressStage" "RestoreProgressStage",
    "tempDatabaseName" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "integrityVerified" BOOLEAN NOT NULL DEFAULT false,
    "databaseCreated" BOOLEAN NOT NULL DEFAULT false,
    "restoreCompleted" BOOLEAN NOT NULL DEFAULT false,
    "validationCompleted" BOOLEAN NOT NULL DEFAULT false,
    "tempDatabaseDropped" BOOLEAN NOT NULL DEFAULT false,
    "tableCount" INTEGER,
    "validationSummary" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorReferenceId" TEXT,
    "initiatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestoreTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "result" "AuditResult" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "backupIntervalDays" INTEGER NOT NULL DEFAULT 2,
    "backupLocalTime" TEXT NOT NULL DEFAULT '03:00',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Aden',
    "nextScheduledBackupAt" TIMESTAMP(3),
    "notificationEmail" TEXT,
    "notifyOnBackupSuccess" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnBackupFailure" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnRestoreSuccess" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnRestoreFailure" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnIntegrityFailure" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLock" (
    "name" TEXT NOT NULL,
    "holder" TEXT,
    "acquiredAt" TIMESTAMP(3),

    CONSTRAINT "JobLock_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Backup_backupNumber_key" ON "Backup"("backupNumber");

-- CreateIndex
CREATE INDEX "Backup_status_idx" ON "Backup"("status");

-- CreateIndex
CREATE INDEX "Backup_type_idx" ON "Backup"("type");

-- CreateIndex
CREATE INDEX "Backup_createdAt_idx" ON "Backup"("createdAt");

-- CreateIndex
CREATE INDEX "Backup_deletedAt_idx" ON "Backup"("deletedAt");

-- CreateIndex
CREATE INDEX "RestoreTest_status_idx" ON "RestoreTest"("status");

-- CreateIndex
CREATE INDEX "RestoreTest_createdAt_idx" ON "RestoreTest"("createdAt");

-- CreateIndex
CREATE INDEX "RestoreTest_tempDatabaseName_idx" ON "RestoreTest"("tempDatabaseName");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_result_idx" ON "AuditLog"("result");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_event_idx" ON "NotificationLog"("event");

-- AddForeignKey
ALTER TABLE "Backup" ADD CONSTRAINT "Backup_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreTest" ADD CONSTRAINT "RestoreTest_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "Backup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreTest" ADD CONSTRAINT "RestoreTest_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed singleton settings and lock rows
INSERT INTO "SystemSettings" ("id", "scheduleEnabled", "backupIntervalDays", "backupLocalTime", "timezone", "notifyOnBackupSuccess", "notifyOnBackupFailure", "notifyOnRestoreSuccess", "notifyOnRestoreFailure", "notifyOnIntegrityFailure", "updatedAt")
VALUES ('default', true, 2, '03:00', 'Asia/Aden', true, true, true, true, true, CURRENT_TIMESTAMP);

INSERT INTO "JobLock" ("name") VALUES ('backup'), ('restore');

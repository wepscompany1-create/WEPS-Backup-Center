-- CreateEnum
CREATE TYPE "ProductionRestoreMode" AS ENUM ('RESTORE_ONLY', 'RESTORE_AND_CUTOVER');

-- CreateEnum
CREATE TYPE "ProductionRestoreStatus" AS ENUM ('PENDING', 'RUNNING', 'AWAITING_CUTOVER', 'AWAITING_EXTERNAL_CUTOVER', 'SUCCESS', 'FAILED', 'INTERRUPTED');

-- CreateEnum
CREATE TYPE "ProductionRestoreStage" AS ENUM ('PREPARING', 'DECRYPTING', 'VERIFYING', 'CREATING_CANDIDATE', 'RESTORING', 'VALIDATING', 'AWAITING_CUTOVER', 'CUTOVER_RENAMING_ORIGINAL', 'CUTOVER_RENAMING_CANDIDATE', 'COMPLETED', 'ROLLBACK_AVAILABLE', 'AWAITING_EXTERNAL_CUTOVER', 'COMPENSATING_RENAME', 'ROLLBACK_REQUIRED', 'DROPPING_PREVIOUS', 'CLEANING_FAILED');

-- CreateEnum
CREATE TYPE "ProductionRestoreEventLevel" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationEvent" ADD VALUE 'PRODUCTION_RESTORE_READY';
ALTER TYPE "NotificationEvent" ADD VALUE 'PRODUCTION_RESTORE_SUCCESS';
ALTER TYPE "NotificationEvent" ADD VALUE 'PRODUCTION_RESTORE_FAILURE';
ALTER TYPE "NotificationEvent" ADD VALUE 'PRODUCTION_RESTORE_CRITICAL';
ALTER TYPE "NotificationEvent" ADD VALUE 'PRODUCTION_PREVIOUS_DROPPED';

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "productionRestoreMaintenanceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productionRestoreMaintenanceEnd" TEXT NOT NULL DEFAULT '23:59',
ADD COLUMN     "productionRestoreMaintenanceStart" TEXT NOT NULL DEFAULT '00:00',
ADD COLUMN     "productionRestoreRollbackRetentionHours" INTEGER NOT NULL DEFAULT 24;

INSERT INTO "JobLock" ("name", "holder", "acquiredAt")
VALUES ('production_restore', NULL, NULL)
ON CONFLICT ("name") DO NOTHING;

-- CreateTable
CREATE TABLE "ProductionRestore" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "requiredRestoreTestId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "cutoverById" TEXT,
    "previousDroppedById" TEXT,
    "mode" "ProductionRestoreMode" NOT NULL,
    "status" "ProductionRestoreStatus" NOT NULL,
    "progressStage" "ProductionRestoreStage" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "candidateReadyAt" TIMESTAMP(3),
    "cutoverStartedAt" TIMESTAMP(3),
    "cutoverCompletedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "originalDatabaseName" TEXT NOT NULL,
    "candidateDatabaseName" TEXT NOT NULL,
    "previousDatabaseName" TEXT,
    "integrityVerified" BOOLEAN NOT NULL DEFAULT false,
    "candidateCreated" BOOLEAN NOT NULL DEFAULT false,
    "restoreCompleted" BOOLEAN NOT NULL DEFAULT false,
    "validationCompleted" BOOLEAN NOT NULL DEFAULT false,
    "tableCount" INTEGER,
    "validationSummary" JSONB,
    "cutoverRequestedAt" TIMESTAMP(3),
    "originalRenameStartedAt" TIMESTAMP(3),
    "originalRenamedAt" TIMESTAMP(3),
    "candidateRenameStartedAt" TIMESTAMP(3),
    "cutoverCompleted" BOOLEAN NOT NULL DEFAULT false,
    "compensationAttemptedAt" TIMESTAMP(3),
    "compensationSucceededAt" TIMESTAMP(3),
    "criticalState" TEXT,
    "rollbackAvailableUntil" TIMESTAMP(3),
    "previousDroppedAt" TIMESTAMP(3),
    "overwriteAcknowledgedAt" TIMESTAMP(3) NOT NULL,
    "initialConfirmationAt" TIMESTAMP(3) NOT NULL,
    "passwordReauthAt" TIMESTAMP(3) NOT NULL,
    "cutoverConfirmationAt" TIMESTAMP(3),
    "dropPreviousConfirmationAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorReferenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRestore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRestoreEvent" (
    "id" TEXT NOT NULL,
    "productionRestoreId" TEXT NOT NULL,
    "stage" "ProductionRestoreStage" NOT NULL,
    "level" "ProductionRestoreEventLevel" NOT NULL,
    "messageCode" TEXT NOT NULL,
    "safeMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionRestoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionRestore_status_idx" ON "ProductionRestore"("status");

-- CreateIndex
CREATE INDEX "ProductionRestore_createdAt_idx" ON "ProductionRestore"("createdAt");

-- CreateIndex
CREATE INDEX "ProductionRestore_backupId_idx" ON "ProductionRestore"("backupId");

-- CreateIndex
CREATE INDEX "ProductionRestore_candidateDatabaseName_idx" ON "ProductionRestore"("candidateDatabaseName");

-- CreateIndex
CREATE INDEX "ProductionRestore_previousDatabaseName_idx" ON "ProductionRestore"("previousDatabaseName");

-- CreateIndex
CREATE INDEX "ProductionRestoreEvent_productionRestoreId_createdAt_idx" ON "ProductionRestoreEvent"("productionRestoreId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductionRestore" ADD CONSTRAINT "ProductionRestore_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "Backup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRestore" ADD CONSTRAINT "ProductionRestore_requiredRestoreTestId_fkey" FOREIGN KEY ("requiredRestoreTestId") REFERENCES "RestoreTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRestore" ADD CONSTRAINT "ProductionRestore_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRestore" ADD CONSTRAINT "ProductionRestore_cutoverById_fkey" FOREIGN KEY ("cutoverById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRestore" ADD CONSTRAINT "ProductionRestore_previousDroppedById_fkey" FOREIGN KEY ("previousDroppedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRestoreEvent" ADD CONSTRAINT "ProductionRestoreEvent_productionRestoreId_fkey" FOREIGN KEY ("productionRestoreId") REFERENCES "ProductionRestore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

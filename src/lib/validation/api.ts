import { z } from "zod";

export const backupsQuerySchema = z.object({
  status: z.enum(["PENDING", "RUNNING", "SUCCESS", "FAILED", "INTERRUPTED"]).optional(),
  type: z.enum(["MANUAL", "SCHEDULED"]).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).catch(1),
});

export const restoreTestBodySchema = z.object({
  backupId: z.string().trim().min(1).max(80),
});

const currentPassword = z.string().min(1).max(1024);

export const productionRestoreBodySchema = z
  .object({
    backupId: z.string().trim().min(1).max(80),
    confirmationPhrase: z.literal("استعادة-الإنتاج"),
    backupNumber: z.number().int().positive(),
    acknowledgeOverwrite: z.literal(true),
    mode: z.enum(["RESTORE_ONLY", "RESTORE_AND_CUTOVER"]),
    currentPassword,
  })
  .strict();

export const productionRestoreCutoverSchema = z
  .object({
    confirmationPhrase: z.literal("تبديل-الإنتاج"),
    backupNumber: z.number().int().positive(),
    acknowledgeDowntime: z.literal(true),
    currentPassword,
  })
  .strict();

export const productionRestoreDropPreviousSchema = z
  .object({
    confirmationPhrase: z.literal("حذف-قاعدة-التراجع"),
    backupNumber: z.number().int().positive(),
    acknowledgeNoRollback: z.literal(true),
    currentPassword,
  })
  .strict();

export const productionRestoresQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  status: z
    .enum([
      "PENDING",
      "RUNNING",
      "AWAITING_CUTOVER",
      "AWAITING_EXTERNAL_CUTOVER",
      "SUCCESS",
      "FAILED",
      "INTERRUPTED",
    ])
    .optional(),
  backupNumber: z.coerce.number().int().positive().optional(),
});

export const testEmailSchema = z.object({
  email: z.string().trim().email("بريد غير صالح").max(254),
});

export const auditQuerySchema = z.object({
  action: z.string().trim().min(1).max(80).optional(),
  result: z.enum(["SUCCESS", "FAILURE", "WARNING"]).optional(),
  page: z.coerce.number().int().min(1).catch(1),
});

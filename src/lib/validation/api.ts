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

export const auditQuerySchema = z.object({
  action: z.string().trim().min(1).max(80).optional(),
  result: z.enum(["SUCCESS", "FAILURE", "WARNING"]).optional(),
  page: z.coerce.number().int().min(1).catch(1),
});

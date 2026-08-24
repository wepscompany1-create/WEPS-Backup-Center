import "server-only";

import { hashPassword } from "@/lib/auth/password";
import { getEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import { getSystemSettings } from "@/lib/db/settings";
import { logger } from "@/lib/logger";

export async function bootstrapAdmin() {
  const env = getEnv();
  await getSystemSettings();

  const existingCount = await prisma.adminUser.count();
  if (existingCount > 0) {
    logger.info({ adminCount: existingCount }, "Admin bootstrap skipped; account already exists");
    return { created: false };
  }

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    logger.warn("ADMIN_EMAIL or ADMIN_PASSWORD missing; no admin was created");
    return { created: false };
  }

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await prisma.adminUser.create({
    data: {
      email: env.ADMIN_EMAIL.toLowerCase().trim(),
      passwordHash,
      isActive: true,
    },
  });

  logger.info("Initial admin account created from environment");
  return { created: true };
}

import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { hydrateProcessEnvFromFiles } from "../src/lib/config/hydrate-env";
import { isPlaceholderSecret } from "../src/lib/config/secrets";

hydrateProcessEnvFromFiles();

async function main() {
  const datasourceUrl = process.env.DATABASE_URL;
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!datasourceUrl) {
    throw new Error("DATABASE_URL is missing");
  }
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL or ADMIN_PASSWORD is missing");
  }
  if (isPlaceholderSecret(password) || password.trim().length < 12) {
    throw new Error("ADMIN_PASSWORD looks like a placeholder or is shorter than 12 characters");
  }

  const prisma = new PrismaClient({ datasourceUrl });
  try {
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (!existing) {
      await prisma.adminUser.create({
        data: {
          email,
          passwordHash: await hashPassword(password),
          isActive: true,
        },
      });
      console.log("admin created");
      return;
    }

    let passwordOk = false;
    try {
      passwordOk = await verifyPassword(existing.passwordHash, password);
    } catch {
      passwordOk = false;
    }

    await prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(passwordOk ? {} : { passwordHash: await hashPassword(password) }),
      },
    });
    console.log(passwordOk ? "admin unlocked" : "admin password reset");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "ensure-admin failed");
  process.exit(1);
});

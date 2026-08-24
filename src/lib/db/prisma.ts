import { PrismaClient } from "@prisma/client";
import { hydrateProcessEnvFromFiles } from "@/lib/config/hydrate-env";

hydrateProcessEnvFromFiles();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaDatasourceUrl?: string;
};

const datasourceUrl = process.env["DATABASE_URL"];

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  });
}

export const prisma =
  globalForPrisma.prisma && globalForPrisma.prismaDatasourceUrl === datasourceUrl
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaDatasourceUrl = datasourceUrl;
}

import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AppError, ErrorCodes } from "@/lib/errors";
import { verifyPassword } from "@/lib/auth/password";

export async function reauthenticateAdmin(userId: string, currentPassword: string) {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, passwordHash: true },
  });
  if (!user?.isActive || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new AppError({ code: ErrorCodes.REAUTH_FAILED });
  }
  return user.id;
}

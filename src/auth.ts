import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { getEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { audit, AuditActions } from "@/lib/audit";
import { consumeRateLimit, loginRateLimitKey } from "@/lib/security/rate-limit";
import { logger } from "@/lib/logger";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getEnv();
  return {
    ...authConfig,
    secret: env.AUTH_SECRET,
    providers: [
      Credentials({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(rawCredentials, request) {
          const parsed = credentialsSchema.safeParse({
            email: rawCredentials?.email,
            password: rawCredentials?.password,
          });
          const ip =
            request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            request?.headers?.get("x-real-ip") ||
            "unknown";
          const userAgent = request?.headers?.get("user-agent")?.slice(0, 180) || undefined;

          if (!parsed.success) {
            await audit({
              action: AuditActions.LOGIN_FAILED,
              result: "FAILURE",
              ipAddress: ip,
              userAgent,
              metadata: { reason: "invalid_input" },
            });
            return null;
          }

          const email = parsed.data.email.toLowerCase().trim();
          const rate = consumeRateLimit({
            key: loginRateLimitKey(ip, email),
            max: env.LOGIN_RATE_LIMIT_MAX,
            windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
          });
          if (!rate.allowed) {
            await audit({
              action: AuditActions.LOGIN_FAILED,
              result: "FAILURE",
              ipAddress: ip,
              userAgent,
              metadata: { reason: "rate_limited" },
            });
            return null;
          }

          let user: Awaited<ReturnType<typeof prisma.adminUser.findUnique>>;
          try {
            user = await prisma.adminUser.findUnique({ where: { email } });
          } catch (error) {
            logger.error({ err: error }, "Login database lookup failed");
            await audit({
              action: AuditActions.LOGIN_FAILED,
              result: "FAILURE",
              ipAddress: ip,
              userAgent,
              metadata: { reason: "database_unavailable" },
            });
            return null;
          }
          if (!user || !user.isActive) {
            await audit({
              action: AuditActions.LOGIN_FAILED,
              result: "FAILURE",
              ipAddress: ip,
              userAgent,
              metadata: { reason: "unknown_user" },
            });
            return null;
          }

          if (user.lockedUntil && user.lockedUntil > new Date()) {
            await audit({
              actorId: user.id,
              action: AuditActions.LOGIN_FAILED,
              result: "FAILURE",
              ipAddress: ip,
              userAgent,
              metadata: { reason: "locked" },
            });
            return null;
          }

          const valid = await verifyPassword(user.passwordHash, parsed.data.password);
          if (!valid) {
            const attempts = user.failedLoginAttempts + 1;
            const lockedUntil =
              attempts >= env.MAX_LOGIN_ATTEMPTS
                ? new Date(Date.now() + env.LOGIN_LOCK_MINUTES * 60 * 1000)
                : null;
            await prisma.adminUser.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: attempts,
                lockedUntil,
              },
            });
            await audit({
              actorId: user.id,
              action: AuditActions.LOGIN_FAILED,
              result: "FAILURE",
              ipAddress: ip,
              userAgent,
              metadata: { reason: "bad_password" },
            });
            return null;
          }

          await prisma.adminUser.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: null,
              lastLoginAt: new Date(),
            },
          });

          await audit({
            actorId: user.id,
            action: AuditActions.LOGIN_SUCCESS,
            result: "SUCCESS",
            ipAddress: ip,
            userAgent,
          });

          logger.info({ userId: user.id }, "Admin signed in");

          return {
            id: user.id,
            email: user.email,
          };
        },
      }),
    ],
  };
});

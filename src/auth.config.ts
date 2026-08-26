import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";
import { getEnv } from "@/lib/config/env";
import { resolveAuthRedirect } from "@/lib/security/redirect";

export const authConfig = {
  trustHost: true,
  secret: getEnv().AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: getEnv().SESSION_MAX_AGE_MINUTES * 60,
    updateAge: 60,
  },
  cookies: {
    sessionToken: {
      name: getEnv().isProduction ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: getEnv().isProduction,
      },
    },
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      return resolveAuthRedirect(url, baseUrl, getEnv().appUrl);
    },
    async jwt({ token, user }: { token: JWT; user?: User }) {
      const env = getEnv();
      const now = Date.now();
      if (user) {
        token.sub = user.id;
        token.email = user.email ?? undefined;
        token.lastActivity = now;
      } else if (typeof token.lastActivity === "number") {
        const idleMs = env.SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;
        if (now - token.lastActivity > idleMs) {
          return {};
        }
        token.lastActivity = now;
      } else {
        token.lastActivity = now;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (!token.sub) {
        return session;
      }
      session.user = {
        ...session.user,
        id: token.sub,
        email: typeof token.email === "string" ? token.email : session.user.email,
      };
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/api/health") || pathname.startsWith("/api/auth") || pathname === "/login") {
        return true;
      }
      return Boolean(auth?.user?.id);
    },
  },
  providers: [],
} satisfies NextAuthConfig;

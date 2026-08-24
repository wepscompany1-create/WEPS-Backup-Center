import { describe, expect, it } from "vitest";
import { loginRateLimitKey, consumeRateLimit, resetRateLimit } from "@/lib/security/rate-limit";

describe("login rate limit", () => {
  it("blocks after the configured maximum", () => {
    resetRateLimit();
    const key = loginRateLimitKey("1.1.1.1", "Admin@example.com");
    for (let i = 0; i < 3; i += 1) {
      expect(consumeRateLimit({ key, max: 3, windowMs: 60_000, now: 1 }).allowed).toBe(true);
    }
    expect(consumeRateLimit({ key, max: 3, windowMs: 60_000, now: 1 }).allowed).toBe(false);
  });
});

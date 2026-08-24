import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMAIL_USER_MESSAGES,
  EmailSendReasons,
  emailResultHttpStatus,
  emailResultResponse,
  emailSendResult,
} from "@/features/notifications/email-result";
import { testEmailSchema } from "@/lib/validation/api";
import { ErrorCodes } from "@/lib/errors";
import { testEmailRateLimitKey } from "@/lib/security/rate-limit";

describe("testEmailSchema", () => {
  it("accepts a trimmed valid address", () => {
    const parsed = testEmailSchema.safeParse({ email: "  ops@example.com  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("ops@example.com");
    }
  });

  it("rejects missing, empty, and invalid addresses", () => {
    expect(testEmailSchema.safeParse({}).success).toBe(false);
    expect(testEmailSchema.safeParse({ email: "" }).success).toBe(false);
    expect(testEmailSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(testEmailSchema.safeParse({ email: "ops@" }).success).toBe(false);
  });
});

describe("email send result mapping", () => {
  it("maps success and config/provider failures to distinct HTTP statuses", () => {
    expect(emailResultHttpStatus(emailSendResult(EmailSendReasons.SENT))).toBe(200);
    expect(emailResultHttpStatus(emailSendResult(EmailSendReasons.MISSING_RECIPIENT))).toBe(400);
    expect(emailResultHttpStatus(emailSendResult(EmailSendReasons.MISSING_API_KEY))).toBe(503);
    expect(emailResultHttpStatus(emailSendResult(EmailSendReasons.MISSING_FROM_EMAIL))).toBe(503);
    expect(emailResultHttpStatus(emailSendResult(EmailSendReasons.PROVIDER_REJECTED))).toBe(502);
  });

  it("exposes a safe user message without provider internals", () => {
    const rejected = emailResultResponse(emailSendResult(EmailSendReasons.PROVIDER_REJECTED));
    expect(rejected.code).toBe(ErrorCodes.RESEND_FAILED);
    expect(rejected.message).toBe(EMAIL_USER_MESSAGES.PROVIDER_REJECTED);
    expect(JSON.stringify(rejected)).not.toMatch(/re_/i);
    expect(rejected.skipped).toBe(false);
    expect(emailResultResponse(emailSendResult(EmailSendReasons.MISSING_API_KEY)).skipped).toBe(true);
  });
});

describe("test email rate limit key", () => {
  it("scopes the bucket to the user", () => {
    expect(testEmailRateLimitKey("user-1")).toBe("test-email:user-1");
  });
});

const sendMock = vi.hoisted(() => vi.fn());
const createLogMock = vi.hoisted(() => vi.fn());
const getEnvMock = vi.hoisted(() => vi.fn());
const getSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

vi.mock("@/lib/config/env", () => ({
  getEnv: () => getEnvMock(),
}));

vi.mock("@/lib/db/settings", () => ({
  getSystemSettings: () => getSettingsMock(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    notificationLog: {
      create: createLogMock,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("sendTestEmail branches", () => {
  beforeEach(() => {
    sendMock.mockReset();
    createLogMock.mockReset();
    createLogMock.mockResolvedValue({ id: "log-1" });
    getEnvMock.mockReset();
    getSettingsMock.mockReset();
    getSettingsMock.mockResolvedValue({ notificationEmail: "saved@example.com", timezone: "Asia/Aden" });
  });

  it("fails safely when the API key is missing and does not call Resend", async () => {
    getEnvMock.mockReturnValue({ RESEND_API_KEY: undefined, RESEND_FROM_EMAIL: "alerts@example.com" });
    const { sendTestEmail } = await import("@/features/notifications/email-service");
    const result = await sendTestEmail("ops@example.com");
    expect(result).toEqual({ sent: false, skipped: true, reason: EmailSendReasons.MISSING_API_KEY });
    expect(sendMock).not.toHaveBeenCalled();
    expect(createLogMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: "TEST",
        status: "FAILED",
        toEmail: "ops@example.com",
        errorCode: "MISSING_API_KEY",
        errorMessage: "RESEND_API_KEY is not configured",
      }),
    });
  });

  it("fails safely when the From address is missing", async () => {
    getEnvMock.mockReturnValue({ RESEND_API_KEY: "re_test_key", RESEND_FROM_EMAIL: undefined });
    const { sendTestEmail } = await import("@/features/notifications/email-service");
    const result = await sendTestEmail("ops@example.com");
    expect(result.reason).toBe(EmailSendReasons.MISSING_FROM_EMAIL);
    expect(result.sent).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
    expect(createLogMock.mock.calls[0][0].data.errorCode).toBe("MISSING_FROM_EMAIL");
  });

  it("treats a blank recipient as a validation-style skip", async () => {
    getEnvMock.mockReturnValue({ RESEND_API_KEY: "re_test_key", RESEND_FROM_EMAIL: "alerts@example.com" });
    getSettingsMock.mockResolvedValue({ notificationEmail: null, timezone: "Asia/Aden" });
    const { sendTestEmail } = await import("@/features/notifications/email-service");
    const result = await sendTestEmail("");
    expect(result.reason).toBe(EmailSendReasons.MISSING_RECIPIENT);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns success when Resend accepts the message", async () => {
    getEnvMock.mockReturnValue({ RESEND_API_KEY: "re_test_key", RESEND_FROM_EMAIL: "alerts@example.com" });
    sendMock.mockResolvedValue({ data: { id: "msg-1" }, error: null });
    const { sendTestEmail } = await import("@/features/notifications/email-service");
    const result = await sendTestEmail("ops@example.com");
    expect(result).toEqual({ sent: true, skipped: false, reason: EmailSendReasons.SENT });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "alerts@example.com",
        to: "ops@example.com",
      }),
    );
    expect(createLogMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ event: "TEST", status: "SENT", toEmail: "ops@example.com" }),
    });
    expect(JSON.stringify(createLogMock.mock.calls[0][0])).not.toContain("re_test_key");
  });

  it("maps a Resend rejection without exposing the provider message", async () => {
    getEnvMock.mockReturnValue({ RESEND_API_KEY: "re_test_key", RESEND_FROM_EMAIL: "alerts@example.com" });
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "The weps.local domain is not verified" },
    });
    const { sendTestEmail } = await import("@/features/notifications/email-service");
    const result = await sendTestEmail("ops@example.com");
    expect(result).toEqual({ sent: false, skipped: false, reason: EmailSendReasons.PROVIDER_REJECTED });
    const logged = createLogMock.mock.calls[0][0].data;
    expect(logged.errorCode).toBe("RESEND_FAILED");
    expect(logged.errorMessage).toBe("Failed to send email");
    expect(JSON.stringify(logged)).not.toContain("not verified");
  });
});

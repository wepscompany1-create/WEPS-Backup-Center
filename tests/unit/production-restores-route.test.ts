import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ErrorCodes } from "@/lib/errors";

const authMock = vi.hoisted(() => vi.fn());
const assertSameOriginMock = vi.hoisted(() => vi.fn());
const reauthenticateAdminMock = vi.hoisted(() => vi.fn());
const enqueueProductionRestoreMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    productionRestore: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/security/headers", () => ({
  applySecurityHeaders: (response: Response) => response,
}));

vi.mock("@/lib/security/same-origin", () => ({
  assertSameOrigin: assertSameOriginMock,
}));

vi.mock("@/lib/auth/reauth", () => ({
  reauthenticateAdmin: reauthenticateAdminMock,
}));

vi.mock("@/features/restore/production-restore-service", () => ({
  enqueueProductionRestore: enqueueProductionRestoreMock,
  productionRestoreActions: vi.fn(),
}));

import { POST } from "@/app/api/production-restores/route";

const validBody = {
  backupId: "backup-1",
  confirmationPhrase: "استعادة-الإنتاج",
  backupNumber: 42,
  acknowledgeOverwrite: true,
  mode: "RESTORE_ONLY",
  currentPassword: "correct-password",
};

function productionRestoreRequest(body: unknown = validBody) {
  return new Request("https://backup.example.com/api/production-restores", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://backup.example.com",
      "x-forwarded-for": "203.0.113.10",
      "user-agent": "route-regression-test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/production-restores", () => {
  beforeEach(() => {
    authMock.mockReset();
    assertSameOriginMock.mockReset();
    reauthenticateAdminMock.mockReset();
    enqueueProductionRestoreMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "admin-1" } });
    reauthenticateAdminMock.mockResolvedValue("admin-1");
    enqueueProductionRestoreMock
      .mockResolvedValueOnce({ id: "restore-1" })
      .mockResolvedValueOnce({ id: "restore-2" });
  });

  it("accepts two consecutive valid requests from the same user", async () => {
    const firstResponse = await POST(productionRestoreRequest());
    const secondResponse = await POST(productionRestoreRequest());

    expect(firstResponse.status).toBe(202);
    expect(secondResponse.status).toBe(202);
    await expect(firstResponse.json()).resolves.toMatchObject({ jobId: "restore-1" });
    await expect(secondResponse.json()).resolves.toMatchObject({ jobId: "restore-2" });
    expect(assertSameOriginMock).toHaveBeenCalledTimes(2);
    expect(reauthenticateAdminMock).toHaveBeenCalledTimes(2);
    expect(reauthenticateAdminMock).toHaveBeenNthCalledWith(
      1,
      "admin-1",
      validBody.currentPassword,
    );
    expect(enqueueProductionRestoreMock).toHaveBeenCalledTimes(2);
    expect(enqueueProductionRestoreMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        backupId: "backup-1",
        backupNumber: 42,
        actorId: "admin-1",
        ipAddress: "203.0.113.10",
        userAgent: "route-regression-test",
      }),
    );
  });

  it("still requires an authenticated user", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(productionRestoreRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ code: "UNAUTHORIZED" });
    expect(assertSameOriginMock).not.toHaveBeenCalled();
    expect(reauthenticateAdminMock).not.toHaveBeenCalled();
    expect(enqueueProductionRestoreMock).not.toHaveBeenCalled();
  });

  it("still rejects requests that fail same-origin validation", async () => {
    assertSameOriginMock.mockImplementation(() => {
      throw new AppError({ code: ErrorCodes.SAME_ORIGIN_REQUIRED });
    });

    const response = await POST(productionRestoreRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: ErrorCodes.SAME_ORIGIN_REQUIRED,
    });
    expect(reauthenticateAdminMock).not.toHaveBeenCalled();
    expect(enqueueProductionRestoreMock).not.toHaveBeenCalled();
  });

  it("still requires administrator password reauthentication", async () => {
    reauthenticateAdminMock.mockRejectedValue(
      new AppError({ code: ErrorCodes.REAUTH_FAILED }),
    );

    const response = await POST(productionRestoreRequest());

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: ErrorCodes.REAUTH_FAILED,
    });
    expect(enqueueProductionRestoreMock).not.toHaveBeenCalled();
  });
});

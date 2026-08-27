import { describe, expect, it } from "vitest";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { decryptFileAes256Gcm, encryptFileAes256Gcm, verifyEncryptedFileChecksum } from "@/lib/crypto/aes";
import { checksumsMatch, sha256Buffer, sha256File } from "@/lib/crypto/checksum";
import { parseEncryptionKey } from "@/lib/crypto/key";
import { generateBackupFileName, sanitizeDownloadFileName } from "@/lib/crypto/filename";
import {
  connectionsPointToSameDatabase,
  createTempDatabaseName,
  createProductionCandidateName,
  createProductionPreviousName,
  isSafeProductionCandidateName,
  isSafeProductionPreviousName,
  isSafeTempDatabaseName,
  parsePostgresUrl,
  replaceDatabaseName,
} from "@/lib/postgres/url";
import { computeNextScheduledBackupAt, isValidLocalTime } from "@/lib/scheduler/next-run";
import { selectBackupsToDelete } from "@/features/backup/retention";
import { ErrorCodes, sanitizeErrorMessage } from "@/lib/errors";
import { resolveBackupPath } from "@/lib/storage/paths";
import { loadEnv, resetEnvCache } from "@/lib/config/env";
import {
  assertBackupAllowedFromIssues,
  collectConfigurationIssues,
  publicBlockingConfigurationIssues,
} from "@/lib/config/checklist";
import { buildHealthSnapshot } from "@/lib/config/health";
import { isPlaceholderSecret } from "@/lib/config/secrets";
import { getBackupDisabledReason, getSourceStatusCard } from "@/features/backup/readiness";
import { assertSourceReadyForBackup } from "@/features/backup/preflight";
import { AppError, toUserError } from "@/lib/errors";
import {
  createPublicUrl,
  resolveAuthRedirect,
  safeInternalPath,
} from "@/lib/security/redirect";
import {
  productionRestoreBodySchema,
  productionRestoreCutoverSchema,
  productionRestoreDropPreviousSchema,
} from "@/lib/validation/api";

describe("encryption key parsing", () => {
  it("accepts 32-byte hex and base64", () => {
    const hex = "a".repeat(64);
    expect(parseEncryptionKey(hex)).toHaveLength(32);
    const base64 = Buffer.alloc(32, 7).toString("base64");
    expect(parseEncryptionKey(base64)).toHaveLength(32);
  });

  it("rejects short keys, placeholders, and imprecise base64", () => {
    const placeholder = "REPLACE_WITH_A_NEW_64_CHARACTER_RANDOM_HEX_KEY";
    expect(() => parseEncryptionKey("abc")).toThrow();
    expect(() => parseEncryptionKey(placeholder)).toThrow(/placeholder/);
    expect(() => parseEncryptionKey(`${Buffer.alloc(32, 7).toString("base64")}!!!`)).toThrow();
    expect(() => parseEncryptionKey(Buffer.alloc(31, 1).toString("base64"))).toThrow();
  });
});

describe("AES-256-GCM + checksum", () => {
  it("round-trips a file and verifies SHA-256 without writing plaintext", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "weps-crypto-"));
    const input = path.join(dir, "in.dump");
    const encrypted = path.join(dir, "out.dump.enc");
    const decrypted = path.join(dir, "out.dump");
    await writeFile(input, "weps-backup-test-payload");
    const key = Buffer.alloc(32, 9);
    const { ivHex, authTagHex } = await encryptFileAes256Gcm({ inputPath: input, outputPath: encrypted, key });
    const original = await sha256File(input);
    expect(
      await verifyEncryptedFileChecksum({
        encryptedPath: encrypted,
        key,
        ivHex,
        authTagHex,
        expectedSha256: original,
      }),
    ).toBe(true);
    await decryptFileAes256Gcm({ inputPath: encrypted, outputPath: decrypted, key, ivHex, authTagHex });
    expect(checksumsMatch(original, await sha256File(decrypted))).toBe(true);
    expect(await readFile(decrypted, "utf8")).toBe("weps-backup-test-payload");
    await rm(dir, { recursive: true, force: true });
  });

  it("hashes buffers consistently", () => {
    expect(sha256Buffer("abc")).toHaveLength(64);
  });
});

describe("filenames and paths", () => {
  it("generates encoded dump names", () => {
    const name = generateBackupFileName(new Date("2026-08-23T03:00:00.000Z"), "abcd1234");
    expect(name).toBe("weps-backup-2026-08-23T03-00-00-000Z-abcd1234.dump.enc");
  });

  it("sanitizes download names", () => {
    expect(sanitizeDownloadFileName("weps backup../x.dump.enc")).toBe("weps_backup.._x.dump.enc");
  });

  it("blocks path traversal", () => {
    process.env.BACKUP_DIR = path.resolve(tmpdir(), "weps-backups");
    resetEnvCache();
    expect(() => resolveBackupPath("../secret.dump.enc")).toThrow();
    expect(() => resolveBackupPath("ok.dump.enc")).not.toThrow();
  });
});

describe("postgres url parsing", () => {
  it("parses encoded credentials and ssl", () => {
    const parsed = parsePostgresUrl("postgres://u%40ser:p%40ss@db.example:5432/app?sslmode=require");
    expect(parsed.user).toBe("u@ser");
    expect(parsed.password).toBe("p@ss");
    expect(parsed.database).toBe("app");
    expect(parsed.sslmode).toBe("require");
  });

  it("detects identical source and app databases", () => {
    const a = "postgres://u:p@host:5432/same";
    const b = "postgresql://u:p@host:5432/same";
    expect(connectionsPointToSameDatabase(a, b)).toBe(true);
    expect(connectionsPointToSameDatabase(a, "postgres://u:p@host:5432/other")).toBe(false);
  });

  it("replaces only the database name", () => {
    const next = replaceDatabaseName("postgres://u:p@host:5432/app?sslmode=require", "restore_test_20260823_abc");
    expect(next).toContain("restore_test_20260823_abc");
    expect(next).toContain("sslmode=require");
  });

  it("validates temp database names", () => {
    expect(isSafeTempDatabaseName(createTempDatabaseName(new Date("2026-08-23T00:00:00Z")))).toBe(true);
    expect(isSafeTempDatabaseName("production")).toBe(false);
  });

  it("strictly validates generated production database names", () => {
    const now = new Date("2026-08-23T00:00:00Z");
    expect(isSafeProductionCandidateName(createProductionCandidateName(now))).toBe(true);
    expect(isSafeProductionPreviousName(createProductionPreviousName(now))).toBe(true);
    for (const unsafe of [
      "production",
      "prod_restore_20260823_SHORT",
      "prod_restore_20260823_abcdef;drop",
      "Prod_restore_20260823_abcdef",
      "prod_previous_20260823_abcde",
    ]) {
      expect(isSafeProductionCandidateName(unsafe)).toBe(false);
      expect(isSafeProductionPreviousName(unsafe)).toBe(false);
    }
  });
});

describe("production restore confirmation schemas", () => {
  const initial = {
    backupId: "backup-id",
    confirmationPhrase: "استعادة-الإنتاج",
    backupNumber: 42,
    acknowledgeOverwrite: true,
    mode: "RESTORE_ONLY",
    currentPassword: "secret",
  };

  it("requires exact initial confirmation and rejects extra fields", () => {
    expect(productionRestoreBodySchema.safeParse(initial).success).toBe(true);
    expect(productionRestoreBodySchema.safeParse({ ...initial, confirmationPhrase: "استعادة الإنتاج" }).success).toBe(false);
    expect(productionRestoreBodySchema.safeParse({ ...initial, databaseName: "production" }).success).toBe(false);
  });

  it("keeps cutover and previous deletion as separate confirmations", () => {
    expect(productionRestoreCutoverSchema.safeParse({
      confirmationPhrase: "تبديل-الإنتاج",
      backupNumber: 42,
      acknowledgeDowntime: true,
      currentPassword: "secret",
    }).success).toBe(true);
    expect(productionRestoreDropPreviousSchema.safeParse({
      confirmationPhrase: "حذف-قاعدة-التراجع",
      backupNumber: 42,
      acknowledgeNoRollback: true,
      currentPassword: "secret",
    }).success).toBe(true);
  });
});

describe("production database safety invariants", () => {
  it("startup recovery never drops production restore prefixes", async () => {
    const source = await readFile(path.join(process.cwd(), "src/server/recovery.ts"), "utf8");
    expect(source).not.toMatch(/DROP DATABASE[^`]*(prod_restore_|prod_previous_)/);
    expect(source).not.toContain("LIKE 'prod_restore_%'");
    expect(source).not.toContain("LIKE 'prod_previous_%'");
  });

  it("never terminates sessions on the recorded original database", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/features/restore/production-restore-service.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/pg_terminate_backend[^`]*originalDatabaseName/);
    expect(source).not.toMatch(/DROP DATABASE[^`]*originalDatabaseName/);
  });
});

describe("schedule / timezone", () => {
  it("accepts HH:mm", () => {
    expect(isValidLocalTime("03:00")).toBe(true);
    expect(isValidLocalTime("24:00")).toBe(false);
  });

  it("computes the next future slot in Asia/Aden", () => {
    const now = new Date("2026-08-23T01:00:00.000Z");
    const next = computeNextScheduledBackupAt({
      now,
      localTime: "03:00",
      timezone: "Asia/Aden",
      intervalDays: 2,
    });
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it("advances by interval after a scheduled run", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    const last = new Date("2026-08-23T00:00:00.000Z");
    const next = computeNextScheduledBackupAt({
      now,
      localTime: "03:00",
      timezone: "Asia/Aden",
      intervalDays: 2,
      lastScheduledAt: last,
    });
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("retention selection", () => {
  it("keeps the newest 7", () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      createdAt: new Date(2026, 0, index + 1),
    }));
    expect(selectBackupsToDelete(items, 7)).toHaveLength(2);
  });
});

describe("error sanitization", () => {
  it("redacts urls and passwords", () => {
    const raw = "failed postgres://u:secret@host/db password=super PGPASSWORD=abc Bearer tok";
    const clean = sanitizeErrorMessage(raw);
    expect(clean).not.toContain("secret");
    expect(clean).not.toContain("super");
    expect(clean).not.toContain("abc");
  });
});

describe("env production guards", () => {
  it("requires AUTH_SECRET in production", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://u:p@localhost:5432/app",
      }),
    ).toThrow(/AUTH_SECRET/);
  });

  it("rejects placeholder AUTH_SECRET in production", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        AUTH_SECRET: "REPLACE_WITH_A_NEW_64_CHARACTER_RANDOM_HEX_VALUE",
        APP_URL: "https://weps-backup-center.onrender.com",
      }),
    ).toThrow(/placeholder/);
  });

  it("rejects reusing the backup encryption key as AUTH_SECRET", () => {
    const shared = "ab".repeat(32);
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        AUTH_SECRET: shared,
        BACKUP_ENCRYPTION_KEY: shared,
        APP_URL: "https://weps-backup-center.onrender.com",
      }),
    ).toThrow(/reuse BACKUP_ENCRYPTION_KEY/);
  });

  it("normalizes the production public origin", () => {
    const env = loadEnv({
      NODE_ENV: "production",
      AUTH_SECRET: "a".repeat(32),
      APP_URL: "https://weps-backup-center.onrender.com/",
      AUTH_URL: "http://localhost:3000",
      NEXTAUTH_URL: "http://localhost:3000",
    });
    expect(env.appUrl).toBe("https://weps-backup-center.onrender.com");
    expect(env.AUTH_URL).toBe(env.appUrl);
    expect(env.NEXTAUTH_URL).toBe(env.appUrl);
  });

  it("rejects localhost and insecure origins in production", () => {
    const base = {
      NODE_ENV: "production" as const,
      AUTH_SECRET: "a".repeat(32),
    };
    expect(() => loadEnv({ ...base, APP_URL: "http://localhost:3000" })).toThrow(/public HTTPS/);
    expect(() => loadEnv({ ...base, APP_URL: "http://weps.example.com" })).toThrow(/public HTTPS/);
  });
});

describe("configuration issues block backups", () => {
  const validHex = "ab".repeat(32);
  const ready = {
    isProduction: true,
    DATABASE_URL: "postgres://u:p@backup-db:5432/backup_center",
    SOURCE_DATABASE_URL: "postgres://u:p@source-db:5432/source",
    BACKUP_ENCRYPTION_KEY: validHex,
    AUTH_SECRET: "s".repeat(32),
    RESEND_API_KEY: "re_test_key",
    RESEND_FROM_EMAIL: "ops@weps.local",
  };

  it("blocks backup when the encryption key is a placeholder and does not log the value", () => {
    const placeholder = "REPLACE_WITH_A_NEW_64_CHARACTER_RANDOM_HEX_KEY";
    const issues = collectConfigurationIssues({
      ...ready,
      BACKUP_ENCRYPTION_KEY: placeholder,
    });
    const blocking = issues.filter((issue) => issue.blocksBackup);
    expect(blocking.some((issue) => issue.code === ErrorCodes.ENCRYPTION_KEY_INVALID)).toBe(true);
    expect(JSON.stringify(issues)).not.toContain(placeholder);
  });

  it("removes the encryption blocker when a valid key is configured", () => {
    const issues = collectConfigurationIssues(ready);
    expect(issues.filter((issue) => issue.blocksBackup)).toHaveLength(0);
    expect(issues.some((issue) => issue.code === ErrorCodes.ENCRYPTION_KEY_INVALID)).toBe(false);
  });

  it("treats known placeholder database URLs as missing", () => {
    expect(isPlaceholderSecret("REPLACE_WITH_BACKUP_CENTER_INTERNAL_DATABASE_URL")).toBe(true);
    const issues = collectConfigurationIssues({
      ...ready,
      DATABASE_URL: "REPLACE_WITH_BACKUP_CENTER_INTERNAL_DATABASE_URL",
      SOURCE_DATABASE_URL: "REPLACE_WITH_SOURCE_INTERNAL_DATABASE_URL",
    });
    expect(issues.some((issue) => issue.code === "DATABASE_URL" && issue.blocksBackup)).toBe(true);
    expect(issues.some((issue) => issue.code === "SOURCE_DATABASE_URL" && issue.blocksBackup)).toBe(true);
  });

  it("produces safe API details containing only blocking issues", () => {
    const placeholder = "REPLACE_WITH_A_NEW_64_CHARACTER_RANDOM_HEX_KEY";
    const publicIssues = publicBlockingConfigurationIssues(
      collectConfigurationIssues({ ...ready, BACKUP_ENCRYPTION_KEY: placeholder }),
    );
    expect(publicIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: ErrorCodes.ENCRYPTION_KEY_INVALID, blocksBackup: true }),
      ]),
    );
    expect(JSON.stringify(publicIssues)).not.toContain(placeholder);
    expect(publicIssues.some((issue) => issue.code === "RESEND")).toBe(false);
  });

  it("prevents backup enqueue when the key is invalid and clears the blocker for a valid key", () => {
    const placeholder = "REPLACE_WITH_A_NEW_64_CHARACTER_RANDOM_HEX_KEY";
    expect(() =>
      assertBackupAllowedFromIssues(
        collectConfigurationIssues({ ...ready, BACKUP_ENCRYPTION_KEY: placeholder }),
      ),
    ).toThrow(AppError);

    try {
      assertBackupAllowedFromIssues(
        collectConfigurationIssues({ ...ready, BACKUP_ENCRYPTION_KEY: placeholder }),
      );
    } catch (error) {
      const parsed = toUserError(error);
      expect(parsed.code).toBe(ErrorCodes.CONFIGURATION_ERROR);
      expect(parsed.message).toMatch(/مفتاح التشفير/);
      expect(parsed.message).not.toContain(placeholder);
    }

    expect(() => assertBackupAllowedFromIssues(collectConfigurationIssues(ready))).not.toThrow();
  });
});

describe("dashboard backup readiness", () => {
  const ready = {
    jobs: { backup: false, restore: false },
    issues: [],
    source: { connected: true, incompatible: false },
  };

  it("allows backup only when the source is connected and compatible", () => {
    expect(getBackupDisabledReason(ready)).toBeNull();
    expect(
      getBackupDisabledReason({ ...ready, source: { connected: false, incompatible: false } }),
    ).toMatch(/غير متصلة/);
    expect(
      getBackupDisabledReason({ ...ready, source: { connected: true, incompatible: true } }),
    ).toMatch(/pg_dump/);
  });

  it("prioritizes configuration blockers before runtime source state", () => {
    expect(
      getBackupDisabledReason({
        ...ready,
        issues: [{ message: "مفتاح التشفير غير صالح", blocksBackup: true }],
        source: { connected: false, incompatible: false },
      }),
    ).toBe("مفتاح التشفير غير صالح");
  });

  it("shows an incompatible source instead of connected", () => {
    expect(
      getSourceStatusCard({ connected: true, incompatible: true, serverVersion: "16.4" }),
    ).toEqual({
      value: "غير متوافق",
      badge: "INCOMPATIBLE",
      helper: "إصدار pg_dump أقدم من الخادم (16.4)",
    });
  });
});

describe("backup API preflight", () => {
  it("rejects disconnected or incompatible sources before a job is created", () => {
    expect(() => assertSourceReadyForBackup({ connected: false, incompatible: false })).toThrow(
      /SOURCE_DB_UNREACHABLE/,
    );
    expect(() => assertSourceReadyForBackup({ connected: true, incompatible: true })).toThrow(
      /PG_VERSION_INCOMPATIBLE/,
    );
    expect(() => assertSourceReadyForBackup({ connected: true, incompatible: false })).not.toThrow();
  });
});

describe("health backup readiness", () => {
  const healthy = {
    appDb: true,
    diskWritable: true,
    pgTools: true,
    sourceConnected: true,
    sourceIncompatible: false,
    blockingIssueCodes: [] as string[],
    timezone: "Asia/Aden",
  };

  it("is ok only when config, disk, tools, and source are ready", () => {
    expect(buildHealthSnapshot(healthy)).toMatchObject({
      status: "ok",
      backupReady: true,
      sourceCompatible: true,
      issueCodes: [],
    });
  });

  it("marks degraded for blocking config, unwritable disk, or incompatible source", () => {
    expect(
      buildHealthSnapshot({ ...healthy, blockingIssueCodes: [ErrorCodes.ENCRYPTION_KEY_INVALID] }),
    ).toMatchObject({
      status: "degraded",
      backupReady: false,
      blockingIssueCodes: [ErrorCodes.ENCRYPTION_KEY_INVALID],
    });
    expect(buildHealthSnapshot({ ...healthy, diskWritable: false }).issueCodes).toContain(
      "DISK_NOT_WRITABLE",
    );
    expect(buildHealthSnapshot({ ...healthy, sourceIncompatible: true })).toMatchObject({
      status: "degraded",
      backupReady: false,
      sourceCompatible: false,
    });
  });
});

describe("safe authentication redirects", () => {
  const productionOrigin = "https://weps-backup-center.onrender.com";

  it("uses the configured production origin over an internal localhost request", () => {
    expect(
      createPublicUrl("/login?callbackUrl=%2F", productionOrigin, "http://localhost:3000").toString(),
    ).toBe(`${productionOrigin}/login?callbackUrl=%2F`);
  });

  it("accepts internal callback paths and rejects external redirects", () => {
    expect(safeInternalPath("/backups?page=2")).toBe("/backups?page=2");
    expect(safeInternalPath("//evil.example/login")).toBe("/");
    expect(safeInternalPath("https://evil.example/login")).toBe("/");
  });

  it("keeps Auth.js redirects on the canonical origin", () => {
    expect(resolveAuthRedirect("/backups", "http://localhost:3000", productionOrigin)).toBe(
      `${productionOrigin}/backups`,
    );
    expect(resolveAuthRedirect("http://localhost:3000/login", "http://localhost:3000", productionOrigin)).toBe(
      `${productionOrigin}/`,
    );
  });
});

describe("stream helper sanity", () => {
  it("writes via pipeline", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "weps-stream-"));
    const file = path.join(dir, "x.txt");
    await pipeline(Readable.from(["ok"]), createWriteStream(file));
    expect(await readFile(file, "utf8")).toBe("ok");
    await rm(dir, { recursive: true, force: true });
  });
});

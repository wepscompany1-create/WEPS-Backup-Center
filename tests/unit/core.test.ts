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
  isSafeTempDatabaseName,
  parsePostgresUrl,
  replaceDatabaseName,
} from "@/lib/postgres/url";
import { computeNextScheduledBackupAt, isValidLocalTime } from "@/lib/scheduler/next-run";
import { selectBackupsToDelete } from "@/features/backup/retention";
import { sanitizeErrorMessage } from "@/lib/errors";
import { resolveBackupPath } from "@/lib/storage/paths";
import { loadEnv, resetEnvCache } from "@/lib/config/env";

describe("encryption key parsing", () => {
  it("accepts 32-byte hex and base64", () => {
    const hex = "a".repeat(64);
    expect(parseEncryptionKey(hex)).toHaveLength(32);
    const base64 = Buffer.alloc(32, 7).toString("base64");
    expect(parseEncryptionKey(base64)).toHaveLength(32);
  });

  it("rejects short keys", () => {
    expect(() => parseEncryptionKey("abc")).toThrow();
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

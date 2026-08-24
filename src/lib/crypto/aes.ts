import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AppError, ErrorCodes } from "@/lib/errors";
import { checksumsMatch } from "@/lib/crypto/checksum";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = "aes-256-gcm";

export async function encryptFileAes256Gcm(options: {
  inputPath: string;
  outputPath: string;
  key: Buffer;
}): Promise<{ ivHex: string; authTagHex: string }> {
  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, options.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    await pipeline(createReadStream(options.inputPath), cipher, createWriteStream(options.outputPath));
    const authTag = cipher.getAuthTag();
    return {
      ivHex: iv.toString("hex"),
      authTagHex: authTag.toString("hex"),
    };
  } catch (error) {
    throw new AppError({
      code: ErrorCodes.ENCRYPTION_FAILED,
      message: "AES-256-GCM encryption failed",
      cause: error,
    });
  }
}

export async function decryptFileAes256Gcm(options: {
  inputPath: string;
  outputPath: string;
  key: Buffer;
  ivHex: string;
  authTagHex: string;
}): Promise<void> {
  try {
    const iv = Buffer.from(options.ivHex, "hex");
    const authTag = Buffer.from(options.authTagHex, "hex");
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error("Invalid IV or auth tag length");
    }
    const decipher = createDecipheriv(ALGORITHM, options.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    await pipeline(createReadStream(options.inputPath), decipher, createWriteStream(options.outputPath));
  } catch (error) {
    throw new AppError({
      code: ErrorCodes.RESTORE_DECRYPT_FAILED,
      message: "AES-256-GCM decryption failed",
      cause: error,
    });
  }
}

export async function verifyEncryptedFileChecksum(options: {
  encryptedPath: string;
  key: Buffer;
  ivHex: string;
  authTagHex: string;
  expectedSha256: string;
}): Promise<boolean> {
  const iv = Buffer.from(options.ivHex, "hex");
  const authTag = Buffer.from(options.authTagHex, "hex");
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    return false;
  }

  const decipher = createDecipheriv(ALGORITHM, options.key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  const hash = createHash("sha256");
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      hash.update(chunk as Buffer);
      callback();
    },
  });

  try {
    await pipeline(createReadStream(options.encryptedPath), decipher, sink);
    return checksumsMatch(options.expectedSha256, hash.digest("hex"));
  } catch {
    return false;
  }
}

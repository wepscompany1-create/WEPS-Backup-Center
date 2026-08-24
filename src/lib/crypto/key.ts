import { AppError, ErrorCodes } from "@/lib/errors";

const AES_KEY_BYTES = 32;

export function parseEncryptionKey(raw: string | undefined): Buffer {
  if (!raw || raw.trim().length === 0) {
    throw new AppError({
      code: ErrorCodes.ENCRYPTION_KEY_INVALID,
      message: "BACKUP_ENCRYPTION_KEY is missing",
    });
  }

  const value = raw.trim();

  if (/^[0-9a-fA-F]+$/.test(value) && value.length === 64) {
    return Buffer.from(value, "hex");
  }

  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === AES_KEY_BYTES) {
      return decoded;
    }
  } catch {
    // fall through
  }

  throw new AppError({
    code: ErrorCodes.ENCRYPTION_KEY_INVALID,
    message: "BACKUP_ENCRYPTION_KEY must be 32 bytes as hex (64 chars) or base64",
  });
}

export function isEncryptionKeyConfigured(raw: string | undefined): boolean {
  try {
    parseEncryptionKey(raw);
    return true;
  } catch {
    return false;
  }
}

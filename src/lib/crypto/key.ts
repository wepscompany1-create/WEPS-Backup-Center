import { AppError, ErrorCodes } from "@/lib/errors";
import { isPlaceholderSecret } from "@/lib/config/secrets";

const AES_KEY_BYTES = 32;
const HEX_KEY_LENGTH = AES_KEY_BYTES * 2;

function decodeStrictBase64Key(value: string): Buffer | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 === 1) {
    return null;
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== AES_KEY_BYTES) {
    return null;
  }

  const roundTrip = decoded.toString("base64");
  const withoutPadding = (input: string) => input.replace(/=+$/, "");
  if (withoutPadding(roundTrip) !== withoutPadding(value)) {
    return null;
  }

  return decoded;
}

export function parseEncryptionKey(raw: string | undefined): Buffer {
  if (!raw || raw.trim().length === 0) {
    throw new AppError({
      code: ErrorCodes.ENCRYPTION_KEY_INVALID,
      message: "BACKUP_ENCRYPTION_KEY is missing",
    });
  }

  const value = raw.trim();
  if (isPlaceholderSecret(value)) {
    throw new AppError({
      code: ErrorCodes.ENCRYPTION_KEY_INVALID,
      message: "BACKUP_ENCRYPTION_KEY is a placeholder, not a real key",
    });
  }

  if (/^[0-9a-fA-F]+$/.test(value) && value.length === HEX_KEY_LENGTH) {
    return Buffer.from(value, "hex");
  }

  const decoded = decodeStrictBase64Key(value);
  if (decoded) {
    return decoded;
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

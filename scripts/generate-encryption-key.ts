#!/usr/bin/env tsx
import { randomBytes } from "node:crypto";

const key = randomBytes(32);
process.stdout.write("hex: ");
process.stdout.write(key.toString("hex"));
process.stdout.write("\nbase64: ");
process.stdout.write(key.toString("base64"));
process.stdout.write(
  "\nPaste the hex value into BACKUP_ENCRYPTION_KEY with no quotes, spaces, or hex: prefix.\n",
);

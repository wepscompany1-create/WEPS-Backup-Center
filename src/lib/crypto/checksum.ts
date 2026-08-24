import { timingSafeEqual, createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export function sha256Buffer(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function checksumsMatch(expected: string, actual: string) {
  if (expected.length !== actual.length || expected.length === 0) {
    return false;
  }
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(actual, "hex");
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

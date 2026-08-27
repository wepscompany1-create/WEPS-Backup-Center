export function isTrustedOrigin(
  origin: string | null,
  expectedAppUrl: string | undefined,
  hostHeader: string | null,
) {
  if (!origin) return false;
  if (expectedAppUrl && origin === expectedAppUrl) return true;
  if (!hostHeader) return false;
  try {
    return new URL(origin).host === hostHeader;
  } catch {
    return false;
  }
}

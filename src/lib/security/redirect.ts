const INTERNAL_BASE = "https://internal.invalid";

export function safeInternalPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(value, INTERNAL_BASE);
    if (url.origin !== INTERNAL_BASE) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function createPublicUrl(path: string, appOrigin: string | undefined, requestOrigin: string) {
  return new URL(safeInternalPath(path), appOrigin || requestOrigin);
}

export function resolveAuthRedirect(url: string, baseUrl: string, appOrigin?: string) {
  const canonicalOrigin = new URL(appOrigin || baseUrl).origin;
  if (url.startsWith("/")) {
    return new URL(safeInternalPath(url), canonicalOrigin).toString();
  }

  try {
    const requested = new URL(url);
    if (requested.origin === canonicalOrigin) {
      return requested.toString();
    }
  } catch {
    // Invalid and cross-origin redirects both fall back to the canonical root.
  }

  return `${canonicalOrigin}/`;
}

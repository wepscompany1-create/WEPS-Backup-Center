import { headers } from "next/headers";

const TRUSTED_IP_HEADERS = ["x-forwarded-for", "x-real-ip"] as const;

export async function getClientIp() {
  const headerList = await headers();
  return extractClientIp(headerList.get.bind(headerList));
}

export function extractClientIp(getHeader: (name: string) => string | null) {
  for (const name of TRUSTED_IP_HEADERS) {
    const value = getHeader(name);
    if (!value) continue;
    const first = value.split(",")[0]?.trim();
    if (first && isPlausibleIp(first)) {
      return first.slice(0, 64);
    }
  }
  return "unknown";
}

function isPlausibleIp(value: string) {
  if (value.length > 45 || value.length < 3) return false;
  if (/[\s<>'"\\]/.test(value)) return false;
  return true;
}

export function truncateUserAgent(value: string | null | undefined) {
  if (!value) return undefined;
  return value.slice(0, 180);
}

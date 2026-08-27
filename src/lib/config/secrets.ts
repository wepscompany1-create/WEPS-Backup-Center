const PLACEHOLDER_PREFIX = /^(REPLACE_WITH|CHANGE_ME|CHANGEME|TODO_SET|INSERT_|YOUR[_-])/i;
const PLACEHOLDER_SUBSTRING = /\b(placeholder|changeme)\b/i;
const KNOWN_EXAMPLE_VALUES = new Set([
  "admin@weps.local",
  "secret",
  "password",
  "changeme",
  "change-me",
  "your-secret",
  "your_secret",
]);

export function isPlaceholderSecret(value: string | undefined | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (PLACEHOLDER_PREFIX.test(trimmed)) return true;
  if (KNOWN_EXAMPLE_VALUES.has(trimmed.toLowerCase())) return true;
  if (PLACEHOLDER_SUBSTRING.test(trimmed)) return true;
  return false;
}

export function isUsableSecret(value: string | undefined | null, minLength: number): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length < minLength) return false;
  return !isPlaceholderSecret(trimmed);
}

export function configuredSecret(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || isPlaceholderSecret(trimmed)) return undefined;
  return trimmed;
}

export const PRODUCTION_RESTORE_PHRASE = "استعادة-الإنتاج";

export function matchesProductionRestorePhrase(value: string) {
  return value === PRODUCTION_RESTORE_PHRASE;
}

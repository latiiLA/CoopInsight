export type SchemeId = "eth" | "visa" | "visacbs" | "mastercard";

export type SchemeTab = {
  id: SchemeId;
  label: string;
  /** Any one of these grants the scheme tab. */
  permissions: string[];
};

export function parseScheme(
  raw: string | null,
  allowed: SchemeId[],
): SchemeId | null {
  if (!raw) return null;
  const id = raw.trim().toLowerCase() as SchemeId;
  if (allowed.includes(id)) return id;
  return null;
}

export function firstAllowedScheme(tabs: SchemeTab[]): SchemeId | null {
  return tabs[0]?.id ?? null;
}

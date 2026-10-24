/** Short operator labels for common ISO message types / Cortex message classes. */
const MSG_TYPE_LABELS: Record<string, string> = {
  "100": "Auth req",
  "110": "Auth",
  "120": "Auth adv",
  "130": "Auth adv",
  "200": "Fin req",
  "210": "Financial",
  "220": "Fin adv",
  "230": "Fin adv",
  "400": "Rev req",
  "410": "Reversal",
  "420": "Rev adv",
  "430": "Rev adv",
  // Cortex message class (MSGCLS) often stores a short class, not full MTI.
  "2": "Financial",
  "4": "Reversal",
};

export function isReversalMsgType(
  msgType: string | number | null | undefined,
): boolean {
  const mti = String(msgType ?? "").trim();
  return (
    mti === "4" ||
    mti === "400" ||
    mti === "410" ||
    mti === "420" ||
    mti === "430"
  );
}

/** Human label for a message type code. Falls back to the raw code. */
export function msgTypeLabel(
  msgType: string | number | null | undefined,
): string {
  const raw = String(msgType ?? "").trim();
  if (!raw) return "";
  const key = raw.replace(/^0+/, "") || "0";
  return MSG_TYPE_LABELS[key] || MSG_TYPE_LABELS[raw] || raw;
}

/** Detail views: "Financial (210)" when a mapped label exists. */
export function msgTypeDisplay(
  msgType: string | number | null | undefined,
): string {
  const raw = String(msgType ?? "").trim();
  if (!raw) return "";
  const label = msgTypeLabel(raw);
  return label === raw ? raw : `${label} (${raw})`;
}

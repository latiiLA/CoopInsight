import { isoCurrencyLabel } from "@/lib/iso-currency";

export function formatUsd(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Maps numeric ISO currency codes (e.g. 840) to short alpha labels (USD). */
export function currencyLabel(
  code: string | number | null | undefined,
): string {
  return isoCurrencyLabel(code);
}

export function formatCount(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString();
}

export function formatPct(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toFixed(1)}%`;
}

export function productLabel(code: string): string {
  switch (code) {
    case "401":
      return "Visa Platinum International";
    case "402":
      return "Visa Classic International";
    default:
      return "Prepaid Visa";
  }
}

/** Cortex packs merchant~id~city~ into CRDACPTLOC; show the readable name. */
export function formatMerchantLabel(raw: string | undefined | null): string {
  const value = (raw ?? "").trim();
  if (!value) {
    return "Unknown";
  }
  const name = value.split("~")[0]?.trim();
  return name || value;
}

/** Reversal message types undo the original spend (amounts come back negative).
 * cortex.tlog stores class 4; full MTIs 410/420/430 are accepted if present. */
export function isReversalMsgType(msgType: string | undefined | null): boolean {
  const mti = (msgType ?? "").trim();
  return (
    mti === "4" ||
    mti === "410" ||
    mti === "420" ||
    mti === "430"
  );
}

export function txnResultLabel(row: {
  msgType?: string;
  approved?: boolean;
  rspCode?: string;
}): string {
  if (isReversalMsgType(row.msgType)) {
    return "Reversal";
  }
  return row.approved ? "Approved" : row.rspCode || "Declined";
}

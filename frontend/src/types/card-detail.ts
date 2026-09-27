export type CardMetric = "created" | "issued" | "activated";

/**
 * One card record behind an activity count.
 *
 * `cardMasked` is masked in SQL and always contains an "XXXXXX" run, so there
 * is no unmasked card number anywhere in the API response.
 *
 * `cardholderName` is present only when the caller holds
 * `card:view-cardholder-name`; the sheet checks `cardholderVisible` on the page
 * envelope to decide whether to render the column at all.
 */
export type CardDetail = {
  cardId: number;
  cardMasked: string;
  cardholderName?: string;
  seqNo: number;
  productCode: string;
  productName: string;
  statusCode: string;
  statusDescription: string;
  branchCode: string;
  branchName: string;
  effectiveDate: string;
  expiryDate: string;
  createdAt: string;
  issuedAt: string;
  activatedAt: string;
};

export type CardDetailPage = {
  items: CardDetail[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  metric: CardMetric;
  branchId?: number;
  cardholderVisible: boolean;
};

/**
 * CORTEX stores a far-future sentinel in date columns for events that have not
 * happened yet. A card still awaiting activation carries
 * DATE_ACTIVATION = 2263-08-31. Printing that as a real date reads as a bug, so
 * anything at or beyond this year is rendered as a dash.
 */
const SENTINEL_YEAR = 2200;

export function isSentinelDate(value?: string): boolean {
  if (!value) {
    return true;
  }
  const year = Number.parseInt(value.slice(0, 4), 10);
  return !Number.isFinite(year) || year >= SENTINEL_YEAR;
}

export function formatCardDate(value?: string): string {
  if (isSentinelDate(value)) {
    return "—";
  }
  return value ?? "—";
}

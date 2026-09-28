export type CardStatusGroupBy =
  | "status"
  | "product"
  | "branch"
  | "status-product"
  | "status-branch";

export type CardStatusDateField = "created" | "statusChanged";

export const CARD_STATUS_GROUP_BY_OPTIONS: Array<{
  value: CardStatusGroupBy;
  label: string;
}> = [
  { value: "status", label: "Status only" },
  { value: "product", label: "Product" },
  { value: "branch", label: "Branch" },
  { value: "status-product", label: "Status and product" },
  { value: "status-branch", label: "Status and branch" },
];

export const CARD_STATUS_DATE_FIELD_OPTIONS: Array<{
  value: CardStatusDateField;
  label: string;
}> = [
  { value: "created", label: "Card requested" },
  { value: "statusChanged", label: "Status last changed" },
];

/** True when the grouping includes the status dimension. */
export function groupsByStatus(groupBy: CardStatusGroupBy): boolean {
  return groupBy === "status" || groupBy === "status-product" || groupBy === "status-branch";
}

/** True when the grouping includes the product dimension. */
export function groupsByProduct(groupBy: CardStatusGroupBy): boolean {
  return groupBy === "product" || groupBy === "status-product";
}

/** True when the grouping includes the branch dimension. */
export function groupsByBranch(groupBy: CardStatusGroupBy): boolean {
  return groupBy === "branch" || groupBy === "status-branch";
}

/**
 * One row of the cards-per-status report.
 *
 * The dimension fields arrive only when the report was grouped by them, which is
 * why they are optional rather than empty strings.
 */
/**
 * Health bands, mirroring the backend's model package.
 *
 * The backend derives these from the CORTEX status code and also returns the
 * vendor's ACTIONCODE and CANCELED flags so the two can be compared.
 */
export type CardHealth = "active" | "notActive" | "blocked" | "dead" | "other";

export const CARD_HEALTH_LABELS: Record<CardHealth, string> = {
  active: "Active",
  notActive: "Not yet active",
  blocked: "Blocked",
  dead: "Permanently unusable",
  other: "Unclassified",
};

export const CARD_HEALTH_ORDER: CardHealth[] = [
  "active",
  "notActive",
  "blocked",
  "dead",
  "other",
];

export type CardStatusReport = {
  cardStatus: string;
  statusDescription: string;

  /** Vendor flags from CRDSTATUS. */
  actionCode: string;
  canceled: string;
  health: CardHealth;

  productCode?: string;
  productName?: string;
  branchCode?: string;
  branchName?: string;

  cardCount: number;

  /** Ageing in days from the date the report is bucketed on. */
  age0to7: number;
  age8to30: number;
  age31to90: number;
  age91plus: number;

  /** Cards in the group expiring within the report's expiry window. */
  expiringCount: number;
};

export type CardStatusResponse = {
  items: CardStatusReport[];
  groupBy: CardStatusGroupBy;
  dateField: CardStatusDateField;
  expiringWithinMonths: number;
};

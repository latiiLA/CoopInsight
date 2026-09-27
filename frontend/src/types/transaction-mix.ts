import type { SuccessChannel } from "./report";

/** Which mix axis a slice belongs to. Each axis totals 100% on its own. */
export type TransactionMixAxis = "scheme" | "routing" | "type";

/** One bucket of a single mix axis. */
export type TransactionMixSlice = {
  key: string;
  label: string;
  count: number;
  countPercent: number;
  amount: number;
  amountPercent: number;
};

/**
 * A scheme or routing slice, which additionally carries its reversal exposure.
 * That is the question those two axes exist to answer: which part of the book
 * gets reversed most often.
 */
export type TransactionMixSegment = TransactionMixSlice & {
  reversalCount: number;
  reversalPercent: number;
};

export type TransactionMixReport = {
  dateFrom: string;
  dateTo: string;
  channel: SuccessChannel;
  totalCount: number;
  totalAmount: number;
  authorisationCount: number;
  reversalCount: number;
  reversalPercent: number;
  approvedCount: number;
  byScheme: TransactionMixSegment[];
  byRouting: TransactionMixSegment[];
  byType: TransactionMixSlice[];
};

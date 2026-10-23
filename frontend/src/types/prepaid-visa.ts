export type PrepaidVisaProductBreakdown = {
  productCode: string;
  productName: string;
  fleetCards: number;
  availableBal: number;
  availableAmount: number;
  blockedBal: number;
  fromAvailable: number;
  unloaded: number;
  blockedCards: number;
  topUpCount: number;
  topUpAmount: number;
  unloadCount: number;
  unloadAmount: number;
  txnCount: number;
  txnAmount: number;
  approvedAmount: number;
  activeCards: number;
};

export type PrepaidVisaDailyPoint = {
  date: string;
  topUpCount: number;
  topUpAmount: number;
  txnCount: number;
  txnAmount: number;
  approvedAmount: number;
  activeCards: number;
};

export type PrepaidVisaMerchantSpend = {
  merchant: string;
  txnCount: number;
  txnAmount: number;
  approvedAmt: number;
};

export type PrepaidVisaDashboard = {
  dateFrom: string;
  dateTo: string;
  fleetCards: number;
  fleetAvailableBal: number;
  fleetAvailableAmount: number;
  fleetBlockedBal: number;
  fleetFromAvailable: number;
  fleetUnloaded: number;
  fleetUnloadCount: number;
  fleetTopUpAmount: number;
  fleetTopUpCount: number;
  fleetApprovedAmount: number;
  amtBlockedSum: number;
  blockedPlusFromAvailable: number;
  reconcileExpected: number;
  blockedCards: number;
  fleetCurrency: string;
  topUpCount: number;
  topUpAmount: number;
  topUpCards: number;
  avgTopUp: number;
  largestTopUp: number;
  unloadCount: number;
  unloadAmount: number;
  unloadCards: number;
  txnCount: number;
  txnAmount: number;
  approvedAmount: number;
  activeCards: number;
  approvedCount: number;
  declinedCount: number;
  approvalRate: number;
  avgTxn: number;
  byProduct: PrepaidVisaProductBreakdown[];
  daily: PrepaidVisaDailyPoint[];
  topMerchants: PrepaidVisaMerchantSpend[];
};

export type PrepaidVisaTopUp = {
  cardId: number;
  cardMasked: string;
  customerId: string;
  cardholderName?: string;
  productCode: string;
  productName: string;
  statusCode: string;
  statusDescription: string;
  branchCode: string;
  branchName: string;
  availableBalance: number;
  availableAmount: number;
  blockedBalance: number;
  fromAvailable: number;
  accountCurrency: string;
  accountNumber: string;
  amount: number;
  currency: string;
  description: string;
  txnCode: string;
  date: string;
  time: string;
  tlogId?: number;
  accItemId: number;
};

/** Account unload — wrong-load correction that zeroes wallet funds. */
export type PrepaidVisaUnload = {
  cardId: number;
  cardMasked: string;
  cardholderName?: string;
  productCode: string;
  productName: string;
  statusCode: string;
  statusDescription: string;
  branchCode: string;
  branchName: string;
  availableBalance: number;
  availableAmount: number;
  blockedBalance: number;
  fromAvailable: number;
  unloaded: number;
  accountCurrency: string;
  accountNumber: string;
  amount: number;
  currency: string;
  description: string;
  txnCode: string;
  date: string;
  time: string;
  tlogId?: number;
  accItemId: number;
};

export type PrepaidVisaTransaction = {
  cardId: number;
  cardMasked: string;
  cardholderName?: string;
  productCode: string;
  productName: string;
  statusCode: string;
  statusDescription: string;
  branchCode: string;
  branchName: string;
  availableBalance: number;
  availableAmount: number;
  blockedBalance: number;
  fromAvailable: number;
  accountCurrency: string;
  amount: number;
  currency: string;
  amountTxn?: number;
  txnCurrency?: string;
  txnCode: string;
  msgType: string;
  rspCode: string;
  approved: boolean;
  rrn: string;
  terminalId: string;
  merchantName: string;
  merchantId: string;
  date: string;
  time: string;
  tlogId: number;
};

export type PrepaidVisaCardReconcile = {
  cardId: number;
  cardMasked: string;
  cardholderName?: string;
  productCode: string;
  productName: string;
  statusCode: string;
  statusDescription: string;
  branchCode: string;
  branchName: string;
  availableBalance: number;
  overrideAmount: number;
  blockedBalance: number;
  unclearCredit: number;
  availableAmount: number;
  fromAvailable: number;
  unloaded: number;
  topUpAmount: number;
  linkedCards?: number;
  expected: number;
  variance: number;
  matched: boolean;
};

export type PrepaidVisaReconcileReport = {
  cardCount: number;
  matchedCount: number;
  mismatchCount: number;
  fundedCount: number;
  fundedMatched: number;
  matchTolerance: number;
  totalTopUp: number;
  totalUnloaded: number;
  totalExpected: number;
  totalVariance: number;
  cards: PrepaidVisaCardReconcile[];
};

export type PrepaidVisaLedgerItem = {
  accItemId: number;
  cardId?: number;
  cardMasked?: string;
  date: string;
  time: string;
  kind: "top-up" | "unload" | "spend" | "reversal" | "other" | string;
  description: string;
  amount: number;
  availableDelta: number;
  blockedDelta: number;
  availableAfter: number;
  blockedAfter: number;
};

export type PrepaidVisaCardActivity = {
  card: PrepaidVisaCardReconcile;
  topUps: PrepaidVisaTopUp[];
  topUpsHasMore?: boolean;
  unloads: PrepaidVisaUnload[];
  unloadsHasMore?: boolean;
  transactions: PrepaidVisaTransaction[];
  transactionsHasMore?: boolean;
  ledger: PrepaidVisaLedgerItem[];
  ledgerHasMore?: boolean;
};

export type PrepaidVisaProductFilter = "" | "401" | "402";

export type PrepaidVisaSearchKind = "transactions" | "topups" | "unloads";

export type PrepaidVisaSearchResultFilter = "" | "approved" | "declined";
export type PrepaidVisaSearchReversalFilter = "" | "exclude" | "only";

export type PrepaidVisaSearchArgs = {
  kind: PrepaidVisaSearchKind;
  dateFrom?: string;
  dateTo?: string;
  product?: PrepaidVisaProductFilter;
  card?: string;
  cardholder?: string;
  branch?: string;
  q?: string;
  rrn?: string;
  merchant?: string;
  terminal?: string;
  result?: PrepaidVisaSearchResultFilter;
  reversal?: PrepaidVisaSearchReversalFilter;
  amountMin?: number;
  amountMax?: number;
  account?: string;
  description?: string;
  page?: number;
};

export type PrepaidVisaSearchResult = {
  kind: PrepaidVisaSearchKind;
  page: number;
  pageSize: number;
  hasMore: boolean;
  transactions?: PrepaidVisaTransaction[];
  topUps?: PrepaidVisaTopUp[];
  unloads?: PrepaidVisaUnload[];
};

export type PrepaidVisaPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

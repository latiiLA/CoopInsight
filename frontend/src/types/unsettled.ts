export type UnsettledMatchStatus = "matched" | "unmatched" | string;
export type UnsettledMatchMode = "amount" | "sum" | string;

export type UnsettledTransaction = {
  id: number;
  date: string;
  txnDate: string;
  time: string;
  msgType: number;
  procCode: number;
  rrn: string;
  stan: string;
  respCode: string;
  amount: number;
  currency: number;
  terminalId: string;
  merchant: string;
  cardProduct: string;
  txnSource: string;
  txnDest: string;
  issuerAcquirer: string;
  posAtm: string;
  txnId?: string;
  /** Mastercard IPM nearest-day amount match (MDS unsettled only). */
  matchStatus?: UnsettledMatchStatus;
  matchedSettlementDate?: string;
  /** Settlement slot amount that matched (txn-level or subset total). */
  matchedAmount?: number;
  matchedAmountField?: string;
  matchedFunctionCode?: string;
  matchedFileId?: string;
  /** "amount" = 1:1; "sum" = subset of clearing rows. */
  matchMode?: UnsettledMatchMode;
  /** abs(txn amount); useful when matchedAmount is a larger subset total. */
  matchedClearingAmount?: number;
  /** Related function-685 Financial position total when available. */
  financialPositionTotal?: number;
  financialPositionField?: string;
  matchNote?: string;
};
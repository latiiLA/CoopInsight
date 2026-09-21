export type SuccessChannel = "atm" | "pos" | "switch";

export type SuccessFlow = "overall" | "onus" | "offus" | "issuing" | "acquiring";

export type SuccessGranularity = "day" | "week" | "month";

export type DeclineReason = {
  code: string;
  label: string;
  count: number;
};

export type SuccessTransactionReport = {
  dateFrom: string;
  dateTo: string;
  channel: SuccessChannel;
  flow: SuccessFlow;
  totalTransactions: number;
  approvedCount: number;
  declinedCount: number;
  successRatePercent: number;
  approvedAmount: number;
  declinedAmount: number;
  totalAmount: number;
  declineReasons: DeclineReason[];
};

export type SuccessRateTrendPoint = {
  periodStart: string;
  periodLabel: string;
  totalTransactions: number;
  approvedCount: number;
  declinedCount: number;
  successRatePercent: number;
  approvedAmount: number;
  declinedAmount: number;
  totalAmount: number;
};

export type SuccessRateTrendReport = {
  dateFrom: string;
  dateTo: string;
  channel: SuccessChannel;
  flow: SuccessFlow;
  granularity: SuccessGranularity;
  points: SuccessRateTrendPoint[];
};

export type SuccessRateRow = DeclineReason & {
  id: string;
  sharePercent: number;
};

export type SuccessTransactionDetail = {
  id: string;
  txnAt: string;
  msgType: number;
  terminalId: string;
  terminalLocation: string;
  cardMasked: string;
  cardProduct: string;
  respCode: string;
  respLabel: string;
  outcome: "approved" | "declined" | "reversed" | string;
  amount: number;
  refNum: string;
  acquirer: string;
  txnSrc: string;
  txnDest: string;
  merchantType: number;
};

export type SuccessBrowseOutcome = "all" | "approved" | "declined";

export type EbirrCardlessWithdrawal = {
  id: string;
  rrn: string;
  terminalName: string;
  terminalLocation: string;
  terminalId: string;
  accountNumber: string;
  response: string;
  date: string;
  amount: number;
  customerMobile: string;
  extTxnId: string;
  bankTransferId: string;
};

export type TerminalTransaction = {
  id: string;
  rrn: string;
  terminalId: string;
  terminalName: string;
  terminalLocation: string;
  txnCode: string;
  txnType: string;
  response: string;
  status: string;
  date: string;
  amount: number;
};

export type TerminalPerformanceRow = {
  id: string;
  rank: number;
  terminalId: string;
  terminalName: string;
  branchName: string;
  transactionCount: number;
  approvedCount: number;
  amount: number;
  approvedAmount: number;
};

export type TerminalPerformanceReport = {
  fleet: string;
  terminalCount: number;
  activeCount: number;
  transactionCount: number;
  totalAmount: number;
  highest: TerminalPerformanceRow[];
  lowest: TerminalPerformanceRow[];
  rows: TerminalPerformanceRow[];
};

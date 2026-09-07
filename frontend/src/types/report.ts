export type DeclineReason = {
  code: string;
  label: string;
  count: number;
};

export type SuccessTransactionReport = {
  dateFrom: string;
  dateTo: string;
  totalTransactions: number;
  approvedCount: number;
  declinedCount: number;
  successRatePercent: number;
  approvedAmount: number;
  declinedAmount: number;
  totalAmount: number;
  declineReasons: DeclineReason[];
};

export type SuccessRateRow = DeclineReason & {
  id: string;
  sharePercent: number;
};

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

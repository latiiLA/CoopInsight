export type SafSummary = {
  pending: number;
  done: number;
  skipped: number;
  other: number;
  dateFrom: string;
  dateTo: string;
  asOf: string;
};

export type SafTransaction = {
  seqNum: string;
  destination: string;
  seqNo?: number;
  safDate?: string;
  sendTime?: number;
  status: string;
  route: string;
  formMailbox: string;
  replay: string;
  respCode?: number;
  safCutoffDate?: string;
  safCutoffTime?: number;
  eventId?: number;
  mti: string;
  retries?: number;
  siteId?: number;
  msgType?: number;
  trace?: string;
  pcode?: string;
  amount?: string;
  maskedPan?: string;
};

export type UnclearedTransaction = {
  id: number;
  date: string;
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
};

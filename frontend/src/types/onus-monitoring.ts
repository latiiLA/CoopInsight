export type OnusEvent = {
  id: string;
  time: string;
  direction: string;
  mti: string;
  responseCode: string;
  approved: boolean;
  terminal: string;
  processingCode: string;
  type: string;
  amount: number;
  mcc: string;
  stan: string;
  rrn: string;
  authCode: string;
  acquirer: string;
  bankId: string;
};

export type OnusFrame = {
  type: "status" | "event";
  live: boolean;
  error?: string;
  event?: OnusEvent;
};

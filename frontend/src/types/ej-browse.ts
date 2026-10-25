export type EJBrowseTerminal = {
  terminalId: string;
  fileCount: number;
  txnCount: number;
};

export type EJBrowseFile = {
  terminalId: string;
  filename: string;
  ejDate: string;
  path?: string;
  size: number;
  txnCount: number;
  atmType?: string;
};

export type EJBrowseArgs = {
  dateFrom: string;
  dateTo: string;
};

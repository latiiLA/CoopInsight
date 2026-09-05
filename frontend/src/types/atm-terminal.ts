export type AtmTerminal = {
  id: string;
  unitId: number;
  type?: string;
  terminalId: string;
  terminalName: string;
  branchName: string;
  branchCode?: string;
  districtName: string;
  site?: string;
  cbsAccount?: string;
  port?: number;
  ipAddress?: string;
  status?: string;
  isDeleted?: boolean;
};

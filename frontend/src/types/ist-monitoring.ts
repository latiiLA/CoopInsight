export type ISTAlert = {
  time: string;
  tag: string;
  code: string;
  text: string;
  raw: string;
};

export type ISTDisk = {
  filesystem: string;
  size: string;
  used: string;
  avail: string;
  usePercent: number;
  mount: string;
};

export type ISTPort = {
  index: number;
  name: string;
  server: string;
  node: string;
  state: string;
  address: string;
  connected: boolean;
  kind: "atm" | "pos" | "other" | string;
  site: string;
  terminalId: string;
};

export type ISTBinRoute = {
  node: string;
  group: string;
  formatter: string;
  route: string;
  up: boolean;
};

export type ISTBin = {
  index: number;
  owner: string;
  id: string;
  status: string;
  up: boolean;
  replay: boolean;
  routes: ISTBinRoute[];
};

export type ISTSnapshot = {
  time: string;
  version: string;
  nodeId: string;

  oraclePingOk: boolean;
  oraclePingMs: number;
  dbPingLossPct: number;
  dbPingAvgMs: number;
  dbPingReceived: number;
  dbPingSent: number;
  dbConnections: number;
  dbPingHost: string;

  cpuUserPct: number;
  cpuSystemPct: number;
  cpuIoWaitPct: number;
  cpuIdlePct: number;
  cpuCount: number;

  disks: ISTDisk[];
  diskMaxPct: number;
  diskMaxMount: string;

  memTotalMiB: number;
  memUsedMiB: number;
  memAvailMiB: number;
  swapTotalMiB: number;
  swapUsedMiB: number;

  processTotal: number;
  processZombies: number;

  vmstatRunQueue: number;
  vmstatBlocked: number;

  mailboxUsed: number;
  mailboxConnected: number;
  mailboxFree: number;
  portsUsed: number;
  portsConnected: number;
  portsFree: number;
  buffersUsed: number;
  buffersFree: number;

  mbPortsConnected: number;
  mbPortsNotConnected: number;
  ports: ISTPort[];
  atmOnline: number;
  atmOffline: number;
  posOnline: number;
  posOffline: number;

  binsUp: number;
  binsDown: number;
  bins: ISTBin[];

  defunctProcesses: number;

  shTabTotal: number;
  shTabUsed: number;

  tmlookEvents: number;

  optMailboxEntries: number;
  optTaskEntries: number;
  optPortEntries: number;

  adviceForward: number;
  advicePending: number;
  adviceDone: number;
  adviceDropped: number;

  alerts: ISTAlert[];
  alertCount: number;
};

export type ISTFrame = {
  type: "status" | "snapshot";
  live: boolean;
  error?: string;
  snapshot?: ISTSnapshot;
};

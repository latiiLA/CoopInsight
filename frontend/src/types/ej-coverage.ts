export type EJCoverageDaySummary = {
  date: string;
  synced: number;
  missing: number;
  totalActive: number;
};

export type EJCoverageWeekSummary = {
  dateFrom: string;
  dateTo: string;
  avgSynced: number;
  syncedTerminalDays: number;
  missingTerminalDays: number;
  totalActive: number;
  dayCount: number;
};

export type EJCoverageDayCell = {
  synced: boolean;
  txnCount?: number;
  indexedAt?: string;
};

export type EJCoverageTerminal = {
  terminalId: string;
  terminalName: string;
  status: string;
  days: Record<string, EJCoverageDayCell>;
};

export type EJCoverageResult = {
  dateFrom: string;
  dateTo: string;
  totalActive: number;
  focus: EJCoverageDaySummary;
  week: EJCoverageWeekSummary;
  days: EJCoverageDaySummary[];
  terminals: EJCoverageTerminal[];
};

export type EJCoverageArgs = {
  dateFrom: string;
  dateTo: string;
};

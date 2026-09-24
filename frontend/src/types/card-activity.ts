export type CardDailyActivity = {
  date: string; // yyyy-MM-dd
  created: number;
  issued: number;
  activated: number;
};

export type CardActivityTotals = {
  created: number;
  issued: number;
  activated: number;
};

export type CardActivityReport = {
  from: string; // yyyy-MM-dd
  to: string; // yyyy-MM-dd
  totals: CardActivityTotals;
  daily: CardDailyActivity[];
};

export type CardBranchActivity = {
  branchId: number;
  branchCode: string;
  branchName: string;
  created: number;
  issued: number;
  activated: number;
};

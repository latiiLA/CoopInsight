import { EbirrCardlessWithdrawal } from "@/types/report";

export type EbirrTerminalSummary = {
  id: string;
  terminalId: string;
  terminalName: string;
  terminalLocation: string;
  transactionCount: number;
  totalAmount: number;
};

export type EbirrReportSummary = {
  transactionCount: number;
  totalAmount: number;
  terminalCount: number;
  averageAmount: number;
  byTerminal: EbirrTerminalSummary[];
};

export function summarizeEbirrWithdrawals(
  rows: EbirrCardlessWithdrawal[],
): EbirrReportSummary {
  const byId = new Map<string, EbirrTerminalSummary>();
  let totalAmount = 0;

  for (const row of rows) {
    totalAmount += row.amount;
    const key = row.terminalId.trim() || "unknown";
    const existing = byId.get(key);
    if (existing) {
      existing.transactionCount += 1;
      existing.totalAmount += row.amount;
      continue;
    }

    byId.set(key, {
      id: key,
      terminalId: row.terminalId,
      terminalName: row.terminalName,
      terminalLocation: row.terminalLocation,
      transactionCount: 1,
      totalAmount: row.amount,
    });
  }

  const byTerminal = [...byId.values()].sort(
    (a, b) => b.totalAmount - a.totalAmount || b.transactionCount - a.transactionCount,
  );
  const transactionCount = rows.length;

  return {
    transactionCount,
    totalAmount,
    terminalCount: byTerminal.length,
    averageAmount: transactionCount > 0 ? totalAmount / transactionCount : 0,
    byTerminal,
  };
}

export function formatCount(value: number) {
  return value.toLocaleString();
}

export function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

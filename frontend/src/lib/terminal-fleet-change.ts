import {
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";

export const NEW_STATUS = "New";
export const ACTIVE_STATUS = "Active";

export type FleetChangePeriod = "daily" | "weekly" | "monthly" | "yearly";

export const FLEET_CHANGE_PERIODS: Array<{
  key: FleetChangePeriod;
  label: string;
  phrase: string;
}> = [
  { key: "daily", label: "Daily", phrase: "today" },
  { key: "weekly", label: "Weekly", phrase: "this week" },
  { key: "monthly", label: "Monthly", phrase: "this month" },
  { key: "yearly", label: "Yearly", phrase: "this year" },
];

export type DatedTerminal = {
  status?: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type FleetChangeStats = {
  current: number;
  added: number;
  removed: number;
  net: number;
};

export function isOperatingNewOrActive(terminal: DatedTerminal) {
  if (terminal.isDeleted === true) {
    return false;
  }
  return terminal.status === NEW_STATUS || terminal.status === ACTIVE_STATUS;
}

export function parseTerminalInstant(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1970) {
    return null;
  }
  return date;
}

export function fleetChangePeriodStart(
  period: FleetChangePeriod,
  now = new Date(),
) {
  switch (period) {
    case "daily":
      return startOfDay(now);
    case "weekly":
      return startOfWeek(now, { weekStartsOn: 1 });
    case "monthly":
      return startOfMonth(now);
    case "yearly":
      return startOfYear(now);
  }
}

export function fleetChangeStats(
  terminals: DatedTerminal[],
  period: FleetChangePeriod,
  now = new Date(),
): FleetChangeStats {
  const start = fleetChangePeriodStart(period, now);
  let current = 0;
  let added = 0;
  let removed = 0;

  for (const terminal of terminals) {
    if (isOperatingNewOrActive(terminal)) {
      current += 1;
      const createdAt = parseTerminalInstant(terminal.createdAt);
      if (createdAt && createdAt >= start) {
        added += 1;
      }
      continue;
    }

    if (terminal.isDeleted !== true) {
      continue;
    }

    const createdAt = parseTerminalInstant(terminal.createdAt);
    const updatedAt = parseTerminalInstant(terminal.updatedAt);
    const leftAt = updatedAt ?? createdAt;
    if (leftAt && leftAt >= start && (!createdAt || createdAt < start)) {
      removed += 1;
    }
  }

  return {
    current,
    added,
    removed,
    net: added - removed,
  };
}

export function formatSignedCount(value: number) {
  if (value > 0) {
    return `+${value.toLocaleString()}`;
  }
  return value.toLocaleString();
}

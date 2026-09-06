import { PosTerminal } from "@/types/pos-terminal";

export const ALL = "all";
export const STOPPED = "Stopped";
export const RELOCATED = "Relocated";
export const TO_BE_RELOCATED = "ToBeRelocated";
export const SITE_MERCHANT = "MERCHANT";
export const SITE_BRANCH = "BRANCH";

export const INACTIVE_STATUSES = new Set([STOPPED, RELOCATED]);

export function isInactiveStatus(status?: string) {
  return INACTIVE_STATUSES.has(status ?? "");
}

export type PosTerminalFilters = {
  status: string;
  district: string;
  branch: string;
  site: string;
  businessType: string;
  merchant: string;
};

export const emptyPosTerminalFilters: PosTerminalFilters = {
  status: ALL,
  district: ALL,
  branch: ALL,
  site: ALL,
  businessType: ALL,
  merchant: ALL,
};

export function formatCount(value: number) {
  return value.toLocaleString();
}

export function isDeletedTerminal(terminal: PosTerminal) {
  return terminal.isDeleted === true;
}

export function liveTerminals(terminals: PosTerminal[]) {
  return terminals.filter((terminal) => !isDeletedTerminal(terminal));
}

export function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));
}

export function statusFilterOptions(terminals: PosTerminal[]) {
  return uniqueSorted(terminals.map((terminal) => terminal.status));
}

export function matchesFilters(
  terminal: PosTerminal,
  filters: PosTerminalFilters,
) {
  if (filters.status === ALL || !isInactiveStatus(filters.status)) {
    if (isDeletedTerminal(terminal)) {
      return false;
    }
  }

  if (filters.status !== ALL && terminal.status !== filters.status) {
    return false;
  }

  if (filters.district !== ALL) {
    const district = terminal.districtName?.trim() || "Unknown";
    if (district !== filters.district) {
      return false;
    }
  }
  if (filters.branch !== ALL && terminal.branchName !== filters.branch) {
    return false;
  }
  if (filters.site !== ALL && terminal.site !== filters.site) {
    return false;
  }
  if (filters.businessType !== ALL) {
    const businessType = terminal.businessType?.trim() || "Unknown";
    if (businessType !== filters.businessType) {
      return false;
    }
  }
  if (filters.merchant !== ALL && terminal.merchantName !== filters.merchant) {
    return false;
  }
  return true;
}

export function countWhere(
  terminals: PosTerminal[],
  key: "status" | "site" | "businessType",
  value: string,
) {
  const source =
    key === "status" && isInactiveStatus(value)
      ? terminals
      : liveTerminals(terminals);

  return source.filter((terminal) => (terminal[key] ?? "") === value).length;
}

export type CountSlice = {
  name: string;
  count: number;
};

export function countBy(
  terminals: PosTerminal[],
  getKey: (terminal: PosTerminal) => string | undefined,
): CountSlice[] {
  const totals = new Map<string, number>();

  for (const terminal of terminals) {
    const name = getKey(terminal)?.trim() || "Unknown";
    totals.set(name, (totals.get(name) ?? 0) + 1);
  }

  return Array.from(totals.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

export function withOthers(slices: CountSlice[], limit: number): CountSlice[] {
  if (slices.length <= limit) {
    return slices;
  }

  const top = slices.slice(0, limit);
  const rest = slices.slice(limit).reduce((sum, slice) => sum + slice.count, 0);

  return [...top, { name: "Others", count: rest }];
}

export function uniqueMerchantCount(terminals: PosTerminal[]) {
  return new Set(
    liveTerminals(terminals)
      .map((terminal) => terminal.merchantId?.trim() || terminal.merchantName?.trim())
      .filter(Boolean),
  ).size;
}

function districtLabel(value?: string) {
  return value?.trim() || "Unknown";
}

export type PosDistrictMix = {
  district: string;
  live: number;
  active: number;
  newCount: number;
  toBeRelocated: number;
  merchant: number;
  branch: number;
  stopped: number;
  relocated: number;
};

export function districtMix(terminals: PosTerminal[]): PosDistrictMix[] {
  const rows = new Map<string, PosDistrictMix>();

  const rowFor = (district: string) => {
    const existing = rows.get(district);
    if (existing) {
      return existing;
    }

    const created: PosDistrictMix = {
      district,
      live: 0,
      active: 0,
      newCount: 0,
      toBeRelocated: 0,
      merchant: 0,
      branch: 0,
      stopped: 0,
      relocated: 0,
    };
    rows.set(district, created);
    return created;
  };

  for (const terminal of terminals) {
    const row = rowFor(districtLabel(terminal.districtName));

    if (terminal.status === STOPPED) {
      row.stopped += 1;
      continue;
    }
    if (terminal.status === RELOCATED) {
      row.relocated += 1;
      continue;
    }
    if (isDeletedTerminal(terminal)) {
      continue;
    }

    row.live += 1;
    if (terminal.status === "Active") {
      row.active += 1;
    } else if (terminal.status === "New") {
      row.newCount += 1;
    } else if (terminal.status === TO_BE_RELOCATED) {
      row.toBeRelocated += 1;
    }
    if (terminal.site === SITE_MERCHANT) {
      row.merchant += 1;
    } else if (terminal.site === SITE_BRANCH) {
      row.branch += 1;
    }
  }

  return Array.from(rows.values()).sort(
    (left, right) =>
      right.live - left.live || left.district.localeCompare(right.district),
  );
}

export type PosStackedDistrictRow = {
  name: string;
  live: number;
  MERCHANT: number;
  BRANCH: number;
};

export function stackedDistrictRows(
  mix: PosDistrictMix[],
  limit: number,
): PosStackedDistrictRow[] {
  const mapped: PosStackedDistrictRow[] = mix
    .filter((row) => row.live > 0)
    .map((row) => ({
      name: row.district,
      live: row.live,
      [SITE_MERCHANT]: row.merchant,
      [SITE_BRANCH]: row.branch,
    }));

  if (mapped.length <= limit) {
    return mapped;
  }

  const top = mapped.slice(0, limit);
  const rest = mapped.slice(limit);
  const others: PosStackedDistrictRow = {
    name: "Others",
    live: 0,
    MERCHANT: 0,
    BRANCH: 0,
  };

  for (const row of rest) {
    others.live += row.live;
    others.MERCHANT += row.MERCHANT;
    others.BRANCH += row.BRANCH;
  }

  return [...top, others];
}

export function filtersFromSearchParams(params: URLSearchParams): PosTerminalFilters {
  return {
    status: params.get("status") || ALL,
    district: params.get("district") || ALL,
    branch: params.get("branch") || ALL,
    site: params.get("site") || ALL,
    businessType: params.get("businessType") || ALL,
    merchant: params.get("merchant") || ALL,
  };
}

export function posTerminalsPath(filters: Partial<PosTerminalFilters> = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== ALL) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/pos-terminals?${query}` : "/pos-terminals";
}

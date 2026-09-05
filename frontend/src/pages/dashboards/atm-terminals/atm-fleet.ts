import { AtmTerminal } from "@/types/atm-terminal";

export const ALL = "all";
export const STOPPED = "Stopped";
export const RELOCATED = "Relocated";

export const INACTIVE_STATUSES = new Set([STOPPED, RELOCATED]);

export function isInactiveStatus(status?: string) {
  return INACTIVE_STATUSES.has(status ?? "");
}

export type AtmTerminalFilters = {
  status: string;
  district: string;
  branch: string;
  type: string;
  site: string;
};

export const emptyAtmTerminalFilters: AtmTerminalFilters = {
  status: ALL,
  district: ALL,
  branch: ALL,
  type: ALL,
  site: ALL,
};

export function formatCount(value: number) {
  return value.toLocaleString();
}

export function isDeletedTerminal(terminal: AtmTerminal) {
  return terminal.isDeleted === true;
}

export function liveTerminals(terminals: AtmTerminal[]) {
  return terminals.filter((terminal) => !isDeletedTerminal(terminal));
}

export function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));
}

export function statusFilterOptions(terminals: AtmTerminal[]) {
  return uniqueSorted(terminals.map((terminal) => terminal.status));
}

export function matchesFilters(
  terminal: AtmTerminal,
  filters: AtmTerminalFilters,
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
  if (filters.type !== ALL && terminal.type !== filters.type) {
    return false;
  }
  if (filters.site !== ALL && terminal.site !== filters.site) {
    return false;
  }
  return true;
}

export function countWhere(
  terminals: AtmTerminal[],
  key: "status" | "site" | "type",
  value: string,
) {
  const source =
    key === "status" && isInactiveStatus(value)
      ? terminals
      : liveTerminals(terminals);

  return source.filter((terminal) => terminal[key] === value).length;
}

export type CountSlice = {
  name: string;
  count: number;
};

export function countBy(
  terminals: AtmTerminal[],
  getKey: (terminal: AtmTerminal) => string | undefined,
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

function districtLabel(value?: string) {
  return value?.trim() || "Unknown";
}

export type DistrictMix = {
  district: string;
  live: number;
  active: number;
  newCount: number;
  onsite: number;
  offsite: number;
  crm: number;
  ncr: number;
  stopped: number;
  relocated: number;
};

export type StackedDistrictRow = {
  name: string;
  live: number;
  Onsite?: number;
  Offsite?: number;
  CRM?: number;
  NCR?: number;
};

export function districtMix(terminals: AtmTerminal[]): DistrictMix[] {
  const rows = new Map<string, DistrictMix>();

  const rowFor = (district: string) => {
    const existing = rows.get(district);
    if (existing) {
      return existing;
    }

    const created: DistrictMix = {
      district,
      live: 0,
      active: 0,
      newCount: 0,
      onsite: 0,
      offsite: 0,
      crm: 0,
      ncr: 0,
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
    }
    if (terminal.site === "Onsite") {
      row.onsite += 1;
    } else if (terminal.site === "Offsite") {
      row.offsite += 1;
    }
    if (terminal.type === "CRM") {
      row.crm += 1;
    } else if (terminal.type === "NCR") {
      row.ncr += 1;
    }
  }

  return Array.from(rows.values()).sort(
    (left, right) =>
      right.live - left.live || left.district.localeCompare(right.district),
  );
}

export function stackedDistrictRows(
  mix: DistrictMix[],
  mode: "site" | "type",
  limit: number,
): StackedDistrictRow[] {
  const mapped: StackedDistrictRow[] = mix
    .filter((row) => row.live > 0)
    .map((row) =>
      mode === "site"
        ? {
            name: row.district,
            live: row.live,
            Onsite: row.onsite,
            Offsite: row.offsite,
          }
        : {
            name: row.district,
            live: row.live,
            CRM: row.crm,
            NCR: row.ncr,
          },
    );

  if (mapped.length <= limit) {
    return mapped;
  }

  const top = mapped.slice(0, limit);
  const rest = mapped.slice(limit);
  const others: StackedDistrictRow = { name: "Others", live: 0 };

  if (mode === "site") {
    others.Onsite = 0;
    others.Offsite = 0;
  } else {
    others.CRM = 0;
    others.NCR = 0;
  }

  for (const row of rest) {
    others.live += row.live;
    if (mode === "site") {
      others.Onsite = (others.Onsite ?? 0) + (row.Onsite ?? 0);
      others.Offsite = (others.Offsite ?? 0) + (row.Offsite ?? 0);
    } else {
      others.CRM = (others.CRM ?? 0) + (row.CRM ?? 0);
      others.NCR = (others.NCR ?? 0) + (row.NCR ?? 0);
    }
  }

  return [...top, others];
}

export function filtersFromSearchParams(params: URLSearchParams): AtmTerminalFilters {
  return {
    status: params.get("status") || ALL,
    district: params.get("district") || ALL,
    branch: params.get("branch") || ALL,
    type: params.get("type") || ALL,
    site: params.get("site") || ALL,
  };
}

export function atmTerminalsPath(filters: Partial<AtmTerminalFilters> = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== ALL) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/atm-terminals?${query}` : "/atm-terminals";
}

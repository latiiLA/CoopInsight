import { AtmTerminal } from "@/types/atm-terminal";
import { ISTBin, ISTPort } from "@/types/ist-monitoring";
import { RELOCATED, isDeletedTerminal } from "@/pages/dashboards/atm-terminals/atm-fleet";

export type AtmSiteFilter = "all" | "CBOBNA" | "CBONCR";
export type AtmOnlineFilter = "all" | "online" | "offline";

export type AtmMonitorRow = {
  key: string;
  unitId: number;
  terminalId: string;
  site: AtmSiteFilter | string;
  online: boolean;
  portName: string;
};

export function activeFleetTerminals(terminals: AtmTerminal[]) {
  return terminals.filter(
    (terminal) =>
      !isDeletedTerminal(terminal) &&
      (terminal.status ?? "").trim() !== RELOCATED,
  );
}

export function normalizeTerminalKey(value: string | number | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const stripped = raw.replace(/^0+/, "");
  return stripped || "0";
}

export function isAtmPort(port: ISTPort) {
  return port.kind === "atm" || port.name.toLowerCase().startsWith("atm.");
}

export function portSite(port: ISTPort) {
  if (port.site) return port.site.trim().toUpperCase();
  const parts = port.name.split(".");
  return parts.length >= 3 ? parts[2].trim().toUpperCase() : "";
}

export function portTerminalId(port: ISTPort) {
  if (port.terminalId) return port.terminalId.trim();
  const parts = port.name.split(".");
  return parts.length >= 4 ? parts[3].trim() : "";
}

function guessSiteFromType(type?: string): string {
  const t = (type ?? "").trim().toUpperCase();
  if (t === "NCR") return "CBONCR";
  return "CBOBNA";
}

/** Join TMS fleet ATMs with IST connection status. */
export function buildAtmMonitorRows(
  fleet: AtmTerminal[],
  ports: ISTPort[],
): AtmMonitorRow[] {
  const atmPorts = ports.filter(isAtmPort);
  const byTerminal = new Map<string, ISTPort>();
  const byUnit = new Map<string, ISTPort>();

  for (const port of atmPorts) {
    const term = normalizeTerminalKey(portTerminalId(port));
    if (term && !byTerminal.has(term)) byTerminal.set(term, port);
    // IST trailing segment sometimes equals unit id.
    if (term && !byUnit.has(term)) byUnit.set(term, port);
  }

  const rows: AtmMonitorRow[] = [];
  for (const terminal of activeFleetTerminals(fleet)) {
    const termKey = normalizeTerminalKey(terminal.terminalId);
    const unitKey = normalizeTerminalKey(terminal.unitId);
    const port =
      (termKey ? byTerminal.get(termKey) : undefined) ??
      (unitKey ? byUnit.get(unitKey) : undefined);

    const site = port
      ? portSite(port) || guessSiteFromType(terminal.type)
      : guessSiteFromType(terminal.type);

    rows.push({
      key: terminal.id || `${terminal.unitId}-${terminal.terminalId}`,
      unitId: terminal.unitId,
      terminalId: terminal.terminalId,
      site,
      online: Boolean(port?.connected),
      portName: port?.name ?? "",
    });
  }

  return rows.sort((a, b) => {
    if (a.online !== b.online) return a.online ? 1 : -1;
    if (a.site !== b.site) return String(a.site).localeCompare(String(b.site));
    return a.unitId - b.unitId;
  });
}

export type BinServiceDef = {
  key: string;
  title: string;
  ids: string[];
  owners: string[];
  routeNames: string[];
};

export const BIN_SERVICE_DEFS: BinServiceDef[] = [
  {
    key: "visa-sms",
    title: "VISA SMS",
    ids: ["04"],
    owners: [],
    routeNames: ["VisaRoute_SMS"],
  },
  {
    key: "visa-base-i",
    title: "VISA Base I",
    ids: [],
    owners: [],
    routeNames: ["VisaAcqRoute", "VisaRoute_BaseI"],
  },
  {
    key: "mc-normal",
    title: "MC Normal",
    ids: ["05"],
    owners: [],
    routeNames: ["MasterCardRoute1", "MasterCardRoute2"],
  },
  {
    key: "mc-cirrus",
    title: "MC Cirrus",
    ids: ["06"],
    owners: [],
    routeNames: ["MasterCIRRoute1", "MasterCIRRoute2"],
  },
  {
    key: "memento",
    title: "MEMENTO",
    ids: ["MEMENTO", "15"],
    owners: ["MEMENTO"],
    routeNames: ["FM_TXN", "FM_TXN1"],
  },
  {
    key: "cortex",
    title: "Cortex",
    ids: ["1000000007"],
    owners: ["CBOBCORTEX"],
    routeNames: ["CTXXML_ROUTE"],
  },
  {
    key: "eth",
    title: "ETH",
    ids: ["1000000010"],
    owners: ["CBOETH"],
    routeNames: ["ETHFMT_ROUTE"],
  },
];

function binIdMatches(binId: string, wanted: string) {
  const a = binId.trim();
  const b = wanted.trim();
  if (!a || !b) return false;
  return a.toUpperCase() === b.toUpperCase();
}

function routeMatches(bin: ISTBin, names: string[]) {
  if (names.length === 0) return false;
  return (bin.routes ?? []).some((route) =>
    names.some((name) => {
      const wanted = name.trim().toUpperCase();
      return (
        route.route.trim().toUpperCase() === wanted ||
        route.formatter.trim().toUpperCase() === wanted ||
        route.group.trim().toUpperCase() === wanted
      );
    }),
  );
}

function scoreBinForService(bin: ISTBin, def: BinServiceDef) {
  let score = 0;
  if (def.ids.some((id) => binIdMatches(bin.id, id))) score += 4;
  if (
    def.owners.some(
      (owner) => bin.owner.trim().toUpperCase() === owner.trim().toUpperCase(),
    )
  ) {
    score += 6;
  }
  if (routeMatches(bin, def.routeNames)) score += 8;
  return score;
}

export function findBinForService(
  bins: ISTBin[],
  def: BinServiceDef,
  claimed: Set<string>,
): ISTBin | undefined {
  const claimKey = (bin: ISTBin) => `${bin.index}|${bin.id}|${bin.owner}`;

  let best: ISTBin | undefined;
  let bestScore = 0;
  for (const bin of bins) {
    if (claimed.has(claimKey(bin))) continue;
    const score = scoreBinForService(bin, def);
    if (score > bestScore) {
      best = bin;
      bestScore = score;
    }
  }

  if (!best || bestScore <= 0) return undefined;
  claimed.add(claimKey(best));
  return best;
}

function csvEscape(value: string | number | boolean) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function stampForFilename(cycleTime: string) {
  const raw = (cycleTime || new Date().toISOString()).trim();
  return raw.replace(/[^\d]+/g, "-").replace(/^-|-$/g, "") || "snapshot";
}

/** Point-in-time CSV export of ATM (+ optional BIN) statuses for the current cycle. */
export function exportIstStatusesCsv(opts: {
  cycleTime: string;
  atms: AtmMonitorRow[];
  bins?: ISTBin[];
}) {
  const stamp = stampForFilename(opts.cycleTime);
  const atmLines = [
    ["cycle_time", "unit_id", "terminal_id", "site", "status"].join(","),
    ...opts.atms.map((row) =>
      [
        opts.cycleTime,
        row.unitId,
        row.terminalId,
        row.site,
        row.online ? "online" : "offline",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  downloadTextFile(
    `ist-atm-status-${stamp}.csv`,
    atmLines.join("\n"),
    "text/csv;charset=utf-8;",
  );

  if (opts.bins && opts.bins.length > 0) {
    const claimed = new Set<string>();
    const binLines = [
      [
        "cycle_time",
        "service",
        "bin_id",
        "owner",
        "status",
        "replay",
        "route",
        "route_status",
      ].join(","),
    ];
    for (const def of BIN_SERVICE_DEFS) {
      const bin = findBinForService(opts.bins, def, claimed);
      const routes =
        bin?.routes?.length && def.routeNames.length
          ? def.routeNames
          : def.routeNames.length
            ? def.routeNames
            : bin?.routes?.map((r) => r.route) ?? [""];
      const names = routes.length > 0 ? routes : [""];
      for (const routeName of names) {
        const route = (bin?.routes ?? []).find(
          (r) =>
            r.route.trim().toUpperCase() === routeName.trim().toUpperCase() ||
            r.formatter.trim().toUpperCase() === routeName.trim().toUpperCase(),
        );
        binLines.push(
          [
            opts.cycleTime,
            def.title,
            bin?.id ?? def.ids[0] ?? "",
            bin?.owner ?? def.owners[0] ?? "",
            bin ? (bin.up ? "Up" : bin.status || "Down") : "Missing",
            bin?.replay ? "yes" : "no",
            routeName,
            route ? (route.up ? "Up" : "Down") : "",
          ]
            .map(csvEscape)
            .join(","),
        );
      }
    }
    downloadTextFile(
      `ist-bin-status-${stamp}.csv`,
      binLines.join("\n"),
      "text/csv;charset=utf-8;",
    );
  }
}

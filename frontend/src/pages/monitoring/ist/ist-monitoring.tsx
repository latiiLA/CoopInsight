import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  Download,
  HardDrive,
  Network,
  PlugZap,
  ServerCog,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import config from "@/configs/config";
import { fetchAtmTerminals } from "@/features/atm_terminal_slice";
import {
  ISTAlert,
  ISTBin,
  ISTFrame,
  ISTPort,
  ISTSnapshot,
} from "@/types/ist-monitoring";
import { getStoredAuthToken } from "@/utility/auth-token";
import { AppDispatch, RootState } from "../../../../app/store/store";
import {
  AtmMonitorRow,
  AtmOnlineFilter,
  AtmSiteFilter,
  BIN_SERVICE_DEFS,
  buildAtmMonitorRows,
  exportIstStatusesCsv,
  findBinForService,
  isAtmPort,
} from "./ist-monitor-helpers";

const SOCKET_PATH = "/monitoring/ist/ws";
const MAX_ALERT_HISTORY = 100;
const ATM_PAGE_SIZE = 48;
const PORT_ROW_CAP = 400;
const SNAPSHOT_CACHE_KEY = "ist-monitor-last-snapshot";

function readCachedSnapshot(): ISTSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ISTSnapshot;
  } catch {
    return null;
  }
}

function writeCachedSnapshot(snapshot: ISTSnapshot) {
  try {
    sessionStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function monitoringSocketUrl(token: string) {
  const apiBase = config.API_URL.replace(/\/$/, "");
  const path = SOCKET_PATH;

  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    const url = new URL(`${apiBase}${path}`);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("token", token);
    return url.toString();
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${apiBase}${path}?token=${encodeURIComponent(token)}`;
}

function alertKey(alert: ISTAlert) {
  return `${alert.time}|${alert.code}|${alert.text}`;
}

type Tone = "ok" | "warn" | "bad" | "muted";

const toneClasses: Record<Tone, string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-destructive",
  muted: "text-muted-foreground",
};

const toneDot: Record<Tone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-destructive",
  muted: "bg-muted-foreground/40",
};

function Stat({
  label,
  value,
  sub,
  tone = "muted",
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-3">
        {Icon ? (
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toneClasses[tone]}`} />
        ) : null}
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-lg font-semibold tabular-nums ${toneClasses[tone]}`}>
            {value}
          </div>
          {sub ? (
            <div className="truncate text-xs text-muted-foreground">{sub}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Bar({ pct, tone }: { pct: number; tone: Tone }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${toneDot[tone]}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function diskTone(pct: number): Tone {
  if (pct >= 90) return "bad";
  if (pct >= 80) return "warn";
  return "ok";
}

export default function IstMonitoring() {
  const dispatch = useDispatch<AppDispatch>();
  const { terminals: fleetTerminals } = useSelector(
    (state: RootState) => state.atmTerminal,
  );
  const [snapshot, setSnapshot] = useState<ISTSnapshot | null>(() =>
    readCachedSnapshot(),
  );
  const [alertHistory, setAlertHistory] = useState<ISTAlert[]>([]);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenAlerts = useRef(new Set<string>());

  useEffect(() => {
    void dispatch(fetchAtmTerminals());
  }, [dispatch]);

  useEffect(() => {
    if (!config.LiveMonitoringEnabled) {
      setLive(false);
      setError("Live monitoring is disabled");
      return;
    }

    const token = getStoredAuthToken();
    if (!token) {
      setError("Authentication token not found");
      return;
    }

    seenAlerts.current = new Set();
    setAlertHistory([]);
    let stopped = false;
    let socket: WebSocket | undefined;
    let reconnect: number | undefined;

    const connect = () => {
      if (stopped) return;

      socket = new WebSocket(monitoringSocketUrl(token));

      socket.onmessage = (message) => {
        let frame: ISTFrame;
        try {
          frame = JSON.parse(message.data) as ISTFrame;
        } catch {
          return;
        }

        if (frame.type === "status") {
          setLive(Boolean(frame.live));
          setError(frame.error || null);
          return;
        }

        if (frame.type !== "snapshot" || !frame.snapshot) return;

        setLive(Boolean(frame.live));
        setError(frame.error || null);
        setSnapshot(frame.snapshot);
        writeCachedSnapshot(frame.snapshot);

        const incoming = frame.snapshot.alerts ?? [];
        if (incoming.length > 0) {
          setAlertHistory((current) => {
            const fresh = incoming.filter((alert) => {
              const key = alertKey(alert);
              if (seenAlerts.current.has(key)) return false;
              seenAlerts.current.add(key);
              return true;
            });
            if (fresh.length === 0) return current;
            return [...fresh, ...current].slice(0, MAX_ALERT_HISTORY);
          });
        }
      };

      socket.onerror = () => {
        setLive(false);
        setError("Live stream disconnected");
      };

      socket.onclose = () => {
        setLive(false);
        if (!stopped) reconnect = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      stopped = true;
      socket?.close();
      if (reconnect) window.clearTimeout(reconnect);
    };
  }, []);

  const cpuBusy = useMemo(
    () => (snapshot ? 100 - snapshot.cpuIdlePct : 0),
    [snapshot],
  );

  const atmRows = useMemo(
    () =>
      buildAtmMonitorRows(fleetTerminals ?? [], snapshot?.ports ?? []),
    [fleetTerminals, snapshot?.ports],
  );
  const atmOnline = atmRows.filter((row) => row.online).length;
  const atmOffline = atmRows.length - atmOnline;

  return (
    <div className="container mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 py-0.5">
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="text-base font-semibold tracking-tight">
            IST switch health
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                live ? "bg-emerald-500" : "bg-muted-foreground/40"
              }`}
            />
            <span>
              {live
                ? "Live"
                : config.LiveMonitoringEnabled
                  ? "Connecting"
                  : "Disabled"}
            </span>
          </div>
        </div>
        {snapshot ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-muted-foreground">
              <span className="tabular-nums">{snapshot.time}</span>
              {snapshot.version ? <span> · v{snapshot.version}</span> : null}
              {snapshot.nodeId ? <span> · {snapshot.nodeId}</span> : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() =>
                exportIstStatusesCsv({
                  cycleTime: snapshot.time,
                  atms: atmRows,
                  bins: snapshot.bins ?? [],
                })
              }
            >
              <Download className="h-3.5 w-3.5" />
              Export status
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      {!snapshot ? (
        <div className="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
          {config.LiveMonitoringEnabled
            ? "Loading last IST monitor cycle..."
            : "Live IST monitoring is disabled"}
        </div>
      ) : (
        <>
          {!live ? (
            <div className="rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
              Showing last complete cycle
              {snapshot.time ? ` · ${snapshot.time}` : ""}. Waiting for the next
              refresh…
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
            <Stat
              label="ATMs online"
              icon={Activity}
              tone={atmOffline > 0 ? "warn" : "ok"}
              value={String(atmOnline)}
              sub={`${atmOffline} offline`}
            />
            <Stat
              label="Oracle DB"
              icon={Database}
              tone={snapshot.oraclePingOk ? "ok" : "bad"}
              value={snapshot.oraclePingOk ? "Reachable" : "Unreachable"}
              sub={
                snapshot.oraclePingOk
                  ? `TNS ping ${snapshot.oraclePingMs} ms`
                  : "TNS ping failed"
              }
            />
            <Stat
              label="DB host ping"
              icon={Network}
              tone={snapshot.dbPingLossPct > 0 ? "warn" : "ok"}
              value={`${snapshot.dbPingLossPct}% loss`}
              sub={`${snapshot.dbPingReceived}/${snapshot.dbPingSent} · ${snapshot.dbPingAvgMs} ms avg`}
            />
            <Stat
              label="DB connections"
              icon={PlugZap}
              tone="muted"
              value={String(snapshot.dbConnections)}
              sub="netstat :1521"
            />
            <Stat
              label="CPU busy"
              icon={Cpu}
              tone={cpuBusy >= 85 ? "bad" : cpuBusy >= 70 ? "warn" : "ok"}
              value={`${cpuBusy.toFixed(1)}%`}
              sub={`usr ${snapshot.cpuUserPct} · sys ${snapshot.cpuSystemPct}`}
            />
            <Stat
              label="Disk peak"
              icon={HardDrive}
              tone={diskTone(snapshot.diskMaxPct)}
              value={`${snapshot.diskMaxPct}%`}
              sub={snapshot.diskMaxMount || "—"}
            />
            <Stat
              label="Alerts"
              icon={AlertTriangle}
              tone={snapshot.alertCount > 0 ? "warn" : "ok"}
              value={String(snapshot.alertCount)}
              sub="this cycle"
            />
          </div>

          <AtmFleetCard rows={atmRows} cycleTime={snapshot.time} />

          <BinServicesSection bins={snapshot.bins ?? []} />

          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="py-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  Disk usage
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Mount</th>
                      <th className="px-3 py-1.5 text-left font-medium">FS</th>
                      <th className="px-3 py-1.5 text-right font-medium">Size</th>
                      <th className="px-3 py-1.5 text-right font-medium">Used</th>
                      <th className="px-3 py-1.5 text-right font-medium">Avail</th>
                      <th className="w-32 px-3 py-1.5 text-right font-medium">Use%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.disks.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-4 text-center text-muted-foreground"
                        >
                          No disk data
                        </td>
                      </tr>
                    ) : (
                      snapshot.disks.map((disk) => (
                        <tr
                          key={`${disk.filesystem}-${disk.mount}`}
                          className="border-t"
                        >
                          <td className="px-3 py-1.5 font-medium">{disk.mount}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {disk.filesystem}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {disk.size}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {disk.used}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {disk.avail}
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center justify-end gap-2">
                              <span className="w-10 text-right tabular-nums">
                                {disk.usePercent}%
                              </span>
                              <div className="w-16">
                                <Bar
                                  pct={disk.usePercent}
                                  tone={diskTone(disk.usePercent)}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ServerCog className="h-4 w-4 text-muted-foreground" />
                  Switch resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 p-3 text-sm">
                <MemoryBar
                  label="Memory"
                  usedMiB={snapshot.memUsedMiB}
                  totalMiB={snapshot.memTotalMiB}
                  availMiB={snapshot.memAvailMiB}
                />
                <MemoryBar
                  label="Swap"
                  usedMiB={snapshot.swapUsedMiB}
                  totalMiB={snapshot.swapTotalMiB}
                />
                <div className="border-t pt-2" />
                <ResourceRow
                  label="Mailboxes"
                  used={snapshot.mailboxUsed}
                  connected={snapshot.mailboxConnected}
                  free={snapshot.mailboxFree}
                  total={snapshot.optMailboxEntries}
                />
                <ResourceRow
                  label="Ports (usage)"
                  used={snapshot.portsUsed}
                  connected={snapshot.portsConnected}
                  free={snapshot.portsFree}
                  total={snapshot.optPortEntries}
                />
                <ResourceRow
                  label="Memory buffers"
                  used={snapshot.buffersUsed}
                  free={snapshot.buffersFree}
                />
                <div className="border-t pt-2" />
                <MiniStat
                  icon={PlugZap}
                  label="Comm ports connected"
                  value={snapshot.mbPortsConnected}
                  tone={snapshot.mbPortsNotConnected > 0 ? "warn" : "ok"}
                  hint={`${snapshot.mbPortsNotConnected} not connected`}
                />
                <MiniStat
                  icon={Activity}
                  label="BIN processes"
                  value={snapshot.binsUp}
                  tone={snapshot.binsDown > 0 ? "warn" : "ok"}
                  hint={`${snapshot.binsDown} down`}
                />
                <MiniStat
                  label="POS ports"
                  value={snapshot.posOnline ?? 0}
                  tone={(snapshot.posOffline ?? 0) > 0 ? "warn" : "muted"}
                  hint={`${snapshot.posOffline ?? 0} offline`}
                />
                <MiniStat
                  label="Shared tables"
                  value={snapshot.shTabUsed}
                  tone="muted"
                  hint={`of ${snapshot.shTabTotal} entries`}
                />
                <MiniStat
                  label="Defunct processes"
                  value={snapshot.defunctProcesses}
                  tone={snapshot.defunctProcesses > 0 ? "bad" : "ok"}
                />
                <MiniStat
                  label="SAFDB forward / pending"
                  value={snapshot.adviceForward}
                  tone={snapshot.adviceDropped > 0 ? "warn" : "muted"}
                  hint={`${snapshot.advicePending} pending · ${snapshot.adviceDropped} dropped`}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <PortsCard
              className="lg:col-span-2"
              ports={snapshot.ports ?? []}
              connected={snapshot.mbPortsConnected}
              notConnected={snapshot.mbPortsNotConnected}
            />
            <BinsCard
              bins={snapshot.bins ?? []}
              up={snapshot.binsUp}
              down={snapshot.binsDown}
            />
          </div>

          <Card>
            <CardHeader className="py-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                Alert feed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-72 overflow-auto">
                {alertHistory.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No alerts received yet
                  </div>
                ) : (
                  alertHistory.map((alert, index) => (
                    <div
                      key={`${alertKey(alert)}-${index}`}
                      className="flex items-baseline gap-3 border-b px-3 py-1.5 text-sm last:border-b-0"
                    >
                      <span className="tabular-nums text-muted-foreground">
                        {alert.time.slice(-8) || alert.time}
                      </span>
                      {alert.code ? (
                        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {alert.code}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate">
                        {alert.text || alert.raw}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function fmtGiB(mib: number) {
  return `${(mib / 1024).toFixed(1)} GiB`;
}

function MemoryBar({
  label,
  usedMiB,
  totalMiB,
  availMiB,
}: {
  label: string;
  usedMiB: number;
  totalMiB: number;
  availMiB?: number;
}) {
  const pct = totalMiB > 0 ? (usedMiB / totalMiB) * 100 : 0;
  const tone: Tone = pct >= 90 ? "bad" : pct >= 75 ? "warn" : "ok";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="font-medium">{fmtGiB(usedMiB)}</span>
          <span className="text-muted-foreground"> / {fmtGiB(totalMiB)}</span>
          {availMiB !== undefined ? (
            <span className="text-muted-foreground">
              {" "}
              · {fmtGiB(availMiB)} avail
            </span>
          ) : null}
        </span>
      </div>
      <div className="mt-1">
        <Bar pct={pct} tone={tone} />
      </div>
    </div>
  );
}

function ResourceRow({
  label,
  used,
  connected,
  free,
  total,
}: {
  label: string;
  used: number;
  connected?: number;
  free: number;
  total?: number;
}) {
  const pct = total && total > 0 ? (used / total) * 100 : 0;
  const tone: Tone = pct >= 90 ? "bad" : pct >= 75 ? "warn" : "ok";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="font-medium">{used}</span>
          {connected !== undefined ? (
            <span className="text-muted-foreground"> ({connected} conn)</span>
          ) : null}
          <span className="text-muted-foreground"> · {free} free</span>
        </span>
      </div>
      {total ? (
        <div className="mt-1">
          <Bar pct={pct} tone={tone} />
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone = "muted",
  icon: Icon,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: Tone;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {Icon ? <Icon className={`h-3.5 w-3.5 ${toneClasses[tone]}`} /> : null}
        {label}
      </span>
      <span className="tabular-nums">
        <span className={`font-medium ${toneClasses[tone]}`}>{value}</span>
        {hint ? <span className="text-muted-foreground"> · {hint}</span> : null}
      </span>
    </div>
  );
}

function AtmFleetCard({
  rows,
  cycleTime,
}: {
  rows: AtmMonitorRow[];
  cycleTime: string;
}) {
  const [query, setQuery] = useState("");
  const [onlineFilter, setOnlineFilter] = useState<AtmOnlineFilter>("all");
  const [siteFilter, setSiteFilter] = useState<AtmSiteFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [onlineFilter, siteFilter, query, rows.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (onlineFilter === "online" && !row.online) return false;
      if (onlineFilter === "offline" && row.online) return false;
      if (siteFilter !== "all" && row.site !== siteFilter) return false;
      if (q) {
        const haystack =
          `${row.unitId} ${row.terminalId} ${row.site} ${row.portName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, onlineFilter, siteFilter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / ATM_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const shown = filtered.slice(
    (safePage - 1) * ATM_PAGE_SIZE,
    safePage * ATM_PAGE_SIZE,
  );

  const online = rows.filter((row) => row.online).length;
  const offline = rows.length - online;

  return (
    <Card>
      <CardHeader className="py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            ATM fleet
            <span className="font-normal text-muted-foreground">
              Active TMS list ·{" "}
              <span className="text-emerald-600">{online} online</span>
              {" · "}
              <span className={offline > 0 ? "text-amber-600" : undefined}>
                {offline} offline
              </span>
            </span>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            disabled={rows.length === 0}
            onClick={() =>
              exportIstStatusesCsv({
                cycleTime,
                atms: filtered.length > 0 ? filtered : rows,
              })
            }
          >
            <Download className="h-3.5 w-3.5" />
            Export ATMs
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search unit id / terminal id / site"
            className="h-7 min-w-48 flex-1 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center gap-1">
            {(
              [
                ["all", "All"],
                ["offline", "Offline"],
                ["online", "Online"],
              ] as [AtmOnlineFilter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOnlineFilter(value)}
                className={`h-7 rounded-md border px-2 text-xs transition-colors ${
                  onlineFilter === value
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {(
              [
                ["all", "All sites"],
                ["CBOBNA", "CBOBNA"],
                ["CBONCR", "CBONCR"],
              ] as [AtmSiteFilter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSiteFilter(value)}
                className={`h-7 rounded-md border px-2 text-xs transition-colors ${
                  siteFilter === value
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {shown.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "No active ATMs in the TMS list (or fleet not loaded)"
              : "No ATMs match the filter"}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
            {shown.map((row) => (
              <div
                key={row.key}
                className={`rounded-md border px-2 py-1.5 ${
                  row.online
                    ? "border-emerald-500/25 bg-emerald-500/5"
                    : "border-amber-500/30 bg-amber-500/5"
                }`}
                title={row.portName || undefined}
              >
                <div
                  className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide ${
                    row.online ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      row.online ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {row.online ? "Online" : "Offline"}
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold tabular-nums leading-tight">
                  {row.unitId}
                </div>
                <div className="truncate text-xs tabular-nums text-muted-foreground">
                  {row.terminalId}
                </div>
              </div>
            ))}
          </div>
        )}
        {filtered.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Page {safePage} of {pageCount} · {filtered.length} ATMs
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BinServicesSection({ bins }: { bins: ISTBin[] }) {
  const cards = useMemo(() => {
    const claimed = new Set<string>();
    return BIN_SERVICE_DEFS.map((def) => ({
      def,
      bin: findBinForService(bins, def, claimed),
    }));
  }, [bins]);

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold tracking-tight">BIN processes</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map(({ def, bin }) => {
          const up = Boolean(bin?.up);
          const routes = bin?.routes ?? [];
          const routeByName = new Map<string, (typeof routes)[number]>();
          for (const route of routes) {
            const keys = [route.route, route.formatter, route.group]
              .map((value) => value.trim().toUpperCase())
              .filter(Boolean);
            for (const key of keys) {
              if (!routeByName.has(key)) routeByName.set(key, route);
            }
          }
          // Always surface configured route names (e.g. CTXXML_ROUTE) plus any extras.
          const names = [
            ...def.routeNames,
            ...routes.flatMap((route) => [route.route, route.formatter]),
          ].filter(Boolean);
          const uniqueNames = Array.from(
            new Map(
              names.map((name) => [name.trim().toUpperCase(), name.trim()]),
            ).values(),
          );

          return (
            <Card key={def.key} className="py-0">
              <CardHeader className="px-3 py-2">
                <CardTitle className="flex items-center justify-between gap-2 text-sm">
                  <span>{def.title}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                      !bin
                        ? "bg-muted text-muted-foreground"
                        : up
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {!bin ? "Missing" : up ? "Up" : bin.status || "Down"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-3 text-sm">
                {bin ? (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium tabular-nums">
                        {bin.id || def.ids[0] || "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {bin.owner || "—"}
                        {bin.replay ? " · replay" : ""}
                      </span>
                    </div>
                    {uniqueNames.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No routes</div>
                    ) : (
                      uniqueNames.map((name) => {
                        const route = routeByName.get(name.trim().toUpperCase());
                        return (
                          <div
                            key={name}
                            className="flex items-baseline justify-between gap-2 text-xs"
                          >
                            <span className="min-w-0 truncate text-muted-foreground">
                              {name}
                            </span>
                            <span
                              className={
                                !route
                                  ? "text-muted-foreground"
                                  : route.up
                                    ? "text-emerald-600"
                                    : "text-destructive"
                              }
                            >
                              {!route ? "—" : route.up ? "Up" : "Down"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Not present in this cycle
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

type PortStateFilter = "all" | "connected" | "not";

function PortsCard({
  ports,
  connected,
  notConnected,
  className,
}: {
  ports: ISTPort[];
  connected: number;
  notConnected: number;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<PortStateFilter>("all");

  const nonAtm = useMemo(() => ports.filter((p) => !isAtmPort(p)), [ports]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nonAtm.filter((port) => {
      if (state === "connected" && !port.connected) return false;
      if (state === "not" && port.connected) return false;
      if (q) {
        const haystack =
          `${port.name} ${port.server} ${port.address} ${port.site}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [nonAtm, query, state]);

  const shown = filtered.slice(0, PORT_ROW_CAP);
  const shownConnected = filtered.filter((port) => port.connected).length;

  return (
    <Card className={className}>
      <CardHeader className="py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <PlugZap className="h-4 w-4 text-muted-foreground" />
            Other ports
            <span className="font-normal text-muted-foreground">
              {connected} connected · {notConnected} not connected (all kinds)
            </span>
          </CardTitle>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter POS / security / other"
            className="h-7 min-w-40 flex-1 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center gap-1">
            {(
              [
                ["all", "All"],
                ["connected", "Connected"],
                ["not", "Not connected"],
              ] as [PortStateFilter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setState(value)}
                className={`h-7 rounded-md border px-2 text-xs transition-colors ${
                  state === value
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Port</th>
                <th className="px-3 py-1.5 text-left font-medium">Server</th>
                <th className="px-3 py-1.5 text-left font-medium">State</th>
                <th className="px-3 py-1.5 text-left font-medium">Address</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No ports match the filter
                  </td>
                </tr>
              ) : (
                shown.map((port, index) => (
                  <tr
                    key={`${port.name}-${port.index}-${index}`}
                    className="border-t"
                  >
                    <td className="px-3 py-1 font-medium">{port.name}</td>
                    <td className="px-3 py-1 text-muted-foreground">
                      {port.server || "—"}
                    </td>
                    <td className="px-3 py-1">
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          port.connected ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            port.connected ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        {port.connected
                          ? "connected"
                          : port.state || "passive listen"}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-xs text-muted-foreground">
                      {port.address || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 ? (
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            {shownConnected} connected of {filtered.length} shown
            {filtered.length > PORT_ROW_CAP
              ? ` · capped at ${PORT_ROW_CAP} rows, refine the filter`
              : ""}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BinsCard({
  bins,
  up,
  down,
}: {
  bins: ISTBin[];
  up: number;
  down: number;
}) {
  const sorted = useMemo(
    () =>
      [...bins].sort(
        (a, b) => Number(a.up) - Number(b.up) || a.index - b.index,
      ),
    [bins],
  );

  return (
    <Card>
      <CardHeader className="py-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-muted-foreground" />
          All BIN processes
          <span className="font-normal text-muted-foreground">
            {up} up · {down} down
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-80 overflow-auto">
          {sorted.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No BIN data
            </div>
          ) : (
            sorted.map((bin, index) => (
              <div
                key={`${bin.id}-${bin.index}-${index}`}
                className={`border-b px-3 py-1.5 text-sm last:border-b-0 ${
                  bin.up ? "" : "bg-destructive/5"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">
                    {bin.id || bin.owner || `BIN ${bin.index}`}
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${
                      bin.up
                        ? "bg-emerald-500/15 text-emerald-700"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {bin.up ? "Up" : bin.status || "Down"}
                  </span>
                </div>
                {bin.owner && bin.id ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {bin.owner}
                    {bin.replay ? " · replay" : ""}
                  </div>
                ) : null}
                {bin.routes && bin.routes.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {bin.routes.map((route, rIndex) => (
                      <div
                        key={`${route.route}-${rIndex}`}
                        className="flex items-baseline justify-between gap-2 text-xs"
                      >
                        <span className="min-w-0 truncate text-muted-foreground">
                          {route.route || route.formatter || route.group}
                        </span>
                        <span
                          className={
                            route.up ? "text-emerald-600" : "text-destructive"
                          }
                        >
                          {route.up ? "Up" : "Down"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

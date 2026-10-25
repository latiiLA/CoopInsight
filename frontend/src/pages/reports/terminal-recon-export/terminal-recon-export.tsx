import { addDays, differenceInCalendarDays, format } from "date-fns";
import { Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { DatePickerWithRange } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fetchAtmTerminals } from "@/features/atm_terminal_slice";
import { fetchPosTerminals } from "@/features/pos_terminal_slice";
import api from "@/lib/api";
import type { AtmTerminal } from "@/types/atm-terminal";
import type { PosTerminal } from "@/types/pos-terminal";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { getTokenFromAuth, withAuthHeader } from "../../../../utility/auth-token";
import getErrorMessage from "../../../../utility/error-message";
import { hasPermission } from "../../../../utility/has-permission";
import { STOPPED as ATM_STOPPED } from "../../dashboards/atm-terminals/atm-fleet";
import { STOPPED as POS_STOPPED } from "../../dashboards/pos-terminals/pos-fleet";
import {
  TerminalSearchSelect,
  type TerminalOption,
} from "../../dashboards/terminal-transactions/terminal-search-select";

type Source = "cortex" | "switch";
type ExportFormat = "csv" | "xlsx";
type Fleet = "atm" | "pos";

const ALL_TERMINALS = "__all__";
const CHUNK_PAGE_SIZE = 2000;

type ChunkPayload = {
  headers: string[];
  rows: string[][];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

type ExportProgress = {
  dayIndex: number;
  dayTotal: number;
  currentDay: string;
  rowsFetched: number;
  startedAt: number;
  /** Set when the file is ready; progress panel stays visible briefly. */
  doneElapsedMs?: number;
};

const DONE_PROGRESS_HOLD_MS = 4000;

/** Include active, relocated, and deleted (historical txs). Exclude stopped only. */
function isReconEligibleStatus(status: string | undefined) {
  const s = (status ?? "").trim();
  return s !== ATM_STOPPED && s !== POS_STOPPED;
}

function atmReconOptions(terminals: AtmTerminal[]): TerminalOption[] {
  return terminals
    .filter(
      (t) => isReconEligibleStatus(t.status) && Boolean(t.terminalId?.trim()),
    )
    .map((t) => {
      const id = t.terminalId.trim();
      const status = t.status?.trim();
      const name = t.terminalName?.trim();
      const parts = [id];
      if (name) parts.push(name);
      if (status) parts.push(status);
      if (t.isDeleted) parts.push("Deleted");
      return { id, label: parts.join(" · ") };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function posReconOptions(terminals: PosTerminal[]): TerminalOption[] {
  return terminals
    .filter(
      (t) => isReconEligibleStatus(t.status) && Boolean(t.terminalId?.trim()),
    )
    .map((t) => {
      const id = t.terminalId.trim();
      const status = t.status?.trim();
      const name = t.merchantName?.trim();
      const parts = [id];
      if (name) parts.push(name);
      if (status) parts.push(status);
      if (t.isDeleted) parts.push("Deleted");
      return { id, label: parts.join(" · ") };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function eachDayInclusive(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const total = differenceInCalendarDays(to, from);
  for (let i = 0; i <= total; i++) {
    days.push(addDays(from, i));
  }
  return days;
}

function csvEscape(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function buildCsv(headers: string[], rows: string[][]) {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ];
  return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
}

function buildXlsx(headers: string[], rows: string[][], filename: string) {
  const sheetRows = [headers, ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Recon");
  XLSX.writeFile(workbook, filename);
}

export default function TerminalReconExportPage() {
  const dispatch = useDispatch<AppDispatch>();
  const authUser = useSelector((state: RootState) => state.user.authUser);
  const permissions = useSelector((state: RootState) => state.user.permissions);
  const atmTerminals = useSelector(
    (state: RootState) => state.atmTerminal.terminals,
  );
  const posTerminals = useSelector(
    (state: RootState) => state.posTerminal.terminals,
  );
  const atmLoading = useSelector((state: RootState) => state.atmTerminal.loading);
  const posLoading = useSelector((state: RootState) => state.posTerminal.loading);

  const canExportSwitch = hasPermission(
    ["report:export-switch-terminal-recon"],
    permissions,
  );
  const canExportCortex = hasPermission(
    ["report:export-cortex-terminal-recon"],
    permissions,
  );
  const allowedSources = useMemo<Source[]>(() => {
    const sources: Source[] = [];
    if (canExportSwitch) sources.push("switch");
    if (canExportCortex) sources.push("cortex");
    return sources;
  }, [canExportCortex, canExportSwitch]);

  const [source, setSource] = useState<Source>(
    canExportSwitch ? "switch" : "cortex",
  );
  const [fleet, setFleet] = useState<Fleet>("atm");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [terminal, setTerminal] = useState("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [lastElapsedMs, setLastElapsedMs] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (allowedSources.length === 0) return;
    if (!allowedSources.includes(source)) {
      setSource(allowedSources[0]);
    }
  }, [allowedSources, source]);

  useEffect(() => {
    if (!exporting) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [exporting]);

  useEffect(() => {
    if (progress?.doneElapsedMs == null) return;
    const id = window.setTimeout(() => setProgress(null), DONE_PROGRESS_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [progress?.doneElapsedMs]);

  useEffect(() => {
    const action =
      fleet === "pos" ? fetchPosTerminals() : fetchAtmTerminals();
    void dispatch(action).then((result) => {
      if (
        (fleet === "pos" && fetchPosTerminals.rejected.match(result)) ||
        (fleet === "atm" && fetchAtmTerminals.rejected.match(result))
      ) {
        toast.error(
          (result.payload as string) || "Could not load terminals",
        );
      }
    });
  }, [dispatch, fleet]);

  const terminalOptions = useMemo<TerminalOption[]>(() => {
    const rows =
      fleet === "pos"
        ? posReconOptions(posTerminals)
        : atmReconOptions(atmTerminals);
    return [{ id: ALL_TERMINALS, label: "All terminals" }, ...rows];
  }, [atmTerminals, fleet, posTerminals]);

  const fleetLoading = fleet === "pos" ? posLoading : atmLoading;

  const onFleetChange = useCallback((next: Fleet) => {
    setFleet(next);
    setTerminal("");
  }, []);

  const progressPercent = useMemo(() => {
    if (!progress || progress.dayTotal <= 0) return 0;
    if (progress.doneElapsedMs != null) return 100;
    return Math.min(
      100,
      Math.round((progress.dayIndex / progress.dayTotal) * 100),
    );
  }, [progress]);

  const onExport = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Choose a date range");
      return;
    }
    const dayCount =
      differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    if (dayCount > 10) {
      toast.error("Date range cannot exceed 10 days");
      return;
    }

    const token = getTokenFromAuth(authUser);
    if (!token) {
      toast.error("Authentication token not found");
      return;
    }

    const days = eachDayInclusive(dateRange.from, dateRange.to);
    const startedAt = Date.now();
    setExporting(true);
    setLastElapsedMs(null);
    setProgress({
      dayIndex: 0,
      dayTotal: days.length,
      currentDay: format(days[0], "yyyy-MM-dd"),
      rowsFetched: 0,
      startedAt,
    });

    let headers: string[] = [];
    const allRows: string[][] = [];

    try {
      for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
        const day = days[dayIndex];
        const dayLabel = format(day, "yyyy-MM-dd");
        const dayParam = format(day, "MM/dd/yyyy");
        let page = 1;
        let hasMore = true;

        setProgress({
          dayIndex,
          dayTotal: days.length,
          currentDay: dayLabel,
          rowsFetched: allRows.length,
          startedAt,
        });

        while (hasMore) {
          const response = await api.get<{ data: ChunkPayload }>(
            "/reports/terminal-recon/chunk",
            {
              ...withAuthHeader(token),
              params: {
                source,
                dateFrom: dayParam,
                dateTo: dayParam,
                page,
                pageSize: CHUNK_PAGE_SIZE,
                ...(terminal.trim() ? { terminal: terminal.trim() } : {}),
              },
              timeout: 180_000,
            },
          );
          const payload = response.data.data;
          if (!headers.length && payload?.headers?.length) {
            headers = payload.headers;
          }
          const rows = payload?.rows ?? [];
          allRows.push(...rows);
          hasMore = Boolean(payload?.hasMore);
          page += 1;

          setProgress({
            dayIndex,
            dayTotal: days.length,
            currentDay: dayLabel,
            rowsFetched: allRows.length,
            startedAt,
          });
        }
      }

      if (!headers.length) {
        toast.error("No data to export");
        setProgress(null);
        return;
      }

      const fromStamp = format(dateRange.from, "yyyyMMdd");
      const toStamp = format(dateRange.to, "yyyyMMdd");
      const filename = `${source}-export-${fromStamp}-${toStamp}.${exportFormat}`;

      if (exportFormat === "csv") {
        downloadBlob(buildCsv(headers, allRows), filename);
      } else {
        buildXlsx(headers, allRows, filename);
      }

      const elapsed = Date.now() - startedAt;
      setLastElapsedMs(elapsed);
      setProgress({
        dayIndex: days.length,
        dayTotal: days.length,
        currentDay: format(days[days.length - 1], "yyyy-MM-dd"),
        rowsFetched: allRows.length,
        startedAt,
        doneElapsedMs: elapsed,
      });
      toast.success(
        `Export complete: ${allRows.length.toLocaleString()} rows in ${formatElapsed(elapsed)}`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
      setProgress(null);
    } finally {
      setExporting(false);
    }
  }, [authUser, dateRange, exportFormat, source, terminal]);

  return (
    <div className="container mx-auto space-y-4 pb-6">
      <div className="space-y-1 pt-1">
        <h3 className="text-lg font-semibold tracking-tight">
          Switch / Cortex export
        </h3>
        <p className="text-sm text-muted-foreground">
          Download approved Switch or Cortex transactions for reconciliation.
          Pick an ATM or POS terminal, or export all. Maximum 10 days.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select
              value={source}
              onValueChange={(v) => setSource(v as Source)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canExportSwitch ? (
                  <SelectItem value="switch">Switch</SelectItem>
                ) : null}
                {canExportCortex ? (
                  <SelectItem value="cortex">Cortex</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Fleet</Label>
            <Select
              value={fleet}
              onValueChange={(v) => onFleetChange(v as Fleet)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="atm">ATM</SelectItem>
                <SelectItem value="pos">POS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label>Terminal</Label>
            <TerminalSearchSelect
              options={terminalOptions}
              value={terminal || ALL_TERMINALS}
              onChange={(id) =>
                setTerminal(id === ALL_TERMINALS ? "" : id)
              }
              placeholder={
                fleetLoading ? "Loading terminals..." : "All terminals"
              }
              triggerClassName="min-w-0 w-full lg:w-full"
            />
          </div>
          <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1 xl:col-span-1">
            <Label>Date range</Label>
            <DatePickerWithRange
              className="w-full min-w-0 shrink"
              date={dateRange}
              onDateChange={setDateRange}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select
              value={exportFormat}
              onValueChange={(v) => setExportFormat(v as ExportFormat)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="xlsx">XLSX</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {progress ? (
          <div className="space-y-2 rounded-md border bg-background/60 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              {progress.doneElapsedMs != null ? (
                <>
                  <span>
                    Export done in {formatElapsed(progress.doneElapsedMs)}
                  </span>
                  <span className="text-muted-foreground">
                    {progress.rowsFetched.toLocaleString()} rows
                  </span>
                </>
              ) : (
                <>
                  <span>
                    Day {Math.min(progress.dayIndex + 1, progress.dayTotal)} of{" "}
                    {progress.dayTotal}
                    {progress.currentDay ? ` (${progress.currentDay})` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {progress.rowsFetched.toLocaleString()} rows ·{" "}
                    {formatElapsed(nowTick - progress.startedAt)}
                  </span>
                </>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full bg-primary transition-[width] duration-300",
                  progress.doneElapsedMs != null && "bg-emerald-600",
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Approved transactions only. Choose a terminal or export all.
            {fleetLoading ? " Loading terminals..." : null}
            {lastElapsedMs != null && !exporting
              ? ` Last export took ${formatElapsed(lastElapsedMs)}.`
              : null}
          </p>
          <Button
            type="button"
            disabled={exporting}
            onClick={() => void onExport()}
          >
            <Download className="mr-2 size-4" />
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </div>
      </div>
    </div>
  );
}

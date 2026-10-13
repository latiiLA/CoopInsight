import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Ban, Hourglass, RefreshCw } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import type { SafSummary, SafTransaction } from "@/types/saf";
import getErrorMessage from "@/utility/error-message";

import { getSafColumns } from "./saf-columns";

const SUMMARY_POLL_MS = 60_000;
const NO_VALUE = "-";
const SAF_LIST_CAP = 5000;

function formatCount(value: number | undefined) {
  if (value == null) {
    return NO_VALUE;
  }
  return value.toLocaleString();
}

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function defaultRange(): DateRange {
  const today = startOfLocalDay();
  return { from: today, to: today };
}

export default function SafMonitoring() {
  const columns = useMemo(() => getSafColumns(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultRange);
  const [summary, setSummary] = useState<SafSummary | null>(null);
  const [rows, setRows] = useState<SafTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateFrom = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : null;
  const dateTo = dateRange?.to
    ? format(dateRange.to, "yyyy-MM-dd")
    : dateFrom;
  const rangeReady = Boolean(dateFrom && dateTo);
  const rangeLabel =
    dateFrom && dateTo
      ? dateFrom === dateTo
        ? dateFrom
        : `${dateFrom} to ${dateTo}`
      : "";

  const loadSummary = useCallback(
    async (silent = false) => {
      if (!dateFrom || !dateTo) {
        return;
      }
      try {
        const summaryRes = await api.get<{ data: SafSummary }>(
          "/monitoring/saf/summary",
          {
            params: { dateFrom, dateTo },
            timeout: 60_000,
          },
        );
        setSummary(summaryRes.data.data ?? null);
        setError(null);
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        if (!silent) {
          toast.error(message);
        }
      }
    },
    [dateFrom, dateTo],
  );

  const loadList = useCallback(
    async (silent = false) => {
      if (!dateFrom || !dateTo) {
        return;
      }
      if (!silent) {
        setListLoading(true);
      }
      try {
        const listRes = await api.get<{ data: SafTransaction[] }>(
          "/monitoring/saf/transactions",
          {
            params: { dateFrom, dateTo, status: "S" },
            timeout: 180_000,
          },
        );
        setRows(listRes.data.data ?? []);
        setError(null);
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        if (!silent) {
          toast.error(message);
        }
      } finally {
        if (!silent) {
          setListLoading(false);
        }
      }
    },
    [dateFrom, dateTo],
  );

  const load = useCallback(
    async (silent = false) => {
      if (!rangeReady) {
        return;
      }
      if (!silent) {
        setLoading(true);
      }
      try {
        await Promise.all([loadSummary(silent), loadList(silent)]);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [loadList, loadSummary, rangeReady],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadSummary(true);
    }, SUMMARY_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadSummary]);

  const asOfLabel = summary?.asOf
    ? new Date(summary.asOf).toLocaleString()
    : "-";

  return (
    <div className="container mx-auto space-y-4">
      <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Advice Message
          </h1>
          <p className="text-sm text-muted-foreground">
            Cortex pending advice backlog, plus skipped for the selected range.
          </p>
          {error ? (
            <p className="mt-1 text-sm text-destructive">
              Switch database unavailable or request failed. {error}
            </p>
          ) : loading && !summary ? (
            <Skeleton className="mt-1 h-3 w-44" />
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Last updated {asOfLabel}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!rangeReady || loading || listLoading}
            onClick={() => void load()}
          >
            <RefreshCw
              className={
                loading || listLoading ? "size-4 animate-spin" : "size-4"
              }
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Pending"
          value={formatCount(summary?.pending)}
          hint="Waiting to be forwarded for Cortex"
          icon={Hourglass}
          loading={!summary}
        />
        <MetricCard
          label="Skipped"
          value={formatCount(summary?.skipped)}
          hint={
            rangeLabel
              ? `Skipped for ${rangeLabel}`
              : "Skipped for the selected range"
          }
          icon={Ban}
          loading={!summary}
        />
      </div>

      {summary && summary.other > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {summary.other.toLocaleString()} row
          {summary.other === 1 ? "" : "s"} with an unrecognized status.
        </p>
      ) : null}

      <div className="space-y-2">
        <div>
          <h2 className="text-base font-medium tracking-tight">
            Skipped advice messages
          </h2>
          <p className="text-sm text-muted-foreground">
            Cortex skipped{rangeLabel ? ` for ${rangeLabel}` : ""}
            {rows.length >= SAF_LIST_CAP
              ? ` (showing first ${SAF_LIST_CAP.toLocaleString()})`
              : ""}
            .
          </p>
        </div>
        <DataTable
          columns={columns}
          data={rows}
          loading={listLoading}
          searchPlaceholder="Search skipped advice messages..."
          exportFileName={`AdviceSkipped-${dateFrom ?? "range"}-${dateTo ?? "range"}`}
        />
      </div>
    </div>
  );
}

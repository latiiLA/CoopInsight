import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { DatePickerWithRange } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  clearCardActivity,
  fetchCardActivity,
} from "@/features/card_activity_slice";
import { AppDispatch, RootState } from "../../../app/store/store";
import CardBranchSection from "./card-branch-section";

type RangePreset = "today" | "7d" | "30d" | "90d" | "12m" | "ytd" | "custom";

const PRESETS: { id: Exclude<RangePreset, "custom">; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "12m", label: "Last 12 months" },
  { id: "ytd", label: "This year" },
];

const SERIES = [
  { key: "created", label: "Requested", color: "var(--chart-1)" },
  { key: "issued", label: "Printed", color: "var(--chart-2)" },
  { key: "activated", label: "Activated", color: "oklch(0.62 0.18 150)" },
] as const;

function rangeForPreset(preset: Exclude<RangePreset, "custom">): DateRange {
  const today = startOfDay(new Date());
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: subDays(today, 6), to: today };
    case "30d":
      return { from: subDays(today, 29), to: today };
    case "90d":
      return { from: subDays(today, 89), to: today };
    case "12m":
      return { from: subMonths(today, 12), to: today };
    case "ytd":
      return { from: startOfYear(today), to: today };
    default:
      return { from: subDays(today, 29), to: today };
  }
}

function formatCount(value: number) {
  return Number(value ?? 0).toLocaleString();
}

function ActivityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="text-muted-foreground">
          <span style={{ color: entry.color }}>{entry.name}: </span>
          <span className="font-medium tabular-nums text-foreground">
            {formatCount(Number(entry.value ?? 0))}
          </span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-3">
          <CardDescription>{label}</CardDescription>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        )}
      </CardHeader>
      <CardContent className="px-4 text-sm text-muted-foreground">
        {loading ? <Skeleton className="h-4 w-28" /> : hint}
      </CardContent>
    </Card>
  );
}

export default function CardActivityDashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const { report, loading, error } = useSelector(
    (state: RootState) => state.cardActivity,
  );

  const [preset, setPreset] = useState<RangePreset>("30d");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() =>
    rangeForPreset("30d"),
  );

  const load = useCallback(
    (range: DateRange | undefined) => {
      if (!range?.from || !range?.to) return;

      const promise = dispatch(
        fetchCardActivity({
          dateFrom: format(range.from, "MM/dd/yyyy"),
          dateTo: format(range.to, "MM/dd/yyyy"),
        }),
      );

      promise.then((result) => {
        if (fetchCardActivity.rejected.match(result) && !result.meta.aborted) {
          toast.error(
            (result.payload as string) || "Failed to fetch card activity",
          );
        }
      });

      return promise;
    },
    [dispatch],
  );

  useEffect(() => {
    const promise = load(dateRange);
    return () => {
      promise?.abort();
    };
  }, [dateRange, load]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  useEffect(() => {
    return () => {
      dispatch(clearCardActivity());
    };
  }, [dispatch]);

  const handlePreset = (id: Exclude<RangePreset, "custom">) => {
    setPreset(id);
    setDateRange(rangeForPreset(id));
  };

  const handleDateChange = (range: DateRange | undefined) => {
    if (!range?.from || !range?.to) return;
    setPreset("custom");
    setDateRange(range);
  };

  const chartRows = useMemo(
    () =>
      (report?.daily ?? []).map((day) => ({
        ...day,
        label: format(parseISO(day.date), "MMM d"),
      })),
    [report],
  );

  const spanDays = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  }, [dateRange]);

  const peak = useMemo(() => {
    const daily = report?.daily ?? [];
    if (daily.length === 0) return null;

    const total = (d: (typeof daily)[number]) =>
      d.created + d.issued + d.activated;

    return daily.reduce(
      (best, day) => (total(day) > total(best) ? day : best),
      daily[0],
    );
  }, [report]);

  const dailyAverage = useMemo(() => {
    const totals = report?.totals;
    if (!totals || spanDays <= 0) return null;
    return {
      created: totals.created / spanDays,
      issued: totals.issued / spanDays,
      activated: totals.activated / spanDays,
    };
  }, [report, spanDays]);

  const exportRows = () =>
    (report?.daily ?? []).map((day) => ({
      Date: day.date,
      Requested: day.created,
      Printed: day.issued,
      Activated: day.activated,
    }));

  const exportCsv = () => {
    const rows = exportRows();
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((key) => JSON.stringify(row[key as keyof typeof row] ?? ""))
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "card-activity.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = () => {
    const rows = exportRows();
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "Card activity");
    XLSX.writeFile(workbook, "card-activity.xlsx");
  };

  const totals = report?.totals;
  const hasData = (report?.daily?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Card Activity Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Organization-wide requested, printed, and activated activity, plus
            branch rankings and per-branch progress over time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !hasData}
            onClick={exportCsv}
          >
            <Download className="size-3.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !hasData}
            onClick={exportXlsx}
          >
            <Download className="size-3.5" />
            XLSX
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Range</div>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={preset === item.id ? "default" : "outline"}
                onClick={() => handlePreset(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Custom dates</div>
          <DatePickerWithRange date={dateRange} onDateChange={handleDateChange} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Cards requested"
          value={formatCount(totals?.created ?? 0)}
          hint={
            dailyAverage
              ? `~${formatCount(Math.round(dailyAverage.created))}/day over ${spanDays} days`
              : "In selected range"
          }
          icon={CreditCard}
          loading={loading}
        />
        <MetricCard
          label="Cards printed"
          value={formatCount(totals?.issued ?? 0)}
          hint={
            dailyAverage
              ? `~${formatCount(Math.round(dailyAverage.issued))}/day over ${spanDays} days`
              : "In selected range"
          }
          icon={Activity}
          loading={loading}
        />
        <MetricCard
          label="Cards activated"
          value={formatCount(totals?.activated ?? 0)}
          hint={
            dailyAverage
              ? `~${formatCount(Math.round(dailyAverage.activated))}/day over ${spanDays} days`
              : "In selected range"
          }
          icon={CheckCircle2}
          loading={loading}
        />
        <MetricCard
          label="Busiest day"
          value={
            peak
              ? formatCount(peak.created + peak.issued + peak.activated)
              : "—"
          }
          hint={
            peak
              ? `${format(parseISO(peak.date), "MMM d, yyyy")} · ${peak.created} requested`
              : "No activity"
          }
          icon={TrendingUp}
          loading={loading}
        />
      </div>

      <Card className="py-4">
        <CardHeader className="px-4">
          <CardTitle>Daily card activity</CardTitle>
          <CardDescription>
            Requested, printed, and activated counts per day
            {report ? ` · ${report.from} to ${report.to}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : !hasData ? (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
              No card activity in this range.
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartRows}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    minTickGap={24}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ActivityTooltip />} />
                  <Legend />
                  {SERIES.map((series) => (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      name={series.label}
                      stroke={series.color}
                      strokeWidth={2}
                      dot={chartRows.length <= 40 ? { r: 2 } : false}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="px-4">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            Daily breakdown
          </CardTitle>
          <CardDescription>
            {chartRows.length} day{chartRows.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : !hasData ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No data to show.
            </div>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="sticky top-0 bg-muted/60 text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 text-right font-medium">Requested</th>
                    <th className="py-2 pr-3 text-right font-medium">Printed</th>
                    <th className="py-2 pr-3 text-right font-medium">Activated</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...chartRows].reverse().map((row) => (
                    <tr key={row.date} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        {format(parseISO(row.date), "MMM d, yyyy")}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatCount(row.created)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatCount(row.issued)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatCount(row.activated)}
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {formatCount(row.created + row.issued + row.activated)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totals && hasData ? (
        <Card className="py-4">
          <CardHeader className="px-4">
            <CardTitle>Range comparison</CardTitle>
            <CardDescription>Totals across the selected range</CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={[
                    {
                      name: "Total",
                      created: totals.created,
                      issued: totals.issued,
                      activated: totals.activated,
                    },
                  ]}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ActivityTooltip />} />
                  <Legend />
                  {SERIES.map((series) => (
                    <Bar
                      key={series.key}
                      dataKey={series.key}
                      name={series.label}
                      fill={series.color}
                      maxBarSize={80}
                      radius={[6, 6, 0, 0]}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <CardBranchSection
        dateFrom={
          dateRange?.from ? format(dateRange.from, "MM/dd/yyyy") : undefined
        }
        dateTo={dateRange?.to ? format(dateRange.to, "MM/dd/yyyy") : undefined}
      />
    </div>
  );
}
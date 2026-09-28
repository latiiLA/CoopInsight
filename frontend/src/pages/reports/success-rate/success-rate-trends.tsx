import {
  differenceInCalendarDays,
  differenceInMonths,
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import {
  Activity,
  Ban,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Download,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

import { toApiDate, toApiEchoDate } from "@/lib/report-range";
import { DatePickerWithRange } from "@/components/date-picker";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSuccessRateTrend } from "@/features/report_slice";
import {
  SuccessChannel,
  SuccessFlow,
  SuccessGranularity,
} from "@/types/report";
import { hasPermission } from "../../../../utility/has-permission";
import { AppDispatch, RootState } from "../../../../app/store/store";

type TrendPreset = "7d" | "30d" | "12m" | "ytd" | "custom";

const CHANNEL_OPTIONS: { value: SuccessChannel; label: string }[] = [
  { value: "switch", label: "Switch" },
  { value: "atm", label: "ATM" },
  { value: "pos", label: "POS" },
];

const FLOW_OPTIONS: {
  value: SuccessFlow;
  label: string;
  channels: SuccessChannel[];
}[] = [
  { value: "overall", label: "Overall", channels: ["switch", "atm", "pos"] },
  { value: "acquiring", label: "Acquiring", channels: ["atm", "pos"] },
  { value: "onus", label: "On-us", channels: ["switch", "atm", "pos"] },
  { value: "offus", label: "Off-us", channels: ["switch", "atm", "pos"] },
  { value: "issuing", label: "Issuing", channels: ["switch", "atm", "pos"] },
];

const PRESETS: { id: Exclude<TrendPreset, "custom">; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "12m", label: "Last 12 months" },
  { id: "ytd", label: "This year" },
];

function permissionFor(channel: SuccessChannel, flow: SuccessFlow) {
  return `report:view-${channel}-${flow}-success-rate`;
}

function canViewCombo(
  channel: SuccessChannel,
  flow: SuccessFlow,
  permissions: string[],
) {
  return hasPermission(
    [permissionFor(channel, flow), "report:view-success-transactions"],
    permissions,
  );
}

function rangeForPreset(preset: Exclude<TrendPreset, "custom">): DateRange {
  const today = startOfDay(new Date());
  switch (preset) {
    case "7d":
      return { from: subDays(today, 6), to: today };
    case "12m":
      return { from: subMonths(today, 12), to: today };
    case "ytd":
      return { from: startOfYear(today), to: endOfYear(today) > today ? today : endOfYear(today) };
    case "30d":
    default:
      return { from: subDays(today, 29), to: today };
  }
}

export function autoGranularity(from: Date, to: Date): SuccessGranularity {
  const days = differenceInCalendarDays(to, from) + 1;
  if (days <= 30) return "day";
  if (days <= 90) return "week";
  return "month";
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Averages keep one decimal place. Rounding to a whole number would report a
 * figure of zero for anything under half a transaction per day, which reads as
 * "no activity" rather than "a small number".
 */
function formatAverage(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function RateTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    value?: number;
    name?: string;
    color?: string;
  }>;
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
          {entry.dataKey === "successRatePercent"
            ? `${Number(entry.value ?? 0).toFixed(2)}%`
            : formatCount(Number(entry.value ?? 0))}
        </div>
      ))}
    </div>
  );
}

export default function SuccessRateTrends() {
  const dispatch = useDispatch<AppDispatch>();
  const permissions = useSelector((state: RootState) => state.user.permissions);
  const { successRateTrend, successRateTrendLoading } = useSelector(
    (state: RootState) => state.report,
  );

  const allowedCombos = useMemo(() => {
    const combos: Array<{ channel: SuccessChannel; flow: SuccessFlow }> = [];
    for (const channel of CHANNEL_OPTIONS) {
      for (const flow of FLOW_OPTIONS) {
        if (!flow.channels.includes(channel.value)) continue;
        if (canViewCombo(channel.value, flow.value, permissions)) {
          combos.push({ channel: channel.value, flow: flow.value });
        }
      }
    }
    return combos;
  }, [permissions]);

  const allowedChannels = useMemo(() => {
    const set = new Set(allowedCombos.map((c) => c.channel));
    return CHANNEL_OPTIONS.filter((c) => set.has(c.value));
  }, [allowedCombos]);

  const [channel, setChannel] = useState<SuccessChannel>(
    () => allowedChannels[0]?.value ?? "atm",
  );
  const flowsForChannel = useMemo(
    () =>
      FLOW_OPTIONS.filter(
        (flow) =>
          flow.channels.includes(channel) &&
          canViewCombo(channel, flow.value, permissions),
      ),
    [channel, permissions],
  );
  const [flow, setFlow] = useState<SuccessFlow>(
    () => flowsForChannel[0]?.value ?? "overall",
  );
  const [preset, setPreset] = useState<TrendPreset>("30d");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() =>
    rangeForPreset("30d"),
  );

  // Keep channel/flow valid when permissions or channel change.
  useEffect(() => {
    if (allowedChannels.length && !allowedChannels.some((c) => c.value === channel)) {
      setChannel(allowedChannels[0].value);
    }
  }, [allowedChannels, channel]);

  useEffect(() => {
    if (flowsForChannel.length && !flowsForChannel.some((f) => f.value === flow)) {
      setFlow(flowsForChannel[0].value);
    }
  }, [flowsForChannel, flow]);

  const granularity = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "day" as SuccessGranularity;
    return autoGranularity(dateRange.from, dateRange.to);
  }, [dateRange]);

  // Returns the raw dispatch promise so the caller can abort it; attaching a
  // .then() in here would return a plain Promise and lose .abort().
  const loadTrend = useCallback(
    (
      range: DateRange,
      nextChannel: SuccessChannel,
      nextFlow: SuccessFlow,
    ) =>
      dispatch(
        fetchSuccessRateTrend({
          dateFrom: toApiDate(range.from as Date),
          dateTo: toApiDate(range.to as Date),
          channel: nextChannel,
          flow: nextFlow,
          granularity: autoGranularity(range.from as Date, range.to as Date),
        }),
      ),
    [dispatch],
  );

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;
    if (!canViewCombo(channel, flow, permissions)) return;

    const promise = loadTrend(dateRange, channel, flow);

    promise.then((result) => {
      // An aborted request was superseded by newer filters, so its error is not
      // worth surfacing.
      if (
        fetchSuccessRateTrend.rejected.match(result) &&
        !result.meta.aborted
      ) {
        toast.error(result.payload || "Failed to fetch success rate trend");
      }
    });

    // Changing any filter aborts the request still in flight, so a slow
    // response can never land on top of the newer one.
    return () => {
      promise.abort();
    };
  }, [channel, dateRange, flow, loadTrend, permissions]);

  const handlePreset = (id: Exclude<TrendPreset, "custom">) => {
    const range = rangeForPreset(id);
    setPreset(id);
    setDateRange(range);
  };

  const handleDateChange = (date: DateRange | undefined) => {
    if (!date?.from || !date?.to) return;
    setPreset("custom");
    setDateRange(date);
  };

  const chartRows = useMemo(
    () =>
      (successRateTrend?.points ?? []).map((point) => ({
        ...point,
        label: point.periodLabel,
      })),
    [successRateTrend],
  );

  // The range exactly as it will appear in the response, so the report can be
  // matched back to the filters that produced it.
  const rangeEchoFrom = dateRange?.from ? toApiEchoDate(dateRange.from) : undefined;
  const rangeEchoTo = dateRange?.to ? toApiEchoDate(dateRange.to) : undefined;

  const showLoading = successRateTrendLoading;

  // The report echoes the filters it was produced from, so all of them are
  // checked. Comparing only channel and flow let a response for a different
  // date range be rendered under the current range's heading, which is how a
  // stale total ends up being read as the answer for the range on screen.
  const reportMatches = Boolean(
    successRateTrend &&
      successRateTrend.channel === channel &&
      successRateTrend.flow === flow &&
      successRateTrend.granularity === granularity &&
      successRateTrend.dateFrom === rangeEchoFrom &&
      successRateTrend.dateTo === rangeEchoTo,
  );

  /**
   * Approved and declined averages per calendar day and per calendar month.
   *
   * Derived from the trend points rather than a second request, because the
   * points already carry every bucket's counts and their sum is the range total
   * regardless of how the range was bucketed.
   *
   * Days and months are counted across the whole selected range, including days
   * with no traffic, so a quiet day lowers the average instead of being skipped.
   * That is the conventional reading of "average per day" and the hint under
   * each tile states the divisor so the figure can be sanity checked.
   *
   * Months counts distinct calendar months the range touches, so 15 Jan to 3 Mar
   * is three months rather than one.
   */
  const averages = useMemo(() => {
    const points = successRateTrend?.points ?? [];
    if (!dateRange?.from || !dateRange?.to || points.length === 0) {
      return null;
    }

    const days = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    const months =
      differenceInMonths(
        endOfMonth(dateRange.to),
        startOfMonth(dateRange.from),
      ) + 1;

    let total = 0;
    let approved = 0;
    let declined = 0;
    for (const point of points) {
      total += point.totalTransactions;
      approved += point.approvedCount;
      declined += point.declinedCount;
    }

    return {
      days,
      months,
      total,
      approved,
      declined,
      totalPerDay: days > 0 ? total / days : 0,
      approvedPerDay: days > 0 ? approved / days : 0,
      declinedPerDay: days > 0 ? declined / days : 0,
      totalPerMonth: months > 0 ? total / months : 0,
      approvedPerMonth: months > 0 ? approved / months : 0,
      declinedPerMonth: months > 0 ? declined / months : 0,
    };
  }, [successRateTrend, dateRange]);

  // Averages are only meaningful once the report on screen is the one for the
  // current channel and flow, otherwise a stale report would label the tiles.
  const showAverages = !showLoading && reportMatches && averages !== null;

  const exportBaseName = `success-rate-trend-${channel}-${flow}-${granularity}`;

  const exportRows = () =>
    (successRateTrend?.points ?? []).map((point) => ({
      Period: point.periodLabel,
      PeriodStart: point.periodStart,
      SuccessRatePercent: point.successRatePercent,
      TotalTransactions: point.totalTransactions,
      ApprovedCount: point.approvedCount,
      DeclinedCount: point.declinedCount,
      ApprovedAmount: point.approvedAmount,
      DeclinedAmount: point.declinedAmount,
      TotalAmount: point.totalAmount,
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
          .map((key) => {
            const value = String(row[key as keyof typeof row] ?? "");
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportBaseName}.csv`;
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
    XLSX.utils.book_append_sheet(workbook, sheet, "Trend");
    XLSX.writeFile(workbook, `${exportBaseName}.xlsx`);
  };

  if (!allowedCombos.length) {
    return (
      <div className="space-y-2 p-4">
        <h1 className="text-2xl font-semibold">Success Rate Trends</h1>
        <p className="text-muted-foreground">
          You do not have permission to view any success-rate trends.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Success Rate Trends</h1>
          <p className="text-sm text-muted-foreground">
            Progress over weeks, months, or a custom range for Switch, ATM, and
            POS.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={showLoading || !chartRows.length}
            onClick={exportCsv}
          >
            <Download className="size-3.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={showLoading || !chartRows.length}
            onClick={exportXlsx}
          >
            <Download className="size-3.5" />
            XLSX
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Channel</div>
          <Select
            value={channel}
            onValueChange={(value) => setChannel(value as SuccessChannel)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedChannels.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Flow</div>
          <Select
            value={flow}
            onValueChange={(value) => setFlow(value as SuccessFlow)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {flowsForChannel.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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

        <div className="pb-2 text-xs text-muted-foreground">
          Bucket: <span className="font-medium text-foreground">{granularity}</span>
        </div>
      </div>

      {/* Grouped by period rather than by metric: the eye reads "per day" and
          "per month" as two questions, and each group is a complete
          total/approved/declined breakdown of the same denominator. */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarDays className="size-4" />
          Daily average
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Total / day"
            value={showAverages ? formatAverage(averages.totalPerDay) : "—"}
            hint={
              showAverages
                ? `${formatCount(averages.total)} over ${averages.days} day${averages.days === 1 ? "" : "s"}`
                : "No transactions in this range"
            }
            icon={Activity}
            loading={showLoading || !reportMatches}
          />
          <MetricCard
            label="Approved / day"
            value={showAverages ? formatAverage(averages.approvedPerDay) : "—"}
            hint={
              showAverages
                ? `${formatCount(averages.approved)} over ${averages.days} day${averages.days === 1 ? "" : "s"}`
                : "No transactions in this range"
            }
            icon={CheckCircle2}
            loading={showLoading || !reportMatches}
          />
          <MetricCard
            label="Declined / day"
            value={showAverages ? formatAverage(averages.declinedPerDay) : "—"}
            hint={
              showAverages
                ? `${formatCount(averages.declined)} over ${averages.days} day${averages.days === 1 ? "" : "s"}`
                : "No transactions in this range"
            }
            icon={Ban}
            loading={showLoading || !reportMatches}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarRange className="size-4" />
          Monthly average
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Total / month"
            value={showAverages ? formatAverage(averages.totalPerMonth) : "—"}
            hint={
              showAverages
                ? `${formatCount(averages.total)} over ${averages.months} month${averages.months === 1 ? "" : "s"}`
                : "No transactions in this range"
            }
            icon={Activity}
            loading={showLoading || !reportMatches}
          />
          <MetricCard
            label="Approved / month"
            value={
              showAverages ? formatAverage(averages.approvedPerMonth) : "—"
            }
            hint={
              showAverages
                ? `${formatCount(averages.approved)} over ${averages.months} month${averages.months === 1 ? "" : "s"}`
                : "No transactions in this range"
            }
            icon={CheckCircle2}
            loading={showLoading || !reportMatches}
          />
          <MetricCard
            label="Declined / month"
            value={
              showAverages ? formatAverage(averages.declinedPerMonth) : "—"
            }
            hint={
              showAverages
                ? `${formatCount(averages.declined)} over ${averages.months} month${averages.months === 1 ? "" : "s"}`
                : "No transactions in this range"
            }
            icon={Ban}
            loading={showLoading || !reportMatches}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="py-4 lg:col-span-2">
          <CardHeader className="px-4">
            <CardTitle>Success rate over time</CardTitle>
            <CardDescription>
              {channel.toUpperCase()} · {flow} · {granularity} buckets
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            {showLoading || !reportMatches ? (
              <Skeleton className="h-72 w-full" />
            ) : chartRows.length === 0 ? (
              <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                No transactions in this range.
              </p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartRows}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis
                      yAxisId="rate"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<RateTooltip />} />
                    <Legend />
                    <Line
                      yAxisId="rate"
                      type="monotone"
                      dataKey="successRatePercent"
                      name="Success rate"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="py-4 lg:col-span-2">
          <CardHeader className="px-4">
            <CardTitle>Approved vs declined volume</CardTitle>
            <CardDescription>
              Transaction counts per {granularity}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            {showLoading || !reportMatches ? (
              <Skeleton className="h-72 w-full" />
            ) : chartRows.length === 0 ? (
              <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                No transactions in this range.
              </p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartRows}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<RateTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="approvedCount"
                      name="Approved"
                      stackId="vol"
                      fill="oklch(0.62 0.18 150)"
                    />
                    <Bar
                      dataKey="declinedCount"
                      name="Declined"
                      stackId="vol"
                      fill="var(--destructive)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!showLoading && reportMatches && chartRows.length > 0 ? (
        <Card className="py-4">
          <CardHeader className="px-4">
            <CardTitle>Series data</CardTitle>
            <CardDescription>
              {chartRows.length} {granularity} point
              {chartRows.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-4">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Period</th>
                  <th className="py-2 pr-3 font-medium">Success %</th>
                  <th className="py-2 pr-3 font-medium">Total</th>
                  <th className="py-2 pr-3 font-medium">Approved</th>
                  <th className="py-2 pr-3 font-medium">Declined</th>
                  <th className="py-2 font-medium">Total amount</th>
                </tr>
              </thead>
              <tbody>
                {chartRows.map((row) => (
                  <tr key={row.periodStart} className="border-b last:border-0">
                    <td className="py-2 pr-3">{row.periodLabel}</td>
                    <td className="py-2 pr-3">
                      {row.successRatePercent.toFixed(2)}%
                    </td>
                    <td className="py-2 pr-3">
                      {formatCount(row.totalTransactions)}
                    </td>
                    <td className="py-2 pr-3">
                      {formatCount(row.approvedCount)}
                    </td>
                    <td className="py-2 pr-3">
                      {formatCount(row.declinedCount)}
                    </td>
                    <td className="py-2">{formatAmount(row.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

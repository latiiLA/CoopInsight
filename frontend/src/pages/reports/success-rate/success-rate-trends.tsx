import {
  differenceInCalendarDays,
  endOfYear,
  format,
  startOfDay,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import { Download } from "lucide-react";
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

import { DatePickerWithRange } from "@/components/date-picker";
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

  const loadTrend = useCallback(
    async (range: DateRange, nextChannel: SuccessChannel, nextFlow: SuccessFlow) => {
      if (!range.from || !range.to) return;

      const result = await dispatch(
        fetchSuccessRateTrend({
          dateFrom: format(range.from, "MM/dd/yyyy"),
          dateTo: format(range.to, "MM/dd/yyyy"),
          channel: nextChannel,
          flow: nextFlow,
          granularity: autoGranularity(range.from, range.to),
        }),
      );

      if (fetchSuccessRateTrend.rejected.match(result)) {
        toast.error(result.payload || "Failed to fetch success rate trend");
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;
    if (!canViewCombo(channel, flow, permissions)) return;
    void loadTrend(dateRange, channel, flow);
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

  const showLoading = successRateTrendLoading;
  const reportMatches =
    successRateTrend &&
    successRateTrend.channel === channel &&
    successRateTrend.flow === flow;

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

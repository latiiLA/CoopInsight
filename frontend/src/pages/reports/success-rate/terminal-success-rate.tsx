import { startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import {
  Cell,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import {
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTerminalSuccessRate } from "@/features/report_slice";
import { formatMoneyWithCurrency } from "@/lib/iso-currency";
import { toApiDate } from "@/lib/report-range";
import { TerminalSuccessReport } from "@/types/report";
import { AppDispatch, RootState } from "../../../../app/store/store";

/** Switch success-rate amounts are stored in local issuer currency (ETB). */
const AMOUNT_CURRENCY = "ETB";

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatAmount(value: number) {
  return formatMoneyWithCurrency(value, AMOUNT_CURRENCY);
}

function getTodayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

type HealthSlice = {
  name: string;
  value: number;
  fill: string;
};

function HealthTooltip({
  active,
  payload,
  totalTerminals,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    payload?: HealthSlice;
    value?: number | string | ReadonlyArray<number | string>;
    name?: string | number;
  }>;
  totalTerminals: number;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const entry = payload[0];
  const slice = entry.payload;
  const raw = slice?.value ?? entry.value ?? 0;
  const value = typeof raw === "number" ? raw : Number(raw) || 0;
  const name = String(slice?.name ?? entry.name ?? "");
  const share =
    totalTerminals > 0 ? ((value / totalTerminals) * 100).toFixed(1) : "0.0";

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      <div className="font-medium">{name}</div>
      <div className="text-muted-foreground">
        {formatCount(value)} ({share}%)
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  loading: boolean;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <CardTitle className="text-2xl">{value}</CardTitle>
        )}
      </CardHeader>
      <CardContent className="px-4 text-sm text-muted-foreground">
        {loading ? <Skeleton className="h-4 w-36" /> : hint}
      </CardContent>
    </Card>
  );
}

const columnHelper = createColumnHelper<DataTableFeatures, TerminalSuccessReport>();

function sortableHeader(label: string) {
  return ({
    column,
  }: {
    column: {
      toggleSorting: (asc: boolean) => void;
      getIsSorted: () => false | "asc" | "desc";
    };
  }) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

const terminalColumns = [
  columnHelper.accessor("terminalId", {
    header: sortableHeader("Terminal ID"),
    cell: ({ row }) => (
      <span className="font-mono">{row.original.terminalId || "-"}</span>
    ),
  }),
  columnHelper.accessor("totalTransactions", {
    header: sortableHeader("Total"),
    cell: ({ row }) => (
      <span>{formatCount(row.original.totalTransactions)}</span>
    ),
  }),
  columnHelper.accessor("approvedCount", {
    header: sortableHeader("Approved"),
    cell: ({ row }) => (
      <span className="text-green-600">
        {formatCount(row.original.approvedCount)}
      </span>
    ),
  }),
  columnHelper.accessor("declinedCount", {
    header: sortableHeader("Declined"),
    cell: ({ row }) => (
      <span className="text-red-600">
        {formatCount(row.original.declinedCount)}
      </span>
    ),
  }),
  columnHelper.accessor("successRatePercent", {
    header: sortableHeader("Success Rate"),
    cell: ({ row }) => (
      <span className="font-semibold">
        {row.original.successRatePercent.toFixed(2)}%
      </span>
    ),
  }),
  columnHelper.accessor("approvedAmount", {
    header: sortableHeader("Approved Amount"),
    cell: ({ row }) => (
      <span>{formatAmount(row.original.approvedAmount)}</span>
    ),
  }),
  columnHelper.accessor("declinedAmount", {
    header: sortableHeader("Declined Amount"),
    cell: ({ row }) => (
      <span>{formatAmount(row.original.declinedAmount)}</span>
    ),
  }),
  columnHelper.accessor("totalAmount", {
    header: sortableHeader("Total Amount"),
    cell: ({ row }) => <span>{formatAmount(row.original.totalAmount)}</span>,
  }),
];

function DonutCenterLabel({
  viewBox,
  totalTerminals,
}: {
  viewBox?: { cx?: number; cy?: number };
  totalTerminals: number;
}) {
  const cx = viewBox?.cx;
  const cy = viewBox?.cy;
  if (cx == null || cy == null) {
    return null;
  }
  return (
    <g>
      <text
        x={cx}
        y={cy}
        dy={-4}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={22}
        fontWeight={700}
        fill="currentColor"
      >
        {formatCount(totalTerminals)}
      </text>
      <text
        x={cx}
        y={cy}
        dy={14}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fill="currentColor"
        opacity={0.6}
      >
        terminals
      </text>
    </g>
  );
}

export default function TerminalSuccessRate({
  channel = "pos",
}: {
  channel?: "pos" | "atm";
}) {
  const dispatch = useDispatch<AppDispatch>();
  const { terminalSuccessRate, terminalSuccessRateLoading } = useSelector(
    (state: RootState) => state.report,
  );
  const todayRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);

  const fleetLabel = channel === "atm" ? "ATM" : "POS";

  const loadData = useCallback(() => {
    if (!dateRange?.from || !dateRange?.to) return;
    dispatch(
      fetchTerminalSuccessRate({
        dateFrom: toApiDate(dateRange.from),
        dateTo: toApiDate(dateRange.to),
        channel,
      }),
    );
  }, [dispatch, dateRange, channel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const healthBuckets = useMemo(
    (): HealthSlice[] => [
      {
        name: ">90%",
        value: terminalSuccessRate.filter((t) => t.successRatePercent >= 90)
          .length,
        fill: "#22c55e",
      },
      {
        name: "80-90%",
        value: terminalSuccessRate.filter(
          (t) => t.successRatePercent >= 80 && t.successRatePercent < 90,
        ).length,
        fill: "#eab308",
      },
      {
        name: "70-80%",
        value: terminalSuccessRate.filter(
          (t) => t.successRatePercent >= 70 && t.successRatePercent < 80,
        ).length,
        fill: "#f97316",
      },
      {
        name: "<70%",
        value: terminalSuccessRate.filter((t) => t.successRatePercent < 70)
          .length,
        fill: "#ef4444",
      },
    ],
    [terminalSuccessRate],
  );

  const totalTerminals = useMemo(
    () => healthBuckets.reduce((sum, bucket) => sum + bucket.value, 0),
    [healthBuckets],
  );

  const renderHealthTooltip = useCallback(
    (props: TooltipContentProps) => (
      <HealthTooltip
        active={props.active}
        payload={props.payload}
        totalTerminals={totalTerminals}
      />
    ),
    [totalTerminals],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {fleetLabel} Terminal Success Rate
          </h2>
          <p className="text-sm text-muted-foreground">
            Acquiring success rate per {fleetLabel} terminal
          </p>
        </div>
        <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Transactions"
          value={formatCount(
            terminalSuccessRate.reduce(
              (sum, r) => sum + r.totalTransactions,
              0,
            ),
          )}
          hint="Across all terminals"
          loading={terminalSuccessRateLoading}
        />
        <MetricCard
          label="Approved"
          value={formatCount(
            terminalSuccessRate.reduce((sum, r) => sum + r.approvedCount, 0),
          )}
          hint="Successful authorizations"
          loading={terminalSuccessRateLoading}
        />
        <MetricCard
          label="Declined"
          value={formatCount(
            terminalSuccessRate.reduce((sum, r) => sum + r.declinedCount, 0),
          )}
          hint="Failed authorizations"
          loading={terminalSuccessRateLoading}
        />
        <MetricCard
          label="Terminals With Transactions"
          value={formatCount(
            terminalSuccessRate.filter((t) => t.totalTransactions > 0).length,
          )}
          hint={`of ${formatCount(terminalSuccessRate.length)} registered terminals`}
          loading={terminalSuccessRateLoading}
        />
      </div>

      {/* Pie gets the widest track; the two leaderboards are narrower and
          compact so the donut has room to render at full size. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Terminal Health</CardTitle>
            <CardDescription>Success rate distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {terminalSuccessRateLoading ? (
              <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
                <Skeleton className="mx-auto size-52 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ) : (
              <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
                {/* Fixed height: recharts sizes the donut from the shorter
                    dimension and centres it, so a short wide box cannot clip it. */}
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={healthBuckets}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="56%"
                        outerRadius="82%"
                        paddingAngle={2}
                        cornerRadius={4}
                        startAngle={90}
                        endAngle={-270}
                        stroke="var(--card)"
                        strokeWidth={2}
                        label={({ percent }) =>
                          (percent ?? 0) >= 0.01
                            ? `${((percent ?? 0) * 100).toFixed(0)}%`
                            : ""
                        }
                        labelLine={false}
                      >
                        {healthBuckets.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                        <Label
                          position="center"
                          content={(props) => (
                            <DonutCenterLabel
                              viewBox={
                                props.viewBox &&
                                "cx" in props.viewBox &&
                                "cy" in props.viewBox
                                  ? {
                                      cx: props.viewBox.cx,
                                      cy: props.viewBox.cy,
                                    }
                                  : undefined
                              }
                              totalTerminals={totalTerminals}
                            />
                          )}
                        />
                      </Pie>
                      <Tooltip content={renderHealthTooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-1.5 text-xs">
                  {healthBuckets.map((item) => (
                    <li key={item.name} className="flex items-center gap-1.5">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="font-medium tabular-nums">
                        {item.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Busiest</CardTitle>
            <CardDescription>Top 5 by transaction count</CardDescription>
          </CardHeader>
          <CardContent>
            {terminalSuccessRateLoading ? (
              <div className="space-y-1.5">
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            ) : (
              <div className="space-y-1.5">
                {[...terminalSuccessRate]
                  .sort((a, b) => b.totalTransactions - a.totalTransactions)
                  .slice(0, 5)
                  .map((terminal, index) => (
                    <div
                      key={terminal.terminalId}
                      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
                          {index + 1}
                        </span>
                        <span className="truncate font-mono text-xs">
                          {terminal.terminalId || "-"}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums">
                        {formatCount(terminal.totalTransactions)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Declined</CardTitle>
            <CardDescription>Top 5 by decline count</CardDescription>
          </CardHeader>
          <CardContent>
            {terminalSuccessRateLoading ? (
              <div className="space-y-1.5">
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            ) : (
              <div className="space-y-1.5">
                {[...terminalSuccessRate]
                  .sort((a, b) => b.declinedCount - a.declinedCount)
                  .slice(0, 5)
                  .map((terminal, index) => (
                    <div
                      key={terminal.terminalId}
                      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-semibold text-red-700">
                          {index + 1}
                        </span>
                        <span className="truncate font-mono text-xs">
                          {terminal.terminalId || "-"}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-red-600">
                        {formatCount(terminal.declinedCount)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Terminal Breakdown</CardTitle>
          <CardDescription>
            Per-terminal acquiring success rate for the selected date range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={
              terminalColumns as ColumnDef<
                DataTableFeatures,
                TerminalSuccessReport
              >[]
            }
            data={terminalSuccessRate}
            searchPlaceholder="Search by terminal ID..."
            loading={terminalSuccessRateLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

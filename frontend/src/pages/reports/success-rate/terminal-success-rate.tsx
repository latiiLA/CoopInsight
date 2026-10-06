import { format, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";

import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SkeletonTableBasic from "@/components/skeloton-table-basic";
import { fetchTerminalSuccessRate } from "@/features/report_slice";
import { toApiDate } from "@/lib/report-range";
import { TerminalSuccessReport } from "@/types/report";
import { AppDispatch, RootState } from "../../../../app/store/store";

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getTodayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
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
    () => [
      {
        name: ">90%",
        value: terminalSuccessRate.filter((t) => t.successRatePercent >= 90).length,
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
        value: terminalSuccessRate.filter((t) => t.successRatePercent < 70).length,
        fill: "#ef4444",
      },
    ],
    [terminalSuccessRate],
  );

  const totalTerminals = useMemo(
    () => healthBuckets.reduce((sum, bucket) => sum + bucket.value, 0),
    [healthBuckets],
  );

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<DataTableFeatures, TerminalSuccessReport>();
    return [
      columnHelper.accessor("terminalId", {
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Terminal ID
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono">{row.original.terminalId || "—"}</span>
        ),
      }),
      columnHelper.accessor("totalTransactions", {
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Total
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span>{formatCount(row.original.totalTransactions)}</span>
        ),
      }),
      columnHelper.accessor("approvedCount", {
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Approved
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-green-600">{formatCount(row.original.approvedCount)}</span>
        ),
      }),
      columnHelper.accessor("declinedCount", {
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Declined
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-red-600">{formatCount(row.original.declinedCount)}</span>
        ),
      }),
      columnHelper.accessor("successRatePercent", {
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Success Rate
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.successRatePercent.toFixed(2)}%</span>
        ),
      }),
      columnHelper.accessor("approvedAmount", {
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Approved Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span>{formatAmount(row.original.approvedAmount)}</span>
        ),
      }),
      columnHelper.accessor("declinedAmount", {
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Declined Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span>{formatAmount(row.original.declinedAmount)}</span>
        ),
      }),
      columnHelper.accessor("totalAmount", {
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Total Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span>{formatAmount(row.original.totalAmount)}</span>
        ),
      }),
    ];
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{fleetLabel} Terminal Success Rate</h2>
          <p className="text-sm text-muted-foreground">
            Acquiring success rate per {fleetLabel} terminal
          </p>
        </div>
        <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Transactions"
          value={formatCount(terminalSuccessRate?.reduce((sum, r) => sum + r.totalTransactions, 0) ?? 0)}
          hint="Across all terminals"
          loading={terminalSuccessRateLoading}
        />
        <MetricCard
          label="Approved"
          value={formatCount(terminalSuccessRate?.reduce((sum, r) => sum + r.approvedCount, 0) ?? 0)}
          hint="Successful authorizations"
          loading={terminalSuccessRateLoading}
        />
        <MetricCard
          label="Declined"
          value={formatCount(terminalSuccessRate?.reduce((sum, r) => sum + r.declinedCount, 0) ?? 0)}
          hint="Failed authorizations"
          loading={terminalSuccessRateLoading}
        />
        <MetricCard
          label="Terminals With Transactions"
          value={formatCount(
            terminalSuccessRate?.filter((t) => t.totalTransactions > 0).length ?? 0,
          )}
          hint={`of ${formatCount(terminalSuccessRate?.length ?? 0)} registered terminals`}
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
                        label={({ percent, cx, cy, midAngle, outerRadius, innerRadius }) => {
                          const percentValue = (percent ?? 0) * 100;
                          if (percentValue < 1) return null;
                          const radian = (midAngle * Math.PI) / 180;
                          const mid = (outerRadius as number) + (innerRadius as number) / 2;
                          return (
                            <text
                              x={cx + mid * Math.cos(radian)}
                              y={cy + mid * Math.sin(radian)}
                              fill="white"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={11}
                              fontWeight={600}
                            >
                              {percentValue.toFixed(0)}%
                            </text>
                          );
                        }}
                        labelLine={false}
                      >
                        {healthBuckets.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      {/* Centre total via recharts Label — raw <text> children
                          are positioned against the viewBox, not the donut. */}
                      <Label
                        position="center"
                        content={() => (
                          <g>
                            <text
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={22}
                              fontWeight={700}
                              fill="currentColor"
                            >
                              {formatCount(totalTerminals)}
                            </text>
                            <text
                              textAnchor="middle"
                              dominantBaseline="central"
                              dy={16}
                              fontSize={10}
                              fill="currentColor"
                              opacity={0.6}
                            >
                              terminals
                            </text>
                          </g>
                        )}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${formatCount(value)} (${totalTerminals > 0 ? ((value / totalTerminals) * 100).toFixed(1) : "0.0"}%)`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-1.5 text-xs">
                  {healthBuckets.map((item) => (
                    <li key={item.name} className="flex items-center gap-1.5">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="font-medium tabular-nums">{item.value}</span>
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
                          {terminal.terminalId || "—"}
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
                          {terminal.terminalId || "—"}
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
            columns={columns}
            data={terminalSuccessRate ?? []}
            searchPlaceholder="Search by terminal ID..."
            loading={terminalSuccessRateLoading}
            enableSorting={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}

import { eachDayOfInterval, format, startOfDay } from "date-fns";
import {
  ArrowDownUp,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Lock,
  Scale,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
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

import { MetricCard } from "@/components/metric-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchPrepaidVisaDashboard } from "@/features/prepaid_visa_slice";
import type {
  PrepaidVisaDailyPoint,
  PrepaidVisaProductFilter,
} from "@/types/prepaid-visa";
import { AppDispatch, RootState } from "../../../../app/store/store";

import { PrepaidVisaDateToolbar } from "./prepaid-visa-date-toolbar";
import { PrepaidVisaFilters } from "./prepaid-visa-filters";
import {
  formatCount,
  formatMerchantLabel,
  formatPct,
  formatUsd,
  productLabel,
} from "./prepaid-visa-format";
import { getLast30DaysRange, prepaidVisaHref } from "./prepaid-visa-range";

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from || !range?.to) {
    return "Selected range";
  }
  const from = format(range.from, "MMM d, yyyy");
  const to = format(range.to, "MMM d, yyyy");
  return from === to ? from : `${from} – ${to}`;
}

export default function PrepaidVisaDashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const { dashboard, dashboardLoading } = useSelector(
    (state: RootState) => state.prepaidVisa,
  );
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    () => getLast30DaysRange(),
  );
  const [product, setProduct] = useState<PrepaidVisaProductFilter>("");
  const requestRef = useRef<{ abort: () => void } | null>(null);

  const load = useCallback(
    async (
      range: DateRange | undefined,
      productFilter: PrepaidVisaProductFilter,
    ) => {
      if (!range?.from || !range?.to) {
        return;
      }

      requestRef.current?.abort?.();
      const request = dispatch(
        fetchPrepaidVisaDashboard({
          dateFrom: format(range.from, "MM/dd/yyyy"),
          dateTo: format(range.to, "MM/dd/yyyy"),
          product: productFilter || undefined,
        }),
      );
      requestRef.current = request;

      const result = await request;
      if (fetchPrepaidVisaDashboard.rejected.match(result)) {
        if (!result.meta.aborted) {
          toast.error(
            result.payload || "Failed to load prepaid Visa dashboard",
          );
        }
      }
    },
    [dispatch],
  );

  useEffect(() => {
    void load(dateRange, product);
    return () => {
      requestRef.current?.abort?.();
    };
  }, [dateRange, product, load]);

  // Fill every calendar day in the selected range so the x-axis does not jump
  // over quiet days (API only returns days with top-up or spend activity).
  const chartData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return [];
    }

    const byDate = new Map<string, PrepaidVisaDailyPoint>();
    for (const d of dashboard?.daily ?? []) {
      byDate.set(d.date, d);
    }

    return eachDayOfInterval({
      start: startOfDay(dateRange.from),
      end: startOfDay(dateRange.to),
    }).map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const d = byDate.get(key);
      const approved = d?.approvedAmount || 0;
      const requested = d?.txnAmount || 0;
      return {
        date: key,
        label: format(day, "MM-dd"),
        topUpCount: d?.topUpCount || 0,
        topUpAmount: d?.topUpAmount || 0,
        txnCount: d?.txnCount || 0,
        txnAmount: requested,
        approvedAmount: approved,
        otherSpend: Math.max(0, requested - approved),
        activeCards: d?.activeCards || 0,
      };
    });
  }, [dashboard?.daily, dateRange]);

  const rangeLabel = formatRangeLabel(dateRange);

  return (
    <div className="container mx-auto space-y-4 pb-8">
      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Prepaid Visa International
          </h3>
          <p className="text-sm text-muted-foreground">
            Live card balances, plus top-ups and spend for a selected period
          </p>
        </div>
        <PrepaidVisaDateToolbar
          dateRange={dateRange}
          onDateChange={setDateRange}
        />
      </div>

      <PrepaidVisaFilters
        product={product}
        onProductChange={setProduct}
        dateRange={dateRange}
      />

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h4 className="text-sm font-semibold tracking-tight">
            Current portfolio
          </h4>
          <p className="text-xs text-muted-foreground">
            Live · not affected by date
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-7">
          <MetricCard
            compact
            label="Cards"
            value={formatCount(dashboard?.fleetCards)}
            hint="Prepaid Visa cards"
            icon={CreditCard}
            loading={dashboardLoading}
          />
          <MetricCard
            compact
            label="Total top-ups"
            value={formatUsd(dashboard?.fleetTopUpAmount)}
            hint={`${formatCount(dashboard?.fleetTopUpCount)} lifetime loads`}
            icon={Wallet}
            loading={dashboardLoading}
          />
          <MetricCard
            compact
            label="Avail bal"
            value={formatUsd(dashboard?.fleetAvailableBal)}
            hint="Wallet balance"
            icon={Wallet}
            loading={dashboardLoading}
          />
          <MetricCard
            compact
            label="Avail amt"
            value={formatUsd(dashboard?.fleetAvailableAmount)}
            hint="Spendable after holds and overrides"
            icon={Wallet}
            loading={dashboardLoading}
          />
          <MetricCard
            compact
            label="Blocked"
            value={formatUsd(dashboard?.fleetBlockedBal)}
            hint={`${formatCount(dashboard?.blockedCards)} cards with open holds`}
            icon={Lock}
            loading={dashboardLoading}
          />
          <MetricCard
            compact
            label="From avail"
            value={formatUsd(dashboard?.fleetFromAvailable)}
            hint="Taken from available (ledger)"
            icon={Scale}
            loading={dashboardLoading}
          />
          <MetricCard
            compact
            label="Unloaded"
            value={formatUsd(dashboard?.fleetUnloaded)}
            hint={`${formatCount(dashboard?.fleetUnloadCount)} lifetime unloads`}
            icon={Wallet}
            loading={dashboardLoading}
          />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h4 className="text-sm font-semibold tracking-tight">Activity</h4>
          <p className="text-xs text-muted-foreground">For {rangeLabel}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            compact
            label="Top-ups"
            value={formatUsd(dashboard?.topUpAmount)}
            hint={`${formatCount(dashboard?.topUpCount)} top-ups · ${formatCount(dashboard?.topUpCards)} cards · avg ${formatUsd(dashboard?.avgTopUp)}`}
            icon={Wallet}
            loading={dashboardLoading}
          />
          <MetricCard
            compact
            label="Unloads"
            value={formatUsd(dashboard?.unloadAmount)}
            hint={`${formatCount(dashboard?.unloadCount)} unloads · ${formatCount(dashboard?.unloadCards)} cards`}
            icon={Wallet}
            loading={dashboardLoading}
          />
          <MetricCard
            compact
            label="Approved spend"
            value={formatUsd(dashboard?.approvedAmount)}
            hint={`${formatCount(dashboard?.approvedCount)} approved transactions`}
            icon={BadgeCheck}
            loading={dashboardLoading}
          />
          <MetricCard
            compact
            label="Requested spend"
            value={formatUsd(dashboard?.txnAmount)}
            hint={`${formatCount(dashboard?.txnCount)} txns · ${formatCount(dashboard?.activeCards)} cards · includes declined`}
            icon={ArrowDownUp}
            loading={dashboardLoading}
          />
          <MetricCard
            compact
            label="Approval rate"
            value={formatPct(dashboard?.approvalRate)}
            hint={`${formatCount(dashboard?.approvedCount)} approved · ${formatCount(dashboard?.declinedCount)} other`}
            icon={CheckCircle2}
            loading={dashboardLoading}
          />
        </div>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daily top-ups vs spend</CardTitle>
          <CardDescription>
            Top-ups beside requested spend (approved + other) within{" "}
            {rangeLabel}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[28rem] pt-2">
          {dashboardLoading ? (
            <Skeleton className="h-full w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No activity in this range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="amt"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <YAxis
                  yAxisId="cnt"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(
                    value: number,
                    name: string,
                    item: { payload?: { txnAmount?: number } },
                  ) => {
                    if (name === "Active cards") {
                      return [formatCount(value), name];
                    }
                    // Stack segment uses the remainder amount; show full requested total.
                    if (name === "Requested spend") {
                      return [
                        formatUsd(item.payload?.txnAmount ?? value),
                        name,
                      ];
                    }
                    return [formatUsd(value), name];
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="amt"
                  dataKey="topUpAmount"
                  name="Top-ups"
                  fill="var(--chart-1)"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  yAxisId="amt"
                  stackId="spend"
                  dataKey="approvedAmount"
                  name="Approved spend"
                  fill="var(--chart-2)"
                />
                <Bar
                  yAxisId="amt"
                  stackId="spend"
                  dataKey="otherSpend"
                  name="Requested spend"
                  fill="var(--chart-3)"
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  yAxisId="cnt"
                  type="monotone"
                  dataKey="activeCards"
                  name="Active cards"
                  stroke="oklch(0.62 0.18 150)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Top merchants</CardTitle>
                <CardDescription>
                  Approved spend in {rangeLabel}
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link
                  to={prepaidVisaHref(
                    "/prepaid-visa/transactions",
                    dateRange,
                    product,
                  )}
                >
                  View txns
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (dashboard?.topMerchants?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No merchant spend</p>
            ) : (
              <ul className="divide-y">
                {dashboard?.topMerchants.map((m, index) => (
                  <li
                    key={`${m.merchant}-${index}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={m.merchant}>
                        {formatMerchantLabel(m.merchant)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCount(m.txnCount)} transactions
                      </p>
                    </div>
                    <p className="shrink-0 tabular-nums font-medium">
                      {formatUsd(m.approvedAmt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">By product</CardTitle>
              <CardDescription>
                Balances are live · top-ups and spend use {rangeLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardLoading ? (
                <>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : (dashboard?.byProduct?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No product rows</p>
              ) : (
                dashboard?.byProduct.map((p) => (
                  <div
                    key={p.productCode}
                    className="rounded-lg border bg-muted/30 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">
                        {productLabel(p.productCode)}
                      </p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {formatCount(p.fleetCards)} cards
                      </p>
                    </div>

                    <p className="mt-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Live balances
                    </p>
                    <div className="mt-1 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Avail amt</p>
                        <p className="font-medium tabular-nums">
                          {formatUsd(p.availableAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Blocked</p>
                        <p
                          className={cn(
                            "font-medium tabular-nums",
                            p.blockedBal
                              ? "text-amber-700 dark:text-amber-400"
                              : "",
                          )}
                        >
                          {formatUsd(p.blockedBal)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">From avail</p>
                        <p className="font-medium tabular-nums">
                          {formatUsd(p.fromAvailable)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Avail + blocked + from avail{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {formatUsd(
                          (p.availableAmount || 0) +
                            (p.blockedBal || 0) +
                            (p.fromAvailable || 0),
                        )}
                      </span>
                    </p>

                    <p className="mt-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      In range
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-muted-foreground">Top-ups</p>
                        <p className="font-medium tabular-nums">
                          {formatUsd(p.topUpAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Approved spend</p>
                        <p className="font-medium tabular-nums">
                          {formatUsd(p.approvedAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Requested spend</p>
                        <p className="font-medium tabular-nums">
                          {formatUsd(p.txnAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Active</p>
                        <p className="font-medium tabular-nums">
                          {formatCount(p.activeCards)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick links</CardTitle>
              <CardDescription>
                Open detailed lists for {rangeLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Link
                to={prepaidVisaHref("/prepaid-visa/top-ups", dateRange, product)}
                className="rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <p className="font-medium">Daily top-ups</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Card, amount, and balances for every top-up in the range
                </p>
                <p className="mt-3 text-lg font-semibold tabular-nums">
                  {dashboardLoading
                    ? "—"
                    : `${formatCount(dashboard?.topUpCount)} top-ups`}
                </p>
              </Link>
              <Link
                to={prepaidVisaHref(
                  "/prepaid-visa/transactions",
                  dateRange,
                  product,
                )}
                className="rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <p className="font-medium">Performing cards</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Card spend with merchant, reference, and live balances
                </p>
                <p className="mt-3 text-lg font-semibold tabular-nums">
                  {dashboardLoading
                    ? "—"
                    : `${formatCount(dashboard?.activeCards)} cards`}
                </p>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

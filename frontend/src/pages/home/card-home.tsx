import { format, startOfDay, subDays } from "date-fns";
import {
  Activity,
  ArrowRight,
  CreditCard,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { NavLink } from "react-router-dom";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import type { CardActivityReport } from "@/types/card-activity";
import {
  CARD_HEALTH_LABELS,
  CARD_HEALTH_ORDER,
  type CardHealth,
  type CardStatusResponse,
} from "@/types/card-status-report";
import type { PrepaidVisaDashboard } from "@/types/prepaid-visa";
import { RootState } from "../../../app/store/store";
import { getTokenFromAuth, withAuthHeader } from "../../../utility/auth-token";
import { hasPermission } from "../../../utility/has-permission";

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  to,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof CreditCard;
  loading: boolean;
  to?: string;
}) {
  const body = (
    <Card className="gap-3 py-4 transition-colors hover:bg-accent/30">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-3">
          <CardDescription>{label}</CardDescription>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        )}
      </CardHeader>
      <CardContent className="px-4 text-sm text-muted-foreground">
        {loading ? <Skeleton className="h-4 w-36" /> : hint}
      </CardContent>
    </Card>
  );

  if (!to) return body;
  return (
    <NavLink to={to} className="min-w-0">
      {body}
    </NavLink>
  );
}

export function CardHome() {
  const { authUser, permissions } = useSelector(
    (state: RootState) => state.user,
  );

  const canViewStatus = hasPermission(
    ["card:view-number-of-cards-per-status"],
    permissions,
  );
  const canViewActivity = hasPermission(
    ["card:view-activity-dashboard"],
    permissions,
  );
  const canViewPrepaid = hasPermission(
    ["card:view-prepaid-visa"],
    permissions,
  );

  const today = useMemo(() => startOfDay(new Date()), []);
  const rangeFrom = useMemo(() => subDays(today, 29), [today]);
  const todayParam = format(today, "MM/dd/yyyy");
  const rangeFromParam = format(rangeFrom, "MM/dd/yyyy");
  const todayLabel = format(today, "EEE, MMM d");

  const [activity, setActivity] = useState<CardActivityReport | null>(null);
  const [activityLoading, setActivityLoading] = useState(canViewActivity);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [status, setStatus] = useState<CardStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(canViewStatus);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [prepaid, setPrepaid] = useState<PrepaidVisaDashboard | null>(null);
  const [prepaidLoading, setPrepaidLoading] = useState(canViewPrepaid);
  const [prepaidError, setPrepaidError] = useState<string | null>(null);

  useEffect(() => {
    const token = getTokenFromAuth(authUser);
    if (!token) return;

    const controller = new AbortController();

    const loadActivity = async () => {
      if (!canViewActivity) {
        setActivity(null);
        setActivityLoading(false);
        return;
      }
      setActivityLoading(true);
      setActivityError(null);
      try {
        const response = await api.get<{
          data: { report: CardActivityReport | null };
        }>("/card/activity", {
          ...withAuthHeader(token),
          params: { dateFrom: rangeFromParam, dateTo: todayParam },
          signal: controller.signal,
          timeout: 120_000,
        });
        if (controller.signal.aborted) return;
        setActivity(response.data.data?.report ?? null);
      } catch {
        if (controller.signal.aborted) return;
        setActivityError("Could not load card activity");
        setActivity(null);
      } finally {
        if (!controller.signal.aborted) setActivityLoading(false);
      }
    };

    const loadStatus = async () => {
      if (!canViewStatus) {
        setStatus(null);
        setStatusLoading(false);
        return;
      }
      setStatusLoading(true);
      setStatusError(null);
      try {
        const response = await api.get<{ data: CardStatusResponse }>(
          "/card/count-per-status",
          {
            ...withAuthHeader(token),
            params: {
              groupBy: "status",
              dateField: "created",
              expiringWithinMonths: 3,
            },
            signal: controller.signal,
            timeout: 180_000,
          },
        );
        if (controller.signal.aborted) return;
        setStatus(response.data.data ?? null);
      } catch {
        if (controller.signal.aborted) return;
        setStatusError("Could not load card inventory");
        setStatus(null);
      } finally {
        if (!controller.signal.aborted) setStatusLoading(false);
      }
    };

    const loadPrepaid = async () => {
      if (!canViewPrepaid) {
        setPrepaid(null);
        setPrepaidLoading(false);
        return;
      }
      setPrepaidLoading(true);
      setPrepaidError(null);
      try {
        const response = await api.get<{ data: PrepaidVisaDashboard }>(
          "/card/prepaid-visa/dashboard",
          {
            ...withAuthHeader(token),
            params: { dateFrom: todayParam, dateTo: todayParam },
            signal: controller.signal,
            timeout: 180_000,
          },
        );
        if (controller.signal.aborted) return;
        setPrepaid(response.data.data ?? null);
      } catch {
        if (controller.signal.aborted) return;
        setPrepaidError("Could not load prepaid Visa summary");
        setPrepaid(null);
      } finally {
        if (!controller.signal.aborted) setPrepaidLoading(false);
      }
    };

    void loadActivity();
    void loadStatus();
    void loadPrepaid();

    return () => controller.abort();
  }, [
    authUser,
    canViewActivity,
    canViewPrepaid,
    canViewStatus,
    todayParam,
    rangeFromParam,
  ]);

  const todayKey = format(today, "yyyy-MM-dd");
  const todayActivity = activity?.daily?.find((day) => day.date === todayKey);
  const createdToday = todayActivity?.created ?? 0;
  const issuedToday = todayActivity?.issued ?? 0;
  const activatedToday = todayActivity?.activated ?? 0;

  const rangeChart = useMemo(() => {
    const days = activity?.daily ?? [];
    return days.map((day) => ({
      label: day.date.slice(5),
      created: day.created,
      issued: day.issued,
      activated: day.activated,
      total: day.created + day.issued + day.activated,
    }));
  }, [activity]);

  const healthTotals = useMemo(() => {
    const totals: Record<CardHealth, number> = {
      active: 0,
      notActive: 0,
      blocked: 0,
      dead: 0,
      other: 0,
    };
    let expiring = 0;
    let all = 0;
    for (const row of status?.items ?? []) {
      const health = (row.health ?? "other") as CardHealth;
      if (health in totals) {
        totals[health] += row.cardCount;
      } else {
        totals.other += row.cardCount;
      }
      expiring += row.expiringCount ?? 0;
      all += row.cardCount;
    }
    return { totals, expiring, all };
  }, [status]);

  const healthRows = CARD_HEALTH_ORDER.map((health) => ({
    health,
    label: CARD_HEALTH_LABELS[health],
    count: healthTotals.totals[health],
  })).filter((row) => row.count > 0 || !statusLoading);

  const currency = prepaid?.fleetCurrency?.trim() || "USD";

  return (
    <div className="space-y-8">
      {canViewActivity ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Card activity
            </h2>
            <p className="text-sm text-muted-foreground">
              Requested, issued, and activated cards for {todayLabel}, with the
              last 30 days for context
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Requested today"
              value={activityLoading ? "-" : formatCount(createdToday)}
              hint={
                activityError ||
                (activity
                  ? `30-day total ${formatCount(activity.totals.created)}`
                  : "New card requests")
              }
              icon={CreditCard}
              loading={activityLoading}
              to="/card-activity"
            />
            <MetricCard
              label="Issued today"
              value={activityLoading ? "-" : formatCount(issuedToday)}
              hint={
                activity
                  ? `30-day total ${formatCount(activity.totals.issued)}`
                  : "Cards issued to customers"
              }
              icon={Activity}
              loading={activityLoading}
              to="/card-activity"
            />
            <MetricCard
              label="Activated today"
              value={activityLoading ? "-" : formatCount(activatedToday)}
              hint={
                activity
                  ? `30-day total ${formatCount(activity.totals.activated)}`
                  : "Cards moved to active use"
              }
              icon={Activity}
              loading={activityLoading}
              to="/card-activity"
            />
          </div>

          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Last 30 days</CardTitle>
                  <CardDescription>
                    Combined daily volume (hover for requested, issued,
                    activated)
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <NavLink to="/card-activity">
                    Open activity
                    <ArrowRight />
                  </NavLink>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4">
              {activityLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : activityError ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                  {activityError}
                </div>
              ) : rangeChart.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                  No card activity in the last 30 days
                </div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rangeChart}
                      margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                    >
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                        minTickGap={18}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        width={36}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value) =>
                          formatCount(typeof value === "number" ? value : 0)
                        }
                        labelFormatter={(label, payload) => {
                          const row = payload?.[0]?.payload as
                            | {
                                created?: number;
                                issued?: number;
                                activated?: number;
                              }
                            | undefined;
                          if (!row) return String(label);
                          return `${label} (req ${row.created ?? 0}, iss ${row.issued ?? 0}, act ${row.activated ?? 0})`;
                        }}
                      />
                      <Bar
                        dataKey="total"
                        name="Activity"
                        fill="var(--color-primary)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={14}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {canViewStatus ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Card inventory
            </h2>
            <p className="text-sm text-muted-foreground">
              Live counts by health across the card portfolio
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total cards"
              value={
                statusLoading ? "-" : formatCount(healthTotals.all)
              }
              hint={statusError || "All statuses in inventory"}
              icon={CreditCard}
              loading={statusLoading}
              to="/cards-per-status"
            />
            <MetricCard
              label="Active"
              value={
                statusLoading
                  ? "-"
                  : formatCount(healthTotals.totals.active)
              }
              hint="Ready for use"
              icon={Activity}
              loading={statusLoading}
              to="/cards-per-status"
            />
            <MetricCard
              label="Not yet active"
              value={
                statusLoading
                  ? "-"
                  : formatCount(healthTotals.totals.notActive)
              }
              hint="Requested or issued, not activated"
              icon={CreditCard}
              loading={statusLoading}
              to="/cards-per-status"
            />
            <MetricCard
              label="Expiring soon"
              value={
                statusLoading ? "-" : formatCount(healthTotals.expiring)
              }
              hint="Within the next 3 months"
              icon={Wallet}
              loading={statusLoading}
              to="/cards-per-status"
            />
          </div>

          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Health mix</CardTitle>
                  <CardDescription>
                    Share of the portfolio by health band
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <NavLink to="/cards-per-status">
                    View by status
                    <ArrowRight />
                  </NavLink>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-4">
              {statusLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : statusError ? (
                <p className="text-sm text-muted-foreground">{statusError}</p>
              ) : healthTotals.all === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No card inventory to show
                </p>
              ) : (
                healthRows.map((row) => {
                  const pct =
                    healthTotals.all > 0
                      ? (row.count / healthTotals.all) * 100
                      : 0;
                  return (
                    <div key={row.health} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{row.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatCount(row.count)} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {canViewPrepaid ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Prepaid Visa
            </h2>
            <p className="text-sm text-muted-foreground">
              Fleet balances and today&apos;s prepaid activity ({currency})
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Fleet cards"
              value={
                prepaidLoading ? "-" : formatCount(prepaid?.fleetCards ?? 0)
              }
              hint={
                prepaidError ||
                `${formatCount(prepaid?.blockedCards ?? 0)} blocked`
              }
              icon={CreditCard}
              loading={prepaidLoading}
              to="/prepaid-visa"
            />
            <MetricCard
              label="Available"
              value={
                prepaidLoading
                  ? "-"
                  : formatAmount(prepaid?.fleetAvailableAmount ?? 0)
              }
              hint={`${currency} ready to spend`}
              icon={Wallet}
              loading={prepaidLoading}
              to="/prepaid-visa"
            />
            <MetricCard
              label="Top-ups today"
              value={
                prepaidLoading
                  ? "-"
                  : formatAmount(prepaid?.topUpAmount ?? 0)
              }
              hint={`${formatCount(prepaid?.topUpCount ?? 0)} top-ups`}
              icon={Activity}
              loading={prepaidLoading}
              to="/prepaid-visa/top-ups"
            />
            <MetricCard
              label="Approved spend today"
              value={
                prepaidLoading
                  ? "-"
                  : formatAmount(prepaid?.approvedAmount ?? 0)
              }
              hint={
                prepaid
                  ? `${(prepaid.approvalRate ?? 0).toFixed(1)}% approval rate`
                  : "Approved prepaid spend"
              }
              icon={Activity}
              loading={prepaidLoading}
              to="/prepaid-visa/transactions"
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Card tools</h2>
          <p className="text-sm text-muted-foreground">
            Open the detailed card workspaces
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {canViewStatus ? (
            <NavLink to="/cards-per-status" className="min-w-0">
              <Card className="h-full gap-2 py-4 transition-colors hover:bg-accent/40">
                <CardHeader className="px-4">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CreditCard className="size-4" />
                  </div>
                  <CardTitle className="text-base">Cards per status</CardTitle>
                  <CardDescription>
                    Inventory by status, product, and branch
                  </CardDescription>
                </CardHeader>
              </Card>
            </NavLink>
          ) : null}
          {canViewActivity ? (
            <NavLink to="/card-activity" className="min-w-0">
              <Card className="h-full gap-2 py-4 transition-colors hover:bg-accent/40">
                <CardHeader className="px-4">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Activity className="size-4" />
                  </div>
                  <CardTitle className="text-base">Card activity</CardTitle>
                  <CardDescription>
                    Requested, issued, and activated trends
                  </CardDescription>
                </CardHeader>
              </Card>
            </NavLink>
          ) : null}
          {canViewPrepaid ? (
            <NavLink to="/prepaid-visa" className="min-w-0">
              <Card className="h-full gap-2 py-4 transition-colors hover:bg-accent/40">
                <CardHeader className="px-4">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Wallet className="size-4" />
                  </div>
                  <CardTitle className="text-base">Prepaid Visa</CardTitle>
                  <CardDescription>
                    International prepaid dashboard and ledgers
                  </CardDescription>
                </CardHeader>
              </Card>
            </NavLink>
          ) : null}
        </div>
      </section>
    </div>
  );
}

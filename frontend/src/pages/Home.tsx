import { format, startOfDay } from "date-fns";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleAlert,
  Percent,
  Shield,
  Activity,
  Users,
} from "lucide-react";
import { type ComponentType, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { NavLink } from "react-router-dom";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDepositPerTerminal } from "@/features/terminal_slice";
import { fetchSuccessTransactions } from "@/features/report_slice";
import { AcquiringOutcomePie } from "@/pages/reports/success-rate/acquiring-outcome-pie";
import { DeclineReasonsPie } from "@/pages/reports/success-rate/decline-reasons-pie";
import { SuccessRateRow } from "@/types/report";
import { AppDispatch, RootState } from "../../app/store/store";
import { hasPermission } from "../../utility/has-permission";

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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
}

export default function Home() {
  const dispatch = useDispatch<AppDispatch>();
  const { authUser, permissions } = useSelector((state: RootState) => state.user);
  const { successRate, successRateLoading, successRateError } = useSelector(
    (state: RootState) => state.report,
  );
  const { data: terminals, loading: terminalsLoading, error: terminalsError } =
    useSelector((state: RootState) => state.depositPerTerminal);

  const user = authUser?.data?.user;
  const firstName = user?.firstName?.trim() || user?.username || "there";
  const todayLabel = format(new Date(), "EEEE, MMMM d, yyyy");
  const canViewSuccessRate = hasPermission([
    "report:view-success-transactions",
  ]);

  useEffect(() => {
    const today = format(startOfDay(new Date()), "MM/dd/yyyy");

    void dispatch(
      fetchDepositPerTerminal({
        dateFrom: today,
        dateTo: today,
      }),
    );

    if (canViewSuccessRate) {
      void dispatch(
        fetchSuccessTransactions({
          dateFrom: today,
          dateTo: today,
        }),
      );
    }
  }, [canViewSuccessRate, dispatch, permissions]);

  const declinedCount = successRate?.declinedCount ?? 0;
  const tableData: SuccessRateRow[] = (successRate?.declineReasons ?? []).map(
    (reason) => ({
      ...reason,
      id: reason.code,
      sharePercent:
        declinedCount > 0 ? (reason.count / declinedCount) * 100 : 0,
    }),
  );

  const depositSummary = useMemo(() => {
    const transactionCount = terminals.reduce(
      (sum, row) => sum + row.NUMBER_TRNX,
      0,
    );
    const amount = terminals.reduce((sum, row) => sum + row.TOTAL_AMT, 0);
    const top = [...terminals]
      .sort((a, b) => b.TOTAL_AMT - a.TOTAL_AMT)
      .slice(0, 6)
      .map((row) => ({
        name: row.TERMINAL_ID,
        amount: row.TOTAL_AMT,
        transactions: row.NUMBER_TRNX,
        branch: row.BRANCH_NAME,
      }));

    return {
      terminalCount: terminals.length,
      transactionCount,
      amount,
      top,
    };
  }, [terminals]);

  const successPercent = successRate?.successRatePercent ?? 0;

  const quickLinks = [
    {
      title: "Acquiring Success Rate",
      description: "Acquiring approvals, declines, and response codes",
      to: "/success-rate",
      icon: Percent,
      show: canViewSuccessRate,
    },
    {
      title: "Deposit per Terminal",
      description: "Branch and terminal deposit volumes",
      to: "/deposit-per-terminal",
      icon: Banknote,
      show: true,
    },
    {
      title: "Manage Users",
      description: "Accounts, roles, and access",
      to: "/users",
      icon: Users,
      show: hasPermission(["user:view", "user:view-details"]),
    },
    {
      title: "Manage Roles",
      description: "Role permissions and assignments",
      to: "/roles",
      icon: Shield,
      show: hasPermission(["role:view", "role:view-details"]),
    },
  ].filter((link) => link.show);

  return (
    <div className="container mx-auto min-w-0 space-y-6 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {greetingForHour(new Date().getHours())}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Today&apos;s ATM and deposit activity for {todayLabel}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="ATM transactions"
          value={
            successRate ? formatCount(successRate.totalTransactions) : "—"
          }
          hint={
            successRate
              ? `Amount ${formatAmount(successRate.totalAmount)}`
              : successRateError || "Today's switch volume"
          }
          icon={Activity}
          loading={canViewSuccessRate && successRateLoading}
        />
        <MetricCard
          label="Approved"
          value={successRate ? formatCount(successRate.approvedCount) : "—"}
          hint={
            successRate
              ? `Amount ${formatAmount(successRate.approvedAmount)}`
              : "Successful ATM responses"
          }
          icon={CheckCircle2}
          loading={canViewSuccessRate && successRateLoading}
        />
        <MetricCard
          label="Declined"
          value={successRate ? formatCount(successRate.declinedCount) : "—"}
          hint={
            successRate
              ? `Amount ${formatAmount(successRate.declinedAmount)}`
              : "Failed or rejected responses"
          }
          icon={CircleAlert}
          loading={canViewSuccessRate && successRateLoading}
        />
        <MetricCard
          label="Acquiring success rate"
          value={successRate ? `${successPercent.toFixed(2)}%` : "—"}
          hint="Approved share of today's acquiring traffic"
          icon={Percent}
          loading={canViewSuccessRate && successRateLoading}
        />
      </div>

      {successRate ? (
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-base">Acquiring approval mix</CardTitle>
            <CardDescription>
              {formatCount(successRate.approvedCount)} approved of{" "}
              {formatCount(successRate.totalTransactions)} acquiring
              transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${Math.min(successPercent, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Approved {successPercent.toFixed(1)}%</span>
              <span>
                Declined {(100 - successPercent).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        {canViewSuccessRate ? (
          successRateLoading && !successRate ? (
            <div className="min-w-0 space-y-4">
              <Card className="h-[28rem] py-4">
                <CardHeader className="px-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="px-4">
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
              <Card className="h-[28rem] py-4">
                <CardHeader className="px-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="px-4">
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="min-w-0 space-y-4">
              <AcquiringOutcomePie
                approvedCount={successRate?.approvedCount ?? 0}
                declinedCount={declinedCount}
              />
              <DeclineReasonsPie
                rows={tableData}
                declinedCount={declinedCount}
              />
            </div>
          )
        ) : (
          <Card className="py-4">
            <CardHeader className="px-4">
              <CardTitle>Acquiring success rate</CardTitle>
              <CardDescription>
                You need report access to view today&apos;s switch performance.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card className="gap-4 py-4">
          <CardHeader className="px-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Top deposit terminals</CardTitle>
                <CardDescription>
                  Highest deposit amounts today
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <NavLink to="/deposit-per-terminal">
                  View all
                  <ArrowRight />
                </NavLink>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4">
            <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Terminals</p>
                <p className="font-semibold tabular-nums">
                  {terminalsLoading
                    ? "—"
                    : formatCount(depositSummary.terminalCount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Deposits</p>
                <p className="font-semibold tabular-nums">
                  {terminalsLoading
                    ? "—"
                    : formatCount(depositSummary.transactionCount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-semibold tabular-nums">
                  {terminalsLoading ? "—" : formatAmount(depositSummary.amount)}
                </p>
              </div>
            </div>

            {terminalsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : terminalsError ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                {terminalsError}
              </div>
            ) : depositSummary.top.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No deposit activity today
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={depositSummary.top}
                    layout="vertical"
                    margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={72}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) =>
                        formatAmount(typeof value === "number" ? value : 0)
                      }
                      labelFormatter={(label, payload) => {
                        const branch = payload?.[0]?.payload?.branch;
                        return branch ? `${label} · ${branch}` : String(label);
                      }}
                    />
                    <Bar
                      dataKey="amount"
                      fill="var(--color-primary)"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Quick links
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;

            return (
              <NavLink key={link.to} to={link.to} className="min-w-0">
                <Card className="h-full gap-3 py-4 transition-colors hover:bg-accent/40">
                  <CardHeader className="px-4">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <CardTitle className="text-base">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </CardHeader>
                </Card>
              </NavLink>
            );
          })}
          {quickLinks.length === 0 ? (
            <Card className="py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-base">No shortcuts yet</CardTitle>
                <CardDescription>
                  Ask an administrator to assign report or admin permissions.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

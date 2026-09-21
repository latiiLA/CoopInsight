import { format, startOfDay } from "date-fns";
import {
  ArrowRight,
  Banknote,
  ChartBar,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Percent,
  Activity,
  ArrowLeftRight,
  Wallet,
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
  const canViewSwitchOverall = hasPermission([
    "report:view-switch-overall-success-rate",
    "report:view-success-transactions",
  ]);
  const canViewAtmOverall = hasPermission([
    "report:view-atm-overall-success-rate",
    "report:view-success-transactions",
  ]);
  const canViewAtmAcquiring = hasPermission([
    "report:view-atm-acquiring-success-rate",
    "report:view-success-transactions",
  ]);
  const canViewAtmOnus = hasPermission([
    "report:view-atm-onus-success-rate",
    "report:view-success-transactions",
  ]);
  const canViewAtmOffus = hasPermission([
    "report:view-atm-offus-success-rate",
    "report:view-success-transactions",
  ]);
  const canViewAtmIssuing = hasPermission([
    "report:view-atm-issuing-success-rate",
    "report:view-success-transactions",
  ]);
  const canViewPosOverall = hasPermission([
    "report:view-pos-overall-success-rate",
    "report:view-success-transactions",
  ]);
  const canViewPosAcquiring = hasPermission([
    "report:view-pos-acquiring-success-rate",
    "report:view-success-transactions",
  ]);
  const canViewPosOnus = hasPermission([
    "report:view-pos-onus-success-rate",
    "report:view-success-transactions",
  ]);
  const canViewPosOffus = hasPermission([
    "report:view-pos-offus-success-rate",
    "report:view-success-transactions",
  ]);
  const canViewPosIssuing = hasPermission([
    "report:view-pos-issuing-success-rate",
    "report:view-success-transactions",
  ]);
  const canViewHomeSuccess = canViewSwitchOverall || canViewAtmOverall;

  useEffect(() => {
    const today = format(startOfDay(new Date()), "MM/dd/yyyy");

    void dispatch(
      fetchDepositPerTerminal({
        dateFrom: today,
        dateTo: today,
      }),
    );

    if (canViewSwitchOverall) {
      void dispatch(
        fetchSuccessTransactions({
          dateFrom: today,
          dateTo: today,
          channel: "switch",
          flow: "overall",
        }),
      );
    } else if (canViewAtmOverall) {
      void dispatch(
        fetchSuccessTransactions({
          dateFrom: today,
          dateTo: today,
          channel: "atm",
          flow: "overall",
        }),
      );
    }
  }, [canViewAtmOverall, canViewSwitchOverall, dispatch, permissions]);

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
      title: "Switch Overall Success Rate",
      description: "On-us, off-us, and issuing across ATM and POS",
      to: "/switch-overall-success-rate",
      icon: Percent,
      show: hasPermission([
        "report:view-switch-overall-success-rate",
        "report:view-success-transactions",
      ]),
    },
    {
      title: "Switch On-us Success Rate",
      description: "CoopBank cards on CoopBank ATM and POS terminals",
      to: "/switch-onus-success-rate",
      icon: Percent,
      show: hasPermission([
        "report:view-switch-onus-success-rate",
        "report:view-success-transactions",
      ]),
    },
    {
      title: "Switch Off-us Success Rate",
      description: "Other bank cards on CoopBank ATM and POS terminals",
      to: "/switch-offus-success-rate",
      icon: Percent,
      show: hasPermission([
        "report:view-switch-offus-success-rate",
        "report:view-success-transactions",
      ]),
    },
    {
      title: "Switch Issuing Success Rate",
      description: "CoopBank cards on other bank ATM and POS terminals",
      to: "/switch-issuing-success-rate",
      icon: Percent,
      show: hasPermission([
        "report:view-switch-issuing-success-rate",
        "report:view-success-transactions",
      ]),
    },
    {
      title: "ATM Overall Success Rate",
      description: "On-us, off-us, and issuing ATM authorizations",
      to: "/atm-overall-success-rate",
      icon: Percent,
      show: canViewAtmOverall,
    },
    {
      title: "ATM Acquiring Success Rate",
      description: "On-us and off-us ATM authorizations",
      to: "/atm-acquiring-success-rate",
      icon: Percent,
      show: canViewAtmAcquiring,
    },
    {
      title: "ATM On-us Success Rate",
      description: "CoopBank cards on CoopBank ATMs",
      to: "/atm-onus-success-rate",
      icon: Percent,
      show: canViewAtmOnus,
    },
    {
      title: "ATM Off-us Success Rate",
      description: "Other bank cards on CoopBank ATMs",
      to: "/atm-offus-success-rate",
      icon: Percent,
      show: canViewAtmOffus,
    },
    {
      title: "ATM Issuing Success Rate",
      description: "CoopBank cards on other bank ATMs",
      to: "/atm-issuing-success-rate",
      icon: Percent,
      show: canViewAtmIssuing,
    },
    {
      title: "POS Overall Success Rate",
      description: "On-us, off-us, and issuing POS authorizations",
      to: "/pos-overall-success-rate",
      icon: Percent,
      show: canViewPosOverall,
    },
    {
      title: "POS Acquiring Success Rate",
      description: "On-us and off-us POS authorizations",
      to: "/pos-acquiring-success-rate",
      icon: Percent,
      show: canViewPosAcquiring,
    },
    {
      title: "POS On-us Success Rate",
      description: "CoopBank cards on CoopBank POS terminals",
      to: "/pos-onus-success-rate",
      icon: Percent,
      show: canViewPosOnus,
    },
    {
      title: "POS Off-us Success Rate",
      description: "Other bank cards on CoopBank POS terminals",
      to: "/pos-offus-success-rate",
      icon: Percent,
      show: canViewPosOffus,
    },
    {
      title: "POS Issuing Success Rate",
      description: "CoopBank cards on other bank POS terminals",
      to: "/pos-issuing-success-rate",
      icon: Percent,
      show: canViewPosIssuing,
    },
    {
      title: "Deposit per Terminal",
      description: "Branch and terminal deposit volumes",
      to: "/deposit-per-terminal",
      icon: Banknote,
      show: true,
    },
    {
      title: "Ebirr Cardless Withdrawal",
      description: "Confirmed Ebirr cardless cash withdrawals",
      to: "/ebirr-cardless-withdrawal",
      icon: Wallet,
      show: hasPermission(["report:view-ebirr-cardless-withdrawal"]),
    },
    {
      title: "ATM Transactions",
      description: "TLOG activity for a selected ATM",
      to: "/atm-transactions",
      icon: ArrowLeftRight,
      show: hasPermission(["terminal:view-atm-transaction"]),
    },
    {
      title: "POS Transactions",
      description: "TLOG activity for a selected POS terminal",
      to: "/pos-transactions",
      icon: CreditCard,
      show: hasPermission(["terminal:view-pos-transaction"]),
    },
    {
      title: "ATM Comparison",
      description: "Highest and lowest ATM transaction performers",
      to: "/atm-comparison",
      icon: ChartBar,
      show: hasPermission(["terminal:view-atm-transaction"]),
    },
    {
      title: "POS Comparison",
      description: "Highest and lowest POS transaction performers",
      to: "/pos-comparison",
      icon: ChartBar,
      show: hasPermission(["terminal:view-pos-transaction"]),
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
            Today&apos;s switch and deposit activity for {todayLabel}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Switch transactions"
          value={
            successRate ? formatCount(successRate.totalTransactions) : "—"
          }
          hint={
            successRate
              ? `Amount ${formatAmount(successRate.totalAmount)}`
              : successRateError || "Today's switch volume"
          }
          icon={Activity}
          loading={canViewHomeSuccess && successRateLoading}
        />
        <MetricCard
          label="Approved"
          value={successRate ? formatCount(successRate.approvedCount) : "—"}
          hint={
            successRate
              ? `Amount ${formatAmount(successRate.approvedAmount)}`
              : "Successful switch responses"
          }
          icon={CheckCircle2}
          loading={canViewHomeSuccess && successRateLoading}
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
          loading={canViewHomeSuccess && successRateLoading}
        />
        <MetricCard
          label="Switch overall success rate"
          value={successRate ? `${successPercent.toFixed(2)}%` : "—"}
          hint="Approved share of today's ATM and POS traffic"
          icon={Percent}
          loading={canViewHomeSuccess && successRateLoading}
        />
      </div>

      {successRate ? (
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-base">Switch overall approval mix</CardTitle>
            <CardDescription>
              {formatCount(successRate.approvedCount)} approved of{" "}
              {formatCount(successRate.totalTransactions)} switch overall
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
        {canViewHomeSuccess ? (
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
                label="Switch overall"
                approvedCount={successRate?.approvedCount ?? 0}
                declinedCount={declinedCount}
              />
              <DeclineReasonsPie
                label="Switch overall"
                rows={tableData}
                declinedCount={declinedCount}
              />
            </div>
          )
        ) : (
          <Card className="py-4">
            <CardHeader className="px-4">
              <CardTitle>Switch overall success rate</CardTitle>
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

import { format, startOfDay } from "date-fns";
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  ChartBar,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  FileSearch,
  Percent,
  Wallet,
} from "lucide-react";
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useMemo,
} from "react";
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
import { AccountsReconHome } from "@/pages/home/accounts-recon-home";
import { CardHome } from "@/pages/home/card-home";
import { AcquiringOutcomePie } from "@/pages/reports/success-rate/acquiring-outcome-pie";
import { DeclineReasonsPie } from "@/pages/reports/success-rate/decline-reasons-pie";
import { SuccessRateRow } from "@/types/report";
import { AppDispatch, RootState } from "../../app/store/store";
import { hasPermission } from "../../utility/has-permission";

type NavIcon = ComponentType<{ className?: string }>;

type HomeLink = {
  title: string;
  description: string;
  to: string;
  icon: NavIcon;
};

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
  icon: NavIcon;
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

function LinkGrid({ links }: { links: HomeLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {links.map((link) => {
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
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  const dispatch = useDispatch<AppDispatch>();
  const { authUser, permissions } = useSelector(
    (state: RootState) => state.user,
  );
  const { successRate, successRateLoading, successRateError } = useSelector(
    (state: RootState) => state.report,
  );
  const {
    data: terminals,
    loading: terminalsLoading,
    error: terminalsError,
  } = useSelector((state: RootState) => state.depositPerTerminal);

  const user = authUser?.data?.user;
  const firstName = user?.firstName?.trim() || user?.username || "there";
  const todayLabel = format(new Date(), "EEEE, MMMM d, yyyy");

  // Use specific rate permissions only. Do not OR with the legacy
  // report:view-success-transactions alias here: that grant used to unlock
  // Switch/POS/ATM all at once and force Switch onto ATM monitoring home.
  const canViewSwitchOverall = hasPermission(
    ["report:view-switch-overall-success-rate"],
    permissions,
  );
  const canViewAtmOverall = hasPermission(
    ["report:view-atm-overall-success-rate"],
    permissions,
  );
  const canViewAtmAcquiring = hasPermission(
    ["report:view-atm-acquiring-success-rate"],
    permissions,
  );
  const canViewPosOverall = hasPermission(
    ["report:view-pos-overall-success-rate"],
    permissions,
  );
  const canViewPosAcquiring = hasPermission(
    ["report:view-pos-acquiring-success-rate"],
    permissions,
  );
  const canViewDeposit = hasPermission(
    ["report:view-deposit-per-terminal"],
    permissions,
  );
  const canViewAtmTerminal = hasPermission(
    ["terminal:view-atm", "terminal:view-atm-transaction"],
    permissions,
  );
  const canViewPosTerminal = hasPermission(
    ["terminal:view-pos", "terminal:view-pos-transaction"],
    permissions,
  );
  const canViewCards = hasPermission(
    [
      "card:view-number-of-cards-per-status",
      "card:view-activity-dashboard",
      "card:view-prepaid-visa",
    ],
    permissions,
  );
  const canViewClearing = hasPermission(
    [
      "clearing:view-uncleared-eth",
      "clearing:view-uncleared-visa",
      "clearing:view-uncleared-visa-cybersource",
      "clearing:view-uncleared-mastercard",
      "clearing:view-cleared-eth",
      "clearing:view-cleared-visa",
      "clearing:view-cleared-visa-cybersource",
      "clearing:view-cleared-mastercard",
    ],
    permissions,
  );
  const canViewSettlement = hasPermission(
    [
      "settlement:view-unsettled-eth",
      "settlement:view-unsettled-visa",
      "settlement:view-unsettled-visa-cybersource",
      "settlement:view-unsettled-mastercard",
      "settlement:view-settled-eth",
      "settlement:view-settled-visa",
      "settlement:view-settled-mastercard",
    ],
    permissions,
  );
  const canViewEj = hasPermission(
    ["report:search-ej-transactions"],
    permissions,
  );

  type HomeSuccessView = {
    channel: "switch" | "atm" | "pos";
    flow: "overall" | "acquiring";
    label: string;
    ratePath: string;
  };

  // Memoize so the fetch effect does not re-fire every render (new object
  // identity previously caused an infinite request loop and froze the UI).
  const homeSuccess = useMemo<HomeSuccessView | null>(() => {
    if (canViewSwitchOverall) {
      return {
        channel: "switch",
        flow: "overall",
        label: "Switch",
        ratePath: "/switch-overall-success-rate",
      };
    }
    if (canViewAtmAcquiring) {
      return {
        channel: "atm",
        flow: "acquiring",
        label: "ATM acquiring",
        ratePath: "/atm-acquiring-success-rate",
      };
    }
    if (canViewAtmOverall) {
      return {
        channel: "atm",
        flow: "overall",
        label: "ATM",
        ratePath: "/atm-overall-success-rate",
      };
    }
    if (canViewPosAcquiring) {
      return {
        channel: "pos",
        flow: "acquiring",
        label: "POS acquiring",
        ratePath: "/pos-acquiring-success-rate",
      };
    }
    if (canViewPosOverall) {
      return {
        channel: "pos",
        flow: "overall",
        label: "POS",
        ratePath: "/pos-overall-success-rate",
      };
    }
    return null;
  }, [
    canViewAtmAcquiring,
    canViewAtmOverall,
    canViewPosAcquiring,
    canViewPosOverall,
    canViewSwitchOverall,
  ]);

  const canViewHomeSuccess = homeSuccess != null;
  const successLabel = homeSuccess?.label ?? "Switch";
  const successChannel = homeSuccess?.channel ?? null;
  const successFlow = homeSuccess?.flow ?? "overall";

  useEffect(() => {
    const today = format(startOfDay(new Date()), "MM/dd/yyyy");

    if (canViewDeposit) {
      void dispatch(
        fetchDepositPerTerminal({
          dateFrom: today,
          dateTo: today,
        }),
      );
    }

    if (successChannel) {
      void dispatch(
        fetchSuccessTransactions({
          dateFrom: today,
          dateTo: today,
          channel: successChannel,
          flow: successFlow,
        }),
      );
    }
  }, [canViewDeposit, dispatch, successChannel, successFlow]);

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

  const subtitleParts: string[] = [];
  if (canViewHomeSuccess) subtitleParts.push(`${successLabel.toLowerCase()} success`);
  if (canViewDeposit) subtitleParts.push("deposits");
  if (canViewSettlement || canViewClearing) {
    subtitleParts.push("settlement and clearing");
  }
  if (canViewCards) subtitleParts.push("cards");
  if (canViewEj) subtitleParts.push("EJ");
  if (canViewAtmTerminal && !canViewSwitchOverall) subtitleParts.push("ATM");
  if (canViewPosTerminal && !canViewSwitchOverall) subtitleParts.push("POS");
  const subtitleFocus =
    subtitleParts.length > 0
      ? subtitleParts.join(", ")
      : "your assigned areas";

  const atmLinks: HomeLink[] = [
    {
      title: "ATM Acquiring Success Rate",
      description: "Acquiring authorizations on CoopBank ATMs",
      to: "/atm-acquiring-success-rate",
      icon: Percent,
    },
    {
      title: "ATM Terminal Success Rate",
      description: "Per-terminal acquiring success",
      to: "/atm-terminal-success-rate",
      icon: Percent,
    },
    {
      title: "ATM Overall Success Rate",
      description: "On-us, off-us, and remote on-us ATM authorizations",
      to: "/atm-overall-success-rate",
      icon: Percent,
    },
    {
      title: "ATM Terminal",
      description: "Fleet status and dashboard",
      to: "/atm-dashboard",
      icon: Activity,
    },
    {
      title: "ATM Transactions",
      description: "Activity for a selected ATM",
      to: "/atm-transactions",
      icon: ArrowLeftRight,
    },
    {
      title: "ATM Comparison",
      description: "Highest and lowest ATM performers",
      to: "/atm-comparison",
      icon: ChartBar,
    },
  ].filter((link) => {
    // Home already surfaces acquiring/overall metrics; keep rate deep-links
    // only when they are not the primary home view.
    if (link.to === "/atm-acquiring-success-rate") {
      return (
        canViewAtmAcquiring &&
        !(successChannel === "atm" && successFlow === "acquiring")
      );
    }
    if (link.to === "/atm-terminal-success-rate") {
      return canViewAtmAcquiring;
    }
    if (link.to === "/atm-overall-success-rate") {
      return (
        canViewAtmOverall &&
        !(successChannel === "atm" && successFlow === "overall")
      );
    }
    if (link.to === "/atm-dashboard") {
      return hasPermission(["terminal:view-atm"], permissions);
    }
    return hasPermission(["terminal:view-atm-transaction"], permissions);
  });

  const posLinks: HomeLink[] = [
    {
      title: "POS Overall Success Rate",
      description: "On-us, off-us, and remote on-us POS authorizations",
      to: "/pos-overall-success-rate",
      icon: Percent,
    },
    {
      title: "POS Terminal Success Rate",
      description: "Per-terminal acquiring success",
      to: "/pos-terminal-success-rate",
      icon: Percent,
    },
    {
      title: "POS Terminal",
      description: "Fleet status and dashboard",
      to: "/pos-dashboard",
      icon: CreditCard,
    },
    {
      title: "POS Transactions",
      description: "Activity for a selected POS terminal",
      to: "/pos-transactions",
      icon: ArrowLeftRight,
    },
    {
      title: "POS Comparison",
      description: "Highest and lowest POS performers",
      to: "/pos-comparison",
      icon: ChartBar,
    },
  ].filter((link) => {
    if (link.to.includes("success-rate")) {
      return canViewPosOverall;
    }
    if (link.to === "/pos-dashboard") {
      return hasPermission(["terminal:view-pos"], permissions);
    }
    return hasPermission(["terminal:view-pos-transaction"], permissions);
  });

  const showSuccessSection = canViewHomeSuccess;
  const showDepositSection = canViewDeposit;
  // When home already shows ATM/POS acquiring metrics, only keep fleet/txn
  // shortcuts in the ATM/POS sections (skip duplicating the rate links).
  const showAtmSection =
    (canViewAtmOverall || canViewAtmAcquiring || canViewAtmTerminal) &&
    !canViewSwitchOverall;
  const showPosSection =
    (canViewPosOverall || canViewPosAcquiring || canViewPosTerminal) &&
    !canViewSwitchOverall;
  const showCardsSection = canViewCards;
  const showSettleClearSection = canViewSettlement || canViewClearing;
  const showEjSection = canViewEj;
  const showAccountsReconHome = showSettleClearSection || showEjSection;

  const quickLinks: HomeLink[] = (
    [
      {
        title: "Switch Overall Success Rate",
        description: "On-us, off-us, and remote on-us across ATM and POS",
        to: "/switch-overall-success-rate",
        icon: Percent,
        show: canViewSwitchOverall,
      },
      {
        title: "ATM Acquiring Success Rate",
        description: "Acquiring authorizations on CoopBank ATMs",
        to: "/atm-acquiring-success-rate",
        icon: Percent,
        show:
          canViewAtmAcquiring &&
          !(successChannel === "atm" && successFlow === "acquiring"),
      },
      {
        title: "Deposit per Terminal",
        description: "Branch and terminal deposit volumes",
        to: "/deposit-per-terminal",
        icon: Banknote,
        show: canViewDeposit,
      },
      {
        title: "Ebirr Cardless Withdrawal",
        description: "Confirmed Ebirr cardless cash withdrawals",
        to: "/ebirr-cardless-withdrawal",
        icon: Wallet,
        show: hasPermission(
          ["report:view-ebirr-cardless-withdrawal"],
          permissions,
        ),
      },
      {
        title: "ATM Transactions",
        description: "Activity for a selected ATM",
        to: "/atm-transactions",
        icon: ArrowLeftRight,
        show:
          canViewSwitchOverall &&
          hasPermission(["terminal:view-atm-transaction"], permissions),
      },
      {
        title: "POS Transactions",
        description: "Activity for a selected POS terminal",
        to: "/pos-transactions",
        icon: CreditCard,
        show:
          canViewSwitchOverall &&
          hasPermission(["terminal:view-pos-transaction"], permissions),
      },
      {
        title: "ATM Comparison",
        description: "Highest and lowest ATM performers",
        to: "/atm-comparison",
        icon: ChartBar,
        show:
          canViewSwitchOverall &&
          hasPermission(["terminal:view-atm-transaction"], permissions),
      },
      {
        title: "POS Comparison",
        description: "Highest and lowest POS performers",
        to: "/pos-comparison",
        icon: ChartBar,
        show:
          canViewSwitchOverall &&
          hasPermission(["terminal:view-pos-transaction"], permissions),
      },
      {
        title: "Switch transaction search",
        description: "Look up IST switch log transactions",
        to: "/switch-transaction-search",
        icon: FileSearch,
        show:
          !showAccountsReconHome &&
          hasPermission(["report:search-switch-transactions"], permissions),
      },
      {
        title: "Switch / Cortex export",
        description: "Export approved transactions for reconciliation",
        to: "/terminal-recon-export",
        icon: Banknote,
        show:
          !showAccountsReconHome &&
          hasPermission(
            [
              "report:export-switch-terminal-recon",
              "report:export-cortex-terminal-recon",
            ],
            permissions,
          ),
      },
    ] as Array<HomeLink & { show: boolean }>
  )
    .filter((link) => link.show)
    .map(({ title, description, to, icon }) => ({
      title,
      description,
      to,
      icon,
    }));

  const showQuickLinks = quickLinks.length > 0;

  const hasAnySection =
    showSuccessSection ||
    showDepositSection ||
    showAtmSection ||
    showPosSection ||
    showCardsSection ||
    showSettleClearSection ||
    showEjSection ||
    showQuickLinks;

  return (
    <div className="container mx-auto min-w-0 space-y-4 pb-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {greetingForHour(new Date().getHours())}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Today&apos;s {subtitleFocus} for {todayLabel}
        </p>
      </div>

      {showSuccessSection ? (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={`${successLabel} transactions`}
              value={
                successRate
                  ? formatCount(successRate.totalTransactions)
                  : "-"
              }
              hint={
                successRate
                  ? `Amount ${formatAmount(successRate.totalAmount)}`
                  : successRateError || `Today's ${successLabel.toLowerCase()} volume`
              }
              icon={Activity}
              loading={successRateLoading}
            />
            <MetricCard
              label="Approved"
              value={
                successRate ? formatCount(successRate.approvedCount) : "-"
              }
              hint={
                successRate
                  ? `Amount ${formatAmount(successRate.approvedAmount)}`
                  : "Successful responses"
              }
              icon={CheckCircle2}
              loading={successRateLoading}
            />
            <MetricCard
              label="Declined"
              value={
                successRate ? formatCount(successRate.declinedCount) : "-"
              }
              hint={
                successRate
                  ? `Amount ${formatAmount(successRate.declinedAmount)}`
                  : "Failed or rejected responses"
              }
              icon={CircleAlert}
              loading={successRateLoading}
            />
            <MetricCard
              label={`${successLabel} success rate`}
              value={successRate ? `${successPercent.toFixed(2)}%` : "-"}
              hint="Approved share of today's traffic"
              icon={Percent}
              loading={successRateLoading}
            />
          </div>

          {successRate ? (
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-base">
                  {successLabel} approval mix
                </CardTitle>
                <CardDescription>
                  {formatCount(successRate.approvedCount)} approved of{" "}
                  {formatCount(successRate.totalTransactions)}{" "}
                  {successLabel.toLowerCase()} transactions
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

          {showDepositSection ? (
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              {successRateLoading && !successRate ? (
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
                </div>
              ) : (
                <div className="min-w-0 space-y-4">
                  <AcquiringOutcomePie
                    label={successLabel}
                    approvedCount={successRate?.approvedCount ?? 0}
                    declinedCount={declinedCount}
                  />
                  <DeclineReasonsPie
                    label={successLabel}
                    rows={tableData}
                    declinedCount={declinedCount}
                  />
                </div>
              )}

              <DepositPanel
                loading={terminalsLoading}
                error={terminalsError}
                summary={depositSummary}
              />
            </div>
          ) : successRateLoading && !successRate ? (
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
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
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <AcquiringOutcomePie
                label={successLabel}
                approvedCount={successRate?.approvedCount ?? 0}
                declinedCount={declinedCount}
              />
              <DeclineReasonsPie
                label={successLabel}
                rows={tableData}
                declinedCount={declinedCount}
              />
            </div>
          )}
        </section>
      ) : null}

      {!showSuccessSection && showDepositSection ? (
        <Section
          title="Deposits"
          description="Highest deposit amounts today"
        >
          <DepositPanel
            loading={terminalsLoading}
            error={terminalsError}
            summary={depositSummary}
          />
        </Section>
      ) : null}

      {showAtmSection && atmLinks.length > 0 ? (
        <Section
          title="ATM"
          description="ATM success rates, fleet, and transactions"
        >
          <LinkGrid links={atmLinks} />
        </Section>
      ) : null}

      {showPosSection && posLinks.length > 0 ? (
        <Section
          title="POS"
          description="POS success rates, fleet, and transactions"
        >
          <LinkGrid links={posLinks} />
        </Section>
      ) : null}

      {showAccountsReconHome ? (
        <AccountsReconHome
          canViewClearing={canViewClearing}
          canViewSettlement={canViewSettlement}
          canViewEj={canViewEj}
        />
      ) : null}

      {showCardsSection ? <CardHome /> : null}

      {showQuickLinks ? (
        <Section title="Quick links">
          <LinkGrid links={quickLinks} />
        </Section>
      ) : null}

      {!hasAnySection ? (
        <Card className="py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-base">No home shortcuts yet</CardTitle>
            <CardDescription>
              Ask an administrator to assign a role with report, terminal,
              settlement, clearing, card, or EJ access.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}

function DepositPanel({
  loading,
  error,
  summary,
}: {
  loading: boolean;
  error: string | null | undefined;
  summary: {
    terminalCount: number;
    transactionCount: number;
    amount: number;
    top: Array<{
      name: string;
      amount: number;
      transactions: number;
      branch: string;
    }>;
  };
}) {
  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Top deposit terminals</CardTitle>
            <CardDescription>Highest deposit amounts today</CardDescription>
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
              {loading ? "-" : formatCount(summary.terminalCount)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Deposits</p>
            <p className="font-semibold tabular-nums">
              {loading ? "-" : formatCount(summary.transactionCount)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Amount</p>
            <p className="font-semibold tabular-nums">
              {loading ? "-" : formatAmount(summary.amount)}
            </p>
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : error ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {error}
          </div>
        ) : summary.top.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No deposit activity today
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.top}
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
  );
}

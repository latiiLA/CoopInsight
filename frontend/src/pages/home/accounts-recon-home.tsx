import { format, startOfDay, subDays } from "date-fns";
import {
  ArrowRight,
  ChartBar,
  CircleAlert,
  Download,
  FileSearch,
  Inbox,
  Scale,
  Search,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { NavLink } from "react-router-dom";

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
import type { EJCoverageResult } from "@/types/ej-coverage";
import { RootState } from "../../../app/store/store";
import { getTokenFromAuth, withAuthHeader } from "../../../utility/auth-token";
import { hasPermission } from "../../../utility/has-permission";

type SchemeId = "eth" | "visa" | "visacbs" | "mastercard";

type SchemeQueueRow = {
  id: SchemeId;
  label: string;
  count: number;
  amount: number;
  hasMore: boolean;
  error: string | null;
  loading: boolean;
};

type PagePayload = {
  items?: Array<{ amount?: number; settlementAmount?: number }>;
  hasMore?: boolean;
};

const HOME_PAGE_SIZE = 100;

const unclearedSchemes: Array<{
  id: SchemeId;
  label: string;
  path: string;
  permissions: string[];
}> = [
  {
    id: "eth",
    label: "ETH",
    path: "eth",
    permissions: ["clearing:view-uncleared-eth"],
  },
  {
    id: "visa",
    label: "Visa",
    path: "visa",
    permissions: ["clearing:view-uncleared-visa"],
  },
  {
    id: "visacbs",
    label: "Cybersource",
    path: "visacybersource",
    permissions: ["clearing:view-uncleared-visa-cybersource"],
  },
  {
    id: "mastercard",
    label: "Mastercard",
    path: "mastercard",
    permissions: ["clearing:view-uncleared-mastercard"],
  },
];

const unsettledSchemes: Array<{
  id: SchemeId;
  label: string;
  path: string;
  permissions: string[];
}> = [
  {
    id: "eth",
    label: "ETH",
    path: "eth",
    permissions: ["settlement:view-unsettled-eth"],
  },
  {
    id: "visa",
    label: "Visa",
    path: "visa",
    permissions: ["settlement:view-unsettled-visa"],
  },
  {
    id: "visacbs",
    label: "Cybersource",
    path: "visacybersource",
    permissions: ["settlement:view-unsettled-visa-cybersource"],
  },
  {
    id: "mastercard",
    label: "Mastercard",
    path: "mastercard",
    permissions: ["settlement:view-unsettled-mastercard"],
  },
];

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCountMaybeMore(count: number, hasMore: boolean) {
  if (hasMore) return `${formatCount(count)}+`;
  return formatCount(count);
}

function emptyRows(
  schemes: Array<{ id: SchemeId; label: string; permissions: string[] }>,
  permissions: string[],
): SchemeQueueRow[] {
  return schemes
    .filter((scheme) => hasPermission(scheme.permissions, permissions))
    .map((scheme) => ({
      id: scheme.id,
      label: scheme.label,
      count: 0,
      amount: 0,
      hasMore: false,
      error: null,
      loading: true,
    }));
}

function sumAmounts(
  items: Array<{ amount?: number; settlementAmount?: number }>,
) {
  return items.reduce((sum, row) => {
    const value =
      typeof row.amount === "number" && Number.isFinite(row.amount)
        ? row.amount
        : typeof row.settlementAmount === "number" &&
            Number.isFinite(row.settlementAmount)
          ? row.settlementAmount
          : 0;
    return sum + value;
  }, 0);
}

async function fetchQueuePage(
  token: string,
  basePath: string,
  schemePath: string,
  dateFrom: string,
  dateTo: string,
  signal: AbortSignal,
): Promise<{ count: number; amount: number; hasMore: boolean }> {
  const response = await api.get<{ data: PagePayload }>(
    `${basePath}/${schemePath}`,
    {
      ...withAuthHeader(token),
      params: {
        dateFrom,
        dateTo,
        page: 1,
        pageSize: HOME_PAGE_SIZE,
      },
      signal,
      timeout: 120_000,
    },
  );
  const items = response.data.data?.items ?? [];
  return {
    count: items.length,
    amount: sumAmounts(items),
    hasMore: Boolean(response.data.data?.hasMore),
  };
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
  icon: typeof Inbox;
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

function QueueTable({
  title,
  description,
  href,
  rows,
  emptyLabel,
  footnoteDay,
}: {
  title: string;
  description: string;
  href: string;
  rows: SchemeQueueRow[];
  emptyLabel: string;
  footnoteDay?: string;
}) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <NavLink to={href}>
              Open
              <ArrowRight />
            </NavLink>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Scheme</th>
                  <th className="px-3 py-2 text-right font-medium">Items</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2.5 font-medium">{row.label}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.loading ? (
                        <Skeleton className="ml-auto h-4 w-12" />
                      ) : row.error ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        formatCountMaybeMore(row.count, row.hasMore)
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.loading ? (
                        <Skeleton className="ml-auto h-4 w-20" />
                      ) : row.error ? (
                        <span
                          className="text-muted-foreground"
                          title={row.error}
                        >
                          Unavailable
                        </span>
                      ) : (
                        formatAmount(row.amount)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Counts for {footnoteDay ?? "today"}. Amounts cover the first{" "}
          {HOME_PAGE_SIZE} rows per scheme
          {` (shown with + when more exist)`}.
        </p>
      </CardContent>
    </Card>
  );
}

export function AccountsReconHome({
  canViewClearing,
  canViewSettlement,
  canViewEj,
}: {
  canViewClearing: boolean;
  canViewSettlement: boolean;
  canViewEj: boolean;
}) {
  const { authUser, permissions } = useSelector(
    (state: RootState) => state.user,
  );
  const today = useMemo(() => startOfDay(new Date()), []);
  const yesterday = useMemo(() => subDays(today, 1), [today]);
  // Uncleared work looks at yesterday: today's approved items are not expected
  // to be cleared yet.
  const unclearedDateParam = format(yesterday, "MM/dd/yyyy");
  const todayDateParam = format(today, "MM/dd/yyyy");
  const unclearedDayLabel = format(yesterday, "EEE, MMM d");

  const [unclearedRows, setUnclearedRows] = useState<SchemeQueueRow[]>(() =>
    emptyRows(unclearedSchemes, permissions),
  );
  const [unsettledRows, setUnsettledRows] = useState<SchemeQueueRow[]>(() =>
    emptyRows(unsettledSchemes, permissions),
  );
  const [ej, setEj] = useState<EJCoverageResult | null>(null);
  const [ejLoading, setEjLoading] = useState(canViewEj);
  const [ejError, setEjError] = useState<string | null>(null);

  const canSearchSwitch = hasPermission(
    ["report:search-switch-transactions"],
    permissions,
  );
  const canExportSwitch = hasPermission(
    ["report:export-switch-terminal-recon"],
    permissions,
  );
  const canExportCortex = hasPermission(
    ["report:export-cortex-terminal-recon"],
    permissions,
  );
  const canExport = canExportSwitch || canExportCortex;

  useEffect(() => {
    const token = getTokenFromAuth(authUser);
    if (!token) return;

    const controller = new AbortController();

    const loadUncleared = async () => {
      if (!canViewClearing) {
        setUnclearedRows([]);
        return;
      }
      const allowed = unclearedSchemes.filter((scheme) =>
        hasPermission(scheme.permissions, permissions),
      );
      setUnclearedRows(emptyRows(unclearedSchemes, permissions));

      await Promise.all(
        allowed.map(async (scheme) => {
          try {
            const result = await fetchQueuePage(
              token,
              "/clearing/uncleared",
              scheme.path,
              unclearedDateParam,
              unclearedDateParam,
              controller.signal,
            );
            if (controller.signal.aborted) return;
            setUnclearedRows((prev) =>
              prev.map((row) =>
                row.id === scheme.id
                  ? {
                      ...row,
                      count: result.count,
                      amount: result.amount,
                      hasMore: result.hasMore,
                      loading: false,
                      error: null,
                    }
                  : row,
              ),
            );
          } catch {
            if (controller.signal.aborted) return;
            setUnclearedRows((prev) =>
              prev.map((row) =>
                row.id === scheme.id
                  ? {
                      ...row,
                      loading: false,
                      error: "Could not load",
                    }
                  : row,
              ),
            );
          }
        }),
      );
    };

    const loadUnsettled = async () => {
      if (!canViewSettlement) {
        setUnsettledRows([]);
        return;
      }
      const allowed = unsettledSchemes.filter((scheme) =>
        hasPermission(scheme.permissions, permissions),
      );
      setUnsettledRows(emptyRows(unsettledSchemes, permissions));

      await Promise.all(
        allowed.map(async (scheme) => {
          try {
            const result = await fetchQueuePage(
              token,
              "/settlement/unsettled",
              scheme.path,
              todayDateParam,
              todayDateParam,
              controller.signal,
            );
            if (controller.signal.aborted) return;
            setUnsettledRows((prev) =>
              prev.map((row) =>
                row.id === scheme.id
                  ? {
                      ...row,
                      count: result.count,
                      amount: result.amount,
                      hasMore: result.hasMore,
                      loading: false,
                      error: null,
                    }
                  : row,
              ),
            );
          } catch {
            if (controller.signal.aborted) return;
            setUnsettledRows((prev) =>
              prev.map((row) =>
                row.id === scheme.id
                  ? {
                      ...row,
                      loading: false,
                      error: "Could not load",
                    }
                  : row,
              ),
            );
          }
        }),
      );
    };

    const loadEj = async () => {
      if (!canViewEj) {
        setEj(null);
        setEjLoading(false);
        return;
      }
      setEjLoading(true);
      setEjError(null);
      try {
        const response = await api.get<{ data: EJCoverageResult }>(
          "/reports/ej-coverage",
          {
            ...withAuthHeader(token),
            params: { dateFrom: todayDateParam, dateTo: todayDateParam },
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;
        setEj(response.data.data ?? null);
      } catch {
        if (controller.signal.aborted) return;
        setEjError("Could not load EJ coverage");
        setEj(null);
      } finally {
        if (!controller.signal.aborted) setEjLoading(false);
      }
    };

    void loadUncleared();
    void loadUnsettled();
    void loadEj();

    return () => controller.abort();
  }, [
    authUser,
    canViewClearing,
    canViewEj,
    canViewSettlement,
    unclearedDateParam,
    todayDateParam,
    permissions,
  ]);

  const unclearedLoading = unclearedRows.some((row) => row.loading);
  const unsettledLoading = unsettledRows.some((row) => row.loading);

  const unclearedTotalCount = unclearedRows.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const unclearedTotalAmount = unclearedRows.reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  const unclearedHasMore = unclearedRows.some((row) => row.hasMore);

  const unsettledTotalCount = unsettledRows.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const unsettledTotalAmount = unsettledRows.reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  const unsettledHasMore = unsettledRows.some((row) => row.hasMore);

  const ejSynced = ej?.focus?.synced ?? 0;
  const ejMissing = ej?.focus?.missing ?? 0;
  const ejActive = ej?.totalActive ?? 0;
  const ejCoveragePct =
    ejActive > 0 ? Math.round((ejSynced / ejActive) * 100) : 0;

  const showQueues = canViewClearing || canViewSettlement;

  return (
    <div className="space-y-8">
      {showQueues ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Clearing and settlement
            </h2>
            <p className="text-sm text-muted-foreground">
              Uncleared uses yesterday ({unclearedDayLabel}); unsettled uses
              today. Drill into a hub for the full list.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {canViewClearing ? (
              <>
                <MetricCard
                  label="Uncleared items"
                  value={
                    unclearedLoading
                      ? "-"
                      : formatCountMaybeMore(
                          unclearedTotalCount,
                          unclearedHasMore,
                        )
                  }
                  hint={
                    unclearedLoading
                      ? `Loading uncleared for ${unclearedDayLabel}`
                      : `From ${unclearedDayLabel} (today still clearing)`
                  }
                  icon={Inbox}
                  loading={unclearedLoading}
                  to="/clearing/uncleared"
                />
                <MetricCard
                  label="Uncleared amount"
                  value={
                    unclearedLoading ? "-" : formatAmount(unclearedTotalAmount)
                  }
                  hint={`Sum of loaded rows for ${unclearedDayLabel}`}
                  icon={Scale}
                  loading={unclearedLoading}
                  to="/clearing/uncleared"
                />
              </>
            ) : null}
            {canViewSettlement ? (
              <>
                <MetricCard
                  label="Unsettled items"
                  value={
                    unsettledLoading
                      ? "-"
                      : formatCountMaybeMore(
                          unsettledTotalCount,
                          unsettledHasMore,
                        )
                  }
                  hint={
                    unsettledLoading
                      ? "Loading today's unsettled queue"
                      : "Across schemes you can view"
                  }
                  icon={CircleAlert}
                  loading={unsettledLoading}
                  to="/settlement/unsettled"
                />
                <MetricCard
                  label="Unsettled amount"
                  value={
                    unsettledLoading ? "-" : formatAmount(unsettledTotalAmount)
                  }
                  hint="Sum of loaded unsettled rows"
                  icon={Wallet}
                  loading={unsettledLoading}
                  to="/settlement/unsettled"
                />
              </>
            ) : null}
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            {canViewClearing ? (
              <QueueTable
                title="Uncleared by scheme"
                description={`Still waiting to clear from ${unclearedDayLabel}`}
                href="/clearing/uncleared"
                rows={unclearedRows}
                emptyLabel="No uncleared schemes in your role"
                footnoteDay={unclearedDayLabel}
              />
            ) : null}
            {canViewSettlement ? (
              <QueueTable
                title="Unsettled by scheme"
                description="Items still waiting to settle"
                href="/settlement/unsettled"
                rows={unsettledRows}
                emptyLabel="No unsettled schemes in your role"
              />
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {canViewClearing ? (
              <>
                <NavLink to="/clearing/uncleared" className="min-w-0">
                  <Card className="h-full gap-2 py-4 transition-colors hover:bg-accent/40">
                    <CardHeader className="px-4">
                      <CardTitle className="text-base">Uncleared hub</CardTitle>
                      <CardDescription>
                        Work the open clearing queue
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </NavLink>
                <NavLink to="/clearing/cleared" className="min-w-0">
                  <Card className="h-full gap-2 py-4 transition-colors hover:bg-accent/40">
                    <CardHeader className="px-4">
                      <CardTitle className="text-base">Cleared hub</CardTitle>
                      <CardDescription>
                        Review posted clearing items
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </NavLink>
              </>
            ) : null}
            {canViewSettlement ? (
              <>
                <NavLink to="/settlement/unsettled" className="min-w-0">
                  <Card className="h-full gap-2 py-4 transition-colors hover:bg-accent/40">
                    <CardHeader className="px-4">
                      <CardTitle className="text-base">Unsettled hub</CardTitle>
                      <CardDescription>
                        Work the open settlement queue
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </NavLink>
                <NavLink to="/settlement/settled" className="min-w-0">
                  <Card className="h-full gap-2 py-4 transition-colors hover:bg-accent/40">
                    <CardHeader className="px-4">
                      <CardTitle className="text-base">Settled hub</CardTitle>
                      <CardDescription>
                        Review settled scheme items
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </NavLink>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {canViewEj ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Electronic journal
            </h2>
            <p className="text-sm text-muted-foreground">
              ATM journal sync coverage for today
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Active ATMs"
              value={ejLoading ? "-" : formatCount(ejActive)}
              hint="Terminals expected to report journals"
              icon={ChartBar}
              loading={ejLoading}
              to="/ej-coverage"
            />
            <MetricCard
              label="Synced today"
              value={ejLoading ? "-" : formatCount(ejSynced)}
              hint="Terminals with indexed journals"
              icon={FileSearch}
              loading={ejLoading}
              to="/ej-coverage"
            />
            <MetricCard
              label="Missing today"
              value={ejLoading ? "-" : formatCount(ejMissing)}
              hint={ejError || "Terminals without today's journal"}
              icon={CircleAlert}
              loading={ejLoading}
              to="/ej-coverage"
            />
            <MetricCard
              label="Coverage"
              value={ejLoading ? "-" : `${ejCoveragePct}%`}
              hint="Synced share of active ATMs"
              icon={ChartBar}
              loading={ejLoading}
              to="/ej-coverage"
            />
          </div>

          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Today&apos;s sync mix</CardTitle>
                  <CardDescription>
                    {ejLoading
                      ? "Loading coverage"
                      : ej
                        ? `${formatCount(ejSynced)} synced of ${formatCount(ejActive)} active ATMs`
                        : ejError || "Coverage unavailable"}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <NavLink to="/ej-coverage">
                    View coverage
                    <ArrowRight />
                  </NavLink>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4">
              {ejLoading ? (
                <Skeleton className="h-2.5 w-full" />
              ) : (
                <>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${Math.min(ejCoveragePct, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>Synced {ejCoveragePct}%</span>
                    <span>Missing {Math.max(0, 100 - ejCoveragePct)}%</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <NavLink to="/ej-finder" className="min-w-0">
              <Card className="h-full gap-2 py-4 transition-colors hover:bg-accent/40">
                <CardHeader className="px-4">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Search className="size-4" />
                  </div>
                  <CardTitle className="text-base">EJ Finder</CardTitle>
                  <CardDescription>
                    Search ATM electronic journal transactions
                  </CardDescription>
                </CardHeader>
              </Card>
            </NavLink>
            <NavLink to="/ej-coverage" className="min-w-0">
              <Card className="h-full gap-2 py-4 transition-colors hover:bg-accent/40">
                <CardHeader className="px-4">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ChartBar className="size-4" />
                  </div>
                  <CardTitle className="text-base">EJ Coverage</CardTitle>
                  <CardDescription>
                    Compare journal sync across terminals and days
                  </CardDescription>
                </CardHeader>
              </Card>
            </NavLink>
          </div>
        </section>
      ) : null}

      {canSearchSwitch || canExport ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Recon tools
            </h2>
            <p className="text-sm text-muted-foreground">
              Look up and export switch transactions
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {canSearchSwitch ? (
              <NavLink to="/switch-transaction-search" className="min-w-0">
                <Card className="h-full gap-2 py-4 transition-colors hover:bg-accent/40">
                  <CardHeader className="px-4">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Search className="size-4" />
                    </div>
                    <CardTitle className="text-base">
                      Switch transaction search
                    </CardTitle>
                    <CardDescription>
                      Find IST switch log rows by RRN, card, or route
                    </CardDescription>
                  </CardHeader>
                </Card>
              </NavLink>
            ) : null}
            {canExport ? (
              <NavLink to="/terminal-recon-export" className="min-w-0">
                <Card className="h-full gap-2 py-4 transition-colors hover:bg-accent/40">
                  <CardHeader className="px-4">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Download className="size-4" />
                    </div>
                    <CardTitle className="text-base">
                      Switch / Cortex export
                    </CardTitle>
                    <CardDescription>
                      Download approved transactions for reconciliation
                    </CardDescription>
                  </CardHeader>
                </Card>
              </NavLink>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

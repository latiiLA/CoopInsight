import { ListTree } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { DateRange } from "react-day-picker";

import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SuccessBrowseOutcome,
  SuccessChannel,
  SuccessFlow,
  SuccessRateRow,
  SuccessTransactionReport,
} from "@/types/report";
import { AcquiringOutcomePie } from "./acquiring-outcome-pie";
import { buildDeclineColumns } from "./columns";
import { DeclineReasonsPie } from "./decline-reasons-pie";

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
  loading,
  actionLabel,
  onAction,
}: {
  label: string;
  value: string;
  hint: string;
  loading: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-2">
          <CardDescription>{label}</CardDescription>
          {onAction ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={loading}
              onClick={onAction}
            >
              <ListTree className="size-3.5" />
              {actionLabel ?? "Browse"}
            </Button>
          ) : null}
        </div>
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

function ChartSkeleton({ title }: { title: string }) {
  return (
    <Card className="h-[28rem] py-4">
      <CardHeader className="px-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="px-4">
        <Skeleton className="h-64 w-full" />
        <p className="sr-only">Loading {title}</p>
      </CardContent>
    </Card>
  );
}

/** Stand-in for a chart with no data, so the page never implies it is loading. */
function EmptyChart({ title, message }: { title: string; message: string }) {
  return (
    <Card className="h-[28rem] py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
          {message}
        </p>
      </CardContent>
    </Card>
  );
}

type PageCopy = {
  title: string;
  subtitle: string;
  label: string;
  rateLabel: string;
  searchPlaceholder: string;
  exportFileName: string;
};

const pageCopy: Partial<Record<`${SuccessChannel}-${SuccessFlow}`, PageCopy>> = {
  "atm-overall": {
    title: "ATM Overall Success Rate",
    subtitle: "On-us, off-us, and issuing ATM authorizations",
    label: "ATM overall",
    rateLabel: "ATM overall success rate",
    searchPlaceholder: "Search ATM overall declined reasons...",
    exportFileName: "atm-overall-success-rate",
  },
  "atm-onus": {
    title: "ATM On-us Success Rate",
    subtitle: "CoopBank cards on CoopBank ATMs",
    label: "ATM on-us",
    rateLabel: "ATM on-us success rate",
    searchPlaceholder: "Search ATM on-us declined reasons...",
    exportFileName: "atm-onus-success-rate",
  },
  "atm-offus": {
    title: "ATM Off-us Success Rate",
    subtitle: "Other bank cards on CoopBank ATMs",
    label: "ATM off-us",
    rateLabel: "ATM off-us success rate",
    searchPlaceholder: "Search ATM off-us declined reasons...",
    exportFileName: "atm-offus-success-rate",
  },
  "atm-issuing": {
    title: "ATM Issuing Success Rate",
    subtitle: "CoopBank cards on other bank ATMs",
    label: "ATM issuing",
    rateLabel: "ATM issuing success rate",
    searchPlaceholder: "Search ATM issuing declined reasons...",
    exportFileName: "atm-issuing-success-rate",
  },
  "atm-acquiring": {
    title: "ATM Acquiring Success Rate",
    subtitle: "On-us and off-us ATM authorizations",
    label: "ATM acquiring",
    rateLabel: "ATM acquiring success rate",
    searchPlaceholder: "Search ATM acquiring declined reasons...",
    exportFileName: "atm-acquiring-success-rate",
  },
  "pos-overall": {
    title: "POS Overall Success Rate",
    subtitle: "On-us, off-us, and issuing POS authorizations",
    label: "POS overall",
    rateLabel: "POS overall success rate",
    searchPlaceholder: "Search POS overall declined reasons...",
    exportFileName: "pos-overall-success-rate",
  },
  "pos-onus": {
    title: "POS On-us Success Rate",
    subtitle: "CoopBank cards on CoopBank POS terminals",
    label: "POS on-us",
    rateLabel: "POS on-us success rate",
    searchPlaceholder: "Search POS on-us declined reasons...",
    exportFileName: "pos-onus-success-rate",
  },
  "pos-offus": {
    title: "POS Off-us Success Rate",
    subtitle: "Other bank cards on CoopBank POS terminals",
    label: "POS off-us",
    rateLabel: "POS off-us success rate",
    searchPlaceholder: "Search POS off-us declined reasons...",
    exportFileName: "pos-offus-success-rate",
  },
  "pos-issuing": {
    title: "POS Issuing Success Rate",
    subtitle: "CoopBank cards on other bank POS terminals",
    label: "POS issuing",
    rateLabel: "POS issuing success rate",
    searchPlaceholder: "Search POS issuing declined reasons...",
    exportFileName: "pos-issuing-success-rate",
  },
  "pos-acquiring": {
    title: "POS Acquiring Success Rate",
    subtitle: "On-us and off-us POS authorizations",
    label: "POS acquiring",
    rateLabel: "POS acquiring success rate",
    searchPlaceholder: "Search POS acquiring declined reasons...",
    exportFileName: "pos-acquiring-success-rate",
  },
  "switch-overall": {
    title: "Switch Overall Success Rate",
    subtitle: "On-us, off-us, and issuing across ATM and POS",
    label: "Switch overall",
    rateLabel: "Switch overall success rate",
    searchPlaceholder: "Search switch overall declined reasons...",
    exportFileName: "switch-overall-success-rate",
  },
  "switch-onus": {
    title: "Switch On-us Success Rate",
    subtitle: "CoopBank cards on CoopBank ATM and POS terminals",
    label: "Switch on-us",
    rateLabel: "Switch on-us success rate",
    searchPlaceholder: "Search switch on-us declined reasons...",
    exportFileName: "switch-onus-success-rate",
  },
  "switch-offus": {
    title: "Switch Off-us Success Rate",
    subtitle: "Other bank cards on CoopBank ATM and POS terminals",
    label: "Switch off-us",
    rateLabel: "Switch off-us success rate",
    searchPlaceholder: "Search switch off-us declined reasons...",
    exportFileName: "switch-offus-success-rate",
  },
  "switch-issuing": {
    title: "Switch Issuing Success Rate",
    subtitle: "CoopBank cards on other bank ATM and POS terminals",
    label: "Switch issuing",
    rateLabel: "Switch issuing success rate",
    searchPlaceholder: "Search switch issuing declined reasons...",
    exportFileName: "switch-issuing-success-rate",
  },
};

export function getSuccessRateCopy(channel: SuccessChannel, flow: SuccessFlow): PageCopy {
  return pageCopy[`${channel}-${flow}`] ?? pageCopy["atm-overall"]!;
}

export type SuccessRateBrowseRequest = {
  outcome: SuccessBrowseOutcome;
  respCode?: string;
  respLabel?: string;
};

/**
 * The success-rate dashboard body: header, metric cards, outcome and decline
 * pies, and the decline-reason table. Data loading lives in the caller, so the
 * logged-in page and the Grafana embed render exactly the same UI.
 *
 * Browse actions only appear when `onBrowse` is given; the embed omits it
 * because transaction-level browsing needs a user session.
 */
export function SuccessRateView({
  channel,
  flow,
  report,
  loading,
  dateRange,
  onDateChange,
  onBrowse,
  headerActions,
  emptyMessage = "No transactions for the selected dates.",
}: {
  channel: SuccessChannel;
  flow: SuccessFlow;
  report: SuccessTransactionReport | null;
  loading: boolean;
  dateRange: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  onBrowse?: (request: SuccessRateBrowseRequest) => void;
  headerActions?: ReactNode;
  emptyMessage?: string;
}) {
  const copy = getSuccessRateCopy(channel, flow);

  const declinedCount = report?.declinedCount ?? 0;
  const tableData: SuccessRateRow[] = useMemo(
    () =>
      (report?.declineReasons ?? []).map((reason) => ({
        ...reason,
        id: reason.code,
        sharePercent: declinedCount > 0 ? (reason.count / declinedCount) * 100 : 0,
      })),
    [report, declinedCount],
  );

  const declineColumns = useMemo(
    () =>
      buildDeclineColumns({
        canBrowse: !!onBrowse,
        onBrowse: (row) =>
          onBrowse?.({
            outcome: "declined",
            respCode: row.code,
            respLabel: row.label,
          }),
      }),
    [onBrowse],
  );

  const browse = (outcome: SuccessBrowseOutcome) =>
    onBrowse ? () => onBrowse({ outcome }) : undefined;

  return (
    <div className="container mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 py-1">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{copy.title}</h3>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onBrowse ? (
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => onBrowse({ outcome: "all" })}
            >
              <ListTree className="size-4" />
              Browse transactions
            </Button>
          ) : null}
          {headerActions}
          <DatePickerWithRange date={dateRange} onDateChange={onDateChange} />
        </div>
      </div>

      <div className="grid gap-4 py-2 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total transactions"
          value={report ? formatCount(report.totalTransactions) : "—"}
          hint={`Amount ${report ? formatAmount(report.totalAmount) : "—"}`}
          loading={loading}
          onAction={browse("all")}
        />
        <MetricCard
          label="Approved"
          value={report ? formatCount(report.approvedCount) : "—"}
          hint={`Amount ${report ? formatAmount(report.approvedAmount) : "—"}`}
          loading={loading}
          onAction={browse("approved")}
        />
        <MetricCard
          label="Declined"
          value={report ? formatCount(report.declinedCount) : "—"}
          hint={`Amount ${report ? formatAmount(report.declinedAmount) : "—"}`}
          loading={loading}
          onAction={browse("declined")}
        />
        <MetricCard
          label={copy.rateLabel}
          value={report ? `${report.successRatePercent.toFixed(2)}%` : "—"}
          hint={
            report
              ? `${report.dateFrom} - ${report.dateTo}`
              : loading
                ? "Loading today's report"
                : "No report for the selected dates"
          }
          loading={loading}
        />
      </div>

      <div className="grid min-w-0 gap-4 py-2 lg:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton title={`${copy.label} outcome`} />
            <ChartSkeleton title={`${copy.label} decline reasons`} />
          </>
        ) : !report ? (
          /* Reached when no report matches the selected filters, for example
             after the range changed again while a request was still in flight.
             An empty state rather than a skeleton, so the page never appears to
             be loading forever. */
          <>
            <EmptyChart title={`${copy.label} outcome`} message={emptyMessage} />
            <EmptyChart title={`${copy.label} decline reasons`} message={emptyMessage} />
          </>
        ) : (
          <>
            <AcquiringOutcomePie
              label={copy.label}
              approvedCount={report.approvedCount}
              declinedCount={declinedCount}
              compact
            />
            <DeclineReasonsPie
              label={copy.label}
              rows={tableData}
              declinedCount={declinedCount}
              compact
            />
          </>
        )}
      </div>

      <DataTable
        loading={loading}
        columns={declineColumns}
        data={loading ? [] : tableData}
        searchPlaceholder={copy.searchPlaceholder}
        exportFileName={copy.exportFileName}
      />
    </div>
  );
}

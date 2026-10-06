import { ArrowUpRight } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SuccessTransactionReport } from "@/types/report";

import { EmbedErrorBanner } from "./error-banner";
import type { EmbedError } from "./errors";

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatRangeLabel(from: string, to: string) {
  const start = parseISO(from);
  if (from === to) return format(start, "d MMM yyyy");
  const end = parseISO(to);
  return start.getFullYear() === end.getFullYear()
    ? `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`
    : `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`;
}

/** Cyan above 95, green above 90, amber otherwise. */
function rateBand(rate: number): "cyan" | "green" | "amber" {
  if (rate > 95) return "cyan";
  if (rate > 90) return "green";
  return "amber";
}

const RATE_TEXT = {
  cyan: "text-cyan-400",
  green: "text-emerald-500",
  amber: "text-amber-400",
} as const;

const RATE_BAR = {
  cyan: "bg-cyan-400",
  green: "bg-emerald-500",
  amber: "bg-amber-400",
} as const;

/**
 * Compact switch-overall KPI tile. Title opens the Grafana panel from
 * `panel=` + `viewPanel=` (target=_top so it replaces the dashboard, not this iframe).
 */
export function SwitchOverallSummary({
  report,
  loading,
  range,
  href,
  error,
  onRetry,
}: {
  report: SuccessTransactionReport | null;
  loading: boolean;
  range: { from: string; to: string };
  href: string;
  error: EmbedError | null;
  onRetry?: () => void;
}) {
  const rate = report?.successRatePercent ?? 0;
  const band = rateBand(rate);

  const title = href ? (
    <a
      href={href}
      target="_top"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-0.5 text-[13px] font-medium tracking-tight text-primary hover:underline"
    >
      <span className="truncate">Switch overall</span>
      <ArrowUpRight className="size-3.5 shrink-0 opacity-80" aria-hidden />
    </a>
  ) : (
    <span className="text-[13px] font-medium tracking-tight">Switch overall</span>
  );

  return (
    <main className="flex h-svh min-h-0 items-start justify-center bg-transparent p-1.5 text-foreground">
      {error && !report ? (
        <EmbedErrorBanner error={error} hasData={false} onRetry={onRetry} />
      ) : (
        <section className="flex w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card/95 px-3.5 py-2.5 text-card-foreground shadow-sm">
          <header className="mb-2 flex items-baseline justify-between gap-2">
            {title}
            <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatRangeLabel(range.from, range.to)}
            </p>
          </header>

          {loading ? (
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-1 w-full rounded-full" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
            </div>
          ) : !report ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No transactions in this range
            </p>
          ) : (
            <div className="flex flex-col">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Success rate
              </p>
              <p
                className={`text-[2rem] font-semibold leading-none tracking-tight tabular-nums ${RATE_TEXT[band]}`}
              >
                {rate.toFixed(2)}
                <span className="ml-0.5 align-top text-sm font-medium opacity-80">%</span>
              </p>
              <div
                className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`Success rate ${rate.toFixed(2)} percent`}
              >
                <div
                  className={`h-full rounded-full ${RATE_BAR[band]}`}
                  style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                />
              </div>

              <dl className="mt-2 divide-y divide-border/70">
                <Stat label="Total transactions" value={formatCount(report.totalTransactions)} />
                <Stat
                  label="Approved"
                  value={formatCount(report.approvedCount)}
                  swatch="bg-emerald-500"
                  tone="text-emerald-500"
                />
                <Stat
                  label="Declined"
                  value={formatCount(report.declinedCount)}
                  swatch="bg-red-500"
                  tone="text-red-500"
                />
              </dl>
            </div>
          )}

          {error && report ? (
            <p className="mt-1.5 truncate text-[11px] text-destructive">
              {error.message}
              {onRetry ? (
                <>
                  {" "}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[11px]"
                    onClick={onRetry}
                  >
                    Retry
                  </Button>
                </>
              ) : null}
            </p>
          ) : null}
        </section>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
  swatch,
}: {
  label: string;
  value: string;
  tone?: string;
  swatch?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
        {swatch ? <span className={`size-1.5 shrink-0 rounded-full ${swatch}`} /> : null}
        {label}
      </dt>
      <dd className={`text-[14px] font-semibold tabular-nums ${tone ?? "text-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}

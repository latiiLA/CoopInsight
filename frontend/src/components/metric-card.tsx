import type { ComponentType } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  /** Secondary line under the value, e.g. how the figure was derived. */
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  loading?: boolean;
  onClick?: () => void;
  /** Rendered under the hint, only when the card is interactive. */
  drillHint?: string;
  /** Shorter padding and value size — same card look, less height. */
  compact?: boolean;
};

/**
 * A single headline figure with an icon, used in the KPI row above a chart.
 *
 * When `onClick` is supplied the whole card becomes a button, so it must stay a
 * single self-contained action: nested interactive elements inside a button are
 * invalid, so drill-down affordances belong in `drillHint` as plain text.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  loading = false,
  onClick,
  drillHint,
  compact = false,
}: MetricCardProps) {
  const interactive = Boolean(onClick);
  const showFooter =
    Boolean(drillHint) || Boolean(hint) || (loading && Boolean(hint));

  return (
    <Card
      className={cn(
        compact ? "gap-1.5 py-2.5" : "gap-3 py-4",
        interactive &&
          "cursor-pointer transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      )}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `View cards behind ${label}` : undefined}
    >
      <CardHeader className={cn(compact ? "gap-1 px-3" : "px-4")}>
        <div className="flex items-start justify-between gap-2">
          <CardDescription className={compact ? "text-xs" : undefined}>
            {label}
          </CardDescription>
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
              compact ? "size-6" : "size-8",
            )}
          >
            <Icon className={compact ? "size-3.5" : "size-4"} />
          </div>
        </div>
        {loading ? (
          <Skeleton className={cn(compact ? "h-6 w-16" : "h-8 w-20")} />
        ) : (
          <CardTitle
            className={cn(
              "tabular-nums",
              compact ? "text-lg leading-tight" : "text-2xl",
            )}
          >
            {value}
          </CardTitle>
        )}
      </CardHeader>
      {showFooter ? (
        <CardContent
          className={cn(
            "text-muted-foreground",
            compact ? "px-3 text-xs leading-snug" : "px-4 text-sm",
          )}
        >
          {loading && hint ? (
            <Skeleton className={cn(compact ? "h-3 w-24" : "h-4 w-28")} />
          ) : (
            hint
          )}
          {!loading && drillHint ? (
            <div className="mt-1 text-xs text-primary/80">{drillHint}</div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

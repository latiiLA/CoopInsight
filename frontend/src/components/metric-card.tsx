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
  hint: string;
  icon: ComponentType<{ className?: string }>;
  loading?: boolean;
  onClick?: () => void;
  /** Rendered under the hint, only when the card is interactive. */
  drillHint?: string;
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
}: MetricCardProps) {
  const interactive = Boolean(onClick);

  return (
    <Card
      className={cn(
        "gap-3 py-4",
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
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-3">
          <CardDescription>{label}</CardDescription>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        )}
      </CardHeader>
      <CardContent className="px-4 text-sm text-muted-foreground">
        {loading ? <Skeleton className="h-4 w-28" /> : hint}
        {!loading && drillHint ? (
          <div className="mt-1 text-xs text-primary/80">{drillHint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

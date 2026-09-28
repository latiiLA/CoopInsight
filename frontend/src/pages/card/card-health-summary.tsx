import { Ban, CheckCircle2, CircleSlash, Clock, Layers } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  CARD_HEALTH_LABELS,
  CARD_HEALTH_ORDER,
  CardHealth,
  CardStatusReport,
} from "@/types/card-status-report";

/**
 * Health band styling. "other" is deliberately muted: an unclassified status is
 * a gap in our mapping, and it should not draw the eye the way a real problem
 * band does.
 */
const HEALTH_STYLE: Record<
  CardHealth,
  { icon: ComponentType<{ className?: string }>; tone: string }
> = {
  active: { icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
  notActive: { icon: Clock, tone: "text-amber-600 dark:text-amber-400" },
  blocked: { icon: Ban, tone: "text-orange-600 dark:text-orange-400" },
  dead: { icon: CircleSlash, tone: "text-destructive" },
  other: { icon: CircleSlash, tone: "text-muted-foreground" },
};

export type HealthSummary = {
  total: number;
  byHealth: Record<CardHealth, { cards: number; sharePercent: number }>;
};

/** Totals each health band from the rows the report already returned. */
export function summariseHealth(rows: CardStatusReport[]): HealthSummary {
  const byHealth = {
    active: { cards: 0, sharePercent: 0 },
    notActive: { cards: 0, sharePercent: 0 },
    blocked: { cards: 0, sharePercent: 0 },
    dead: { cards: 0, sharePercent: 0 },
    other: { cards: 0, sharePercent: 0 },
  } satisfies Record<CardHealth, { cards: number; sharePercent: number }>;

  let total = 0;
  for (const row of rows) {
    const band = row.health in byHealth ? row.health : "other";
    byHealth[band].cards += row.cardCount;
    total += row.cardCount;
  }

  for (const band of CARD_HEALTH_ORDER) {
    byHealth[band].sharePercent =
      total > 0 ? (byHealth[band].cards / total) * 100 : 0;
  }

  return { total, byHealth };
}

type CardHealthSummaryProps = {
  rows: CardStatusReport[];
  /** Currently selected band, highlighted in the table. */
  selected?: CardHealth | null;
  onSelect?: (band: CardHealth) => void;
  /** Clears the band filter, returning the table to every status. */
  onClear?: () => void;
};

/**
 * Portfolio usability summary.
 *
 * Answers "how many cards cannot be used, and why" in one row, which the status
 * table alone does not: it lists statuses, not the share of the portfolio that
 * is workable. The leading "All cards" tile is the escape hatch back to the full
 * table, so the filter is never a one-way trip.
 */
export function CardHealthSummary({
  rows,
  selected,
  onSelect,
  onClear,
}: CardHealthSummaryProps) {
  const { total, byHealth } = summariseHealth(rows);

  if (total === 0) {
    return null;
  }

  // Anything that is not active is a card a customer cannot use right now.
  const unusable = total - byHealth.active.cards - byHealth.other.cards;
  const filtered = selected !== null && selected !== undefined;

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card
          role="button"
          tabIndex={0}
          aria-pressed={!filtered}
          onClick={onClear}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onClear?.();
            }
          }}
          className={cn(
            "gap-1 py-3 transition-colors",
            "cursor-pointer hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            !filtered && "border-primary/50 bg-muted",
          )}
        >
          <CardContent className="px-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                All cards
              </span>
              <Layers className="size-4 shrink-0 text-muted-foreground" />
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {total.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">
              {filtered ? "Show every status" : "No filter applied"}
            </div>
          </CardContent>
        </Card>

        {CARD_HEALTH_ORDER.map((band) => {
          const { icon: Icon, tone } = HEALTH_STYLE[band];
          const entry = byHealth[band];
          const interactive = Boolean(onSelect);
          const isSelected = selected === band;

          return (
            <Card
              key={band}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-pressed={interactive ? isSelected : undefined}
              onClick={interactive ? () => onSelect?.(band) : undefined}
              onKeyDown={
                interactive
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect?.(band);
                      }
                    }
                  : undefined
              }
              className={cn(
                "gap-1 py-3 transition-colors",
                interactive &&
                  "cursor-pointer hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isSelected && "border-primary/50 bg-muted",
                entry.cards === 0 && "opacity-60",
              )}
            >
              <CardContent className="px-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {CARD_HEALTH_LABELS[band]}
                  </span>
                  <Icon className={cn("size-4 shrink-0", tone)} />
                </div>
                <div
                  className={cn(
                    "mt-1 text-2xl font-semibold tabular-nums",
                    tone,
                  )}
                >
                  {entry.cards.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {entry.sharePercent.toFixed(1)}% of portfolio
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {unusable.toLocaleString()} card
        {unusable === 1 ? "" : "s"} cannot be used right now (
        {total > 0 ? ((unusable / total) * 100).toFixed(1) : "0.0"}% of the
        portfolio). Select a band to filter the table, or All cards to clear it.
      </p>
    </div>
  );
}

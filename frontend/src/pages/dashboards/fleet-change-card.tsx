 import { type ComponentType, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

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
  FLEET_CHANGE_PERIODS,
  type DatedTerminal,
  type FleetChangePeriod,
  fleetChangeStats,
  formatSignedCount,
} from "@/lib/terminal-fleet-change";
import { cn } from "@/lib/utils";

export function FleetChangeCard({
  terminals,
  loading,
  label,
  icon: Icon,
  onClick,
}: {
  terminals: DatedTerminal[];
  loading: boolean;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
}) {
  const [period, setPeriod] = useState<FleetChangePeriod>("weekly");
  const stats = useMemo(
    () => fleetChangeStats(terminals, period),
    [period, terminals],
  );
  const phrase =
    FLEET_CHANGE_PERIODS.find((option) => option.key === period)?.phrase ??
    "this period";
  const ChangeIcon = stats.net < 0 ? TrendingDown : TrendingUp;

  return (
    <Card
      className={cn(
        "gap-1.5 py-2.5",
        onClick && "cursor-pointer transition-colors hover:border-primary/50",
      )}
      onClick={onClick}
    >
      <CardHeader className="gap-1 px-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardDescription className="text-xs">{label}</CardDescription>
          <div className="flex items-center gap-2">
            <div
              className="flex flex-wrap gap-1"
              onClick={(event) => event.stopPropagation()}
            >
              {FLEET_CHANGE_PERIODS.map((option) => (
                <Button
                  key={option.key}
                  type="button"
                  size="xs"
                  variant={period === option.key ? "default" : "outline"}
                  aria-pressed={period === option.key}
                  onClick={() => setPeriod(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-3.5" />
            </div>
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <CardTitle className="text-lg leading-tight tabular-nums">
            {stats.current.toLocaleString()}
          </CardTitle>
        )}
      </CardHeader>
      <CardContent className="px-3 text-xs leading-snug text-muted-foreground">
        {loading ? (
          <Skeleton className="h-3 w-56" />
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium tabular-nums",
                stats.net > 0 && "text-emerald-600 dark:text-emerald-400",
                stats.net < 0 && "text-destructive",
              )}
            >
              <ChangeIcon className="size-3.5" />
              {formatSignedCount(stats.net)} {phrase}
            </span>
            <span>
              {stats.added.toLocaleString()} added ·{" "}
              {stats.removed.toLocaleString()} relocated or stopped
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

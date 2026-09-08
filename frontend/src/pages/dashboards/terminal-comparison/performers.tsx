import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TerminalPerformanceRow } from "@/types/report";

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function TerminalPerformers({
  title,
  description,
  rows,
  loading,
  emptyLabel,
  onSelect,
}: {
  title: string;
  description: string;
  rows: TerminalPerformanceRow[];
  loading: boolean;
  emptyLabel: string;
  onSelect: (terminalId: string) => void;
}) {
  const max = Math.max(...rows.map((row) => row.transactionCount), 1);

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <ol className="space-y-2.5">
            {rows.map((row) => {
              const width = Math.max(
                (row.transactionCount / max) * 100,
                row.transactionCount > 0 ? 4 : 0,
              );

              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className="w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/50"
                    onClick={() => onSelect(row.terminalId)}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {row.rank}. {row.terminalId}
                        {row.terminalName ? ` · ${row.terminalName}` : ""}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums">
                        {formatCount(row.transactionCount)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatAmount(row.amount)}
                      {row.branchName ? ` · ${row.branchName}` : ""}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

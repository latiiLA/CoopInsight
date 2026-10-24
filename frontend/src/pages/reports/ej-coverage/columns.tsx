import { createColumnHelper } from "@tanstack/react-table";

import { type DataTableFeatures } from "@/components/data-table-features";
import type { EJCoverageTerminal } from "@/types/ej-coverage";
import { cn } from "@/lib/utils";

const columnHelper = createColumnHelper<
  DataTableFeatures,
  EJCoverageTerminal
>();

function dayLabel(isoDate: string) {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[1]}/${parts[2]}`;
}

export function createEjCoverageColumns(days: string[]) {
  const dayCols = days.map((day) =>
    columnHelper.display({
      id: `day-${day}`,
      header: dayLabel(day),
      cell: ({ row }) => {
        const cell = row.original.days?.[day];
        if (!cell?.synced) {
          return (
            <span className="text-muted-foreground" title="Missing">
              -
            </span>
          );
        }
        const txns = cell.txnCount ?? 0;
        return (
          <span
            className={cn(
              "font-medium text-emerald-700 dark:text-emerald-400",
            )}
            title={
              txns > 0
                ? `Synced: ${txns.toLocaleString()} transactions`
                : "Synced"
            }
          >
            {txns > 0 ? txns.toLocaleString() : "Yes"}
          </span>
        );
      },
    }),
  );

  return columnHelper.columns([
    columnHelper.accessor("terminalId", {
      header: "Terminal",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{getValue() || "-"}</span>
      ),
    }),
    columnHelper.accessor("terminalName", {
      header: "Name",
      cell: ({ getValue }) => getValue()?.trim() || "-",
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: ({ getValue }) => getValue()?.trim() || "-",
    }),
    ...dayCols,
  ]);
}

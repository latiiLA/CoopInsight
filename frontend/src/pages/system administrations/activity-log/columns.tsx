import { createColumnHelper } from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowUpDown } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import { ActivityLog } from "@/types/activity-log";

const columnHelper = createColumnHelper<DataTableFeatures, ActivityLog>();

function sortableHeader(label: string) {
  return ({
    column,
  }: {
    column: {
      toggleSorting: (asc: boolean) => void;
      getIsSorted: () => false | "asc" | "desc";
    };
  }) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

export function getColumns() {
  return columnHelper.columns([
    columnHelper.accessor("timestamp", {
      header: sortableHeader("Time"),
      cell: ({ getValue }) => {
        const value = getValue();
        const date = value ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) {
          return "—";
        }
        return format(date, "MMM d, yyyy HH:mm:ss");
      },
    }),
    columnHelper.accessor("actorUsername", {
      header: sortableHeader("Actor"),
      cell: ({ getValue }) => getValue() || "—",
    }),
    columnHelper.accessor("action", {
      header: sortableHeader("Action"),
    }),
    columnHelper.accessor("summary", {
      header: sortableHeader("Summary"),
    }),
    columnHelper.accessor("status", {
      header: sortableHeader("Status"),
      cell: ({ getValue }) => {
        const status = getValue();
        return (
          <span
            className={
              status === "failure"
                ? "text-destructive"
                : "text-muted-foreground"
            }
          >
            {status}
          </span>
        );
      },
    }),
    columnHelper.accessor("ip", {
      header: sortableHeader("IP"),
      cell: ({ getValue }) => getValue() || "—",
    }),
    columnHelper.accessor("traceId", {
      header: sortableHeader("Trace ID"),
      cell: ({ getValue }) => {
        const value = getValue();
        if (!value) {
          return "—";
        }
        return (
          <span className="font-mono text-xs" title={value}>
            {value.slice(0, 8)}…
          </span>
        );
      },
    }),
  ]);
}

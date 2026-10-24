import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown, BookOpen } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import type { EJTransaction } from "@/types/ej-transaction-search";

const columnHelper = createColumnHelper<DataTableFeatures, EJTransaction>();

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

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function createEjTxnSearchColumns(opts: {
  onOpenJournal: (row: EJTransaction) => void;
}) {
  return columnHelper.columns([
    columnHelper.accessor("ejDate", {
      header: sortableHeader("Date"),
    }),
    columnHelper.accessor("startTime", {
      header: sortableHeader("Time"),
    }),
    columnHelper.accessor("lineStart", {
      header: sortableHeader("EJ line"),
      cell: ({ row, getValue }) => {
        const start = getValue();
        const end = row.original.lineEnd;
        if (!start) return "-";
        if (end && end !== start) return `${start}-${end}`;
        return String(start);
      },
    }),
    columnHelper.accessor("terminalId", {
      header: sortableHeader("Terminal"),
    }),
    columnHelper.accessor("cardMasked", {
      header: sortableHeader("Card"),
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() || "-"}</span>
      ),
    }),
    columnHelper.accessor("amount", {
      header: sortableHeader("Amount"),
      cell: ({ getValue }) => formatAmount(getValue()),
    }),
    columnHelper.accessor("status", {
      header: sortableHeader("Status"),
      cell: ({ getValue }) => {
        const status = (getValue() || "").trim();
        if (!status) return "-";
        const ok = status.toUpperCase() === "SUCCESS";
        return (
          <span
            className={
              ok
                ? "rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                : "rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-400"
            }
          >
            {status}
          </span>
        );
      },
    }),
    columnHelper.accessor("respCode", {
      header: sortableHeader("Response"),
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() || "-"}</span>
      ),
    }),
    columnHelper.accessor("authNum", {
      header: sortableHeader("Auth"),
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() || "-"}</span>
      ),
    }),
    columnHelper.accessor("txnType", {
      header: sortableHeader("Type"),
      cell: ({ getValue }) => getValue() || "-",
    }),
    columnHelper.display({
      id: "openJournal",
      header: "Journal",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={(e) => {
            e.stopPropagation();
            opts.onOpenJournal(row.original);
          }}
        >
          <BookOpen className="mr-1.5 size-3.5" />
          Open journal
        </Button>
      ),
    }),
  ]);
}

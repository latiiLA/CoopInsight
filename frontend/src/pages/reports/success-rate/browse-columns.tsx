import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import { SuccessTransactionDetail } from "@/types/report";

const columnHelper = createColumnHelper<
  DataTableFeatures,
  SuccessTransactionDetail
>();

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const browseColumns = columnHelper.columns([
  columnHelper.accessor("txnAt", {
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  }),
  columnHelper.accessor("txnTime", {
    header: "Time",
  }),
  columnHelper.accessor("terminalId", {
    header: "Terminal",
  }),
  columnHelper.accessor("terminalLocation", {
    header: "Location",
  }),
  columnHelper.accessor("cardProduct", {
    header: "Product",
  }),
  columnHelper.accessor("respCode", {
    header: "Code",
  }),
  columnHelper.accessor("respLabel", {
    header: "Reason",
  }),
  columnHelper.accessor("outcome", {
    header: "Outcome",
    cell: ({ row }) => {
      const outcome = row.original.outcome;
      const className =
        outcome === "approved"
          ? "text-emerald-600 dark:text-emerald-400"
          : outcome === "reversed"
            ? "text-amber-600 dark:text-amber-400"
            : "text-destructive";
      return <span className={className}>{outcome}</span>;
    },
  }),
  columnHelper.accessor("amount", {
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Amount
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => formatAmount(row.original.amount),
  }),
  columnHelper.accessor("refNum", {
    header: "RRN",
  }),
  columnHelper.accessor("msgType", {
    header: "MTI",
  }),
]);

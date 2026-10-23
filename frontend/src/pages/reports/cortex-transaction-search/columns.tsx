import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import type { CortexTransaction } from "@/types/cortex-transaction-search";

const columnHelper = createColumnHelper<DataTableFeatures, CortexTransaction>();

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
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const cortexTxnSearchColumns = columnHelper.columns([
  columnHelper.accessor("date", {
    header: sortableHeader("Date"),
  }),
  columnHelper.accessor("time", {
    header: "Time",
  }),
  columnHelper.accessor("rrn", {
    header: sortableHeader("RRN"),
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{getValue() || "-"}</span>
    ),
  }),
  columnHelper.accessor("cardMasked", {
    header: sortableHeader("Card"),
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{getValue()}</span>
    ),
  }),
  columnHelper.accessor("cardholderName", {
    header: sortableHeader("Cardholder"),
    cell: ({ getValue }) => getValue() || "-",
  }),
  columnHelper.accessor("productName", {
    header: sortableHeader("Product"),
    cell: ({ row, getValue }) =>
      getValue() || row.original.productCode || "-",
  }),
  columnHelper.accessor("terminalId", {
    header: sortableHeader("Terminal"),
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{getValue() || "-"}</span>
    ),
  }),
  columnHelper.accessor("merchantName", {
    header: sortableHeader("Merchant"),
    cell: ({ getValue }) => getValue() || "-",
  }),
  columnHelper.accessor("amount", {
    header: sortableHeader("Billing amount"),
    cell: ({ row, getValue }) => {
      const currency = row.original.currency?.trim();
      return (
        <span className="tabular-nums">
          {formatAmount(getValue())}
          {currency ? (
            <span className="ml-1 text-muted-foreground">{currency}</span>
          ) : null}
        </span>
      );
    },
  }),
  columnHelper.accessor("approved", {
    header: sortableHeader("Result"),
    cell: ({ row }) => {
      const approved = row.original.approved;
      return (
        <span
          className={
            approved
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-destructive"
          }
        >
          {approved ? "Approved" : "Declined"}
        </span>
      );
    },
  }),
  columnHelper.accessor("branchName", {
    header: sortableHeader("Branch"),
    cell: ({ row, getValue }) =>
      getValue() || row.original.branchCode || "-",
  }),
]);

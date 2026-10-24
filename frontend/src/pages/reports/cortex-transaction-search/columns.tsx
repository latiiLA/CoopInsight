import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import { formatMoneyWithCurrency } from "@/lib/iso-currency";
import { isReversalMsgType, msgTypeLabel } from "@/lib/msg-type";
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

export const cortexTxnSearchColumns = columnHelper.columns([
  columnHelper.accessor("date", {
    header: sortableHeader("Date"),
  }),
  columnHelper.accessor("time", {
    header: "Time",
  }),
  columnHelper.accessor("msgType", {
    header: "Type",
    size: 88,
    maxSize: 100,
    cell: ({ getValue }) => {
      const code = (getValue() || "").trim();
      if (!code) return "-";
      const label = msgTypeLabel(code);
      const reversal = isReversalMsgType(code);
      return (
        <span
          className={
            reversal
              ? "text-xs text-amber-700 dark:text-amber-400"
              : "text-xs text-muted-foreground"
          }
          title={code}
        >
          {label}
        </span>
      );
    },
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
    cell: ({ row, getValue }) => (
      <span className="tabular-nums">
        {formatMoneyWithCurrency(getValue(), row.original.currency)}
      </span>
    ),
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

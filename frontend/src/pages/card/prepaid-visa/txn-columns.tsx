import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { PrepaidVisaTransaction } from "@/types/prepaid-visa";

import {
  currencyLabel,
  formatMerchantLabel,
  formatUsd,
  isReversalMsgType,
  productLabel,
  txnResultLabel,
} from "./prepaid-visa-format";

const columnHelper = createColumnHelper<
  DataTableFeatures,
  PrepaidVisaTransaction
>();

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

export const txnColumns = columnHelper.columns([
  columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.accessor("date", {
    header: sortableHeader("Date"),
  }),
  columnHelper.accessor("time", {
    header: sortableHeader("Time"),
  }),
  columnHelper.accessor("cardMasked", {
    header: sortableHeader("Card"),
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{getValue()}</span>
    ),
  }),
  columnHelper.accessor("cardholderName", {
    header: sortableHeader("Cardholder"),
    cell: ({ getValue }) => getValue() || "—",
  }),
  columnHelper.accessor("productCode", {
    header: sortableHeader("Product"),
    cell: ({ getValue }) => productLabel(getValue()),
  }),
  columnHelper.accessor("merchantName", {
    header: sortableHeader("Merchant"),
    cell: ({ getValue }) => formatMerchantLabel(getValue()),
  }),
  columnHelper.accessor("amount", {
    header: sortableHeader("Amount"),
    cell: ({ row, getValue }) => {
      const bill = getValue();
      const txn = row.original.amountTxn;
      const txnCur = row.original.txnCurrency?.trim();
      const txnCurLabel = currencyLabel(txnCur);
      const showTxn =
        typeof txn === "number" &&
        txnCur &&
        txnCurLabel !== "USD" &&
        Math.abs(txn - bill) > 0.009;
      return (
        <div className="tabular-nums">
          <div>{formatUsd(bill)}</div>
          {showTxn ? (
            <div className="text-xs text-muted-foreground">
              {txn.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              {txnCurLabel || txnCur}
            </div>
          ) : null}
        </div>
      );
    },
  }),
  columnHelper.accessor("approved", {
    header: sortableHeader("Result"),
    cell: ({ row }) => {
      const label = txnResultLabel(row.original);
      if (isReversalMsgType(row.original.msgType)) {
        return (
          <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
            {label}
          </span>
        );
      }
      return row.original.approved ? (
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          {label}
        </span>
      ) : (
        <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
          {label}
        </span>
      );
    },
  }),
  columnHelper.accessor("rrn", {
    header: sortableHeader("RRN"),
  }),
  columnHelper.accessor("terminalId", {
    header: sortableHeader("Terminal"),
  }),
  columnHelper.accessor("availableAmount", {
    header: sortableHeader("Avail amt"),
    cell: ({ getValue }) => formatUsd(getValue()),
  }),
  columnHelper.accessor("blockedBalance", {
    header: sortableHeader("Blocked"),
    cell: ({ getValue }) => formatUsd(getValue()),
  }),
  columnHelper.accessor("fromAvailable", {
    header: sortableHeader("From avail"),
    cell: ({ getValue }) => formatUsd(getValue()),
  }),
  columnHelper.accessor("branchName", {
    header: sortableHeader("Branch"),
  }),
  columnHelper.accessor("txnCode", {
    header: sortableHeader("Txn type"),
  }),
]);

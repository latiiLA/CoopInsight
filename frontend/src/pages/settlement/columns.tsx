import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableFeatures } from "@/components/data-table-features";
import type { UnsettledProduct } from "@/features/unsettled_slice";
import { UnsettledTransaction } from "@/types/unsettled";

const columnHelper = createColumnHelper<
  DataTableFeatures,
  UnsettledTransaction
>();

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function MatchStatusCell({ row }: { row: { original: UnsettledTransaction } }) {
  const status = row.original.matchStatus;
  if (!status) return <span>{"\u2014"}</span>;
  const matched = status === "matched";
  return (
    <span
      title={row.original.matchNote}
      className={
        matched
          ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
          : "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
      }
    >
      {matched ? "Matched" : "No settlement"}
    </span>
  );
}

function MatchedSettlAmountCell({
  row,
}: {
  row: { original: UnsettledTransaction };
}) {
  const tx = row.original;
  if (tx.matchStatus !== "matched" || tx.matchedAmount == null) {
    return <span>{"\u2014"}</span>;
  }
  const isSum = tx.matchMode === "sum";
  // Primary = settlement amount that matched (txn-level for 1:1, subset total
  // for sum). On sum rows, also show this txn's clearing contribution.
  const clearing =
    tx.matchedClearingAmount != null
      ? tx.matchedClearingAmount
      : Math.abs(tx.amount);
  const titleParts = [
    tx.matchNote,
    isSum
      ? `Subset settlement total; this txn ${formatAmount(clearing)}`
      : "Txn-level settlement match",
    tx.matchedAmountField ? `PDS ${tx.matchedAmountField}` : "",
    tx.matchedFunctionCode ? `IPM ${tx.matchedFunctionCode}` : "",
  ].filter(Boolean);
  return (
    <span title={titleParts.join(" — ")} className="tabular-nums">
      {formatAmount(tx.matchedAmount)}
      {isSum ? (
        <span className="ml-1 text-xs text-muted-foreground">
          (txn {formatAmount(clearing)})
        </span>
      ) : null}
    </span>
  );
}

function FinancialPositionCell({
  row,
}: {
  row: { original: UnsettledTransaction };
}) {
  const tx = row.original;
  if (tx.financialPositionTotal == null) {
    return <span>{"\u2014"}</span>;
  }
  const field = tx.financialPositionField
    ? ` (PDS ${tx.financialPositionField})`
    : "";
  return (
    <span title={`685 Financial position${field}`} className="tabular-nums">
      {formatAmount(tx.financialPositionTotal)}
    </span>
  );
}

export function getUnsettledColumns(product: UnsettledProduct) {
  return columnHelper.columns([
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
    columnHelper.accessor("txnDate", {
      header: "Txn Date",
    }),
    ...(product === "VISA" || product === "VISACBS"
      ? [
          columnHelper.accessor("txnId", {
            header: "Txn ID",
          }),
        ]
      : []),
    columnHelper.accessor("time", {
      header: "Time",
    }),
    // columnHelper.accessor("msgType", {
    //   header: "Type",
    // }),
    columnHelper.accessor("rrn", {
      header: "Reference no.",
    }),
    columnHelper.accessor("stan", {
      header: "Trace no.",
    }),
    columnHelper.accessor("respCode", {
      header: "Response",
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
      cell: ({ getValue }) => formatAmount(getValue()),
    }),
    ...(product === "MDS"
      ? [
          columnHelper.accessor("matchStatus", {
            header: "Settlement match",
            cell: ({ row }) => <MatchStatusCell row={row} />,
          }),
          columnHelper.accessor("matchedSettlementDate", {
            header: "Matched settl. date",
            cell: ({ getValue }) => getValue() || "\u2014",
          }),
          columnHelper.accessor("matchedAmount", {
            header: "Matched settl. amount",
            cell: ({ row }) => <MatchedSettlAmountCell row={row} />,
          }),
          columnHelper.accessor("financialPositionTotal", {
            header: "Financial position total",
            cell: ({ row }) => <FinancialPositionCell row={row} />,
          }),
        ]
      : []),
    columnHelper.accessor("terminalId", {
      header: "Terminal ID",
    }),
    columnHelper.accessor("merchant", {
      header: "Merchant name",
      cell: ({ getValue }) => {
        const value = getValue() || "";
        return value.length > 36
          ? `${value.slice(0, 36)}\u2026`
          : value || "\u2014";
      },
    }),
    columnHelper.accessor("cardProduct", {
      header: "Card product",
    }),
    columnHelper.accessor("procCode", {
      header: "Processing code",
    }),
  ]);
}

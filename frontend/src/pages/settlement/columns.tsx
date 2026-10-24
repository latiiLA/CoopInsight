import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableFeatures } from "@/components/data-table-features";
import type { UnsettledProduct } from "@/features/unsettled_slice";
import { formatMoneyWithCurrency } from "@/lib/iso-currency";
import { UnsettledTransaction } from "@/types/unsettled";

const columnHelper = createColumnHelper<
  DataTableFeatures,
  UnsettledTransaction
>();

function MatchStatusCell({ row }: { row: { original: UnsettledTransaction } }) {
  const status = row.original.matchStatus;
  if (!status) return <span>-</span>;
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
    return <span>-</span>;
  }
  const isSum = tx.matchMode === "sum";
  // Primary = settlement amount that matched (txn-level for 1:1, subset total
  // for sum). On sum rows, also show this txn's clearing contribution.
  const clearing =
    tx.matchedClearingAmount != null
      ? tx.matchedClearingAmount
      : Math.abs(tx.amount);
  const money = (n: number) => formatMoneyWithCurrency(n, tx.currency);
  const titleParts = [
    tx.matchNote,
    isSum
      ? `Subset settlement total; this txn ${money(clearing)}`
      : "Txn-level settlement match",
    tx.matchedAmountField ? `PDS ${tx.matchedAmountField}` : "",
    tx.matchedFunctionCode ? `IPM ${tx.matchedFunctionCode}` : "",
  ].filter(Boolean);
  return (
    <span title={titleParts.join(". ")} className="tabular-nums">
      {money(tx.matchedAmount)}
      {isSum ? (
        <span className="ml-1 text-xs text-muted-foreground">
          (txn {money(clearing)})
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
    return <span>-</span>;
  }
  const field = tx.financialPositionField
    ? ` (PDS ${tx.financialPositionField})`
    : "";
  return (
    <span title={`685 Financial position${field}`} className="tabular-nums">
      {formatMoneyWithCurrency(tx.financialPositionTotal, tx.currency)}
    </span>
  );
}

function formatSettlementAmount(row: UnsettledTransaction) {
  const amount = row.settlementAmount;
  const currency = row.settlementCurrency;
  if ((!amount || amount === 0) && (!currency || currency === 0)) {
    return "-";
  }
  return formatMoneyWithCurrency(amount, currency);
}

export function getUnsettledColumns(product: UnsettledProduct) {
  const showSettlement = product === "MDS";

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
    columnHelper.accessor("rrn", {
      header: "Reference no.",
    }),
    columnHelper.accessor("stan", {
      header: "Trace no.",
    }),
    columnHelper.accessor("amount", {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {showSettlement ? "Source amount" : "Amount"}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row, getValue }) => (
        <span className="tabular-nums">
          {formatMoneyWithCurrency(getValue(), row.original.currency)}
        </span>
      ),
    }),
    ...(showSettlement
      ? [
          columnHelper.accessor("settlementAmount", {
            header: "Settlement amount",
            cell: ({ row }) => (
              <span className="tabular-nums">
                {formatSettlementAmount(row.original)}
              </span>
            ),
          }),
        ]
      : []),
    ...(product === "MDS"
      ? [
          columnHelper.accessor("matchStatus", {
            header: "Settlement match",
            cell: ({ row }) => <MatchStatusCell row={row} />,
          }),
          columnHelper.accessor("matchedSettlementDate", {
            header: "Matched settl. date",
            cell: ({ getValue }) => getValue() || "-",
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
          : value || "-";
      },
    }),
    columnHelper.accessor("cardProduct", {
      header: "Card product",
    }),
    columnHelper.accessor("respCode", {
      header: "Response",
    }),
    columnHelper.accessor("procCode", {
      header: "Processing code",
    }),
  ]);
}

import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown, ListTree } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  VisaSettlementBatchSummary,
  VisaSettlementTransaction,
} from "@/types/visa-settlement";

function formatAmount(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sortableHeader(
  label: string,
  column: {
    toggleSorting: (desc?: boolean) => void;
    getIsSorted: () => string | false;
  },
) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

const batchHelper = createColumnHelper<
  DataTableFeatures,
  VisaSettlementBatchSummary
>();

export function buildBatchColumns(
  onViewRecords?: (batch: VisaSettlementBatchSummary) => void,
) {
  const columns = [
    batchHelper.accessor("file_name", {
      header: ({ column }) => sortableHeader("File", column),
    }),
    batchHelper.accessor("total_records", {
      header: ({ column }) => sortableHeader("Records", column),
      cell: ({ row }) => row.original.total_records.toLocaleString(),
    }),
    batchHelper.display({
      id: "newRecords",
      header: "New",
      // Only meaningful once re-upload detection was in place; older summaries
      // have no split, so they fall back to the record total.
      cell: ({ row }) =>
        (
          row.original.inserted_records ?? row.original.total_records
        ).toLocaleString(),
      enableSorting: false,
    }),
    batchHelper.display({
      id: "skipped",
      header: "Skipped",
      cell: ({ row }) =>
        (row.original.duplicate_records ?? 0) > 0
          ? row.original.duplicate_records!.toLocaleString()
          : "0",
      enableSorting: false,
    }),
    batchHelper.accessor("status", {
      header: ({ column }) => sortableHeader("Status", column),
      cell: ({ row }) => {
        const status = row.original.status;
        // DUPLICATE is not a failure, so it is styled as neutral rather than
        // alarming the way FAILED does.
        const tone =
          status === "FAILED"
            ? "text-destructive"
            : status === "DUPLICATE"
              ? "text-muted-foreground"
              : "text-foreground";
        return <span className={`font-medium ${tone}`}>{status}</span>;
      },
    }),
    batchHelper.accessor("processed_at", {
      header: ({ column }) => sortableHeader("Processed", column),
      cell: ({ row }) => {
        const parsed = new Date(row.original.processed_at);
        return Number.isNaN(parsed.getTime())
          ? row.original.processed_at
          : parsed.toLocaleString();
      },
    }),
    batchHelper.display({
      id: "error",
      header: "Detail",
      cell: ({ row }) =>
        row.original.error_message ? (
          <span className="text-sm text-destructive">
            {row.original.error_message}
          </span>
        ) : null,
      enableSorting: false,
    }),
  ];

  if (onViewRecords) {
    columns.push(
      batchHelper.display({
        id: "viewRecords",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            disabled={row.original.total_records <= 0}
            onClick={() => onViewRecords(row.original)}
          >
            <ListTree className="size-4" />
            View records
          </Button>
        ),
        enableSorting: false,
      }),
    );
  }

  return batchHelper.columns(columns);
}

const txHelper = createColumnHelper<
  DataTableFeatures,
  VisaSettlementTransaction
>();

export function buildTransactionColumns() {
  return txHelper.columns([
    txHelper.display({
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
    txHelper.accessor("transaction_date", {
      header: ({ column }) => sortableHeader("Txn date", column),
      cell: ({ row }) =>
        row.original.transaction_date
          ? row.original.transaction_date.slice(0, 10)
          : "Not parsed",
    }),
    txHelper.accessor("merchant_name", {
      header: ({ column }) => sortableHeader("Merchant", column),
    }),
    txHelper.accessor("merchant_category_code", {
      header: ({ column }) => sortableHeader("MCC", column),
    }),
    txHelper.accessor("fee_descriptor", {
      header: ({ column }) => sortableHeader("Fee descriptor", column),
    }),
    txHelper.accessor("source_amount", {
      header: ({ column }) => sortableHeader("Source amt", column),
      cell: ({ row }) => formatAmount(row.original.source_amount),
    }),
    txHelper.accessor("settlement_amount", {
      header: ({ column }) => sortableHeader("Settlement", column),
      cell: ({ row }) => formatAmount(row.original.settlement_amount),
    }),
    txHelper.accessor("interchange_fee_amount", {
      header: ({ column }) => sortableHeader("Interchange fee", column),
      cell: ({ row }) => formatAmount(row.original.interchange_fee_amount),
    }),
    txHelper.accessor("terminal_id", {
      header: ({ column }) => sortableHeader("Terminal", column),
    }),
    txHelper.accessor("transaction_id", {
      header: ({ column }) => sortableHeader("Transaction ID", column),
    }),
    txHelper.accessor("account_number", {
      header: ({ column }) => sortableHeader("Account", column),
    }),
  ]);
}

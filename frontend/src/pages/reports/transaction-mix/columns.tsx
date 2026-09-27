import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { TransactionMixSlice } from "@/types/transaction-mix";

const columnHelper =
  createColumnHelper<DataTableFeatures, TransactionMixSlice & Record<string, unknown>>();

function formatCount(value: unknown) {
  return Number(value || 0).toLocaleString();
}

function formatAmount(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: unknown) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function SortableHeader({
  label,
  column,
}: {
  label: string;
  column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => string | false };
}) {
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

/**
 * Columns for a mix axis table.
 *
 * The reversal column is only added for the scheme and routing axes. On the
 * type axis the reversal row is itself a type, so repeating its rate inside
 * that row would be circular.
 */
export function buildMixColumns(options?: { showReversals?: boolean }) {
  const cols = [
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
    columnHelper.accessor("label", {
      header: ({ column }) => <SortableHeader label="Name" column={column} />,
    }),
    columnHelper.accessor("count", {
      header: ({ column }) => (
        <SortableHeader label="Messages" column={column} />
      ),
      cell: ({ row }) => formatCount(row.original.count),
    }),
    columnHelper.accessor("countPercent", {
      header: ({ column }) => (
        <SortableHeader label="Share of messages" column={column} />
      ),
      cell: ({ row }) => formatPercent(row.original.countPercent),
    }),
    columnHelper.accessor("amount", {
      header: ({ column }) => <SortableHeader label="Value" column={column} />,
      cell: ({ row }) => formatAmount(row.original.amount),
    }),
    columnHelper.accessor("amountPercent", {
      header: ({ column }) => (
        <SortableHeader label="Share of value" column={column} />
      ),
      cell: ({ row }) => formatPercent(row.original.amountPercent),
    }),
  ];

  if (options?.showReversals) {
    cols.push(
      columnHelper.accessor("reversalCount", {
        id: "reversalCount",
        header: ({ column }) => (
          <SortableHeader label="Reversals" column={column} />
        ),
        cell: ({ row }) => formatCount(row.original.reversalCount ?? 0),
      }),
      columnHelper.accessor("reversalPercent", {
        id: "reversalPercent",
        header: ({ column }) => (
          <SortableHeader label="Reversal rate" column={column} />
        ),
        cell: ({ row }) => formatPercent(row.original.reversalPercent ?? 0),
      }),
    );
  }

  return columnHelper.columns(cols);
}

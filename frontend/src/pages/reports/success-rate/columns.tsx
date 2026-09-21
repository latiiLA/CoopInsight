import { createColumnHelper } from "@tanstack/react-table";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ListTree } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SuccessRateRow } from "@/types/report";

const columnHelper = createColumnHelper<DataTableFeatures, SuccessRateRow>();

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatShare(value: number) {
  return `${value.toFixed(2)}%`;
}

export function buildDeclineColumns(options?: {
  canBrowse?: boolean;
  onBrowse?: (row: SuccessRateRow) => void;
}) {
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
    columnHelper.accessor("code", {
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Code
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    }),
    columnHelper.accessor("label", {
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Reason
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    }),
    columnHelper.accessor("count", {
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Count
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => formatCount(row.original.count),
    }),
    columnHelper.accessor("sharePercent", {
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Share
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => formatShare(row.original.sharePercent),
    }),
  ];

  if (options?.canBrowse && options.onBrowse) {
    cols.push(
      columnHelper.display({
        id: "browse",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            disabled={row.original.count <= 0}
            onClick={() => options.onBrowse?.(row.original)}
          >
            <ListTree className="size-4" />
            Browse
          </Button>
        ),
        enableSorting: false,
      }),
    );
  }

  return columnHelper.columns(cols);
}

export const columns = buildDeclineColumns();

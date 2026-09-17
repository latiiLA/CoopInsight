import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableFeatures } from "@/components/data-table-features";
import { UnclearedTransaction } from "@/types/uncleared";

const columnHelper = createColumnHelper<DataTableFeatures, UnclearedTransaction>();

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const unclearedColumns = columnHelper.columns([
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
  columnHelper.accessor("time", {
    header: "Time",
  }),
  columnHelper.accessor("msgType", {
    header: "Type",
  }),
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
  columnHelper.accessor("terminalId", {
    header: "Terminal ID",
  }),
  columnHelper.accessor("merchant", {
    header: "Merchant name",
    cell: ({ getValue }) => {
      const value = getValue() || "";
      return value.length > 36 ? `${value.slice(0, 36)}…` : value || "—";
    },
  }),
  columnHelper.accessor("cardProduct", {
    header: "Card product",
  }),
  columnHelper.accessor("procCode", {
    header: "Processing code",
  }),
]);

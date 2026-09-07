import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EbirrCardlessWithdrawal } from "@/types/report";

const columnHelper = createColumnHelper<
  DataTableFeatures,
  EbirrCardlessWithdrawal
>();

function sortableHeader(label: string) {
  return ({ column }: { column: { toggleSorting: (asc: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

export const columns = columnHelper.columns([
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
  columnHelper.accessor("rrn", {
    header: sortableHeader("RRN"),
  }),
  columnHelper.accessor("terminalId", {
    header: sortableHeader("Terminal ID"),
  }),
  columnHelper.accessor("terminalName", {
    header: sortableHeader("Terminal Name"),
  }),
  columnHelper.accessor("terminalLocation", {
    header: sortableHeader("Terminal Location"),
  }),
  columnHelper.accessor("amount", {
    header: sortableHeader("Amount"),
    cell: ({ getValue }) => getValue().toLocaleString(),
  }),
  columnHelper.accessor("response", {
    header: sortableHeader("Response"),
  }),
  columnHelper.accessor("extTxnId", {
    header: sortableHeader("Ext Txn ID"),
  }),
  columnHelper.accessor("bankTransferId", {
    header: sortableHeader("Bank Transfer ID"),
  }),
]);

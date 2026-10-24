import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { PrepaidVisaTopUp } from "@/types/prepaid-visa";

import { formatUsd, productLabel } from "./prepaid-visa-format";

const columnHelper = createColumnHelper<DataTableFeatures, PrepaidVisaTopUp>();

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

export const topUpColumns = columnHelper.columns([
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
  columnHelper.accessor("customerId", {
    header: sortableHeader("Customer ID"),
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{getValue() || "-"}</span>
    ),
  }),
  columnHelper.accessor("cardholderName", {
    header: sortableHeader("Cardholder"),
    cell: ({ getValue }) => getValue() || "-",
  }),
  columnHelper.accessor("productCode", {
    header: sortableHeader("Product"),
    cell: ({ getValue }) => productLabel(getValue()),
  }),
  columnHelper.accessor("amount", {
    header: sortableHeader("Top-up"),
    cell: ({ getValue }) => formatUsd(getValue()),
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
  columnHelper.accessor("description", {
    header: sortableHeader("Description"),
  }),
  columnHelper.accessor("branchName", {
    header: sortableHeader("Branch"),
  }),
  columnHelper.accessor("statusDescription", {
    header: sortableHeader("Status"),
  }),
  columnHelper.accessor("accountNumber", {
    header: sortableHeader("Account"),
  }),
]);

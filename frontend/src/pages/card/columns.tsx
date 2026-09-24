import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardStatusReport } from "@/types/card-status-report";
import { DataTableFeatures } from "@/components/data-table-features";

const columnHelper = createColumnHelper<DataTableFeatures, CardStatusReport>();

export const cardStatusColumns = columnHelper.columns([
  columnHelper.accessor("cardStatus", {
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Status
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ getValue }) => getValue() || "—",
  }),

  columnHelper.accessor("statusDescription", {
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Status Description
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ getValue }) => getValue() || "—",
  }),

  columnHelper.accessor("cardCount", {
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
      >
        Number of Cards
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ getValue }) => Number(getValue()).toLocaleString(),
  }),
]);
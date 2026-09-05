import { createColumnHelper } from "@tanstack/react-table";
import { toast } from "sonner";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataRowActions } from "@/components/data-row-actions";
import { DataTableFeatures } from "@/components/data-table-features";
import { AtmTerminal } from "@/types/atm-terminal";

const columnHelper = createColumnHelper<DataTableFeatures, AtmTerminal>();

async function copyText(label: string, value: string) {
  const text = value.trim();

  if (!text) {
    toast.error(`${label} is missing`);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`, {
      description: text,
    });
  } catch {
    toast.error(`Failed to copy ${label.toLowerCase()}`);
  }
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
  columnHelper.accessor("unitId", {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Unit ID
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  }),
  columnHelper.accessor("terminalId", {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Terminal ID
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  }),
  columnHelper.accessor("terminalName", {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Terminal Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  }),
  columnHelper.accessor("branchName", {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Branch Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  }),
  columnHelper.accessor("districtName", {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          District
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: ({ row }) => {
      const terminal = row.original;

      return (
        <DataRowActions
          row={terminal}
          extraItems={[
            {
              label: "Copy terminal ID",
              onSelect: () => {
                void copyText("Terminal ID", terminal.terminalId);
              },
            },
            {
              label: "Copy unit ID",
              onSelect: () => {
                void copyText("Unit ID", String(terminal.unitId ?? ""));
              },
            },
          ]}
        />
      );
    },
  }),
]);

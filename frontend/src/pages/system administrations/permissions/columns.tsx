import { createColumnHelper } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DataRowActions } from "@/components/data-row-actions";
import { DataTableFeatures } from "@/components/data-table-features";
import { Permission } from "@/types/permission";

const columnHelper = createColumnHelper<DataTableFeatures, Permission>();

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
  columnHelper.accessor("name", {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  }),
  columnHelper.accessor("resource", {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Resource
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  }),
  columnHelper.accessor("action", {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Action
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  }),
  columnHelper.accessor("description", {
    header: "Description",
    cell: ({ row }) => row.original.description || (
      <span className="text-muted-foreground">None</span>
    ),
  }),
  columnHelper.accessor("status", {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: ({ row }) => (
      <DataRowActions
        row={row.original}
        viewPath="/permission/details"
        viewPermission={["permission:view-details"]}
        editPath="/permission/edit"
        editPermission={["permission:update"]}
        deleteLabel="Delete"
        deleteTitle="Delete Permission"
        deleteDescription="Are you sure you want to delete this permission?"
        deletePermission={["permission:delete"]}
        onDelete={async () => {
          // delete permission here
        }}
      />
    ),
  }),
]);

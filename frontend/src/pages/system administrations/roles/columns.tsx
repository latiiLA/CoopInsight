import { createColumnHelper } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DataRowActions } from "@/components/data-row-actions";
import { DataTableFeatures } from "@/components/data-table-features";
import { Role } from "@/types/role";

const columnHelper = createColumnHelper<DataTableFeatures, Role>();

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
  columnHelper.accessor((row) => row.permissions?.length ?? 0, {
    id: "permissions",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Permissions
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const permissions = row.original.permissions ?? [];

      if (permissions.length === 0) {
        return <span className="text-muted-foreground">None</span>;
      }

      return (
        <span className="max-w-[320px] truncate" title={permissions.join(", ")}>
          {permissions.join(", ")}
        </span>
      );
    },
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
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => (
      <DataRowActions
        row={row.original}
        viewPath="/role/details"
        viewPermission={["role:view-details"]}
        editPath="/role/edit"
        editPermission={["role:update"]}
        deleteLabel="Delete"
        deleteTitle="Delete Role"
        deleteDescription="Are you sure you want to delete this role?"
        deletePermission={["role:delete"]}
        onDelete={async () => {
          // delete role here
        }}
      />
    ),
  },
]);

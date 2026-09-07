import { createColumnHelper } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableFeatures } from "@/components/data-table-features";
import {
  AccountRequest,
  getAccountRequestId,
} from "@/types/account-request";
import { hasPermission } from "../../../../utility/has-permission";

const columnHelper = createColumnHelper<DataTableFeatures, AccountRequest>();

function CreateUserAction({ request }: { request: AccountRequest }) {
  const navigate = useNavigate();
  const requestId = getAccountRequestId(request);

  if (!requestId || !hasPermission(["user:create"])) {
    return null;
  }

  return (
    <Button
      size="sm"
      onClick={() => navigate(`/user?request=${requestId}`)}
    >
      Create user
    </Button>
  );
}

export const accountRequestColumns = columnHelper.columns([
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
  columnHelper.accessor("username", {
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Username
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  }),
  columnHelper.accessor("firstName", {
    header: "First name",
  }),
  columnHelper.accessor("middleName", {
    header: "Father name",
  }),
  columnHelper.accessor("lastName", {
    header: "Grandfather name",
  }),
  columnHelper.accessor("email", {
    header: "Email",
  }),
  columnHelper.accessor("createdAt", {
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Requested
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ getValue }) => {
      const value = getValue();
      const date = value ? new Date(value) : null;

      if (!date || Number.isNaN(date.getTime())) {
        return "—";
      }

      return date.toLocaleString();
    },
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: ({ row }) => <CreateUserAction request={row.original} />,
  }),
]);

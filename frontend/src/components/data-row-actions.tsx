import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteDialog } from "./delete-dialog";

// import { RootState } from "@/store/store";
// import { hasPermission } from "@/utility/has-permission";

interface DataRowActionsProps<TData> {
  row: TData;

  viewPath?: string;
  editPath?: string;

  viewPermission?: string[];
  editPermission?: string[];
  deletePermission?: string[];

  onDelete?: (row: TData) => Promise<void> | void;

  deleteLabel?: string;
  deleteTitle?: string;
  deleteDescription?: string;
}

export function DataRowActions<TData>({
  row,

  viewPath,
  editPath,

  viewPermission,
  editPermission,
  deletePermission,

  onDelete,

  deleteLabel = "Delete",
  deleteTitle = "Delete item",
  deleteDescription = "Are you sure you want to delete this item?",
}: DataRowActionsProps<TData>) {
  const navigate = useNavigate();

//   const { authUser } = useSelector(
//     (state: RootState) => state.auth
//   );

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasRequiredPermission = (
    permissions?: string[]
  ) => {
    if (!permissions || permissions.length === 0) {
      return true;
    }

    // if (!authUser) {
    //   return false;
    // }

    // return hasPermission({
    //   authUser,
    //   requiredPermissions: permissions,
    // });
    return true
  };

  const canView =
    !!viewPath && hasRequiredPermission(viewPermission);

  const canEdit =
    !!editPath && hasRequiredPermission(editPermission);

  const canDelete =
    !!onDelete && hasRequiredPermission(deletePermission);

  const handleDelete = async () => {
    if (!onDelete) return;

    try {
      setDeleting(true);

      await onDelete(row);

      setDeleteOpen(false);
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setDeleting(false);
    }
  };

  if (!canView && !canEdit && !canDelete) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
          >
            <span className="sr-only">
              Open menu
            </span>

            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            Actions
          </DropdownMenuLabel>

          {canView && (
            <DropdownMenuItem
              onClick={() =>
                navigate(viewPath!, {
                  state: { row },
                })
              }
            >
              View
            </DropdownMenuItem>
          )}

          {canEdit && (
            <DropdownMenuItem
              onClick={() =>
                navigate(editPath!, {
                  state: { row },
                })
              }
            >
              Edit
            </DropdownMenuItem>
          )}

          {canDelete && (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                {deleteLabel}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Your reusable delete dialog goes here */}
      <DeleteDialog
        row={row}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        loading={deleting}
        title={deleteTitle}
        description={deleteDescription}
      />
    </>
  );
}
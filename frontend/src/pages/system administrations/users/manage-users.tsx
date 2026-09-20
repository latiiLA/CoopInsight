import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { PlusCircle } from "lucide-react";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { DataTable } from "@/components/data-table";
import { DeleteDialog } from "@/components/delete-dialog";
import { getColumns } from "./columns";
import {
  deleteUser,
  fetchUsers,
  suspendUser,
  unsuspendUser,
} from "@/features/user_slice";
import { hasPermission } from "../../../../utility/has-permission";
import { User, getUserId } from "@/types/user";

type StatusAction = {
  mode: "suspend" | "unsuspend";
  user: User;
};

const ManageUsers = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { users, usersError, authUser } = useSelector(
    (state: RootState) => state.user,
  );
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    if (authUser) {
      dispatch(fetchUsers());
    }
  }, [authUser, dispatch]);

  useEffect(() => {
    if (usersError) {
      toast.error(usersError);
    }
  }, [usersError]);

  const handleDelete = useCallback(
    async (user: User) => {
      const userId = getUserId(user);

      if (!userId) {
        toast.error("User id is missing");
        return;
      }

      const result = await dispatch(deleteUser(userId));

      if (deleteUser.rejected.match(result)) {
        toast.error(result.payload || "Failed to delete user");
        throw new Error(result.payload || "Failed to delete user");
      }

      toast.success("User deleted successfully", {
        description: `${user.username} has been removed.`,
      });
      dispatch(fetchUsers());
    },
    [dispatch],
  );

  const handleSuspend = useCallback((user: User) => {
    setStatusAction({ mode: "suspend", user });
  }, []);

  const handleUnsuspend = useCallback((user: User) => {
    setStatusAction({ mode: "unsuspend", user });
  }, []);

  const confirmStatusAction = useCallback(async () => {
    if (!statusAction) {
      return;
    }

    const userId = getUserId(statusAction.user);
    if (!userId) {
      toast.error("User id is missing");
      return;
    }

    setStatusLoading(true);
    try {
      if (statusAction.mode === "suspend") {
        const result = await dispatch(suspendUser(userId));
        if (suspendUser.rejected.match(result)) {
          toast.error(result.payload || "Failed to suspend user");
          return;
        }
        toast.success("User suspended", {
          description: `${statusAction.user.username} can no longer sign in.`,
        });
      } else {
        const result = await dispatch(unsuspendUser(userId));
        if (unsuspendUser.rejected.match(result)) {
          toast.error(result.payload || "Failed to unsuspend user");
          return;
        }
        toast.success("User unsuspended", {
          description: `${statusAction.user.username} is active again.`,
        });
      }
      setStatusAction(null);
      dispatch(fetchUsers());
    } finally {
      setStatusLoading(false);
    }
  }, [dispatch, statusAction]);

  const columns = useMemo(
    () =>
      getColumns({
        onDelete: handleDelete,
        onSuspend: handleSuspend,
        onUnsuspend: handleUnsuspend,
      }),
    [handleDelete, handleSuspend, handleUnsuspend],
  );

  return (
    <div>
      <div className="flex align-items-center justify-between">
        <h1 className="text-lg font-semibold">User Management</h1>
        <div className="flex gap-2">
          {authUser && hasPermission(["user:create"]) && (
            <Button onClick={() => navigate("/user")}>
              <PlusCircle />
              Add User
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={users}
        searchPlaceholder="Search all users..."
        exportFileName="Users"
      />

      <DeleteDialog
        row={statusAction?.user}
        open={Boolean(statusAction)}
        onOpenChange={(open) => {
          if (!open) {
            setStatusAction(null);
          }
        }}
        onConfirm={confirmStatusAction}
        loading={statusLoading}
        title={
          statusAction?.mode === "unsuspend" ? "Unsuspend User" : "Suspend User"
        }
        description={
          statusAction?.mode === "unsuspend"
            ? `Restore access for ${statusAction.user.username}? They will be set to active and can sign in again.`
            : `Suspend ${statusAction?.user.username}? They will not be able to sign in until unsuspended.`
        }
        confirmLabel={
          statusAction?.mode === "unsuspend" ? "Unsuspend" : "Suspend"
        }
        loadingLabel={
          statusAction?.mode === "unsuspend" ? "Unsuspending..." : "Suspending..."
        }
      />
    </div>
  );
};

export default ManageUsers;

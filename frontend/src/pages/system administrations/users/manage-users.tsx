import { useCallback, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { PlusCircle } from "lucide-react";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { DataTable } from "@/components/data-table";
import { getColumns } from "./columns";
import { deleteUser, fetchUsers } from "@/features/user_slice";
import { hasPermission } from "../../../../utility/has-permission";
import { User, getUserId } from "@/types/user";

const ManageUsers = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { users, usersError, authUser } = useSelector(
    (state: RootState) => state.user,
  );

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

  const columns = useMemo(() => getColumns(handleDelete), [handleDelete]);

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
    </div>
  );
};

export default ManageUsers;

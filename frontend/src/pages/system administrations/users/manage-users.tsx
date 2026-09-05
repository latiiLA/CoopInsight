import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { PlusCircle } from "lucide-react";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { DataTable } from "@/components/data-table";
import { columns } from "./columns";
import { fetchUsers } from "@/features/user_slice";
import { hasPermission } from "../../../../utility/has-permission";

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

  return (
    <div>
      <div className="flex align-items-center justify-between">
        <h1 className="text-lg font-semibold">User Management</h1>
        <div className="flex gap-2">
          {authUser && hasPermission(["user:add"]) && (
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

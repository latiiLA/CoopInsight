import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { PlusCircle } from "lucide-react";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { DataTable } from "@/components/data-table";
import { columns } from "./columns";
import { fetchRoles } from "@/features/role_slice";
import { hasPermission } from "../../../../utility/has-permission";

const ManageRoles = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { roles, roleError } = useSelector((state: RootState) => state.role);
  const { authUser } = useSelector((state: RootState) => state.user);

  useEffect(() => {
    if (authUser && roles.length === 0) {
      dispatch(fetchRoles());
    }
  }, [authUser, roles.length, dispatch]);

  useEffect(() => {
    if (roleError) {
      toast.error(roleError);
    }
  }, [roleError]);

  return (
    <div>
      <div className="flex align-items-center justify-between">
        <h1 className="text-lg font-semibold">Role Management</h1>
        <div className="flex gap-2">
          {authUser && hasPermission(["role:add"]) && (
            <Button onClick={() => navigate("/role")}>
              <PlusCircle />
              Add Role
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={roles}
        searchPlaceholder="Search all roles..."
        exportFileName="Roles"
      />
    </div>
  );
};

export default ManageRoles;

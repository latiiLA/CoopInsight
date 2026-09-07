import { useCallback, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { PlusCircle } from "lucide-react";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { DataTable } from "@/components/data-table";
import { getColumns } from "./columns";
import { deleteRole, fetchRoles } from "@/features/role_slice";
import { hasPermission } from "../../../../utility/has-permission";
import { Role, getRoleId } from "@/types/role";

const ManageRoles = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { roles, roleError } = useSelector((state: RootState) => state.role);
  const { authUser } = useSelector((state: RootState) => state.user);

  useEffect(() => {
    if (authUser) {
      dispatch(fetchRoles());
    }
  }, [authUser, dispatch]);

  useEffect(() => {
    if (roleError) {
      toast.error(roleError);
    }
  }, [roleError]);

  const handleDelete = useCallback(
    async (role: Role) => {
      const roleId = getRoleId(role);

      if (!roleId) {
        toast.error("Role id is missing");
        return;
      }

      const result = await dispatch(deleteRole(roleId));

      if (deleteRole.rejected.match(result)) {
        toast.error(result.payload || "Failed to delete role");
        throw new Error(result.payload || "Failed to delete role");
      }

      toast.success("Role deleted successfully", {
        description: `${role.name} has been removed.`,
      });
      dispatch(fetchRoles());
    },
    [dispatch],
  );

  const columns = useMemo(() => getColumns(handleDelete), [handleDelete]);

  return (
    <div>
      <div className="flex align-items-center justify-between">
        <h1 className="text-lg font-semibold">Role Management</h1>
        <div className="flex gap-2">
          {authUser && hasPermission(["role:create"]) && (
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

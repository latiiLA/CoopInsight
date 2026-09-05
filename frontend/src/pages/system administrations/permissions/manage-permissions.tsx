import { useCallback, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { PlusCircle } from "lucide-react";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { DataTable } from "@/components/data-table";
import { getColumns } from "./columns";
import {
  deletePermission,
  fetchPermissions,
} from "@/features/permission_slice";
import { hasPermission } from "../../../../utility/has-permission";
import { Permission, getPermissionId } from "@/types/permission";

const ManagePermissions = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { allPermissions, permissionError } = useSelector(
    (state: RootState) => state.permission,
  );
  const { authUser } = useSelector((state: RootState) => state.user);

  useEffect(() => {
    if (authUser) {
      dispatch(fetchPermissions());
    }
  }, [authUser, dispatch]);

  useEffect(() => {
    if (permissionError) {
      toast.error(permissionError);
    }
  }, [permissionError]);

  const handleDelete = useCallback(
    async (permission: Permission) => {
      const permissionId = getPermissionId(permission);

      if (!permissionId) {
        toast.error("Permission id is missing");
        return;
      }

      const result = await dispatch(deletePermission(permissionId));

      if (deletePermission.rejected.match(result)) {
        toast.error(result.payload || "Failed to delete permission");
        throw new Error(result.payload || "Failed to delete permission");
      }

      toast.success("Permission deleted successfully", {
        description: `${permission.name} has been removed.`,
      });
      dispatch(fetchPermissions());
    },
    [dispatch],
  );

  const columns = useMemo(() => getColumns(handleDelete), [handleDelete]);

  return (
    <div>
      <div className="flex align-items-center justify-between">
        <h1 className="text-lg font-semibold">Permission Management</h1>
        <div className="flex gap-2">
          {authUser && hasPermission(["permission:create"]) && (
            <Button onClick={() => navigate("/permission")}>
              <PlusCircle />
              Add Permission
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={allPermissions}
        searchPlaceholder="Search all permissions..."
        exportFileName="Permissions"
      />
    </div>
  );
};

export default ManagePermissions;

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { PlusCircle } from "lucide-react";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { DataTable } from "@/components/data-table";
import { columns } from "./columns";
import { fetchPermissions } from "@/features/permission_slice";
import { hasPermission } from "../../../../utility/has-permission";

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

import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Pencil, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { fetchPermissions } from "@/features/permission_slice";
import { clearSelectedRole, fetchRoleById } from "@/features/role_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { getPermissionId } from "@/types/permission";
import { getRoleId } from "@/types/role";
import { hasPermission } from "../../../../utility/has-permission";
import { formatLabel } from "../users/user-form-schema";

const formatDate = (value?: Date | string | null) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
};

const DetailItem = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <div className="space-y-1">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-sm font-medium">{value || "—"}</p>
  </div>
);

const ViewRole = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { isLoggedIn } = useSelector((state: RootState) => state.user);
  const { selectedRole, roleDetailLoading, roleDetailError } = useSelector(
    (state: RootState) => state.role,
  );
  const { allPermissions, permissionLoading } = useSelector(
    (state: RootState) => state.permission,
  );

  useEffect(() => {
    if (!isLoggedIn || !id) {
      return;
    }

    dispatch(fetchRoleById(id));
    dispatch(fetchPermissions());

    return () => {
      dispatch(clearSelectedRole());
    };
  }, [dispatch, id, isLoggedIn]);

  useEffect(() => {
    if (roleDetailError) {
      toast.error(roleDetailError);
    }
  }, [roleDetailError]);

  const rolePermissionNames = selectedRole?.permissions ?? [];

  const assignedPermissions = useMemo(() => {
    const catalogByName = new Map(
      allPermissions
        .filter((permission) => Boolean(permission.name))
        .map((permission) => [permission.name, permission]),
    );

    return rolePermissionNames
      .filter(Boolean)
      .map((name) => {
        const match = catalogByName.get(name);
        return {
          id: match ? getPermissionId(match) || name : name,
          name,
          description: match?.description,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPermissions, rolePermissionNames]);

  const canEdit = hasPermission(["role:update"]);

  if (roleDetailLoading || !selectedRole) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        {roleDetailLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <p className="text-sm text-muted-foreground">Role not found.</p>
        )}
      </div>
    );
  }

  const roleId = getRoleId(selectedRole);

  return (
    <div className="w-full pb-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Role Details
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Review this role and the permissions it grants.
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/roles")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {canEdit && (
              <Button type="button" onClick={() => navigate(`/role/${roleId}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-base font-semibold">Role</h2>
            <Separator />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem label="Name" value={selectedRole.name} />
              <DetailItem
                label="Status"
                value={formatLabel(selectedRole.status)}
              />
              <DetailItem
                label="Created At"
                value={formatDate(selectedRole.createdAt)}
              />
              <DetailItem
                label="Updated At"
                value={formatDate(selectedRole.updatedAt)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Permissions</h2>
              <p className="text-sm text-muted-foreground">
                Permissions granted by this role
                {assignedPermissions.length
                  ? ` (${assignedPermissions.length}).`
                  : "."}
              </p>
            </div>
            <Separator />
            <div className="rounded-lg border p-4">
              {permissionLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading permissions...
                </p>
              ) : assignedPermissions.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {assignedPermissions.map((permission) => (
                    <div
                      key={permission.id}
                      className="flex items-start gap-3 rounded-md border p-3 opacity-70"
                    >
                      <Checkbox checked disabled className="mt-0.5" />
                      <span className="space-y-1">
                        <span className="block text-sm leading-none">
                          {permission.name}
                        </span>
                        {permission.description ? (
                          <span className="block text-xs text-muted-foreground">
                            {permission.description}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No permissions assigned.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ViewRole;

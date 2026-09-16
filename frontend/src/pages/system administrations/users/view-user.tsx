import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Pencil, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  clearSelectedUser,
  fetchUserById,
} from "@/features/user_slice";
import { fetchPermissions } from "@/features/permission_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { getUserId } from "@/types/user";
import { hasPermission } from "../../../../utility/has-permission";
import { formatLabel } from "./user-form-schema";

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

const ViewUser = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { selectedUser, userDetailLoading, userDetailError, isLoggedIn } =
    useSelector((state: RootState) => state.user);
  const { allPermissions, permissionLoading } = useSelector(
    (state: RootState) => state.permission,
  );

  useEffect(() => {
    if (!isLoggedIn || !id) {
      return;
    }

    dispatch(fetchUserById(id));
    dispatch(fetchPermissions());

    return () => {
      dispatch(clearSelectedUser());
    };
  }, [dispatch, id, isLoggedIn]);

  useEffect(() => {
    if (userDetailError) {
      toast.error(userDetailError);
    }
  }, [userDetailError]);

  const rolePermissionNames = selectedUser?.role?.permissions ?? [];
  const assignedExtraNames = (selectedUser?.permissions ?? []).filter(
    (permission) => !rolePermissionNames.includes(permission),
  );

  const roleIncludedPermissions = useMemo(() => {
    return allPermissions.filter((permission) =>
      rolePermissionNames.includes(permission.name),
    );
  }, [allPermissions, rolePermissionNames]);

  const extraPermissions = useMemo(() => {
    return allPermissions.filter(
      (permission) => !rolePermissionNames.includes(permission.name),
    );
  }, [allPermissions, rolePermissionNames]);

  const canEdit = hasPermission(["user:update"]);

  if (userDetailLoading || !selectedUser) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        {userDetailLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <p className="text-sm text-muted-foreground">User not found.</p>
        )}
      </div>
    );
  }

  const userId = getUserId(selectedUser);

  return (
    <div className="w-full pb-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              <h1 className="text-2xl font-semibold tracking-tight">
                User Details
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Review this user's profile, role, and assigned permissions.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/users")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {canEdit && (
              <Button
                type="button"
                onClick={() => navigate(`/user/${userId}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-base font-semibold">Personal Information</h2>
            <Separator />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem label="First Name" value={selectedUser.firstName} />
              <DetailItem label="Father Name" value={selectedUser.middleName} />
              <DetailItem
                label="Grandfather Name"
                value={selectedUser.lastName}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold">Work context</h2>
            <Separator />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem
                label="Department"
                value={selectedUser.profile?.department}
              />
              <DetailItem
                label="Subprocess"
                value={selectedUser.profile?.subProcess}
              />
              <DetailItem
                label="Process"
                value={selectedUser.profile?.process}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold">Account</h2>
            <Separator />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem label="Username" value={selectedUser.username} />
              <DetailItem label="Email" value={selectedUser.email} />
              <DetailItem
                label="Role"
                value={formatLabel(selectedUser.role?.name)}
              />
              <DetailItem
                label="Status"
                value={formatLabel(selectedUser.status)}
              />
              <DetailItem
                label="Created At"
                value={formatDate(selectedUser.createdAt)}
              />
              <DetailItem
                label="Updated At"
                value={formatDate(selectedUser.updatedAt)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Permissions</h2>
              <p className="text-sm text-muted-foreground">
                Permissions included with the role and any extras granted to
                this user.
              </p>
            </div>
            <Separator />
            <div className="rounded-lg border p-4">
              {permissionLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading permissions...
                </p>
              ) : allPermissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No permissions are available.
                </p>
              ) : (
                <div className="space-y-6">
                  {roleIncludedPermissions.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Included with role</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {roleIncludedPermissions.map((permission) => (
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
                    </div>
                  )}

                  {extraPermissions.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Extra permissions</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {extraPermissions.map((permission) => {
                          const checked = assignedExtraNames.includes(
                            permission.name,
                          );

                          return (
                            <div
                              key={permission.id}
                              className={`flex items-start gap-3 rounded-md border p-3 ${
                                checked ? "" : "opacity-60"
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                disabled
                                className="mt-0.5"
                              />
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
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {roleIncludedPermissions.length === 0 &&
                  extraPermissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No permissions assigned.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ViewUser;

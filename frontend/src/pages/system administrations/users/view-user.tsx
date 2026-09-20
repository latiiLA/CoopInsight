import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Pencil, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { clearSelectedUser, fetchUserById } from "@/features/user_slice";
import { fetchPermissions } from "@/features/permission_slice";
import { avatarInitial, avatarSrc } from "@/lib/avatars";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { User, getUserId } from "@/types/user";
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

const personLabel = (
  person?: Pick<User, "username" | "firstName" | "middleName" | "lastName"> | null,
) => {
  if (!person) {
    return "—";
  }

  const name = [person.firstName, person.middleName, person.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (name && person.username) {
    return `${name} (@${person.username})`;
  }

  return name || person.username || "—";
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
    <p className="text-sm font-medium whitespace-pre-wrap break-words">
      {value || "—"}
    </p>
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

  const grantedExtraPermissions = useMemo(() => {
    return allPermissions.filter((permission) =>
      assignedExtraNames.includes(permission.name),
    );
  }, [allPermissions, assignedExtraNames]);

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
  const fullName = [
    selectedUser.firstName,
    selectedUser.middleName,
    selectedUser.lastName,
  ]
    .filter(Boolean)
    .join(" ");
  const pictureSrc = avatarSrc(selectedUser.avatar);
  const initial = avatarInitial(
    selectedUser.firstName || fullName,
    selectedUser.username,
  );
  const profile = selectedUser.profile;

  return (
    <div className="w-full px-4 pb-8 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              {pictureSrc ? <AvatarImage src={pictureSrc} alt={fullName} /> : null}
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <UserRound className="h-5 w-5" />
                <h1 className="text-2xl font-semibold tracking-tight">
                  {fullName || selectedUser.username}
                </h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                @{selectedUser.username}
                {selectedUser.status
                  ? ` · ${formatLabel(selectedUser.status)}`
                  : ""}
                {selectedUser.role?.name
                  ? ` · ${formatLabel(selectedUser.role.name)}`
                  : ""}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Review this user's profile, role, activity, and permissions.
              </p>
            </div>
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
              <DetailItem label="Email" value={selectedUser.email} />
              <DetailItem label="Phone" value={profile?.phone} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold">Work context</h2>
            <Separator />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem label="Job title" value={profile?.jobTitle} />
              <DetailItem label="Department" value={profile?.department} />
              <DetailItem label="Subprocess" value={profile?.subProcess} />
              <DetailItem label="Process" value={profile?.process} />
              <DetailItem label="Branch / office" value={profile?.branch} />
            </div>
            {profile?.bio ? (
              <DetailItem label="About" value={profile.bio} />
            ) : null}
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold">Account</h2>
            <Separator />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem label="Username" value={selectedUser.username} />
              <DetailItem
                label="Role"
                value={formatLabel(selectedUser.role?.name)}
              />
              <DetailItem
                label="Status"
                value={formatLabel(selectedUser.status)}
              />
              <DetailItem
                label="Last login"
                value={formatDate(selectedUser.lastLogin)}
              />
              <DetailItem
                label="Created At"
                value={formatDate(selectedUser.createdAt)}
              />
              <DetailItem
                label="Updated At"
                value={formatDate(selectedUser.updatedAt)}
              />
              {selectedUser.deletedAt ? (
                <DetailItem
                  label="Deleted At"
                  value={formatDate(selectedUser.deletedAt)}
                />
              ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold">Audit</h2>
            <Separator />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem
                label="Created by"
                value={personLabel(selectedUser.creator)}
              />
              <DetailItem
                label="Last updated by"
                value={personLabel(selectedUser.updater)}
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
                      <p className="text-sm font-medium">
                        Included with role ({roleIncludedPermissions.length})
                      </p>
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

                  {grantedExtraPermissions.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">
                        Extra permissions ({grantedExtraPermissions.length})
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {grantedExtraPermissions.map((permission) => (
                          <div
                            key={permission.id}
                            className="flex items-start gap-3 rounded-md border p-3"
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
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No extra permissions beyond the role.
                    </p>
                  )}

                  {roleIncludedPermissions.length === 0 &&
                  grantedExtraPermissions.length === 0 ? (
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

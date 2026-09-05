import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Pencil, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  const { allPermissions } = useSelector((state: RootState) => state.permission);

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

  const rolePermissions = selectedUser?.role?.permissions ?? [];
  const extraPermissions = (selectedUser?.permissions ?? []).filter(
    (permission) => !rolePermissions.includes(permission),
  );
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
  const permissionLabels = (names: string[]) =>
    names.map((name) => {
      const match = allPermissions.find((permission) => permission.name === name);
      return match?.description ? `${name} — ${match.description}` : name;
    });

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
            <Button type="button" variant="outline" onClick={() => navigate("/users")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {canEdit && (
              <Button type="button" onClick={() => navigate(`/user/${userId}/edit`)}>
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
              <DetailItem label="Grandfather Name" value={selectedUser.lastName} />
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
            <h2 className="text-base font-semibold">Permissions</h2>
            <Separator />
            <div className="space-y-6 rounded-lg border p-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Included with role</p>
                {rolePermissions.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {permissionLabels(rolePermissions).map((label) => (
                      <li
                        key={label}
                        className="rounded-md border p-3 text-sm"
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">None</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Extra permissions</p>
                {extraPermissions.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {permissionLabels(extraPermissions).map((label) => (
                      <li
                        key={label}
                        className="rounded-md border p-3 text-sm"
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">None</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ViewUser;

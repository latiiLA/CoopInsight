import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, KeyRound, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  clearSelectedPermission,
  fetchPermissionById,
} from "@/features/permission_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { getPermissionId } from "@/types/permission";
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

const ViewPermission = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { isLoggedIn } = useSelector((state: RootState) => state.user);
  const {
    selectedPermission,
    permissionDetailLoading,
    permissionDetailError,
  } = useSelector((state: RootState) => state.permission);

  useEffect(() => {
    if (!isLoggedIn || !id) {
      return;
    }

    dispatch(fetchPermissionById(id));

    return () => {
      dispatch(clearSelectedPermission());
    };
  }, [dispatch, id, isLoggedIn]);

  useEffect(() => {
    if (permissionDetailError) {
      toast.error(permissionDetailError);
    }
  }, [permissionDetailError]);

  const canEdit = hasPermission(["permission:update"]);

  if (permissionDetailLoading || !selectedPermission) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        {permissionDetailLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <p className="text-sm text-muted-foreground">Permission not found.</p>
        )}
      </div>
    );
  }

  const permissionId = getPermissionId(selectedPermission);

  return (
    <div className="w-full pb-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Permission Details
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Review this permission and how it is used in CoopInsight.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/permissions")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {canEdit && (
              <Button
                type="button"
                onClick={() => navigate(`/permission/${permissionId}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-base font-semibold">Permission</h2>
            <Separator />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailItem label="Name" value={selectedPermission.name} />
              <DetailItem label="Resource" value={selectedPermission.resource} />
              <DetailItem label="Action" value={selectedPermission.action} />
              <DetailItem
                label="Status"
                value={formatLabel(selectedPermission.status)}
              />
              <DetailItem
                label="Assigned"
                value={selectedPermission.assigned ? "Yes" : "No"}
              />
              <DetailItem
                label="Created At"
                value={formatDate(selectedPermission.createdAt)}
              />
              <DetailItem
                label="Updated At"
                value={formatDate(selectedPermission.updatedAt)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold">Description</h2>
            <Separator />
            <p className="text-sm">
              {selectedPermission.description || "—"}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ViewPermission;

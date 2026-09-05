import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import {
  clearSelectedPermission,
  clearUpdateError,
  fetchPermissionById,
  fetchPermissions,
  updatePermission,
} from "@/features/permission_slice";

import { AppDispatch, RootState } from "../../../../app/store/store";
import { UpdatePermissionDTO, getPermissionId } from "@/types/permission";
import {
  permissionFormSchema,
  type PermissionFormValues,
} from "./permission-form-schema";

const emptyFormValues: PermissionFormValues = {
  resource: "",
  action: "",
  description: "",
};

const EditPermission = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { isLoggedIn } = useSelector((state: RootState) => state.user);
  const {
    selectedPermission,
    permissionDetailLoading,
    permissionDetailError,
    updateLoading,
  } = useSelector((state: RootState) => state.permission);

  const nameLocked = Boolean(selectedPermission?.assigned);

  const formValues = useMemo<PermissionFormValues>(() => {
    if (!selectedPermission) {
      return emptyFormValues;
    }

    return {
      resource: selectedPermission.resource ?? "",
      action: selectedPermission.action ?? "",
      description: selectedPermission.description ?? "",
    };
  }, [selectedPermission]);

  const form = useForm<PermissionFormValues>({
    resolver: zodResolver(permissionFormSchema),
    defaultValues: emptyFormValues,
    values: formValues,
    resetOptions: {
      keepDirtyValues: true,
    },
  });

  const resource = form.watch("resource");
  const action = form.watch("action");
  const permissionName =
    resource.trim() && action.trim()
      ? `${resource.trim().toLowerCase()}:${action.trim().toLowerCase()}`
      : selectedPermission?.name ?? "";

  useEffect(() => {
    if (!isLoggedIn || !id) {
      return;
    }

    dispatch(fetchPermissionById(id));
  }, [dispatch, id, isLoggedIn]);

  useEffect(() => {
    if (!id) {
      toast.error("Unable to load permission", {
        id: "permission-detail-error",
        description: "Permission id is missing.",
      });
      navigate("/permissions");
      return;
    }

    if (!permissionDetailError) {
      return;
    }

    toast.error("Unable to load permission", {
      id: "permission-detail-error",
      description: permissionDetailError,
    });
    navigate("/permissions");
  }, [id, navigate, permissionDetailError]);

  useEffect(() => {
    return () => {
      dispatch(clearSelectedPermission());
      dispatch(clearUpdateError());
    };
  }, [dispatch]);

  async function onSubmit(values: PermissionFormValues) {
    const permissionId = id || getPermissionId(selectedPermission);

    if (!permissionId) {
      toast.error("Permission id is missing");
      return;
    }

    const resourceValue = nameLocked
      ? selectedPermission?.resource ?? values.resource.trim().toLowerCase()
      : values.resource.trim().toLowerCase();
    const actionValue = nameLocked
      ? selectedPermission?.action ?? values.action.trim().toLowerCase()
      : values.action.trim().toLowerCase();

    const payload: UpdatePermissionDTO = {
      name: `${resourceValue}:${actionValue}`,
      resource: resourceValue,
      action: actionValue,
      description: values.description?.trim() || undefined,
    };

    const resultAction = await dispatch(
      updatePermission({ id: permissionId, payload }),
    );

    if (updatePermission.fulfilled.match(resultAction)) {
      dispatch(fetchPermissions());
      toast.success("Permission updated successfully", {
        description: `${payload.name} has been updated.`,
      });
      navigate("/permissions");
      return;
    }

    toast.error("Permission update failed", {
      description:
        (resultAction.payload as string) ||
        "Unable to update the permission. Please try again.",
    });
    dispatch(clearUpdateError());
  }

  const isSubmitting = form.formState.isSubmitting || updateLoading;

  if (permissionDetailLoading && !selectedPermission) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading permission...
      </div>
    );
  }

  return (
    <div className="w-full pb-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Edit Permission
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {nameLocked
                ? "This permission is assigned, so its name stays locked. You can still update the description."
                : "Update the CoopInsight permission details."}
            </p>
          </div>

          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Permission Details</h2>
                <p className="text-sm text-muted-foreground">
                  The permission name is built from resource and action.
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField
                  control={form.control}
                  name="resource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resource</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="user"
                          disabled={nameLocked}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {nameLocked
                          ? "Resource cannot change while this permission is assigned."
                          : "The area this permission applies to, such as user or role."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="action"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Action</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="create"
                          disabled={nameLocked}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {nameLocked
                          ? "Action cannot change while this permission is assigned."
                          : "The operation being allowed, such as create, edit, or delete."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Permission Name</FormLabel>
                  <Input
                    value={permissionName}
                    placeholder="user:create"
                    readOnly
                    disabled
                  />
                  <FormDescription>
                    Saved as resource:action.
                  </FormDescription>
                </FormItem>
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional description" {...field} />
                    </FormControl>
                    <FormDescription>
                      Explain what this permission allows.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-w-[140px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Permission
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default EditPermission;

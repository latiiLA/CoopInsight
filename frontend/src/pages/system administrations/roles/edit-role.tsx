import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

import { fetchPermissions } from "@/features/permission_slice";
import {
  clearUpdateError,
  fetchRoleById,
  fetchRoles,
  updateRole,
} from "@/features/role_slice";

import { AppDispatch, RootState } from "../../../../app/store/store";
import { getPermissionId } from "@/types/permission";
import { UpdateRoleDTO, getRoleId } from "@/types/role";
import { roleFormSchema, type RoleFormValues } from "./role-form-schema";

const emptyFormValues: RoleFormValues = {
  name: "",
  permissions: [],
};

type PermissionOption = {
  id: string;
  name: string;
  description?: string;
};

function PermissionCheckboxGrid({
  options,
  selected,
  onToggle,
}: {
  options: PermissionOption[];
  selected: string[];
  onToggle: (name: string, checked: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((permission) => (
        <label
          key={permission.id}
          className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
        >
          <Checkbox
            checked={selected.includes(permission.name)}
            className="mt-0.5"
            onCheckedChange={(value) => onToggle(permission.name, Boolean(value))}
          />
          <span className="space-y-1">
            <span className="block text-sm leading-none">{permission.name}</span>
            {permission.description ? (
              <span className="block text-xs text-muted-foreground">
                {permission.description}
              </span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}

const EditRole = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { isLoggedIn } = useSelector((state: RootState) => state.user);
  const {
    selectedRole,
    roleDetailLoading,
    roleDetailError,
    updateLoading,
  } = useSelector((state: RootState) => state.role);
  const { allPermissions, permissionError, permissionLoading } = useSelector(
    (state: RootState) => state.permission,
  );

  const isSuperAdmin = selectedRole?.name?.toUpperCase() === "SUPERADMIN";

  const catalogPermissions = useMemo<PermissionOption[]>(() => {
    return allPermissions
      .filter((permission) => Boolean(permission.name))
      .map((permission) => ({
        id: getPermissionId(permission) || permission.name,
        name: permission.name,
        description: permission.description,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPermissions]);

  const extraAssignedPermissions = useMemo<PermissionOption[]>(() => {
    const catalogNames = new Set(
      catalogPermissions.map((permission) => permission.name),
    );

    return (selectedRole?.permissions ?? [])
      .filter((name) => Boolean(name) && !catalogNames.has(name))
      .map((name) => ({ id: name, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogPermissions, selectedRole?.permissions]);

  const hasPermissionOptions =
    catalogPermissions.length > 0 || extraAssignedPermissions.length > 0;

  const formValues = useMemo<RoleFormValues>(() => {
    if (!selectedRole) {
      return emptyFormValues;
    }

    return {
      name: selectedRole.name ?? "",
      permissions: selectedRole.permissions ?? [],
    };
  }, [selectedRole]);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: emptyFormValues,
    values: formValues,
    resetOptions: {
      keepDirtyValues: true,
    },
  });

  useEffect(() => {
    if (!isLoggedIn || !id) {
      return;
    }

    dispatch(fetchRoleById(id));
    dispatch(fetchPermissions());
  }, [dispatch, id, isLoggedIn]);

  useEffect(() => {
    if (permissionError) {
      toast.error(permissionError);
    }
  }, [permissionError]);

  useEffect(() => {
    if (!id) {
      toast.error("Unable to load role", {
        id: "role-detail-error",
        description: "Role id is missing.",
      });
      navigate("/roles");
      return;
    }

    if (!roleDetailError) {
      return;
    }

    toast.error("Unable to load role", {
      id: "role-detail-error",
      description: roleDetailError,
    });
    navigate("/roles");
  }, [id, navigate, roleDetailError]);

  async function onSubmit(values: RoleFormValues) {
    const roleId = id || getRoleId(selectedRole);

    if (!roleId) {
      toast.error("Role id is missing");
      return;
    }

    const payload: UpdateRoleDTO = {
      name: isSuperAdmin
        ? selectedRole?.name ?? values.name.trim()
        : values.name.trim(),
      permissions: values.permissions ?? [],
    };

    const resultAction = await dispatch(updateRole({ id: roleId, payload }));

    if (updateRole.fulfilled.match(resultAction)) {
      dispatch(fetchRoles());
      toast.success("Role updated successfully", {
        description: `${payload.name} has been updated.`,
      });
      navigate("/roles");
      return;
    }

    toast.error("Role update failed", {
      description:
        (resultAction.payload as string) ||
        "Unable to update the role. Please try again.",
    });

    dispatch(clearUpdateError());
  }

  const isSubmitting = form.formState.isSubmitting || updateLoading;

  if (roleDetailLoading || !selectedRole) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full pb-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Edit Role
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Update this role's name and the permissions it grants.
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
                <h2 className="text-base font-semibold">Role Details</h2>
                <p className="text-sm text-muted-foreground">
                  {isSuperAdmin
                    ? "The SUPERADMIN role name cannot be changed."
                    : "Update the name for this role."}
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter role name"
                          disabled={isSuperAdmin}
                          readOnly={isSuperAdmin}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {isSuperAdmin
                          ? "This built-in role name is locked."
                          : "Use a short name that describes this set of access."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Permissions</h2>
                <p className="text-sm text-muted-foreground">
                  Catalog items are defined under Manage Permissions. Assigned
                  names that are not in the catalog still appear below so they
                  are not lost.
                  {selectedRole.permissions?.length
                    ? ` ${selectedRole.permissions.length} currently assigned.`
                    : ""}
                </p>
              </div>

              <Separator />

              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem>
                    <div className="rounded-lg border p-4">
                      {permissionLoading ? (
                        <p className="text-sm text-muted-foreground">
                          Loading permissions...
                        </p>
                      ) : !hasPermissionOptions ? (
                        <p className="text-sm text-muted-foreground">
                          No permissions are available to assign.
                        </p>
                      ) : (
                        <div className="space-y-6">
                          {catalogPermissions.length > 0 && (
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm font-medium">
                                  Permission catalog
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Defined in Manage Permissions. A checked box
                                  means this role already has it.
                                </p>
                              </div>
                              <PermissionCheckboxGrid
                                options={catalogPermissions}
                                selected={field.value ?? []}
                                onToggle={(name, checked) => {
                                  const current = field.value ?? [];

                                  field.onChange(
                                    checked
                                      ? [...current, name]
                                      : current.filter((item) => item !== name),
                                  );
                                }}
                              />
                            </div>
                          )}

                          {extraAssignedPermissions.length > 0 && (
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm font-medium">
                                  Already assigned, not in catalog
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  These names are stored on the role, but there
                                  is no matching permission record yet.
                                </p>
                              </div>
                              <PermissionCheckboxGrid
                                options={extraAssignedPermissions}
                                selected={field.value ?? []}
                                onToggle={(name, checked) => {
                                  const current = field.value ?? [];

                                  field.onChange(
                                    checked
                                      ? [...current, name]
                                      : current.filter((item) => item !== name),
                                  );
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/roles")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting || permissionLoading}
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
                    Save Changes
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

export default EditRole;

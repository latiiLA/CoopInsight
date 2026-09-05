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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import {
  clearSelectedUser,
  clearUpdateError,
  fetchUserById,
  fetchUsers,
  updateUser,
} from "@/features/user_slice";
import { fetchRoles } from "@/features/role_slice";
import { fetchPermissions } from "@/features/permission_slice";

import { AppDispatch, RootState } from "../../../../app/store/store";
import { UpdateUserDTO, getUserId, resolveUserRoleId } from "@/types/user";
import { getRoleId } from "@/types/role";
import {
  USER_STATUSES,
  editUserFormSchema,
  formatLabel,
  type EditUserFormValues,
} from "./user-form-schema";

const emptyFormValues: EditUserFormValues = {
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  role: "",
  permissions: [],
  status: "new",
};

const EditUser = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const {
    isLoggedIn,
    selectedUser,
    userDetailLoading,
    userDetailError,
    updateLoading,
  } = useSelector((state: RootState) => state.user);

  const { allPermissions, permissionError, permissionLoading } = useSelector(
    (state: RootState) => state.permission,
  );

  const { roles, roleError, roleLoading } = useSelector(
    (state: RootState) => state.role,
  );

  const formValues = useMemo<EditUserFormValues>(() => {
    if (!selectedUser) {
      return emptyFormValues;
    }

    const roleId = resolveUserRoleId(selectedUser, roles);
    const rolePermissions =
      roles.find((role) => getRoleId(role) === roleId)?.permissions ??
      selectedUser.role?.permissions ??
      [];

    return {
      firstName: selectedUser.firstName ?? "",
      middleName: selectedUser.middleName ?? "",
      lastName: selectedUser.lastName ?? "",
      email: selectedUser.email ?? "",
      role: roleId,
      permissions: (selectedUser.permissions ?? []).filter(
        (permission) => !rolePermissions.includes(permission),
      ),
      status: USER_STATUSES.includes(
        selectedUser.status as (typeof USER_STATUSES)[number],
      )
        ? (selectedUser.status as (typeof USER_STATUSES)[number])
        : "new",
    };
  }, [roles, selectedUser]);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: emptyFormValues,
    values: formValues,
    resetOptions: {
      keepDirtyValues: true,
    },
  });

  const selectedRole = form.watch("role");

  const selectedRolePermissions = useMemo(() => {
    return (
      roles.find((role) => getRoleId(role) === selectedRole)?.permissions ?? []
    );
  }, [roles, selectedRole]);

  const extraPermissions = useMemo(() => {
    return allPermissions.filter(
      (permission) => !selectedRolePermissions.includes(permission.name),
    );
  }, [allPermissions, selectedRolePermissions]);

  const roleIncludedPermissions = useMemo(() => {
    return allPermissions.filter((permission) =>
      selectedRolePermissions.includes(permission.name),
    );
  }, [allPermissions, selectedRolePermissions]);

  useEffect(() => {
    if (!isLoggedIn || !id) {
      return;
    }

    dispatch(fetchUserById(id));
    dispatch(fetchRoles());
    dispatch(fetchPermissions());

    return () => {
      dispatch(clearSelectedUser());
      dispatch(clearUpdateError());
    };
  }, [dispatch, id, isLoggedIn]);

  useEffect(() => {
    if (roleError) {
      toast.error(roleError);
    }
  }, [roleError]);

  useEffect(() => {
    if (permissionError) {
      toast.error(permissionError);
    }
  }, [permissionError]);

  useEffect(() => {
    if (userDetailError) {
      toast.error(userDetailError);
    }
  }, [userDetailError]);

  async function onSubmit(values: EditUserFormValues) {
    const userId = id || getUserId(selectedUser);

    if (!userId) {
      toast.error("User id is missing");
      return;
    }

    const payload: UpdateUserDTO = {
      firstName: values.firstName.trim(),
      middleName: values.middleName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim().toLowerCase(),
      role: values.role,
      permissions: values.permissions ?? [],
      status: values.status,
    };

    const resultAction = await dispatch(updateUser({ id: userId, payload }));

    if (updateUser.fulfilled.match(resultAction)) {
      dispatch(fetchUsers());
      toast.success("User updated successfully", {
        description: `${payload.firstName} ${payload.middleName} has been updated.`,
      });
      navigate(`/user/${userId}`);
      return;
    }

    toast.error("User update failed", {
      description:
        (resultAction.payload as string) ||
        "Unable to update the user. Please try again.",
    });

    dispatch(clearUpdateError());
  }

  const isSubmitting = form.formState.isSubmitting || updateLoading;

  if (userDetailLoading && !selectedUser) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selectedUser) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <p className="text-sm text-muted-foreground">User not found.</p>
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
                Edit User
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Update this user's profile, role, status, and extra permissions.
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
                <h2 className="text-base font-semibold">Personal Information</h2>
                <p className="text-sm text-muted-foreground">
                  Update the user's name information.
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter first name"
                          autoComplete="given-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="middleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Father Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter father name"
                          autoComplete="additional-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grandfather Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter grandfather name"
                          autoComplete="family-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Account</h2>
                <p className="text-sm text-muted-foreground">
                  Username cannot be changed. Update email, role, and status.
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input value={selectedUser.username} disabled readOnly />
                  </FormControl>
                </FormItem>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter email address"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        key={field.value || "role"}
                        value={field.value || undefined}
                        onValueChange={(value) => {
                          if (value !== field.value) {
                            form.setValue("permissions", []);
                          }
                          field.onChange(value);
                        }}
                        disabled={roleLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                roleLoading ? "Loading roles..." : "Select role"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles.length > 0 ? (
                            roles.map((role) => {
                              const roleId = getRoleId(role);

                              if (!roleId) {
                                return null;
                              }

                              return (
                                <SelectItem key={roleId} value={roleId}>
                                  {formatLabel(role.name)}
                                </SelectItem>
                              );
                            })
                          ) : (
                            <SelectItem value="none" disabled>
                              {roleLoading
                                ? "Loading roles..."
                                : "No roles available"}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        key={field.value || "status"}
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {USER_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {formatLabel(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">
                  Additional Permissions
                </h2>
                <p className="text-sm text-muted-foreground">
                  Optionally grant extra permissions beyond the selected role.
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
                      ) : !selectedRole ? (
                        <p className="text-sm text-muted-foreground">
                          Select a role first to assign additional permissions.
                        </p>
                      ) : allPermissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No permissions are available to assign.
                        </p>
                      ) : (
                        <div className="space-y-6">
                          {roleIncludedPermissions.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-sm font-medium">
                                Included with role
                              </p>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {roleIncludedPermissions.map((permission) => (
                                  <label
                                    key={permission.id}
                                    className="flex cursor-default items-start gap-3 rounded-md border p-3 opacity-70"
                                  >
                                    <Checkbox
                                      checked
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
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {extraPermissions.length > 0 ? (
                            <div className="space-y-3">
                              <p className="text-sm font-medium">
                                Assign extra permissions
                              </p>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {extraPermissions.map((permission) => {
                                  const checked = field.value?.includes(
                                    permission.name,
                                  );

                                  return (
                                    <label
                                      key={permission.id}
                                      className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                                    >
                                      <Checkbox
                                        checked={checked}
                                        className="mt-0.5"
                                        onCheckedChange={(value) => {
                                          const current = field.value ?? [];

                                          if (value) {
                                            field.onChange([
                                              ...current,
                                              permission.name,
                                            ]);
                                          } else {
                                            field.onChange(
                                              current.filter(
                                                (item) =>
                                                  item !== permission.name,
                                              ),
                                            );
                                          }
                                        }}
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
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              This role already includes all available
                              permissions.
                            </p>
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
                onClick={() => navigate(`/user/${getUserId(selectedUser)}`)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || roleLoading}
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

export default EditUser;

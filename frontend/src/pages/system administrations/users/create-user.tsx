import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import {
  clearRegisterError,
  fetchUsers,
  registerAuth,
} from "@/features/user_slice";
import { fetchRoles } from "@/features/role_slice";
import { fetchPermissions } from "@/features/permission_slice";

import { AppDispatch, RootState } from "../../../../app/store/store";
import { CreateUserDTO } from "@/types/user";

const nameSchema = (fieldName: string, minLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${fieldName} is required`)
    .min(minLength, `${fieldName} must be at least ${minLength} characters`)
    .regex(/^[a-zA-Z\s]+$/, `${fieldName} can only contain letters and spaces`);

const formSchema = z.object({
  firstName: nameSchema("First name", 3),
  middleName: nameSchema("Father name", 3),
  lastName: nameSchema("Grandfather name", 3),
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username can only contain letters, numbers, dots, underscores and hyphens",
    ),
  role: z.string().min(1, "Role is required"),
  permissions: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

const formatName = (value?: string) => {
  if (!value) return "";

  return value.charAt(0).toUpperCase() + value.slice(1);
};

const CreateUser = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { isLoggedIn, registerLoading } = useSelector(
    (state: RootState) => state.user,
  );

  const { allPermissions, permissionError, permissionLoading } = useSelector(
    (state: RootState) => state.permission,
  );

  const { roles, roleError, roleLoading } = useSelector(
    (state: RootState) => state.role,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      username: "",
      role: "",
      permissions: [],
    },
  });

  const selectedRole = form.watch("role");

  const selectedRolePermissions = useMemo(() => {
    return roles.find((role) => role._id === selectedRole)?.permissions ?? [];
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
    if (!isLoggedIn) return;

    dispatch(fetchRoles());
    dispatch(fetchPermissions());
  }, [dispatch, isLoggedIn]);

  useEffect(() => {
    form.setValue("permissions", []);
  }, [selectedRole, form]);

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

  async function onSubmit(values: FormValues) {
    const payload: CreateUserDTO = {
      username: values.username.trim(),
      firstName: values.firstName.trim(),
      middleName: values.middleName.trim(),
      lastName: values.lastName.trim(),
      role: values.role,
      permissions: values.permissions ?? [],
    };

    const resultAction = await dispatch(registerAuth(payload));

    if (registerAuth.fulfilled.match(resultAction)) {
      form.reset();
      dispatch(fetchUsers());

      toast.success("User created successfully", {
        id: "user-add-success",
        description: `${payload.firstName} ${payload.middleName} has been added to CoopInsight.`,
      });

      navigate("/users");
      return;
    }

    const errorMessage =
      (resultAction.payload as string) ||
      "Unable to create the user. Please try again.";

    toast.error("User creation failed", {
      description: errorMessage,
    });

    dispatch(clearRegisterError());
  }

  const isSubmitting = form.formState.isSubmitting || registerLoading;

  return (
    <div className="w-full pb-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Add User
              </h1>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Create a CoopInsight user and assign their role and permissions.
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
                <h2 className="text-base font-semibold">
                  Personal Information
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enter the user's name information.
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                  Configure the user's login identity and system role.
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>

                      <FormControl>
                        <Input
                          placeholder="Enter username"
                          autoComplete="username"
                          {...field}
                        />
                      </FormControl>

                      <FormDescription>
                        Use the username the user will use to sign in.
                      </FormDescription>

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
                        value={field.value}
                        onValueChange={field.onChange}
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
                            roles.map((role) => (
                              <SelectItem key={role._id} value={role._id}>
                                {formatName(role.name)}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>
                              {roleLoading
                                ? "Loading roles..."
                                : "No roles available"}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>

                      <FormDescription>
                        The selected role provides the user's default
                        permissions.
                      </FormDescription>

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
                  Permissions included with the role are already checked.
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
                                    key={permission._id}
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
                                      key={permission._id}
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
                onClick={() => navigate(-1)}
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
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create User
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

export default CreateUser;

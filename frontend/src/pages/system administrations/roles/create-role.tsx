import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, ShieldPlus } from "lucide-react";
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

import {
  clearCreateError,
  createRole,
  fetchRoles,
} from "@/features/role_slice";
import { fetchPermissions } from "@/features/permission_slice";

import { AppDispatch, RootState } from "../../../../app/store/store";
import { CreateRoleDTO } from "@/types/role";

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Role name must be at least 3 characters")
    .max(50, "Role name must be at most 50 characters")
    .regex(
      /^[a-zA-Z0-9\s_-]+$/,
      "Role name can only contain letters, numbers, spaces, underscores and hyphens",
    ),
  permissions: z
    .array(z.string())
    .min(1, "Select at least one permission for this role"),
});

type FormValues = z.infer<typeof formSchema>;

const CreateRole = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { isLoggedIn } = useSelector((state: RootState) => state.user);
  const { createLoading } = useSelector((state: RootState) => state.role);
  const { allPermissions, permissionError, permissionLoading } = useSelector(
    (state: RootState) => state.permission,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      permissions: [],
    },
  });

  useEffect(() => {
    if (!isLoggedIn) return;

    dispatch(fetchPermissions());
  }, [dispatch, isLoggedIn]);

  useEffect(() => {
    if (permissionError) {
      toast.error(permissionError);
    }
  }, [permissionError]);

  async function onSubmit(values: FormValues) {
    const payload: CreateRoleDTO = {
      name: values.name.trim(),
      permissions: values.permissions ?? [],
    };

    const resultAction = await dispatch(createRole(payload));

    if (createRole.fulfilled.match(resultAction)) {
      form.reset();
      dispatch(fetchRoles());

      toast.success("Role created successfully", {
        id: "role-add-success",
        description: `${payload.name} has been added to CoopInsight.`,
      });

      navigate("/roles");
      return;
    }

    const errorMessage =
      (resultAction.payload as string) ||
      "Unable to create the role. Please try again.";

    toast.error("Role creation failed", {
      description: errorMessage,
    });

    dispatch(clearCreateError());
  }

  const isSubmitting = form.formState.isSubmitting || createLoading;

  return (
    <div className="w-full pb-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldPlus className="h-5 w-5" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Add Role
              </h1>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Create a CoopInsight role and assign the permissions it should
              include.
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
                  Enter a name for this role.
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
                        <Input placeholder="Enter role name" {...field} />
                      </FormControl>
                      <FormDescription>
                        Use a short name that describes this set of access.
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
                  Select the permissions this role should grant.
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
                      ) : allPermissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No permissions are available to assign.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {allPermissions.map((permission) => {
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
                                          (item) => item !== permission.name,
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
                disabled={isSubmitting || permissionLoading}
                className="min-w-[140px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <ShieldPlus className="mr-2 h-4 w-4" />
                    Create Role
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

export default CreateRole;

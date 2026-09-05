import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
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
  clearCreateError,
  createPermission,
  fetchPermissions,
} from "@/features/permission_slice";

import { AppDispatch, RootState } from "../../../../app/store/store";
import { CreatePermissionDTO } from "@/types/permission";

const slugSchema = (fieldName: string) =>
  z
    .string()
    .trim()
    .min(2, `${fieldName} must be at least 2 characters`)
    .max(50, `${fieldName} must be at most 50 characters`)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      `${fieldName} can only contain letters, numbers, underscores and hyphens`,
    );

const formSchema = z.object({
  resource: slugSchema("Resource"),
  action: slugSchema("Action"),
  description: z.string().trim().max(200, "Description is too long").optional(),
});

type FormValues = z.infer<typeof formSchema>;

const CreatePermission = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { createLoading } = useSelector((state: RootState) => state.permission);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      resource: "",
      action: "",
      description: "",
    },
  });

  const resource = form.watch("resource");
  const action = form.watch("action");
  const permissionName =
    resource.trim() && action.trim()
      ? `${resource.trim().toLowerCase()}:${action.trim().toLowerCase()}`
      : "";

  useEffect(() => {
    return () => {
      dispatch(clearCreateError());
    };
  }, [dispatch]);

  async function onSubmit(values: FormValues) {
    const payload: CreatePermissionDTO = {
      name: `${values.resource.trim().toLowerCase()}:${values.action.trim().toLowerCase()}`,
      resource: values.resource.trim().toLowerCase(),
      action: values.action.trim().toLowerCase(),
      description: values.description?.trim() || undefined,
    };

    const resultAction = await dispatch(createPermission(payload));

    if (createPermission.fulfilled.match(resultAction)) {
      form.reset();
      dispatch(fetchPermissions());

      toast.success("Permission created successfully", {
        id: "permission-add-success",
        description: `${payload.name} has been added to CoopInsight.`,
      });

      navigate("/permissions");
      return;
    }

    const errorMessage =
      (resultAction.payload as string) ||
      "Unable to create the permission. Please try again.";

    toast.error("Permission creation failed", {
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
              <KeyRound className="h-5 w-5" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Add Permission
              </h1>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Create a CoopInsight permission that can be assigned to roles and
              users.
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField
                  control={form.control}
                  name="resource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resource</FormLabel>
                      <FormControl>
                        <Input placeholder="user" {...field} />
                      </FormControl>
                      <FormDescription>
                        The area this permission applies to, such as user or
                        role.
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
                        <Input placeholder="add" {...field} />
                      </FormControl>
                      <FormDescription>
                        The operation being allowed, such as add, edit, or
                        delete.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Permission Name</FormLabel>
                  <Input
                    value={permissionName}
                    placeholder="user:add"
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
                      <Input
                        placeholder="Optional description"
                        {...field}
                      />
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
                    Creating...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Create Permission
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

export default CreatePermission;

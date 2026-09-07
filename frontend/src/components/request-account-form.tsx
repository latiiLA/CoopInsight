import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Loader2 } from "lucide-react";
import { Label } from "./ui/label";
import { toast } from "sonner";

import { AppDispatch, RootState } from "../../app/store/store";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useNavigate } from "react-router-dom";

import { requestAccount } from "@/features/user_slice";
import { nameSchema } from "@/pages/system administrations/users/user-form-schema";

const requestAccountSchema = z.object({
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
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});

type RequestAccountFormInputs = z.infer<typeof requestAccountSchema>;

export function RequestAccountForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestAccountFormInputs>({
    resolver: zodResolver(requestAccountSchema),
  });

  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { requestAccountLoading } = useSelector(
    (state: RootState) => state.user,
  );

  const onSubmit = async (data: RequestAccountFormInputs) => {
    const result = await dispatch(
      requestAccount({
        username: data.username.trim(),
        firstName: data.firstName.trim(),
        middleName: data.middleName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim().toLowerCase(),
      }),
    );

    if (requestAccount.fulfilled.match(result)) {
      toast.success("Account request submitted", {
        description:
          result.payload ||
          "An administrator will review it before you can sign in.",
      });
      navigate("/");
      return;
    }

    toast.error(result.payload || "Unable to submit the account request.");
  };

  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">Request an account</h1>
              <p className="text-sm text-muted-foreground">
                An administrator will review your request.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  {...register("firstName")}
                />
                {errors.firstName?.message ? (
                  <p className="text-xs text-red-600">
                    {errors.firstName.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="middleName">Father name</Label>
                <Input
                  id="middleName"
                  autoComplete="additional-name"
                  {...register("middleName")}
                />
                {errors.middleName?.message ? (
                  <p className="text-xs text-red-600">
                    {errors.middleName.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="lastName">Grandfather name</Label>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  {...register("lastName")}
                />
                {errors.lastName?.message ? (
                  <p className="text-xs text-red-600">
                    {errors.lastName.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" {...register("username")} />
                {errors.username?.message ? (
                  <p className="text-xs text-red-600">
                    {errors.username.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register("email")}
                />
                {errors.email?.message ? (
                  <p className="text-xs text-red-600">{errors.email.message}</p>
                ) : null}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={requestAccountLoading}
            >
              {requestAccountLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  <span>Please wait</span>
                </>
              ) : (
                "Submit request"
              )}
            </Button>

            <FieldDescription className="text-center">
              Already have an account? <NavLink to="/">Login</NavLink>
            </FieldDescription>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

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
    .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, _ or -"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});

type RequestAccountFormInputs = z.infer<typeof requestAccountSchema>;

function FieldError({ message }: { message?: string }) {
  return (
    <p className="h-4 truncate text-xs leading-4 text-destructive">
      {message ?? "\u00a0"}
    </p>
  );
}

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
    <div className={cn("flex flex-col", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="p-5 md:p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-0.5">
              <h1 className="text-xl font-semibold tracking-tight">
                Request an account
              </h1>
              <p className="text-sm text-muted-foreground">
                An administrator will review your request before you can sign in.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  aria-invalid={Boolean(errors.firstName)}
                  {...register("firstName")}
                />
                <FieldError message={errors.firstName?.message} />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="middleName">Father name</Label>
                <Input
                  id="middleName"
                  autoComplete="additional-name"
                  aria-invalid={Boolean(errors.middleName)}
                  {...register("middleName")}
                />
                <FieldError message={errors.middleName?.message} />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="lastName">Grandfather name</Label>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  aria-invalid={Boolean(errors.lastName)}
                  {...register("lastName")}
                />
                <FieldError message={errors.lastName?.message} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  aria-invalid={Boolean(errors.username)}
                  {...register("username")}
                />
                <FieldError message={errors.username?.message} />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  {...register("email")}
                />
                <FieldError message={errors.email?.message} />
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

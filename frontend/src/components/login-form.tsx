import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import logincover from "../assets/Login-pana.svg";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { Label } from "./ui/label";
import { toast } from "sonner"

import { AppDispatch, RootState } from "../../app/store/store";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useNavigate } from "react-router-dom";

import { loginUser } from "@/features/user_slice";

// Zod schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Infer TypeScript type from schema
type LoginFormInputs = z.infer<typeof loginSchema>;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { authLoading } = useSelector(
    (state: RootState) => state.user
  );

  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (data: LoginFormInputs) => {
    const result = await dispatch(
      loginUser({
        username: data.username ?? "",
        password: data.password ?? "",
      }),
    );

    if (loginUser.fulfilled.match(result)) {
      navigate("/home");
    }

    if (loginUser.rejected.match(result)) {
      toast.error(result.payload || "Invalid username or password");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="p-6 md:p-8"
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">
                  Welcome back
                </h1>

                <p className="text-balance text-muted-foreground">
                  Login to your Switch Hub account
                </p>
              </div>

              {/* Username */}
              <div className="grid gap-2">
                <Label htmlFor="username">
                  Username
                </Label>

                <Input
                  id="username"
                  type="text"
                  {...register("username")}
                />

                {errors.username?.message ? (
                  <p className="text-xs text-red-600">
                    {errors.username.message}
                  </p>
                ) : null}
              </div>

              {/* Password */}
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">
                    Password
                  </Label>
                </div>

                <div className="relative flex items-center">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                {errors.password?.message ? (
                  <p className="text-xs text-red-600">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={authLoading}
              >
                {authLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Please wait</span>
                  </>
                ) : (
                  "Login"
                )}
              </Button>

              <FieldDescription className="text-center">
                Don&apos;t have an account?{" "}
                <NavLink to="/request-account">Request account</NavLink>
              </FieldDescription>
            </FieldGroup>
          </form>

          <div className="relative hidden bg-muted md:block">
            <img
              src={logincover}
              alt="Login"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.5]"
            />
          </div>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{" "}
        <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
}
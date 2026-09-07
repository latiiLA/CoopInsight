import { RequestAccountForm } from "@/components/request-account-form";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

import { RootState } from "../../app/store/store";

export default function RequestAccountPage() {
  const isLoggedIn = useSelector((state: RootState) => state.user.isLoggedIn);

  if (isLoggedIn) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-4 md:p-6">
      <div className="w-full max-w-2xl">
        <RequestAccountForm />
      </div>
    </div>
  );
}

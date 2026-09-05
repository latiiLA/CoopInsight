import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

import { RootState } from "../../app/store/store";
import { hasPermission } from "../../utility/has-permission";

export function RequirePermission({
  permissions,
  children,
}: {
  permissions: string[];
  children: ReactNode;
}) {
  const isLoggedIn = useSelector((state: RootState) => state.user.isLoggedIn);
  const granted = useSelector((state: RootState) => state.user.permissions);

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  if (!hasPermission(permissions, granted)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}

import { useEffect } from "react";
import { useSelector } from "react-redux";
import { jwtDecode } from "jwt-decode";

import { RootState } from "../../app/store/store";
import { endSession, refreshAccessToken } from "@/lib/auth-session";

const REFRESH_AHEAD_MS = 2 * 60 * 1000;

export function useAccessTokenRefresh() {
  const isLoggedIn = useSelector((state: RootState) => state.user.isLoggedIn);
  const token = useSelector(
    (state: RootState) => state.user.authUser?.data?.token,
  );

  useEffect(() => {
    if (!isLoggedIn || !token) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    try {
      const { exp } = jwtDecode<{ exp?: number }>(token);

      if (!exp) {
        return;
      }

      const delay = exp * 1000 - Date.now() - REFRESH_AHEAD_MS;
      const run = () => {
        if (cancelled) {
          return;
        }

        void refreshAccessToken().catch(() => {
          void endSession();
        });
      };

      if (delay <= 0) {
        run();
        return;
      }

      timeoutId = window.setTimeout(run, delay);
    } catch {
      return;
    }

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isLoggedIn, token]);
}

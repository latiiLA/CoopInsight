import { useEffect, useState } from "react";

import { getStoredAuthToken } from "@/utility/auth-token";

/**
 * Resolve a same-origin /uploads/... path via an authenticated fetch so
 * <img> tags never need a query-string access token. Preset avatar paths
 * (e.g. /avatars/*.svg) are returned unchanged.
 */
export function useAuthFileUrl(src?: string | null) {
  const [resolved, setResolved] = useState<string | undefined>(() =>
    src && !src.startsWith("/uploads/") ? src : undefined,
  );

  useEffect(() => {
    if (!src) {
      setResolved(undefined);
      return;
    }

    if (!src.startsWith("/uploads/")) {
      setResolved(src);
      return;
    }

    const token = getStoredAuthToken();
    if (!token) {
      setResolved(undefined);
      return;
    }

    let cancelled = false;
    let objectUrl: string | undefined;

    setResolved(undefined);

    void (async () => {
      try {
        const response = await fetch(src, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok || cancelled) {
          return;
        }
        const blob = await response.blob();
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setResolved(objectUrl);
      } catch {
        if (!cancelled) {
          setResolved(undefined);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  return resolved;
}

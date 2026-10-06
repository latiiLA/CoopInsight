import { useEffect } from "react";

import type { EmbedTheme } from "./params";

export function useTheme(theme: EmbedTheme) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme !== "auto") {
      root.classList.toggle("dark", theme === "dark");
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.classList.toggle("dark", media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

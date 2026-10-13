import { Loader2 } from "lucide-react";

type LoadingMoreBannerProps = {
  loadedCount?: number;
};

export function LoadingMoreBanner({ loadedCount }: LoadingMoreBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-20 flex items-start gap-3 rounded-md border border-amber-400 bg-amber-200 px-4 py-3 text-amber-950 shadow-md dark:border-amber-500 dark:bg-amber-900 dark:text-amber-50"
    >
      <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">Still loading more rows…</p>
        <p className="text-xs font-medium opacity-90">
          {loadedCount != null
            ? `${loadedCount.toLocaleString()} loaded so far. Wait until this banner disappears before using or exporting the list.`
            : "Wait until this banner disappears before using or exporting the list."}
        </p>
      </div>
    </div>
  );
}

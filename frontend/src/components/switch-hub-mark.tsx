import { cn } from "@/lib/utils";

export function SwitchHubMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "group inline-flex items-baseline gap-2",
        className,
      )}
    >
      <span className="text-[15px] font-semibold tracking-[-0.05em] text-foreground">
        Switch
      </span>
      <span className="relative text-[15px] font-medium tracking-tight text-primary">
        Hub
        <span className="absolute inset-x-0 -bottom-px h-px origin-left bg-primary/80 transition-transform duration-200 group-hover:scale-x-110" />
      </span>
    </span>
  );
}

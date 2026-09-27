import { cn } from "@/lib/utils";

/**
 * A count that opens the card detail list for its own scope.
 *
 * Used inside rows that already have their own click behaviour (selecting a
 * branch for the trend), so the drill click stops propagation rather than
 * fighting the row handler. Renders plain text when no handler is supplied,
 * which keeps callers free of conditional markup.
 */
export function DrillValue({
  value,
  onClick,
  className,
  format,
}: {
  value: number;
  onClick?: () => void;
  className?: string;
  format?: (value: number) => string;
}) {
  const display = format ? format(value) : value.toLocaleString();

  if (!onClick) {
    return <span className={className}>{display}</span>;
  }

  return (
    <button
      type="button"
      className={cn(
        "rounded px-1 py-0.5 tabular-nums underline-offset-2 hover:bg-primary/10 hover:underline",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={`View ${display} cards`}
    >
      {display}
    </button>
  );
}

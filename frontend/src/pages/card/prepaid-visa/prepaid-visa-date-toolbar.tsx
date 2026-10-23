import { isSameDay, startOfDay, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";

import { DatePickerWithRange } from "@/components/date-picker";
import { Button } from "@/components/ui/button";

const PRESETS: { label: string; /** Inclusive calendar days ending today */ days: number }[] =
  [
    { label: "Today", days: 1 },
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
  ];

type Props = {
  dateRange: DateRange | undefined;
  onDateChange: (range: DateRange | undefined) => void;
};

function rangeForPreset(days: number): DateRange {
  const to = startOfDay(new Date());
  if (days <= 1) {
    return { from: to, to };
  }
  return { from: subDays(to, days - 1), to };
}

function isPresetActive(
  dateRange: DateRange | undefined,
  days: number,
): boolean {
  if (!dateRange?.from || !dateRange?.to) {
    return false;
  }
  const preset = rangeForPreset(days);
  return (
    isSameDay(dateRange.from, preset.from!) &&
    isSameDay(dateRange.to, preset.to!)
  );
}

/**
 * Always accept partial ranges so the calendar can show the first click.
 * Parents should only fetch when both from and to are set.
 */
export function PrepaidVisaDateToolbar({ dateRange, onDateChange }: Props) {
  const customSelected =
    dateRange?.from != null &&
    dateRange?.to != null &&
    !PRESETS.some((preset) => isPresetActive(dateRange, preset.days));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => {
        const active = isPresetActive(dateRange, preset.days);
        return (
          <Button
            key={preset.label}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            aria-pressed={active}
            onClick={() => onDateChange(rangeForPreset(preset.days))}
          >
            {preset.label}
          </Button>
        );
      })}
      <div
        className={
          customSelected
            ? "rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background"
            : undefined
        }
      >
        <DatePickerWithRange date={dateRange} onDateChange={onDateChange} />
      </div>
    </div>
  );
}

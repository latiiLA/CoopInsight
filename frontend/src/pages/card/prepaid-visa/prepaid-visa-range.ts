import { format, isValid, parse, startOfDay, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";

import type { PrepaidVisaProductFilter } from "@/types/prepaid-visa";

const API_DATE = "MM/dd/yyyy";

export function getTodayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

/** Inclusive last N calendar days ending today (N=30 → today and prior 29 days). */
export function getLastDaysRange(days: number): DateRange {
  const to = startOfDay(new Date());
  if (days <= 1) {
    return { from: to, to };
  }
  return { from: subDays(to, days - 1), to };
}

export function getLast7DaysRange(): DateRange {
  return getLastDaysRange(7);
}

export function getLast30DaysRange(): DateRange {
  return getLastDaysRange(30);
}

export function rangeToSearchParams(
  range: DateRange | undefined,
  product: PrepaidVisaProductFilter,
): URLSearchParams {
  const params = new URLSearchParams();
  if (range?.from && range?.to) {
    params.set("dateFrom", format(range.from, API_DATE));
    params.set("dateTo", format(range.to, API_DATE));
  }
  if (product) {
    params.set("product", product);
  }
  return params;
}

export function parseRangeFromSearch(search: string): {
  range?: DateRange;
  product: PrepaidVisaProductFilter;
} {
  const params = new URLSearchParams(search);
  const productRaw = params.get("product")?.trim() ?? "";
  const product: PrepaidVisaProductFilter =
    productRaw === "401" || productRaw === "402" ? productRaw : "";

  const fromRaw = params.get("dateFrom");
  const toRaw = params.get("dateTo");
  if (!fromRaw || !toRaw) {
    return { product };
  }

  const from = parse(fromRaw, API_DATE, new Date());
  const to = parse(toRaw, API_DATE, new Date());
  if (!isValid(from) || !isValid(to)) {
    return { product };
  }

  return {
    product,
    range: { from: startOfDay(from), to: startOfDay(to) },
  };
}

export function prepaidVisaHref(
  path: string,
  range: DateRange | undefined,
  product: PrepaidVisaProductFilter,
): string {
  const params = rangeToSearchParams(range, product);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

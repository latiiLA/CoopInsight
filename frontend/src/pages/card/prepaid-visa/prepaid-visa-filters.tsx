import type { DateRange } from "react-day-picker";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PrepaidVisaProductFilter } from "@/types/prepaid-visa";

import { prepaidVisaHref } from "./prepaid-visa-range";

const PRODUCT_OPTIONS: { id: PrepaidVisaProductFilter; label: string }[] = [
  { id: "", label: "All products" },
  { id: "401", label: "Platinum" },
  { id: "402", label: "Classic" },
];

const PAGE_LINKS = [
  { to: "/prepaid-visa", label: "Dashboard", end: true },
  { to: "/prepaid-visa/search", label: "Search", end: false },
  { to: "/prepaid-visa/top-ups", label: "Top-ups", end: false },
  { to: "/prepaid-visa/unloads", label: "Unloads", end: false },
  { to: "/prepaid-visa/transactions", label: "Transactions", end: false },
  { to: "/prepaid-visa/reconciliation", label: "Reconciliation", end: false },
] as const;

type Props = {
  product: PrepaidVisaProductFilter;
  onProductChange: (product: PrepaidVisaProductFilter) => void;
  dateRange?: DateRange;
};

export function PrepaidVisaFilters({
  product,
  onProductChange,
  dateRange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
        {PAGE_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={prepaidVisaHref(link.to, dateRange, product)}
            end={link.end}
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex flex-wrap gap-1">
        {PRODUCT_OPTIONS.map((opt) => (
          <Button
            key={opt.id || "all"}
            type="button"
            size="sm"
            variant={product === opt.id ? "default" : "outline"}
            onClick={() => onProductChange(opt.id)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

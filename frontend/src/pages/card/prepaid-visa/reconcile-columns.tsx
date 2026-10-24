import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import type { PrepaidVisaCardReconcile } from "@/types/prepaid-visa";

import { formatUsd, productLabel } from "./prepaid-visa-format";

const columnHelper = createColumnHelper<
  DataTableFeatures,
  PrepaidVisaCardReconcile
>();

function sortableHeader(label: string) {
  return ({
    column,
  }: {
    column: {
      toggleSorting: (asc: boolean) => void;
      getIsSorted: () => false | "asc" | "desc";
    };
  }) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

export const prepaidVisaReconcileColumns = () => [
  columnHelper.accessor("matched", {
    header: sortableHeader("Status"),
    cell: ({ getValue }) =>
      getValue() ? (
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          Match
        </span>
      ) : (
        <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
          Mismatch
        </span>
      ),
  }),
  columnHelper.accessor("cardMasked", {
    header: sortableHeader("Card"),
    cell: ({ row, getValue }) => {
      const linked = row.original.linkedCards ?? 1;
      return (
        <span>
          {getValue()}
          {linked > 1 ? (
            <span className="ml-1 text-xs text-muted-foreground">
              · {linked} cards
            </span>
          ) : null}
        </span>
      );
    },
  }),
  columnHelper.accessor("cardholderName", {
    header: sortableHeader("Cardholder"),
    cell: ({ getValue }) => getValue() || "—",
  }),
  columnHelper.accessor("productCode", {
    header: sortableHeader("Product"),
    cell: ({ getValue }) => productLabel(getValue()),
  }),
  columnHelper.accessor("topUpAmount", {
    header: sortableHeader("Top-ups"),
    cell: ({ getValue }) => formatUsd(getValue()),
  }),
  columnHelper.accessor("availableAmount", {
    header: sortableHeader("Avail amt"),
    cell: ({ getValue }) => formatUsd(getValue()),
  }),
  columnHelper.accessor("availableBalance", {
    header: sortableHeader("Avail bal"),
    cell: ({ getValue }) => formatUsd(getValue()),
  }),
  columnHelper.accessor("blockedBalance", {
    header: sortableHeader("Blocked"),
    cell: ({ getValue }) => formatUsd(getValue()),
  }),
  columnHelper.accessor("fromAvailable", {
    header: sortableHeader("From avail"),
    cell: ({ getValue }) => formatUsd(getValue()),
  }),
  columnHelper.accessor("unloaded", {
    header: sortableHeader("Unloaded"),
    cell: ({ getValue }) => formatUsd(getValue()),
  }),
  columnHelper.accessor("expected", {
    header: sortableHeader("Expected"),
    cell: ({ getValue }) => formatUsd(getValue()),
  }),
  columnHelper.accessor("variance", {
    header: sortableHeader("Variance"),
    cell: ({ getValue }) => {
      const v = getValue();
      const tone =
        Math.abs(v) <= 1
          ? ""
          : v > 0
            ? "text-amber-700 dark:text-amber-400"
            : "text-rose-700 dark:text-rose-400";
      return <span className={`tabular-nums ${tone}`}>{formatUsd(v)}</span>;
    },
  }),
  columnHelper.accessor("branchName", {
    header: sortableHeader("Branch"),
  }),
];

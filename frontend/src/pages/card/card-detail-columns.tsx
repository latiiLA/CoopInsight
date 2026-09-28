import {
  createColumnHelper,
  type Column,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTableFeatures } from "@/components/data-table-features";
import { CardDetail, formatCardDate } from "@/types/card-detail";

const columnHelper = createColumnHelper<DataTableFeatures, CardDetail>();

function sortableHeader<TValue>(
  label: string,
  column: Column<DataTableFeatures, CardDetail, TValue>,
) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

function orDash(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

/**
 * Columns for the card detail list.
 *
 * `cardholderVisible` is threaded through rather than read from the store so the
 * table and the permission decision cannot drift apart. The cardholder column is
 * omitted entirely when the caller lacks the permission, because a blank column
 * would imply the data is missing rather than withheld.
 *
 * The return type widens TValue to `any`, which is what the column helper's own
 * `columns()` does. `Column` is invariant in TValue, so an array inferred as
 * `AccessorKeyColumnDef<..., CardDetail, string>` is not assignable to
 * DataTable's `ColumnDef<..., CardDetail, unknown>` even though every accessor
 * here returns a string.
 */
export function cardDetailColumns(
  cardholderVisible: boolean,
): ColumnDef<DataTableFeatures, CardDetail, any>[] {
  // The shared TableCell sets whitespace-nowrap, so every text column needs an
  // explicit max-width before truncate or wrap can take effect. Without one a
  // long branch or cardholder name stretches the whole table.
  const columns: ColumnDef<DataTableFeatures, CardDetail, any>[] = [
    columnHelper.accessor("cardMasked", {
      header: ({ column }) => sortableHeader("Card", column),
      cell: ({ getValue }) => (
        <span className="font-mono text-xs tabular-nums">{getValue()}</span>
      ),
    }),

    columnHelper.accessor("productName", {
      header: ({ column }) => sortableHeader("Product", column),
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[6.5rem]">
          {/* Wraps rather than truncates: product names are long but
              informative, and a silent ellipsis is worse than a second line. */}
          <div
            className="whitespace-normal break-words leading-snug"
            title={row.original.productName || undefined}
          >
            {orDash(row.original.productName)}
          </div>
          {row.original.productCode ? (
            <div className="text-xs text-muted-foreground">
              {row.original.productCode}
            </div>
          ) : null}
        </div>
      ),
    }),

    columnHelper.accessor("statusDescription", {
      header: ({ column }) => sortableHeader("Status", column),
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[7rem]">
          <div className="truncate">{orDash(row.original.statusDescription)}</div>
          {row.original.statusCode ? (
            <div className="text-xs text-muted-foreground">
              {row.original.statusCode}
            </div>
          ) : null}
        </div>
      ),
    }),

    columnHelper.accessor("branchName", {
      header: ({ column }) => sortableHeader("Branch", column),
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[10rem]">
          <div className="truncate">{orDash(row.original.branchName)}</div>
          {row.original.branchCode ? (
            <div className="text-xs text-muted-foreground">
              {row.original.branchCode}
            </div>
          ) : null}
        </div>
      ),
    }),

    columnHelper.accessor("createdAt", {
      header: ({ column }) => sortableHeader("Requested", column),
      cell: ({ getValue }) => formatCardDate(getValue()),
    }),

    columnHelper.accessor("issuedAt", {
      header: ({ column }) => sortableHeader("Issued", column),
      cell: ({ getValue }) => formatCardDate(getValue()),
    }),

    columnHelper.accessor("activatedAt", {
      header: ({ column }) => sortableHeader("Activated", column),
      cell: ({ getValue }) => formatCardDate(getValue()),
    }),

    columnHelper.accessor("expiryDate", {
      header: ({ column }) => sortableHeader("Expires", column),
      cell: ({ getValue }) => formatCardDate(getValue()),
    }),
  ];

  if (!cardholderVisible) {
    return columns;
  }

  // Inserted after the card number so the sensitive column sits next to the
  // identifier it belongs to. Wrapped rather than truncated, because a
  // cardholder name is the one column where silently hiding characters would be
  // worse than using a second line.
  columns.splice(1, 0, columnHelper.accessor("cardholderName", {
    header: ({ column }) => sortableHeader("Cardholder", column),
    cell: ({ getValue }) => (
      <div
        className="max-w-[8rem] whitespace-normal break-words leading-snug"
        title={getValue() || undefined}
      >
        {orDash(getValue())}
      </div>
    ),
  }));

  return columns;
}

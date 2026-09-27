import {
  createColumnHelper,
  type Column,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTableFeatures } from "@/components/data-table-features";
import { cn } from "@/lib/utils";
import {
  CARD_HEALTH_LABELS,
  CardHealth,
  CardStatusGroupBy,
  CardStatusReport,
  groupsByBranch,
  groupsByProduct,
  groupsByStatus,
} from "@/types/card-status-report";

const columnHelper = createColumnHelper<DataTableFeatures, CardStatusReport>();

/** Badge tint per health band, matching the summary tiles. */
const HEALTH_BADGE: Record<CardHealth, string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  notActive: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  blocked: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  dead: "bg-destructive/10 text-destructive",
  other: "bg-muted text-muted-foreground",
};

function sortableHeader<TValue>(
  label: string,
  column: Column<DataTableFeatures, CardStatusReport, TValue>,
  align: "left" | "right" = "left",
) {
  return (
    <Button
      variant="ghost"
      className={align === "right" ? "ml-auto" : undefined}
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

function count(value: number) {
  return Number(value ?? 0).toLocaleString();
}

/**
 * Columns for the cards-per-status report.
 *
 * The dimension columns follow the active grouping, so the table never shows a
 * Product column full of dashes when the report is not grouped by product.
 *
 * TValue is widened to `any`, matching the column helper's own `columns()`
 * return, so the array satisfies DataTable's `ColumnDef<..., unknown>`.
 */
export function cardStatusColumns(
  groupBy: CardStatusGroupBy,
  expiringWithinMonths: number,
): ColumnDef<DataTableFeatures, CardStatusReport, any>[] {
  const columns: ColumnDef<DataTableFeatures, CardStatusReport, any>[] = [];

  if (groupsByStatus(groupBy)) {
    // Health sits next to the status because it is the answer to "can this card
    // be used", which is what the status code alone does not convey.
    columns.push(
      columnHelper.accessor("health", {
        header: ({ column }) => sortableHeader("Usability", column),
        cell: ({ getValue }) => {
          const band = getValue() as CardHealth;
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                HEALTH_BADGE[band] ?? HEALTH_BADGE.other,
              )}
            >
              {CARD_HEALTH_LABELS[band] ?? CARD_HEALTH_LABELS.other}
            </span>
          );
        },
      }),
    );
  }

  if (groupsByStatus(groupBy)) {
    columns.push(
      columnHelper.accessor("statusDescription", {
        header: ({ column }) => sortableHeader("Status", column),
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[11rem]">
            <div className="truncate">
              {orDash(row.original.statusDescription)}
            </div>
            {row.original.cardStatus ? (
              <div className="text-xs text-muted-foreground">
                {row.original.cardStatus}
              </div>
            ) : null}
          </div>
        ),
      }) as ColumnDef<DataTableFeatures, CardStatusReport, any>,
    );
  }

  if (groupsByProduct(groupBy)) {
    columns.push(
      columnHelper.accessor("productName", {
        header: ({ column }) => sortableHeader("Product", column),
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[9rem]">
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
      }) as ColumnDef<DataTableFeatures, CardStatusReport, any>,
    );
  }

  if (groupsByBranch(groupBy)) {
    columns.push(
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
      }) as ColumnDef<DataTableFeatures, CardStatusReport, any>,
    );
  }

  columns.push(
    columnHelper.accessor("cardCount", {
      header: ({ column }) => sortableHeader("Cards", column, "right"),
      cell: ({ getValue }) => (
        <span className="font-medium tabular-nums">{count(getValue())}</span>
      ),
    }) as ColumnDef<DataTableFeatures, CardStatusReport, any>,
  );

  const ageColumn = (
    label: string,
    accessor: "age0to7" | "age8to30" | "age31to90" | "age91plus",
  ) =>
    columnHelper.accessor(accessor, {
      header: ({ column }) => sortableHeader(label, column, "right"),
      cell: ({ getValue }) => (
        <span className="tabular-nums text-muted-foreground">
          {count(getValue())}
        </span>
      ),
    }) as ColumnDef<DataTableFeatures, CardStatusReport, any>;

  columns.push(
    ageColumn("0-7 days", "age0to7"),
    ageColumn("8-30 days", "age8to30"),
    ageColumn("31-90 days", "age31to90"),
    ageColumn("91+ days", "age91plus"),
  );

  if (expiringWithinMonths > 0) {
    columns.push(
      columnHelper.accessor("expiringCount", {
        header: ({ column }) =>
          sortableHeader(`Expires <${expiringWithinMonths}m`, column, "right"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {count(getValue())}
          </span>
        ),
      }) as ColumnDef<DataTableFeatures, CardStatusReport, any>,
    );
  }

  return columns;
}

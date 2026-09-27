import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearCardStatus,
  fetchCardStatus,
} from "@/features/card_slice";
import {
  CARD_STATUS_DATE_FIELD_OPTIONS,
  CARD_STATUS_GROUP_BY_OPTIONS,
  CardHealth,
  CardStatusDateField,
  CardStatusGroupBy,
  groupsByStatus,
} from "@/types/card-status-report";
import { AppDispatch, RootState } from "../../../app/store/store";
import { CardHealthSummary } from "./card-health-summary";
import { cardStatusColumns } from "./columns";

/** Expiry windows offered in the UI. 0 would hide the column entirely. */
const EXPIRY_WINDOWS = [
  { value: "24", label: "24 months" },
  { value: "36", label: "36 months" },
  { value: "60", label: "60 months" },
  { value: "120", label: "10 years" },
];

type CardStatusPageProps = {
  title: string;
  description: string;
};

export default function CardPerStatus({
  title,
  description,
}: CardStatusPageProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { rows, loading, groupBy, dateField, expiringWithinMonths } = useSelector(
    (state: RootState) => state.card,
  );

  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedGroupBy, setSelectedGroupBy] =
    useState<CardStatusGroupBy>("status");
  const [selectedDateField, setSelectedDateField] =
    useState<CardStatusDateField>("created");
  const [expiryWindow, setExpiryWindow] = useState("60");

  const columns = useMemo(
    () => cardStatusColumns(groupBy, expiringWithinMonths),
    [groupBy, expiringWithinMonths],
  );

  // Selecting a health band filters the table client side. The report already
  // returns every status for the current grouping, so this needs no extra
  // request.
  const [healthFilter, setHealthFilter] = useState<CardHealth | null>(null);

  // An unset range means the report is unfiltered, which is every card on
  // record rather than a default window. Collapsing to a concrete pair here
  // narrows both ends for the caption, which a hasDateRange boolean cannot do
  // on its own.
  const activeRange = useMemo(() => {
    const from = dateRange?.from;
    const to = dateRange?.to;
    return from && to ? { from, to } : undefined;
  }, [dateRange]);

  const hasDateRange = activeRange !== undefined;

  const visibleRows = useMemo(
    () =>
      healthFilter
        ? rows.filter((row) => row.health === healthFilter)
        : rows,
    [rows, healthFilter],
  );

  const handleSelectHealth = useCallback((band: CardHealth) => {
    // Selecting the active band again clears the filter, so the control
    // behaves like a toggle rather than a one-way switch.
    setHealthFilter((current) => (current === band ? null : band));
  }, []);

  useEffect(() => {
    const dateFrom = dateRange?.from
      ? format(dateRange.from, "MM/dd/yyyy")
      : undefined;

    const dateTo = dateRange?.to
      ? format(dateRange.to, "MM/dd/yyyy")
      : undefined;

    const promise = dispatch(
      fetchCardStatus({
        dateFrom,
        dateTo,
        groupBy: selectedGroupBy,
        dateField: selectedDateField,
        expiringWithinMonths: Number(expiryWindow),
      }),
    );

    promise.then((result) => {
      if (
        fetchCardStatus.rejected.match(result) &&
        !result.meta.aborted
      ) {
        toast.error(result.payload || "Failed to fetch card status report");
      }
    });

    return () => {
      promise.abort();
    };
  }, [dateRange, selectedGroupBy, selectedDateField, expiryWindow, dispatch]);

  useEffect(() => {
    return () => {
      dispatch(clearCardStatus());
    };
  }, [dispatch]);

  // The ageing columns count back from whichever date the report is bucketed
  // on, so the heading has to say which one is in effect.
  const ageingBasis =
    dateField === "statusChanged" ? "status last changed" : "card requested";

  const totalCards = useMemo(
    () => visibleRows.reduce((sum, row) => sum + row.cardCount, 0),
    [visibleRows],
  );

  return (
    <div className="container mx-auto">
      <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Group by</div>
            <Select
              value={selectedGroupBy}
              onValueChange={(value) =>
                setSelectedGroupBy(value as CardStatusGroupBy)
              }
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARD_STATUS_GROUP_BY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Date applies to</div>
            <Select
              value={selectedDateField}
              onValueChange={(value) =>
                setSelectedDateField(value as CardStatusDateField)
              }
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARD_STATUS_DATE_FIELD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Expires within</div>
            <Select value={expiryWindow} onValueChange={setExpiryWindow}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_WINDOWS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Dates</div>
            <div className="flex items-center gap-2">
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
              />
              <Button
                type="button"
                variant={hasDateRange ? "outline" : "default"}
                size="sm"
                onClick={() => setDateRange(undefined)}
                disabled={!hasDateRange}
              >
                All time
              </Button>
            </div>
          </div>
        </div>
      </div>

      {groupsByStatus(groupBy) ? (
        <CardHealthSummary
          rows={rows}
          selected={healthFilter}
          onSelect={handleSelectHealth}
          onClear={() => setHealthFilter(null)}
        />
      ) : (
        <p className="py-3 text-xs text-muted-foreground">
          Usability needs the status dimension, which this grouping rolls up, so
          it is not shown. Choose{" "}
          <span className="font-medium text-foreground">
            {groupBy === "product" ? "Status and product" : "Status and branch"}
          </span>{" "}
          to see it.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {activeRange ? (
          <>
            Showing cards dated {format(activeRange.from, "MMM d, yyyy")} to{" "}
            {format(activeRange.to, "MMM d, yyyy")}.
          </>
        ) : (
          <>
            No date range selected, so this covers{" "}
            <span className="font-medium text-foreground">
              every card on record
            </span>
            . Pick dates, or use All time to stay here.
          </>
        )}{" "}
        Ageing columns count back from {ageingBasis}.
        {healthFilter
          ? " Filtered to one health band; use All cards to clear it."
          : ""}
      </p>

      <DataTable
        columns={columns}
        data={visibleRows}
        loading={loading}
        searchPlaceholder="Search status, product, branch..."
        exportFileName={`cards-per-status-${groupBy}`}
      />

      {!loading && visibleRows.length > 0 ? (
        <p className="py-2 text-xs text-muted-foreground">
          {visibleRows.length.toLocaleString()} group
          {visibleRows.length === 1 ? "" : "s"} ·{" "}
          {totalCards.toLocaleString()} card
          {totalCards === 1 ? "" : "s"} in total
        </p>
      ) : null}
    </div>
  );
}

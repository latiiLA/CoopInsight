import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CARD_DETAIL_MAX_AUTO_PAGES,
  clearCardDetails,
  fetchCardDetails,
  prepareCardDetails,
} from "@/features/card_detail_slice";
import { CardMetric, isSentinelDate } from "@/types/card-detail";
import { AppDispatch, RootState } from "../../../app/store/store";
import { cardDetailColumns } from "./card-detail-columns";

const METRIC_LABEL: Record<CardMetric, string> = {
  created: "requested",
  issued: "issued",
  activated: "activated",
};

/** Columns whose value is a date that may hold the far-future sentinel. */
const CARD_DATE_COLUMNS = [
  "effectiveDate",
  "expiryDate",
  "createdAt",
  "issuedAt",
  "activatedAt",
] as const;

/**
 * The export path reads raw accessor values, so the sentinel year would land in
 * the file as a real-looking 2263 date. Blanking it keeps the download
 * consistent with the screen, which shows a dash.
 */
const exportValueByColumn = Object.fromEntries(
  CARD_DATE_COLUMNS.map((id) => [
    id,
    (value: unknown) => (isSentinelDate(value as string) ? "" : value),
  ]),
);

type CardDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: CardMetric;
  dateFrom: string;
  dateTo: string;
  branchId?: number;
  /** Human-readable scope shown in the subtitle, e.g. a branch or day name. */
  scopeLabel?: string;
};

/**
 * CardDetailSheet lists the individual cards behind an activity count.
 *
 * Paging is server-side: page 1 renders as soon as it lands, then later pages
 * are streamed in and appended, mirroring the uncleared list. The first page is
 * never withheld waiting for the rest, which is what keeps a wide date range
 * feeling fast.
 */
export function CardDetailSheet({
  open,
  onOpenChange,
  metric,
  dateFrom,
  dateTo,
  branchId,
  scopeLabel,
}: CardDetailSheetProps) {
  const dispatch = useDispatch<AppDispatch>();
  const {
    items,
    page,
    hasMore,
    loading,
    loadingMore,
    error,
    truncated,
    cardholderVisible,
  } = useSelector((state: RootState) => state.cardDetail);

  // Guards against a late page appending itself to a list the user has already
  // navigated away from.
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (targetPage: number) => {
      const requestId = ++requestIdRef.current;

      const promise = dispatch(
        fetchCardDetails({
          metric,
          dateFrom,
          dateTo,
          branchId,
          page: targetPage,
        }),
      );

      const result = await promise;

      if (requestId !== requestIdRef.current) {
        return null;
      }

      if (fetchCardDetails.rejected.match(result)) {
        if (!result.meta.aborted) {
          toast.error(result.payload || "Failed to load card details");
        }
        return null;
      }

      if (!fetchCardDetails.fulfilled.match(result)) {
        return null;
      }

      return result.payload;
    },
    [dispatch, metric, dateFrom, dateTo, branchId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    dispatch(prepareCardDetails(metric));

    const run = async () => {
      let currentPage = 1;

      // Sequential so pages append in order and the "Loading more…" line stays
      // honest about what is still outstanding.
      for (;;) {
        const result = await load(currentPage);
        if (!result) {
          return;
        }
        if (!result.hasMore || currentPage >= CARD_DETAIL_MAX_AUTO_PAGES) {
          return;
        }
        currentPage += 1;
      }
    };

    void run();

    return () => {
      // Invalidate in-flight pages without clearing state, so the list survives
      // a re-render and is only reset when the sheet closes.
      requestIdRef.current += 1;
    };
  }, [open, metric, dateFrom, dateTo, branchId, load]);

  useEffect(() => {
    if (!open) {
      dispatch(clearCardDetails());
    }
  }, [open, dispatch]);

  const columns = useMemo(
    () => cardDetailColumns(cardholderVisible),
    [cardholderVisible],
  );

  const title = `Cards ${METRIC_LABEL[metric]}`;

  const filterHint = [
    scopeLabel,
    dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`,
    !cardholderVisible ? "cardholder name withheld" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const stopReached = truncated || (hasMore && page >= CARD_DETAIL_MAX_AUTO_PAGES);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-6xl"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{filterHint}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-muted-foreground">
          <span>
            {loading
              ? "Loading cards…"
              : error
                ? error
                : `${items.length.toLocaleString()} card${items.length === 1 ? "" : "s"}`}
            {loadingMore ? " · loading more…" : ""}
          </span>
          <div className="flex items-center gap-2">
            {stopReached ? (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Showing the first {items.length.toLocaleString()}. Narrow the
                date range for a complete list.
              </span>
            ) : null}
            {hasMore && !stopReached ? (
              <Button
                variant="outline"
                size="sm"
                disabled={loading || loadingMore}
                onClick={() => void load(page + 1)}
              >
                Load more
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={loading || loadingMore}
              onClick={() => void load(1)}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          <DataTable
            loading={loading}
            columns={columns}
            data={items}
            searchPlaceholder="Search card, product, status, branch..."
            exportFileName={`cards-${metric}`}
            exportValueByColumn={exportValueByColumn}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

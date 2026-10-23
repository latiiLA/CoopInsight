import { format } from "date-fns";
import { CreditCard, TrendingDown, Users, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { LoadingMoreBanner } from "@/components/loading-more-banner";
import { MetricCard } from "@/components/metric-card";
import {
  CLEARING_MAX_AUTO_PAGES,
  fetchPrepaidVisaUnloads,
} from "@/features/prepaid_visa_slice";
import type {
  PrepaidVisaProductFilter,
  PrepaidVisaUnload,
} from "@/types/prepaid-visa";
import { AppDispatch, RootState } from "../../../../app/store/store";

import {
  PrepaidVisaCardSheet,
  type PrepaidVisaCardFocus,
} from "./prepaid-visa-card-sheet";
import { PrepaidVisaDateToolbar } from "./prepaid-visa-date-toolbar";
import { PrepaidVisaFilters } from "./prepaid-visa-filters";
import { formatCount, formatUsd } from "./prepaid-visa-format";
import {
  getLast30DaysRange,
  parseRangeFromSearch,
  prepaidVisaHref,
} from "./prepaid-visa-range";
import { unloadColumns } from "./unload-columns";

export default function PrepaidVisaUnloads() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    unloads,
    unloadsLoading,
    unloadsLoadingMore,
    unloadsTruncated,
    topUps,
    transactions,
  } = useSelector((state: RootState) => state.prepaidVisa);

  const initial = useMemo(
    () => parseRangeFromSearch(location.search),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [product, setProduct] = useState<PrepaidVisaProductFilter>(
    initial.product,
  );
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    () => initial.range ?? getLast30DaysRange(),
  );
  const requestIdRef = useRef(0);
  const [cardFocus, setCardFocus] = useState<PrepaidVisaCardFocus | null>(null);

  const openCard = useCallback((row: PrepaidVisaUnload) => {
    setCardFocus({ kind: "unload", row });
  }, []);

  const summary = useMemo(() => {
    const count = unloads.length;
    const amount = unloads.reduce((sum, row) => sum + (row.amount || 0), 0);
    const cards = new Set(unloads.map((r) => r.cardId)).size;
    const avg = count > 0 ? amount / count : 0;
    return { count, amount, cards, avg };
  }, [unloads]);

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const dateFrom = format(dateRange.from, "MM/dd/yyyy");
    const dateTo = format(dateRange.to, "MM/dd/yyyy");
    let cancelled = false;
    const controllers: Array<{ abort: () => void }> = [];

    navigate(prepaidVisaHref("/prepaid-visa/unloads", dateRange, product), {
      replace: true,
    });

    const run = async () => {
      let nextPage = 1;
      let continueFetch = true;

      while (continueFetch && !cancelled && requestId === requestIdRef.current) {
        const promise = dispatch(
          fetchPrepaidVisaUnloads({
            dateFrom,
            dateTo,
            product: product || undefined,
            page: nextPage,
          }),
        );
        controllers.push(promise);

        const result = await promise;
        if (cancelled || requestId !== requestIdRef.current) {
          return;
        }

        if (fetchPrepaidVisaUnloads.rejected.match(result)) {
          if (!result.meta.aborted) {
            toast.error(result.payload || "Failed to load unloads");
          }
          return;
        }

        if (!fetchPrepaidVisaUnloads.fulfilled.match(result)) {
          return;
        }

        const { hasMore: more, page: currentPage } = result.payload;
        continueFetch = more && currentPage < CLEARING_MAX_AUTO_PAGES;
        nextPage = currentPage + 1;
      }
    };

    void run();

    return () => {
      cancelled = true;
      controllers.forEach((p) => p.abort());
    };
  }, [dateRange, product, dispatch, navigate]);

  return (
    <div className="container mx-auto space-y-4 pb-6">
      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Prepaid Visa unloads
          </h3>
          <p className="text-sm text-muted-foreground">
            Account corrections that return funds and zero the card
          </p>
          {unloadsTruncated ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Showing the first {unloads.length.toLocaleString()} rows. Narrow
              the date range for a complete list.
            </p>
          ) : null}
        </div>
        <PrepaidVisaDateToolbar
          dateRange={dateRange}
          onDateChange={setDateRange}
        />
      </div>

      <PrepaidVisaFilters
        product={product}
        onProductChange={setProduct}
        dateRange={dateRange}
      />

      {unloadsLoadingMore ? (
        <LoadingMoreBanner loadedCount={unloads.length} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Unloads"
          value={formatCount(summary.count)}
          hint="Unloads in the selected range"
          icon={Wallet}
          loading={unloadsLoading}
        />
        <MetricCard
          label="Total amount"
          value={formatUsd(summary.amount)}
          hint="Sum of unload amounts (USD)"
          icon={TrendingDown}
          loading={unloadsLoading}
        />
        <MetricCard
          label="Cards unloaded"
          value={formatCount(summary.cards)}
          hint="Distinct cards with at least one unload"
          icon={Users}
          loading={unloadsLoading}
        />
        <MetricCard
          label="Average unload"
          value={formatUsd(summary.avg)}
          hint="Total amount ÷ unload count"
          icon={CreditCard}
          loading={unloadsLoading}
        />
      </div>

      <DataTable
        loading={unloadsLoading}
        columns={unloadColumns}
        data={unloads}
        searchPlaceholder="Search unloads..."
        exportFileName="prepaid-visa-unloads"
        enableExport={!unloadsLoadingMore}
        onRowClick={openCard}
      />

      <PrepaidVisaCardSheet
        open={cardFocus != null}
        onOpenChange={(open) => {
          if (!open) {
            setCardFocus(null);
          }
        }}
        focus={cardFocus}
        relatedTopUps={topUps}
        relatedTransactions={transactions}
      />
    </div>
  );
}

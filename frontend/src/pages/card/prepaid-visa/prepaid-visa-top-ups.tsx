import { format } from "date-fns";
import { CreditCard, TrendingUp, Users, Wallet } from "lucide-react";
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
  fetchPrepaidVisaTopUps,
} from "@/features/prepaid_visa_slice";
import type { PrepaidVisaProductFilter } from "@/types/prepaid-visa";
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
import { topUpColumns } from "./top-up-columns";
import type { PrepaidVisaTopUp } from "@/types/prepaid-visa";

export default function PrepaidVisaTopUps() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    topUps,
    topUpsLoading,
    topUpsLoadingMore,
    topUpsTruncated,
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

  const openCard = useCallback((row: PrepaidVisaTopUp) => {
    setCardFocus({ kind: "top-up", row });
  }, []);

  const summary = useMemo(() => {
    const count = topUps.length;
    const amount = topUps.reduce((sum, row) => sum + (row.amount || 0), 0);
    const cards = new Set(topUps.map((r) => r.cardId)).size;
    const avg = count > 0 ? amount / count : 0;
    return { count, amount, cards, avg };
  }, [topUps]);

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const dateFrom = format(dateRange.from, "MM/dd/yyyy");
    const dateTo = format(dateRange.to, "MM/dd/yyyy");
    let cancelled = false;
    const controllers: Array<{ abort: () => void }> = [];

    navigate(prepaidVisaHref("/prepaid-visa/top-ups", dateRange, product), {
      replace: true,
    });

    const run = async () => {
      let nextPage = 1;
      let continueFetch = true;

      while (continueFetch && !cancelled && requestId === requestIdRef.current) {
        const promise = dispatch(
          fetchPrepaidVisaTopUps({
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

        if (fetchPrepaidVisaTopUps.rejected.match(result)) {
          if (!result.meta.aborted) {
            toast.error(result.payload || "Failed to load top-ups");
          }
          return;
        }

        if (!fetchPrepaidVisaTopUps.fulfilled.match(result)) {
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
            Prepaid Visa top-ups
          </h3>
          <p className="text-sm text-muted-foreground">
            Branch top-ups with card, amount, and balance details
          </p>
          {topUpsTruncated ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Showing the first {topUps.length.toLocaleString()} rows. Narrow
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

      {topUpsLoadingMore ? (
        <LoadingMoreBanner loadedCount={topUps.length} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Top-ups"
          value={formatCount(summary.count)}
          hint="Top-ups in the selected range"
          icon={Wallet}
          loading={topUpsLoading}
        />
        <MetricCard
          label="Total amount"
          value={formatUsd(summary.amount)}
          hint="Sum of top-up amounts (USD)"
          icon={TrendingUp}
          loading={topUpsLoading}
        />
        <MetricCard
          label="Cards topped up"
          value={formatCount(summary.cards)}
          hint="Distinct cards with at least one top-up"
          icon={Users}
          loading={topUpsLoading}
        />
        <MetricCard
          label="Average top-up"
          value={formatUsd(summary.avg)}
          hint="Total amount ÷ top-up count"
          icon={CreditCard}
          loading={topUpsLoading}
        />
      </div>

      <DataTable
        loading={topUpsLoading}
        columns={topUpColumns}
        data={topUps}
        searchPlaceholder="Search top-ups..."
        exportFileName="prepaid-visa-top-ups"
        enableExport={!topUpsLoadingMore}
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

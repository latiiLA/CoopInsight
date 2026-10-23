import { format } from "date-fns";
import {
  Activity,
  CheckCircle2,
  CreditCard,
  XCircle,
} from "lucide-react";
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
  fetchPrepaidVisaTransactions,
} from "@/features/prepaid_visa_slice";
import type { PrepaidVisaProductFilter } from "@/types/prepaid-visa";
import { AppDispatch, RootState } from "../../../../app/store/store";

import {
  PrepaidVisaCardSheet,
  type PrepaidVisaCardFocus,
} from "./prepaid-visa-card-sheet";
import { PrepaidVisaDateToolbar } from "./prepaid-visa-date-toolbar";
import { PrepaidVisaFilters } from "./prepaid-visa-filters";
import { formatCount, formatPct, formatUsd } from "./prepaid-visa-format";
import {
  getLast30DaysRange,
  parseRangeFromSearch,
  prepaidVisaHref,
} from "./prepaid-visa-range";
import { txnColumns } from "./txn-columns";
import type { PrepaidVisaTransaction } from "@/types/prepaid-visa";

export default function PrepaidVisaTransactions() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    transactions,
    transactionsLoading,
    transactionsLoadingMore,
    transactionsTruncated,
    topUps,
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

  const openCard = useCallback((row: PrepaidVisaTransaction) => {
    setCardFocus({ kind: "transaction", row });
  }, []);

  const summary = useMemo(() => {
    const count = transactions.length;
    const amount = transactions.reduce((sum, row) => sum + (row.amount || 0), 0);
    const cards = new Set(transactions.map((r) => r.cardId)).size;
    const approved = transactions.filter((r) => r.approved).length;
    const declined = count - approved;
    const rate = count > 0 ? (approved / count) * 100 : 0;
    return { count, amount, cards, approved, declined, rate };
  }, [transactions]);

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const dateFrom = format(dateRange.from, "MM/dd/yyyy");
    const dateTo = format(dateRange.to, "MM/dd/yyyy");
    let cancelled = false;
    const controllers: Array<{ abort: () => void }> = [];

    navigate(
      prepaidVisaHref("/prepaid-visa/transactions", dateRange, product),
      { replace: true },
    );

    const run = async () => {
      let nextPage = 1;
      let continueFetch = true;

      while (continueFetch && !cancelled && requestId === requestIdRef.current) {
        const promise = dispatch(
          fetchPrepaidVisaTransactions({
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

        if (fetchPrepaidVisaTransactions.rejected.match(result)) {
          if (!result.meta.aborted) {
            toast.error(result.payload || "Failed to load transactions");
          }
          return;
        }

        if (!fetchPrepaidVisaTransactions.fulfilled.match(result)) {
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
            Prepaid Visa performing cards
          </h3>
          <p className="text-sm text-muted-foreground">
            Card spend activity with merchant and approval details
          </p>
          {transactionsTruncated ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Showing the first {transactions.length.toLocaleString()} rows.
              Narrow the date range for a complete list.
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

      {transactionsLoadingMore ? (
        <LoadingMoreBanner loadedCount={transactions.length} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Transactions"
          value={formatCount(summary.count)}
          hint="Transactions in the selected range"
          icon={Activity}
          loading={transactionsLoading}
        />
        <MetricCard
          label="Volume"
          value={formatUsd(summary.amount)}
          hint="Sum of transaction amounts"
          icon={CreditCard}
          loading={transactionsLoading}
        />
        <MetricCard
          label="Active cards"
          value={formatCount(summary.cards)}
          hint="Distinct cards with activity"
          icon={CreditCard}
          loading={transactionsLoading}
        />
        <MetricCard
          label="Approved"
          value={formatCount(summary.approved)}
          hint={formatPct(summary.rate)}
          icon={CheckCircle2}
          loading={transactionsLoading}
        />
        <MetricCard
          label="Other / declined"
          value={formatCount(summary.declined)}
          hint="Not approved"
          icon={XCircle}
          loading={transactionsLoading}
        />
      </div>

      <DataTable
        loading={transactionsLoading}
        columns={txnColumns}
        data={transactions}
        searchPlaceholder="Search transactions..."
        exportFileName="prepaid-visa-transactions"
        enableExport={!transactionsLoadingMore}
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

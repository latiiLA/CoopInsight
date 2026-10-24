import {
  BadgeCheck,
  CircleAlert,
  Scale,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import {
  clearPrepaidVisaCardActivity,
  fetchPrepaidVisaCardActivity,
  fetchPrepaidVisaReconciliation,
} from "@/features/prepaid_visa_slice";
import type {
  PrepaidVisaCardReconcile,
  PrepaidVisaProductFilter,
} from "@/types/prepaid-visa";
import { AppDispatch, RootState } from "../../../../app/store/store";

import { PrepaidVisaFilters } from "./prepaid-visa-filters";
import { formatCount, formatPct, formatUsd } from "./prepaid-visa-format";
import { PrepaidVisaReconcileSheet } from "./prepaid-visa-reconcile-sheet";
import { parseRangeFromSearch } from "./prepaid-visa-range";
import { prepaidVisaReconcileColumns } from "./reconcile-columns";

export default function PrepaidVisaReconciliation() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    reconcile,
    reconcileLoading,
    cardActivity,
    cardActivityLoading,
    cardActivityError,
  } = useSelector((state: RootState) => state.prepaidVisa);
  const initial = parseRangeFromSearch(window.location.search);
  const [product, setProduct] = useState<PrepaidVisaProductFilter>(
    initial.product,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const requestRef = useRef<{ abort: () => void } | null>(null);
  const activityRef = useRef<{ abort: () => void } | null>(null);

  const load = useCallback(
    async (productFilter: PrepaidVisaProductFilter) => {
      requestRef.current?.abort?.();
      const request = dispatch(
        fetchPrepaidVisaReconciliation({
          product: productFilter || undefined,
        }),
      );
      requestRef.current = request;
      const result = await request;
      if (fetchPrepaidVisaReconciliation.rejected.match(result)) {
        if (!result.meta.aborted) {
          toast.error(
            result.payload || "Failed to load card reconciliation",
          );
        }
      }
    },
    [dispatch],
  );

  useEffect(() => {
    void load(product);
    return () => {
      requestRef.current?.abort?.();
      activityRef.current?.abort?.();
    };
  }, [product, load]);

  const openCard = useCallback(
    (row: PrepaidVisaCardReconcile) => {
      activityRef.current?.abort?.();
      setSheetOpen(true);
      const request = dispatch(
        fetchPrepaidVisaCardActivity({ cardId: row.cardId }),
      );
      activityRef.current = request;
      void request.then((result) => {
        if (fetchPrepaidVisaCardActivity.rejected.match(result)) {
          if (!result.meta.aborted) {
            toast.error(result.payload || "Failed to load card activity");
          }
        }
      });
    },
    [dispatch],
  );

  const columns = useMemo(() => prepaidVisaReconcileColumns(), []);
  const matchRate =
    reconcile && reconcile.cardCount > 0
      ? (reconcile.matchedCount / reconcile.cardCount) * 100
      : 0;
  const fundedRate =
    reconcile && reconcile.fundedCount > 0
      ? (reconcile.fundedMatched / reconcile.fundedCount) * 100
      : 0;

  return (
    <div className="container mx-auto space-y-4 pb-8">
      <div className="pt-1">
        <h3 className="text-lg font-semibold tracking-tight">
          Prepaid Visa reconciliation
        </h3>
        <p className="text-sm text-muted-foreground">
          Per wallet: top-ups should equal avail amt + blocked + from avail.
          Cards that share an account are rolled into one row. Click
          a row to inspect activity.
        </p>
      </div>

      <PrepaidVisaFilters product={product} onProductChange={setProduct} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          compact
          label="Wallets matched"
          value={`${formatCount(reconcile?.matchedCount)} / ${formatCount(reconcile?.cardCount)}`}
          hint={`${formatPct(matchRate)} of wallets`}
          icon={BadgeCheck}
          loading={reconcileLoading}
        />
        <MetricCard
          compact
          label="Funded cards matched"
          value={`${formatCount(reconcile?.fundedMatched)} / ${formatCount(reconcile?.fundedCount)}`}
          hint={`${formatPct(fundedRate)} with top-ups`}
          icon={Scale}
          loading={reconcileLoading}
        />
        <MetricCard
          compact
          label="Total top-ups"
          value={formatUsd(reconcile?.totalTopUp)}
          hint="Lifetime loads"
          icon={Wallet}
          loading={reconcileLoading}
        />
        <MetricCard
          compact
          label="Total unloaded"
          value={formatUsd(reconcile?.totalUnloaded)}
          hint="Lifetime account unloads"
          icon={Wallet}
          loading={reconcileLoading}
        />
        <MetricCard
          compact
          label="Total variance"
          value={formatUsd(reconcile?.totalVariance)}
          hint={`Top-ups minus expected · tol ${formatUsd(reconcile?.matchTolerance ?? 1)}`}
          icon={CircleAlert}
          loading={reconcileLoading}
        />
      </div>

      <DataTable
        columns={columns}
        data={reconcile?.cards ?? []}
        loading={reconcileLoading}
        searchPlaceholder="Search cards..."
        exportFileName="prepaid-visa-reconciliation"
        onRowClick={openCard}
      />

      <PrepaidVisaReconcileSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            activityRef.current?.abort?.();
            dispatch(clearPrepaidVisaCardActivity());
          }
        }}
        loading={cardActivityLoading}
        activity={cardActivity}
        error={cardActivityError}
      />
    </div>
  );
}

import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearCortexTransactionDetail,
  clearCortexTransactionSearch,
  CORTEX_TXN_SEARCH_PAGE_SIZE,
  fetchCortexTransactionDetail,
  fetchCortexTransactionSearch,
} from "@/features/cortex_transaction_search_slice";
import type {
  CortexTransaction,
  CortexTxnResultFilter,
  CortexTxnReversalFilter,
} from "@/types/cortex-transaction-search";
import { hasPermission } from "../../../../utility/has-permission";
import { AppDispatch, RootState } from "../../../../app/store/store";

import { cortexTxnSearchColumns } from "./columns";
import { CortexTransactionDetailSheet } from "./detail-sheet";

type FormState = {
  product: string;
  card: string;
  cardholder: string;
  branch: string;
  q: string;
  rrn: string;
  merchant: string;
  terminal: string;
  txnCode: string;
  tlogId: string;
  stan: string;
  account: string;
  approvalCode: string;
  rspCode: string;
  currency: string;
  mcc: string;
  acquiringCountry: string;
  msgType: string;
  result: CortexTxnResultFilter;
  reversal: CortexTxnReversalFilter;
  amountMin: string;
  amountMax: string;
};

const emptyForm = (): FormState => ({
  product: "",
  card: "",
  cardholder: "",
  branch: "",
  q: "",
  rrn: "",
  merchant: "",
  terminal: "",
  txnCode: "",
  tlogId: "",
  stan: "",
  account: "",
  approvalCode: "",
  rspCode: "",
  currency: "",
  mcc: "",
  acquiringCountry: "",
  msgType: "",
  result: "",
  reversal: "",
  amountMin: "",
  amountMax: "",
});

function parseOptionalAmount(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function parseOptionalLogId(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

export default function CortexTransactionSearchPage() {
  const dispatch = useDispatch<AppDispatch>();
  const canViewCardholder = hasPermission(["card:view-cardholder-name"]);
  const {
    items,
    submitted,
    loading,
    loadingMore,
    error,
    hasMore,
    page,
    lastArgs,
    detail,
    detailLoading,
    detailError,
  } = useSelector((state: RootState) => state.cortexTxnSearch);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [detailOpen, setDetailOpen] = useState(false);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const buildArgs = useCallback(
    (nextPage: number) => {
      const amountMin = parseOptionalAmount(form.amountMin);
      const amountMax = parseOptionalAmount(form.amountMax);
      const tlogId = parseOptionalLogId(form.tlogId);
      return {
        dateFrom:
          dateRange?.from && dateRange?.to
            ? format(dateRange.from, "MM/dd/yyyy")
            : undefined,
        dateTo:
          dateRange?.from && dateRange?.to
            ? format(dateRange.to, "MM/dd/yyyy")
            : undefined,
        product: form.product || undefined,
        card: form.card || undefined,
        cardholder: canViewCardholder
          ? form.cardholder || undefined
          : undefined,
        branch: form.branch || undefined,
        q: form.q || undefined,
        rrn: form.rrn || undefined,
        merchant: form.merchant || undefined,
        terminal: form.terminal || undefined,
        txnCode: form.txnCode || undefined,
        tlogId,
        stan: form.stan || undefined,
        account: form.account || undefined,
        approvalCode: form.approvalCode || undefined,
        rspCode: form.rspCode || undefined,
        currency: form.currency || undefined,
        mcc: form.mcc || undefined,
        acquiringCountry: form.acquiringCountry || undefined,
        msgType: form.msgType || undefined,
        result: form.result || undefined,
        reversal: form.reversal || undefined,
        amountMin,
        amountMax,
        page: nextPage,
        pageSize: CORTEX_TXN_SEARCH_PAGE_SIZE,
      };
    },
    [canViewCardholder, dateRange, form],
  );

  const onClear = useCallback(() => {
    setForm(emptyForm());
    setDateRange(undefined);
    dispatch(clearCortexTransactionSearch());
  }, [dispatch]);

  const onSearch = useCallback(async () => {
    const hasLookupKey = Boolean(
      form.rrn.trim() ||
        form.card.trim() ||
        form.tlogId.trim() ||
        form.stan.trim(),
    );
    const hasDates = Boolean(dateRange?.from && dateRange?.to);
    if (!hasDates && !hasLookupKey) {
      toast.error(
        "Choose a date range, or search by RRN, card, STAN, or log id",
      );
      return;
    }
    if (form.tlogId.trim() && parseOptionalLogId(form.tlogId) == null) {
      toast.error("Log id must be a positive whole number");
      return;
    }
    if (
      (form.amountMin.trim() && parseOptionalAmount(form.amountMin) == null) ||
      (form.amountMax.trim() && parseOptionalAmount(form.amountMax) == null)
    ) {
      toast.error("Amount min/max must be numbers");
      return;
    }

    const result = await dispatch(
      fetchCortexTransactionSearch({ ...buildArgs(1), append: false }),
    );
    if (
      fetchCortexTransactionSearch.rejected.match(result) &&
      !result.meta.aborted
    ) {
      toast.error(result.payload || "Search failed");
    }
  }, [
    buildArgs,
    dateRange,
    dispatch,
    form.amountMax,
    form.amountMin,
    form.card,
    form.rrn,
    form.stan,
    form.tlogId,
  ]);

  const onLoadMore = useCallback(async () => {
    if (!lastArgs || !hasMore || loadingMore) return;
    const result = await dispatch(
      fetchCortexTransactionSearch({
        ...lastArgs,
        page: page + 1,
        append: true,
      }),
    );
    if (
      fetchCortexTransactionSearch.rejected.match(result) &&
      !result.meta.aborted
    ) {
      toast.error(result.payload || "Failed to load more");
    }
  }, [dispatch, hasMore, lastArgs, loadingMore, page]);

  const onRowClick = useCallback(
    (row: CortexTransaction) => {
      if (!row.tlogId) return;
      setDetailOpen(true);
      void dispatch(fetchCortexTransactionDetail({ tlogId: row.tlogId }));
    },
    [dispatch],
  );

  const emptyHint = useMemo(() => {
    if (loading) return null;
    if (!submitted) return "Enter criteria and search";
    if (error) return error;
    if (items.length === 0) return "No matching rows";
    return null;
  }, [error, items.length, loading, submitted]);

  return (
    <div className="container mx-auto space-y-4 pb-6">
      <div className="space-y-1 pt-1">
        <h3 className="text-lg font-semibold tracking-tight">
          Cortex transaction search
        </h3>
        <p className="text-sm text-muted-foreground">
          Look up Cortex log rows by date, RRN, card, STAN, log id, and related
          criteria. Results appear after you search.
        </p>
      </div>

      <form
        className="space-y-4 rounded-lg border bg-muted/20 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSearch();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label>Date range</Label>
            <DatePickerWithRange
              className="w-full min-w-0 shrink"
              date={dateRange}
              onDateChange={setDateRange}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-product">Product</Label>
            <Input
              id="ctx-product"
              placeholder="e.g. 401"
              value={form.product}
              onChange={(e) => setField("product", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-card">Card</Label>
            <Input
              id="ctx-card"
              placeholder="Last 4, fragment, or PAN (spaces ok)"
              value={form.card}
              onChange={(e) => setField("card", e.target.value)}
            />
          </div>
          {canViewCardholder ? (
            <div className="space-y-1.5">
              <Label htmlFor="ctx-holder">Cardholder</Label>
              <Input
                id="ctx-holder"
                placeholder="Name"
                value={form.cardholder}
                onChange={(e) => setField("cardholder", e.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="ctx-branch">Branch</Label>
            <Input
              id="ctx-branch"
              placeholder="Code or name"
              value={form.branch}
              onChange={(e) => setField("branch", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-q">Free text</Label>
            <Input
              id="ctx-q"
              placeholder="RRN, merchant, terminal, card..."
              value={form.q}
              onChange={(e) => setField("q", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-rrn">RRN</Label>
            <Input
              id="ctx-rrn"
              placeholder="Retrieval reference"
              value={form.rrn}
              onChange={(e) => setField("rrn", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-merchant">Merchant</Label>
            <Input
              id="ctx-merchant"
              placeholder="Location or acceptor ID"
              value={form.merchant}
              onChange={(e) => setField("merchant", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-terminal">Terminal</Label>
            <Input
              id="ctx-terminal"
              placeholder="Terminal ID"
              value={form.terminal}
              onChange={(e) => setField("terminal", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-txncode">Transaction code</Label>
            <Input
              id="ctx-txncode"
              placeholder="e.g. 0"
              value={form.txnCode}
              onChange={(e) => setField("txnCode", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-tlogid">Log id</Label>
            <Input
              id="ctx-tlogid"
              inputMode="numeric"
              placeholder="Cortex log id"
              value={form.tlogId}
              onChange={(e) => setField("tlogId", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-stan">STAN</Label>
            <Input
              id="ctx-stan"
              placeholder="Trace / STAN"
              value={form.stan}
              onChange={(e) => setField("stan", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-account">Account</Label>
            <Input
              id="ctx-account"
              placeholder="Account number"
              value={form.account}
              onChange={(e) => setField("account", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-aprvl">Approval code</Label>
            <Input
              id="ctx-aprvl"
              placeholder="Approval code"
              value={form.approvalCode}
              onChange={(e) => setField("approvalCode", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-rsp">Response code</Label>
            <Input
              id="ctx-rsp"
              placeholder="e.g. 00 or 51"
              value={form.rspCode}
              onChange={(e) => setField("rspCode", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-currency">Billing currency</Label>
            <Input
              id="ctx-currency"
              placeholder="e.g. 840"
              value={form.currency}
              onChange={(e) => setField("currency", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-mcc">MCC</Label>
            <Input
              id="ctx-mcc"
              placeholder="Merchant category"
              value={form.mcc}
              onChange={(e) => setField("mcc", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-acqctry">Acquiring country</Label>
            <Input
              id="ctx-acqctry"
              placeholder="Country code"
              value={form.acquiringCountry}
              onChange={(e) => setField("acquiringCountry", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-msgtype">Message type</Label>
            <Input
              id="ctx-msgtype"
              placeholder="e.g. 210 or 410"
              value={form.msgType}
              onChange={(e) => setField("msgType", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Result</Label>
            <Select
              value={form.result || "all"}
              onValueChange={(v) =>
                setField(
                  "result",
                  (v === "all" ? "" : v) as CortexTxnResultFilter,
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reversal</Label>
            <Select
              value={form.reversal || "all"}
              onValueChange={(v) =>
                setField(
                  "reversal",
                  (v === "all" ? "" : v) as CortexTxnReversalFilter,
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="exclude">Exclude reversals</SelectItem>
                <SelectItem value="only">Reversals only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-amin">Amount min</Label>
            <Input
              id="ctx-amin"
              inputMode="decimal"
              placeholder="Min"
              value={form.amountMin}
              onChange={(e) => setField("amountMin", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctx-amax">Amount max</Label>
            <Input
              id="ctx-amax"
              inputMode="decimal"
              placeholder="Max"
              value={form.amountMax}
              onChange={(e) => setField("amountMax", e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClear}
            disabled={loading || loadingMore}
          >
            Clear
          </Button>
        </div>
      </form>

      {emptyHint && !loading ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyHint}
        </p>
      ) : null}

      {(loading || (submitted && !emptyHint)) && (
        <>
          <DataTable
            loading={loading}
            columns={cortexTxnSearchColumns}
            data={loading ? [] : items}
            searchPlaceholder="Filter results..."
            exportFileName="cortex-transaction-search"
            enableExport={!loadingMore}
            onRowClick={onRowClick}
          />
          {hasMore && !loading ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={loadingMore}
                onClick={() => void onLoadMore()}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <CortexTransactionDetailSheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            dispatch(clearCortexTransactionDetail());
          }
        }}
        detail={detail}
        loading={detailLoading}
        error={detailError}
      />
    </div>
  );
}

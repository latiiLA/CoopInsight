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
  clearSwitchTransactionDetail,
  clearSwitchTransactionSearch,
  SWITCH_TXN_SEARCH_PAGE_SIZE,
  fetchSwitchTransactionDetail,
  fetchSwitchTransactionSearch,
} from "@/features/switch_transaction_search_slice";
import type {
  SwitchTransaction,
  SwitchTxnChannelFilter,
  SwitchTxnResultFilter,
  SwitchTxnReversalFilter,
  SwitchTxnRouteMatch,
} from "@/types/switch-transaction-search";
import { AppDispatch, RootState } from "../../../../app/store/store";

import { switchTxnSearchColumns } from "./columns";
import { SwitchTransactionDetailSheet } from "./detail-sheet";

type FormState = {
  product: string;
  card: string;
  q: string;
  rrn: string;
  merchant: string;
  terminal: string;
  txnCode: string;
  trace: string;
  account: string;
  approvalCode: string;
  rspCode: string;
  issuerCurrency: string;
  acquirerCurrency: string;
  mcc: string;
  acquiringCountry: string;
  acquirer: string;
  routeId: string;
  routeMatch: SwitchTxnRouteMatch;
  channel: SwitchTxnChannelFilter;
  msgType: string;
  result: SwitchTxnResultFilter;
  reversal: SwitchTxnReversalFilter;
  amountMin: string;
  amountMax: string;
};

const emptyForm = (): FormState => ({
  product: "",
  card: "",
  q: "",
  rrn: "",
  merchant: "",
  terminal: "",
  txnCode: "",
  trace: "",
  account: "",
  approvalCode: "",
  rspCode: "",
  issuerCurrency: "",
  acquirerCurrency: "",
  mcc: "",
  acquiringCountry: "",
  acquirer: "",
  routeId: "",
  routeMatch: "either",
  channel: "",
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

export default function SwitchTransactionSearchPage() {
  const dispatch = useDispatch<AppDispatch>();
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
  } = useSelector((state: RootState) => state.switchTxnSearch);

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
        q: form.q || undefined,
        rrn: form.rrn || undefined,
        merchant: form.merchant || undefined,
        terminal: form.terminal || undefined,
        txnCode: form.txnCode || undefined,
        trace: form.trace || undefined,
        account: form.account || undefined,
        approvalCode: form.approvalCode || undefined,
        rspCode: form.rspCode || undefined,
        issuerCurrency: form.issuerCurrency || undefined,
        acquirerCurrency: form.acquirerCurrency || undefined,
        mcc: form.mcc || undefined,
        acquiringCountry: form.acquiringCountry || undefined,
        acquirer: form.acquirer || undefined,
        routeId: form.routeId || undefined,
        routeMatch: form.routeId
          ? form.routeMatch || "either"
          : undefined,
        channel: form.channel || undefined,
        msgType: form.msgType || undefined,
        result: form.result || undefined,
        reversal: form.reversal || undefined,
        amountMin,
        amountMax,
        page: nextPage,
        pageSize: SWITCH_TXN_SEARCH_PAGE_SIZE,
      };
    },
    [dateRange, form],
  );

  const onClear = useCallback(() => {
    setForm(emptyForm());
    setDateRange(undefined);
    dispatch(clearSwitchTransactionSearch());
  }, [dispatch]);

  const onSearch = useCallback(async () => {
    const hasLookupKey = Boolean(
      form.rrn.trim() || form.card.trim() || form.trace.trim(),
    );
    const hasDates = Boolean(dateRange?.from && dateRange?.to);
    if (!hasDates && !hasLookupKey) {
      toast.error(
        "Choose a date range, or search by RRN, card, or trace",
      );
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
      fetchSwitchTransactionSearch({ ...buildArgs(1), append: false }),
    );
    if (
      fetchSwitchTransactionSearch.rejected.match(result) &&
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
    form.trace,
  ]);

  const onLoadMore = useCallback(async () => {
    if (!lastArgs || !hasMore || loadingMore) return;
    const result = await dispatch(
      fetchSwitchTransactionSearch({
        ...lastArgs,
        page: page + 1,
        append: true,
      }),
    );
    if (
      fetchSwitchTransactionSearch.rejected.match(result) &&
      !result.meta.aborted
    ) {
      toast.error(result.payload || "Failed to load more");
    }
  }, [dispatch, hasMore, lastArgs, loadingMore, page]);

  const onRowClick = useCallback(
    (row: SwitchTransaction) => {
      if (!row.rowId) return;
      setDetailOpen(true);
      void dispatch(fetchSwitchTransactionDetail({ rowId: row.rowId }));
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
          Switch transaction search
        </h3>
        <p className="text-sm text-muted-foreground">
          Look up IST switch log rows by date, RRN, card, trace, route, and
          related criteria. Results appear after you search.
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
            <Label htmlFor="sw-product">Product</Label>
            <Input
              id="sw-product"
              placeholder="Card product"
              value={form.product}
              onChange={(e) => setField("product", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-card">Card</Label>
            <Input
              id="sw-card"
              placeholder="Last 4 or fragment"
              value={form.card}
              onChange={(e) => setField("card", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-rrn">RRN</Label>
            <Input
              id="sw-rrn"
              placeholder="Retrieval reference"
              value={form.rrn}
              onChange={(e) => setField("rrn", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-trace">Trace</Label>
            <Input
              id="sw-trace"
              placeholder="Trace number"
              value={form.trace}
              onChange={(e) => setField("trace", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-q">Free text</Label>
            <Input
              id="sw-q"
              placeholder="RRN, merchant, terminal, route..."
              value={form.q}
              onChange={(e) => setField("q", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-merchant">Merchant</Label>
            <Input
              id="sw-merchant"
              placeholder="Name or location"
              value={form.merchant}
              onChange={(e) => setField("merchant", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-terminal">Terminal</Label>
            <Input
              id="sw-terminal"
              placeholder="Terminal ID"
              value={form.terminal}
              onChange={(e) => setField("terminal", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-txncode">Processing code</Label>
            <Input
              id="sw-txncode"
              placeholder="e.g. 0"
              value={form.txnCode}
              onChange={(e) => setField("txnCode", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-account">Account</Label>
            <Input
              id="sw-account"
              placeholder="Account number"
              value={form.account}
              onChange={(e) => setField("account", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-aprvl">Approval code</Label>
            <Input
              id="sw-aprvl"
              placeholder="Auth number"
              value={form.approvalCode}
              onChange={(e) => setField("approvalCode", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-rsp">Response code</Label>
            <Input
              id="sw-rsp"
              placeholder="e.g. 0 or 51"
              value={form.rspCode}
              onChange={(e) => setField("rspCode", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-isscur">Issuer currency</Label>
            <Input
              id="sw-isscur"
              placeholder="e.g. 230"
              value={form.issuerCurrency}
              onChange={(e) => setField("issuerCurrency", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-acqcur">Acquirer currency</Label>
            <Input
              id="sw-acqcur"
              placeholder="e.g. 840"
              value={form.acquirerCurrency}
              onChange={(e) => setField("acquirerCurrency", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-mcc">MCC</Label>
            <Input
              id="sw-mcc"
              placeholder="Merchant type"
              value={form.mcc}
              onChange={(e) => setField("mcc", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-acqctry">Acquiring country</Label>
            <Input
              id="sw-acqctry"
              placeholder="Country code"
              value={form.acquiringCountry}
              onChange={(e) => setField("acquiringCountry", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-acquirer">Acquirer</Label>
            <Input
              id="sw-acquirer"
              placeholder="Acquirer id"
              value={form.acquirer}
              onChange={(e) => setField("acquirer", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-route">Route id</Label>
            <Input
              id="sw-route"
              placeholder="e.g. 04, CBOBCORTEX"
              value={form.routeId}
              onChange={(e) => setField("routeId", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Match on</Label>
            <Select
              value={form.routeMatch || "either"}
              onValueChange={(v) =>
                setField("routeMatch", v as SwitchTxnRouteMatch)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="either">Source or destination</SelectItem>
                <SelectItem value="source">Source only</SelectItem>
                <SelectItem value="dest">Destination only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select
              value={form.channel || "all"}
              onValueChange={(v) =>
                setField(
                  "channel",
                  (v === "all" ? "" : v) as SwitchTxnChannelFilter,
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="atm">ATM</SelectItem>
                <SelectItem value="pos">POS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-msgtype">Message type</Label>
            <Input
              id="sw-msgtype"
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
                  (v === "all" ? "" : v) as SwitchTxnResultFilter,
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
                  (v === "all" ? "" : v) as SwitchTxnReversalFilter,
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
            <Label htmlFor="sw-amin">Amount min</Label>
            <Input
              id="sw-amin"
              inputMode="decimal"
              placeholder="Min"
              value={form.amountMin}
              onChange={(e) => setField("amountMin", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sw-amax">Amount max</Label>
            <Input
              id="sw-amax"
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
            columns={switchTxnSearchColumns}
            data={loading ? [] : items}
            searchPlaceholder="Filter results..."
            exportFileName="switch-transaction-search"
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

      <SwitchTransactionDetailSheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            dispatch(clearSwitchTransactionDetail());
          }
        }}
        detail={detail}
        loading={detailLoading}
        error={detailError}
      />
    </div>
  );
}

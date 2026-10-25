import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
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
  clearPrepaidVisaSearch,
  fetchPrepaidVisaSearch,
  setPrepaidVisaSearchKind,
} from "@/features/prepaid_visa_slice";
import type {
  PrepaidVisaProductFilter,
  PrepaidVisaSearchKind,
  PrepaidVisaSearchReversalFilter,
  PrepaidVisaSearchResultFilter,
  PrepaidVisaTopUp,
  PrepaidVisaTransaction,
  PrepaidVisaUnload,
} from "@/types/prepaid-visa";
import { hasPermission } from "../../../../utility/has-permission";
import { AppDispatch, RootState } from "../../../../app/store/store";

import {
  PrepaidVisaCardSheet,
  type PrepaidVisaCardFocus,
} from "./prepaid-visa-card-sheet";
import { PrepaidVisaDateToolbar } from "./prepaid-visa-date-toolbar";
import { PrepaidVisaFilters } from "./prepaid-visa-filters";
import { topUpColumns } from "./top-up-columns";
import { txnColumns } from "./txn-columns";
import { unloadColumns } from "./unload-columns";

const KIND_OPTIONS: { id: PrepaidVisaSearchKind; label: string }[] = [
  { id: "transactions", label: "Transactions" },
  { id: "topups", label: "Top-ups" },
  { id: "unloads", label: "Unloads" },
];

type FormState = {
  card: string;
  cardholder: string;
  branch: string;
  q: string;
  rrn: string;
  merchant: string;
  terminal: string;
  result: PrepaidVisaSearchResultFilter;
  reversal: PrepaidVisaSearchReversalFilter;
  amountMin: string;
  amountMax: string;
  account: string;
  description: string;
};

const emptyForm = (): FormState => ({
  card: "",
  cardholder: "",
  branch: "",
  q: "",
  rrn: "",
  merchant: "",
  terminal: "",
  result: "",
  reversal: "",
  amountMin: "",
  amountMax: "",
  account: "",
  description: "",
});

function parseOptionalAmount(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export default function PrepaidVisaSearch() {
  const dispatch = useDispatch<AppDispatch>();
  const canViewCardholder = hasPermission(["card:view-cardholder-name"]);
  const {
    searchKind,
    searchSubmitted,
    searchLoading,
    searchError,
    searchTransactions,
    searchTopUps,
    searchUnloads,
    searchHasMore,
  } = useSelector((state: RootState) => state.prepaidVisa);

  const [product, setProduct] = useState<PrepaidVisaProductFilter>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [cardFocus, setCardFocus] = useState<PrepaidVisaCardFocus | null>(null);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const onKindChange = useCallback(
    (kind: PrepaidVisaSearchKind) => {
      dispatch(setPrepaidVisaSearchKind(kind));
    },
    [dispatch],
  );

  const onClear = useCallback(() => {
    setForm(emptyForm());
    setDateRange(undefined);
    setProduct("");
    dispatch(clearPrepaidVisaSearch());
  }, [dispatch]);

  const onSearch = useCallback(async () => {
    const hasRrnOrCard = Boolean(form.rrn.trim() || form.card.trim());
    const hasDates = Boolean(dateRange?.from && dateRange?.to);
    if (!hasDates && !hasRrnOrCard) {
      toast.error("Choose a date range, or search by RRN or card");
      return;
    }

    const amountMin = parseOptionalAmount(form.amountMin);
    const amountMax = parseOptionalAmount(form.amountMax);
    if (
      (form.amountMin.trim() && amountMin == null) ||
      (form.amountMax.trim() && amountMax == null)
    ) {
      toast.error("Amount min/max must be numbers");
      return;
    }

    const result = await dispatch(
      fetchPrepaidVisaSearch({
        kind: searchKind,
        dateFrom:
          dateRange?.from && dateRange?.to
            ? format(dateRange.from, "MM/dd/yyyy")
            : undefined,
        dateTo:
          dateRange?.from && dateRange?.to
            ? format(dateRange.to, "MM/dd/yyyy")
            : undefined,
        product: product || undefined,
        card: form.card || undefined,
        cardholder: canViewCardholder ? form.cardholder || undefined : undefined,
        branch: form.branch || undefined,
        q: form.q || undefined,
        rrn: searchKind === "transactions" ? form.rrn || undefined : undefined,
        merchant:
          searchKind === "transactions" ? form.merchant || undefined : undefined,
        terminal:
          searchKind === "transactions" ? form.terminal || undefined : undefined,
        result:
          searchKind === "transactions" && form.result
            ? form.result
            : undefined,
        reversal:
          searchKind === "transactions" && form.reversal
            ? form.reversal
            : undefined,
        amountMin,
        amountMax,
        account:
          searchKind !== "transactions" ? form.account || undefined : undefined,
        description:
          searchKind !== "transactions"
            ? form.description || undefined
            : undefined,
        page: 1,
      }),
    );

    if (fetchPrepaidVisaSearch.rejected.match(result) && !result.meta.aborted) {
      toast.error(result.payload || "Search failed");
    }
  }, [
    canViewCardholder,
    dateRange,
    dispatch,
    form,
    product,
    searchKind,
  ]);

  const openTxn = useCallback((row: PrepaidVisaTransaction) => {
    setCardFocus({ kind: "transaction", row });
  }, []);
  const openTopUp = useCallback((row: PrepaidVisaTopUp) => {
    setCardFocus({ kind: "top-up", row });
  }, []);
  const openUnload = useCallback((row: PrepaidVisaUnload) => {
    setCardFocus({ kind: "unload", row });
  }, []);

  const emptyHint = useMemo(() => {
    if (searchLoading) return null;
    if (!searchSubmitted) {
      return "Enter criteria and search";
    }
    if (searchError) {
      return searchError;
    }
    const count =
      searchKind === "transactions"
        ? searchTransactions.length
        : searchKind === "topups"
          ? searchTopUps.length
          : searchUnloads.length;
    if (count === 0) {
      return "No matching rows";
    }
    return null;
  }, [
    searchError,
    searchKind,
    searchLoading,
    searchSubmitted,
    searchTopUps.length,
    searchTransactions.length,
    searchUnloads.length,
  ]);

  const isTxn = searchKind === "transactions";
  const isLedger = searchKind === "topups" || searchKind === "unloads";

  return (
    <div className="container mx-auto space-y-4 pb-6">
      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Prepaid Visa search
          </h3>
          <p className="text-sm text-muted-foreground">
            Look up by RRN, card, name, or other criteria. Results appear after
            you search.
          </p>
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

      <form
        className="space-y-4 rounded-lg border bg-muted/20 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSearch();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="pv-search-kind">Kind</Label>
            <Select
              value={searchKind}
              onValueChange={(v) => onKindChange(v as PrepaidVisaSearchKind)}
            >
              <SelectTrigger id="pv-search-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pv-search-card">Card</Label>
            <Input
              id="pv-search-card"
              placeholder="Last 4, fragment, or PAN (spaces ok)"
              value={form.card}
              onChange={(e) => setField("card", e.target.value)}
            />
          </div>
          {canViewCardholder ? (
            <div className="space-y-1.5">
              <Label htmlFor="pv-search-holder">Cardholder</Label>
              <Input
                id="pv-search-holder"
                placeholder="Name"
                value={form.cardholder}
                onChange={(e) => setField("cardholder", e.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="pv-search-branch">Branch</Label>
            <Input
              id="pv-search-branch"
              placeholder="Code or name"
              value={form.branch}
              onChange={(e) => setField("branch", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pv-search-q">Free text</Label>
            <Input
              id="pv-search-q"
              placeholder={
                isTxn
                  ? "RRN, merchant, terminal, card…"
                  : "Description, account, card…"
              }
              value={form.q}
              onChange={(e) => setField("q", e.target.value)}
            />
          </div>
        </div>

        {isTxn ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="pv-search-rrn">RRN</Label>
              <Input
                id="pv-search-rrn"
                placeholder="Retrieval reference"
                value={form.rrn}
                onChange={(e) => setField("rrn", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pv-search-merchant">Merchant</Label>
              <Input
                id="pv-search-merchant"
                placeholder="Location or acceptor ID"
                value={form.merchant}
                onChange={(e) => setField("merchant", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pv-search-terminal">Terminal</Label>
              <Input
                id="pv-search-terminal"
                placeholder="Terminal ID"
                value={form.terminal}
                onChange={(e) => setField("terminal", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Result</Label>
              <Select
                value={form.result || "all"}
                onValueChange={(v) =>
                  setField(
                    "result",
                    (v === "all" ? "" : v) as PrepaidVisaSearchResultFilter,
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
                    (v === "all" ? "" : v) as PrepaidVisaSearchReversalFilter,
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
              <Label htmlFor="pv-search-amin">Amount min (USD)</Label>
              <Input
                id="pv-search-amin"
                inputMode="decimal"
                placeholder="Min"
                value={form.amountMin}
                onChange={(e) => setField("amountMin", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pv-search-amax">Amount max (USD)</Label>
              <Input
                id="pv-search-amax"
                inputMode="decimal"
                placeholder="Max"
                value={form.amountMax}
                onChange={(e) => setField("amountMax", e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {isLedger ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="pv-search-account">Account</Label>
              <Input
                id="pv-search-account"
                placeholder="Wallet account"
                value={form.account}
                onChange={(e) => setField("account", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pv-search-desc">Description</Label>
              <Input
                id="pv-search-desc"
                placeholder="Ledger text"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pv-search-lamin">Amount min (USD)</Label>
              <Input
                id="pv-search-lamin"
                inputMode="decimal"
                placeholder="Min"
                value={form.amountMin}
                onChange={(e) => setField("amountMin", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pv-search-lamax">Amount max (USD)</Label>
              <Input
                id="pv-search-lamax"
                inputMode="decimal"
                placeholder="Max"
                value={form.amountMax}
                onChange={(e) => setField("amountMax", e.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={searchLoading}>
            {searchLoading ? "Searching…" : "Search"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClear}
            disabled={searchLoading}
          >
            Clear
          </Button>
        </div>
      </form>

      {emptyHint && !searchLoading ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyHint}
        </p>
      ) : null}

      {searchHasMore && searchSubmitted && !searchLoading && !emptyHint ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          More rows may exist. Narrow the criteria for a complete match set.
        </p>
      ) : null}

      {searchKind === "transactions" && (searchLoading || !emptyHint) ? (
        <DataTable
          loading={searchLoading}
          columns={txnColumns}
          data={searchLoading ? [] : searchTransactions}
          searchPlaceholder="Filter results…"
          exportFileName="prepaid-visa-search-transactions"
          onRowClick={openTxn}
        />
      ) : null}
      {searchKind === "topups" && (searchLoading || !emptyHint) ? (
        <DataTable
          loading={searchLoading}
          columns={topUpColumns}
          data={searchLoading ? [] : searchTopUps}
          searchPlaceholder="Filter results…"
          exportFileName="prepaid-visa-search-top-ups"
          onRowClick={openTopUp}
        />
      ) : null}
      {searchKind === "unloads" && (searchLoading || !emptyHint) ? (
        <DataTable
          loading={searchLoading}
          columns={unloadColumns}
          data={searchLoading ? [] : searchUnloads}
          searchPlaceholder="Filter results…"
          exportFileName="prepaid-visa-search-unloads"
          onRowClick={openUnload}
        />
      ) : null}

      <PrepaidVisaCardSheet
        open={cardFocus != null}
        onOpenChange={(open) => {
          if (!open) setCardFocus(null);
        }}
        focus={cardFocus}
        relatedTopUps={searchTopUps}
        relatedTransactions={searchTransactions}
      />
    </div>
  );
}

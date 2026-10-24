import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { fetchAtmTerminals } from "@/features/atm_terminal_slice";
import {
  clearEJJournal,
  clearEJTransactionSearch,
  EJ_TXN_SEARCH_PAGE_SIZE,
  fetchEJJournal,
  fetchEJJournalFile,
  fetchEJTransactionSearch,
} from "@/features/ej_transaction_search_slice";
import api from "@/lib/api";
import type { AtmTerminal } from "@/types/atm-terminal";
import type { EJTransaction } from "@/types/ej-transaction-search";
import { ejTransactionId } from "@/types/ej-transaction-search";
import getErrorMessage from "../../../../utility/error-message";
import { AppDispatch, RootState } from "../../../../app/store/store";
import {
  TerminalSearchSelect,
  type TerminalOption,
} from "../../dashboards/terminal-transactions/terminal-search-select";

import { createEjTxnSearchColumns } from "./columns";
import { EJTransactionDetailSheet } from "./detail-sheet";
import {
  EJJournalViewer,
  type JournalViewerMode,
} from "./journal-viewer";

const ALL_TERMINALS = "__all__";
const STATUS_ALL = "__all__";

type FormState = {
  card: string;
  terminal: string;
  authNum: string;
  status: string;
  amount: string;
  customerAccount: string;
};

const emptyForm = (): FormState => ({
  card: "",
  terminal: "",
  authNum: "",
  status: "",
  amount: "",
  customerAccount: "",
});

function parseAmountFilter(raw: string): number | undefined {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

/** Full TMS ATM list for EJ lookup: include relocated and deleted. */
function ejAtmTerminalOptions(terminals: AtmTerminal[]): TerminalOption[] {
  return terminals
    .filter((t) => Boolean(t.terminalId?.trim()))
    .map((t) => {
      const id = t.terminalId.trim();
      const name = t.terminalName?.trim();
      const status = t.status?.trim();
      const parts = [id];
      if (name) parts.push(name);
      if (status) parts.push(status);
      if (t.isDeleted) parts.push("Deleted");
      return { id, label: parts.join(" · ") };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export default function EJTransactionSearchPage() {
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
    journal,
    journalLoading,
    journalError,
    journalFile,
    journalFileLoading,
    journalFileError,
  } = useSelector((state: RootState) => state.ejTransactionSearch);
  const atmTerminals = useSelector(
    (state: RootState) => state.atmTerminal.terminals,
  );
  const atmTerminalsLoading = useSelector(
    (state: RootState) => state.atmTerminal.loading,
  );
  const { authUser } = useSelector((state: RootState) => state.user);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<EJTransaction | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalMode, setJournalMode] = useState<JournalViewerMode>("block");
  const [journalTxnId, setJournalTxnId] = useState<string>("");

  const setField = useCallback((key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (!authUser) return;
    void dispatch(fetchAtmTerminals()).then((result) => {
      if (fetchAtmTerminals.rejected.match(result)) {
        toast.error(
          (result.payload as string) || "Could not load terminals",
        );
      }
    });
  }, [authUser, dispatch]);

  const terminalOptions = useMemo<TerminalOption[]>(() => {
    return [
      { id: ALL_TERMINALS, label: "All terminals" },
      ...ejAtmTerminalOptions(atmTerminals),
    ];
  }, [atmTerminals]);

  const onOpenJournal = useCallback(
    async (row: EJTransaction) => {
      const id = ejTransactionId(row);
      if (!id) {
        toast.error("Missing transaction id");
        return;
      }
      setJournalTxnId(id);
      setJournalMode("block");
      setJournalOpen(true);
      const result = await dispatch(fetchEJJournal(id));
      if (fetchEJJournal.rejected.match(result)) {
        if (result.payload && result.payload !== "canceled") {
          toast.error(result.payload);
        }
      }
    },
    [dispatch],
  );

  const onRequestWholeFile = useCallback(async () => {
    if (!journalTxnId) return;
    if (journalFile?.id === journalTxnId) return;
    const result = await dispatch(fetchEJJournalFile(journalTxnId));
    if (fetchEJJournalFile.rejected.match(result)) {
      if (result.payload && result.payload !== "canceled") {
        toast.error(result.payload);
      }
    }
  }, [dispatch, journalFile?.id, journalTxnId]);

  const onDownloadFile = useCallback(async () => {
    if (!journalTxnId) {
      toast.error("Open a journal row first");
      return;
    }
    try {
      const response = await api.get(
        `/reports/ej-transactions/${encodeURIComponent(journalTxnId)}/journal-file/download`,
        { responseType: "blob" },
      );
      const blob = response.data as Blob;
      const disposition = String(
        response.headers["content-disposition"] || "",
      );
      let filename =
        journalFile?.filename || journal?.filename || "journal.log";
      const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
      if (match?.[1]) {
        filename = decodeURIComponent(match[1].replace(/"/g, "").trim());
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (error) {
      toast.error(getErrorMessage(error));
      throw error;
    }
  }, [journal?.filename, journalFile?.filename, journalTxnId]);

  const columns = useMemo(
    () => createEjTxnSearchColumns({ onOpenJournal }),
    [onOpenJournal],
  );

  const onSearch = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Pick a date range");
      return;
    }
    const amountRaw = form.amount.trim();
    const amount = parseAmountFilter(amountRaw);
    if (amountRaw && amount == null) {
      toast.error("Enter a valid amount");
      return;
    }
    const status = form.status.trim().toUpperCase();
    const args = {
      dateFrom: format(dateRange.from, "MM/dd/yyyy"),
      dateTo: format(dateRange.to, "MM/dd/yyyy"),
      card: form.card.trim() || undefined,
      terminal: form.terminal.trim() || undefined,
      authNum: form.authNum.trim() || undefined,
      status:
        status === "SUCCESS" || status === "FAILED" ? status : undefined,
      amount,
      customerAccount: form.customerAccount.trim() || undefined,
      page: 1,
      pageSize: EJ_TXN_SEARCH_PAGE_SIZE,
    };
    const result = await dispatch(fetchEJTransactionSearch(args));
    if (fetchEJTransactionSearch.rejected.match(result)) {
      if (result.payload && result.payload !== "canceled") {
        toast.error(result.payload);
      }
    }
  }, [dateRange, dispatch, form]);

  const onLoadMore = useCallback(async () => {
    if (!lastArgs || !hasMore || loadingMore) return;
    const result = await dispatch(
      fetchEJTransactionSearch({
        ...lastArgs,
        page: page + 1,
      }),
    );
    if (fetchEJTransactionSearch.rejected.match(result)) {
      if (result.payload && result.payload !== "canceled") {
        toast.error(result.payload);
      }
    }
  }, [dispatch, hasMore, lastArgs, loadingMore, page]);

  const onClear = useCallback(() => {
    setForm(emptyForm());
    setDateRange(undefined);
    setSelected(null);
    setDetailOpen(false);
    setJournalOpen(false);
    dispatch(clearEJTransactionSearch());
  }, [dispatch]);

  const onRowClick = useCallback((row: EJTransaction) => {
    setSelected(row);
    setDetailOpen(true);
  }, []);

  const emptyHint = useMemo(() => {
    if (loading) return null;
    if (!submitted) {
      return "Pick a date range, then optionally narrow by card, terminal, auth, status, amount, or customer account. Results appear after you search.";
    }
    if (error) return error;
    if (items.length === 0) return "No matching journal rows";
    return null;
  }, [error, items.length, loading, submitted]);

  return (
    <div className="container mx-auto space-y-4 pb-6">
      <div className="space-y-1 pt-1">
        <h3 className="text-lg font-semibold tracking-tight">EJ Finder</h3>
        <p className="text-sm text-muted-foreground">
          Look up ATM electronic journal rows by date, card, terminal, auth,
          status, amount, or customer account. Use Open journal to view the
          exact transaction block and line.
        </p>
      </div>

      <form
        className="space-y-4 rounded-lg border bg-muted/20 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSearch();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label>Date range</Label>
            <DatePickerWithRange
              className="w-full min-w-0 shrink"
              date={dateRange}
              onDateChange={setDateRange}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ej-card">Card</Label>
            <Input
              id="ej-card"
              placeholder="92316542, 9231****6542, or 458300XXXXXXXXX7"
              value={form.card}
              onChange={(e) => setField("card", e.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label>Terminal</Label>
            <TerminalSearchSelect
              options={terminalOptions}
              value={form.terminal || ALL_TERMINALS}
              onChange={(id) =>
                setField("terminal", id === ALL_TERMINALS ? "" : id)
              }
              placeholder={
                atmTerminalsLoading
                  ? "Loading terminals..."
                  : "All terminals"
              }
              triggerClassName="min-w-0 w-full lg:w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ej-auth">Auth number</Label>
            <Input
              id="ej-auth"
              placeholder="Auth / approval number"
              value={form.authNum}
              onChange={(e) => setField("authNum", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status || STATUS_ALL}
              onValueChange={(value) =>
                setField("status", value === STATUS_ALL ? "" : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>All statuses</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ej-amount">Amount</Label>
            <Input
              id="ej-amount"
              inputMode="decimal"
              placeholder="Exact amount"
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="ej-account">Customer account</Label>
            <Input
              id="ej-account"
              placeholder="Account entered at ATM"
              value={form.customerAccount}
              onChange={(e) => setField("customerAccount", e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClear}>
            Clear
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
      </form>

      {emptyHint ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyHint}
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={loading ? [] : items}
          searchKey="cardMasked"
          searchPlaceholder="Filter results..."
          exportFileName="ej-finder"
          onRowClick={onRowClick}
        />
      )}

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

      <EJTransactionDetailSheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelected(null);
        }}
        detail={selected}
        onOpenJournal={onOpenJournal}
      />

      <EJJournalViewer
        open={journalOpen}
        onOpenChange={(open) => {
          setJournalOpen(open);
          if (!open) {
            setJournalMode("block");
            setJournalTxnId("");
            dispatch(clearEJJournal());
          }
        }}
        mode={journalMode}
        onModeChange={setJournalMode}
        onRequestWholeFile={() => void onRequestWholeFile()}
        onDownloadFile={onDownloadFile}
        journal={journal}
        journalLoading={journalLoading}
        journalError={journalError}
        journalFile={journalFile}
        journalFileLoading={journalFileLoading}
        journalFileError={journalFileError}
      />
    </div>
  );
}

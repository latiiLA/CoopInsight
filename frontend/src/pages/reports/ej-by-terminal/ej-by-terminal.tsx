import { format, startOfDay } from "date-fns";
import { ArrowLeft, BookOpen, Terminal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import {
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";

import { type DataTableFeatures } from "@/components/data-table-features";
import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  clearEJBrowse,
  clearEJBrowseFiles,
  clearEJBrowseJournal,
  fetchEJBrowseFiles,
  fetchEJBrowseJournalFile,
  fetchEJBrowseTerminals,
} from "@/features/ej_browse_slice";
import api from "@/lib/api";
import type { EJBrowseFile, EJBrowseTerminal } from "@/types/ej-browse";
import getErrorMessage from "../../../../utility/error-message";
import { AppDispatch, RootState } from "../../../../app/store/store";
import {
  EJJournalViewer,
  type JournalViewerMode,
} from "../ej-transaction-search/journal-viewer";

function getTodayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatBytes(n: number) {
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const terminalHelper = createColumnHelper<DataTableFeatures, EJBrowseTerminal>();
const fileHelper = createColumnHelper<DataTableFeatures, EJBrowseFile>();

export default function EJByTerminalPage() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    terminals,
    files,
    selectedTerminal,
    submitted,
    terminalsLoading,
    filesLoading,
    error,
    lastArgs,
    journalFile,
    journalFileLoading,
    journalFileError,
  } = useSelector((state: RootState) => state.ejBrowse);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    getTodayRange,
  );
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalMode] = useState<JournalViewerMode>("file");
  const [openFileMeta, setOpenFileMeta] = useState<{
    terminalId: string;
    filename: string;
  } | null>(null);

  const onListTerminals = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Pick a date range");
      return;
    }
    const args = {
      dateFrom: format(dateRange.from, "MM/dd/yyyy"),
      dateTo: format(dateRange.to, "MM/dd/yyyy"),
    };
    const result = await dispatch(fetchEJBrowseTerminals(args));
    if (fetchEJBrowseTerminals.rejected.match(result)) {
      if (result.payload && result.payload !== "canceled") {
        toast.error(result.payload);
      }
    }
  }, [dateRange, dispatch]);

  const onSelectTerminal = useCallback(
    async (row: EJBrowseTerminal) => {
      if (!lastArgs) {
        toast.error("List terminals for a date range first");
        return;
      }
      const result = await dispatch(
        fetchEJBrowseFiles({
          ...lastArgs,
          terminalId: row.terminalId,
        }),
      );
      if (fetchEJBrowseFiles.rejected.match(result)) {
        if (result.payload && result.payload !== "canceled") {
          toast.error(result.payload);
        }
      }
    },
    [dispatch, lastArgs],
  );

  const onOpenEj = useCallback(
    async (row: EJBrowseFile) => {
      setOpenFileMeta({
        terminalId: row.terminalId,
        filename: row.filename,
      });
      setJournalOpen(true);
      const result = await dispatch(
        fetchEJBrowseJournalFile({
          terminalId: row.terminalId,
          filename: row.filename,
        }),
      );
      if (fetchEJBrowseJournalFile.rejected.match(result)) {
        if (result.payload && result.payload !== "canceled") {
          toast.error(result.payload);
        }
      }
    },
    [dispatch],
  );

  const onDownloadFile = useCallback(async () => {
    if (!openFileMeta) {
      toast.error("Open a journal first");
      return;
    }
    try {
      const response = await api.get(
        `/reports/ej-browse/terminals/${encodeURIComponent(openFileMeta.terminalId)}/files/${encodeURIComponent(openFileMeta.filename)}/download`,
        { responseType: "blob" },
      );
      const blob = response.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = openFileMeta.filename || "journal.log";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (error) {
      toast.error(getErrorMessage(error));
      throw error;
    }
  }, [openFileMeta]);

  const onBackToTerminals = useCallback(() => {
    dispatch(clearEJBrowseFiles());
  }, [dispatch]);

  const onClear = useCallback(() => {
    setDateRange(getTodayRange());
    setJournalOpen(false);
    setOpenFileMeta(null);
    dispatch(clearEJBrowse());
  }, [dispatch]);

  const terminalColumns = useMemo(
    () =>
      [
        terminalHelper.accessor("terminalId", {
          header: "Terminal ID",
          cell: ({ getValue }) => (
            <button
              type="button"
              className="font-mono text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {getValue() || "-"}
            </button>
          ),
        }),
        terminalHelper.accessor("fileCount", {
          header: "EJ files",
          cell: ({ getValue }) => formatCount(getValue()),
        }),
        terminalHelper.accessor("txnCount", {
          header: "Transactions",
          cell: ({ getValue }) => formatCount(getValue()),
        }),
        terminalHelper.display({
          id: "open",
          header: "",
          cell: () => (
            <span className="text-xs text-muted-foreground">
              Click row to list journals
            </span>
          ),
        }),
      ] as ColumnDef<DataTableFeatures, EJBrowseTerminal>[],
    [],
  );

  const fileColumns = useMemo(
    () =>
      [
        fileHelper.accessor("ejDate", {
          header: "Date",
          cell: ({ getValue }) => getValue() || "-",
        }),
        fileHelper.accessor("filename", {
          header: "Journal file",
          cell: ({ getValue }) => (
            <span className="font-mono text-xs">{getValue() || "-"}</span>
          ),
        }),
        fileHelper.accessor("txnCount", {
          header: "Transactions",
          cell: ({ getValue }) => formatCount(getValue()),
        }),
        fileHelper.accessor("size", {
          header: "Size",
          cell: ({ getValue }) => formatBytes(getValue()),
        }),
        fileHelper.accessor("atmType", {
          header: "ATM type",
          cell: ({ getValue }) => getValue() || "-",
        }),
        fileHelper.display({
          id: "openEj",
          header: "Journal",
          cell: ({ row }) => (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={(e) => {
                e.stopPropagation();
                void onOpenEj(row.original);
              }}
            >
              <BookOpen className="mr-1.5 size-3.5" />
              Open EJ
            </Button>
          ),
        }),
      ] as ColumnDef<DataTableFeatures, EJBrowseFile>[],
    [onOpenEj],
  );

  const showingFiles = Boolean(selectedTerminal);
  const loading = showingFiles ? filesLoading : terminalsLoading;

  const emptyHint = useMemo(() => {
    if (loading) return null;
    if (!submitted) {
      return "Pick a date range and list terminals that have indexed electronic journals.";
    }
    if (error) return error;
    if (showingFiles && files.length === 0) {
      return `No journal files for ${selectedTerminal} in this date range.`;
    }
    if (!showingFiles && terminals.length === 0) {
      return "No terminals with indexed journals for this date range. Check EJ Coverage or run the indexer.";
    }
    return null;
  }, [
    error,
    files.length,
    loading,
    selectedTerminal,
    showingFiles,
    submitted,
    terminals.length,
  ]);

  return (
    <div className="container mx-auto space-y-4 pb-6">
      <div className="space-y-1 pt-1">
        <h3 className="text-lg font-semibold tracking-tight">EJ by Terminal</h3>
        <p className="text-sm text-muted-foreground">
          Browse indexed journals by terminal ID, then open the electronic
          journal file. Transaction search remains on EJ Finder.
        </p>
      </div>

      <form
        className="space-y-4 rounded-lg border bg-muted/20 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onListTerminals();
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
            <Label>Date range</Label>
            <DatePickerWithRange
              className="w-full min-w-0"
              date={dateRange}
              onDateChange={setDateRange}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onClear}>
              Clear
            </Button>
            <Button type="submit" disabled={terminalsLoading}>
              {terminalsLoading ? "Loading..." : "List terminals"}
            </Button>
          </div>
        </div>
      </form>

      {showingFiles ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBackToTerminals}
          >
            <ArrowLeft className="mr-1.5 size-3.5" />
            All terminals
          </Button>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Terminal className="size-3.5 text-muted-foreground" />
            <span className="font-mono">{selectedTerminal}</span>
          </div>
        </div>
      ) : null}

      {emptyHint ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyHint}
        </p>
      ) : showingFiles ? (
        <DataTable
          columns={fileColumns}
          data={filesLoading ? [] : files}
          searchKey="filename"
          searchPlaceholder="Filter journal files..."
          exportFileName={`ej-${selectedTerminal || "terminal"}`}
          onRowClick={(row) => void onOpenEj(row)}
          loading={filesLoading}
        />
      ) : (
        <DataTable
          columns={terminalColumns}
          data={terminalsLoading ? [] : terminals}
          searchKey="terminalId"
          searchPlaceholder="Filter terminal ID..."
          exportFileName="ej-terminals"
          onRowClick={(row) => void onSelectTerminal(row)}
          loading={terminalsLoading}
        />
      )}

      <EJJournalViewer
        open={journalOpen}
        onOpenChange={(open) => {
          setJournalOpen(open);
          if (!open) {
            setOpenFileMeta(null);
            dispatch(clearEJBrowseJournal());
          }
        }}
        mode={journalMode}
        onModeChange={() => {
          /* file-only browse */
        }}
        onRequestWholeFile={() => {
          /* already whole file */
        }}
        onDownloadFile={onDownloadFile}
        journal={null}
        journalLoading={false}
        journalError={null}
        journalFile={journalFile}
        journalFileLoading={journalFileLoading}
        journalFileError={journalFileError}
        fileOnly
      />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Copy, Download, FileSearch, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  EJJournalFileView,
  EJJournalView,
} from "@/types/ej-transaction-search";

export type JournalViewerMode = "block" | "file";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: JournalViewerMode;
  onModeChange: (mode: JournalViewerMode) => void;
  onRequestWholeFile: () => void;
  onDownloadFile: () => Promise<void>;
  journal: EJJournalView | null;
  journalLoading: boolean;
  journalError: string | null;
  journalFile: EJJournalFileView | null;
  journalFileLoading: boolean;
  journalFileError: string | null;
};

async function copyText(label: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy");
  }
}

function lineLabel(journal: EJJournalView) {
  if (!journal.lineStart) return "-";
  if (journal.lineEnd && journal.lineEnd !== journal.lineStart) {
    return `${journal.lineStart}-${journal.lineEnd}`;
  }
  return String(journal.lineStart);
}

function formatBytes(n: number) {
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function EJJournalViewer({
  open,
  onOpenChange,
  mode,
  onModeChange,
  onRequestWholeFile,
  onDownloadFile,
  journal,
  journalLoading,
  journalError,
  journalFile,
  journalFileLoading,
  journalFileError,
}: Props) {
  const preRef = useRef<HTMLPreElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const loading = mode === "file" ? journalFileLoading : journalLoading;
  const error = mode === "file" ? journalFileError : journalError;
  const filename =
    mode === "file"
      ? journalFile?.filename
      : journal?.filename;
  const path = mode === "file" ? journalFile?.path : journal?.path;

  const highlightStart =
    journalFile?.highlightLine ?? journal?.lineStart ?? 0;
  const highlightEnd =
    journalFile?.highlightLineEnd ??
    journal?.lineEnd ??
    highlightStart;

  useEffect(() => {
    if (mode !== "file" || !highlightStart || !preRef.current) {
      return;
    }
    const target = preRef.current.querySelector(
      `[data-ej-line="${highlightStart}"]`,
    );
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: "center" });
    }
  }, [mode, highlightStart, journalFile]);

  const wholeFileLines =
    mode === "file" && journalFile?.content
      ? journalFile.content.split(/\r?\n/)
      : null;

  function isTxnBoundaryLine(line: string) {
    const t = line.toUpperCase();
    return (
      t.includes("TRANSACTION START") || t.includes("TRANSACTION END")
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="space-y-1 border-b px-6 py-4 text-left">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileSearch className="size-3.5 shrink-0 text-primary" />
            {mode === "file" ? "Whole journal file" : "Open journal"}
          </div>
          <DialogTitle className="text-base">
            {filename || (loading ? "Loading journal..." : "Journal")}
          </DialogTitle>
          <DialogDescription>
            {mode === "file"
              ? journalFile
                ? `${formatBytes(journalFile.sizeBytes)}${
                    journalFile.terminalId
                      ? ` · ${journalFile.terminalId}`
                      : ""
                  }${
                    journalFile.highlightLine
                      ? ` · near line ${journalFile.highlightLine}`
                      : ""
                  }${journalFile.truncated ? " · truncated for display" : ""}`
                : error || "Full electronic journal file"
              : journal
                ? `Line ${lineLabel(journal)}${
                    journal.terminalId ? ` · ${journal.terminalId}` : ""
                  }${journal.ejDate ? ` · ${journal.ejDate}` : ""}`
                : error || "Transaction block from the electronic journal"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b px-6 py-2">
          <Button
            type="button"
            variant={mode === "block" ? "default" : "outline"}
            size="sm"
            disabled={journalLoading}
            onClick={() => onModeChange("block")}
          >
            This transaction
          </Button>
          <Button
            type="button"
            variant={mode === "file" ? "default" : "outline"}
            size="sm"
            disabled={journalFileLoading}
            onClick={() => {
              onModeChange("file");
              onRequestWholeFile();
            }}
          >
            <FileText className="mr-1.5 size-3.5" />
            {journalFileLoading ? "Loading file..." : "View whole file"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={downloading || (!journal && !journalFile)}
            onClick={() => {
              setDownloading(true);
              void onDownloadFile()
                .catch(() => {
                  /* toast handled by caller */
                })
                .finally(() => setDownloading(false));
            }}
          >
            <Download className="mr-1.5 size-3.5" />
            {downloading ? "Downloading..." : "Download file"}
          </Button>

          {mode === "block" && journal?.lineStart ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void copyText("Line", String(journal.lineStart))
              }
            >
              <Copy className="mr-1.5 size-3.5" />
              Copy line {journal.lineStart}
            </Button>
          ) : null}
          {path ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyText("Path", path)}
            >
              <Copy className="mr-1.5 size-3.5" />
              Copy path
            </Button>
          ) : null}
          {mode === "block" && journal?.rawText ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyText("Journal text", journal.rawText)}
            >
              <Copy className="mr-1.5 size-3.5" />
              Copy text
            </Button>
          ) : null}
          {mode === "file" && journalFile?.content ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void copyText("Journal file", journalFile.content)
              }
            >
              <Copy className="mr-1.5 size-3.5" />
              Copy file
            </Button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              {mode === "file"
                ? "Opening whole journal file..."
                : "Opening journal..."}
            </p>
          ) : null}
          {error && !loading ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          {mode === "block" && journal?.rawText && !loading ? (
            <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 font-mono text-[12px] leading-relaxed">
              {journal.rawText}
            </pre>
          ) : null}

          {mode === "file" && wholeFileLines && !loading ? (
            <pre
              ref={preRef}
              className="rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed"
            >
              {wholeFileLines.map((line, idx) => {
                const lineNo = idx + 1;
                const inTxnRange =
                  highlightStart > 0 &&
                  lineNo >= highlightStart &&
                  lineNo <= Math.max(highlightEnd, highlightStart);
                const highlight =
                  inTxnRange && isTxnBoundaryLine(line);
                return (
                  <div
                    key={lineNo}
                    data-ej-line={lineNo}
                    className={
                      highlight
                        ? "bg-amber-500/20 px-1 whitespace-pre-wrap break-words"
                        : "px-1 whitespace-pre-wrap break-words"
                    }
                  >
                    <span className="mr-3 inline-block w-10 select-none text-right text-muted-foreground">
                      {lineNo}
                    </span>
                    {line}
                  </div>
                );
              })}
            </pre>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

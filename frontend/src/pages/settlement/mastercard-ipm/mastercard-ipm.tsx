import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  FileUp,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearMastercardIPMUpload,
  fetchMastercardIPMBatchRecords,
  fetchMastercardIPMBatches,
  fetchMastercardIPMTransactions,
  uploadMastercardIPMFile,
} from "@/features/mastercard_ipm_slice";
import type { MastercardIPMBatchSummary } from "@/types/mastercard-ipm";
import { AppDispatch, RootState } from "../../../../app/store/store";
import {
  FINANCIAL_COLUMN_IDS,
  buildBatchColumns,
  buildTransactionColumns,
} from "./columns";

/**
 * The date range this endpoint is asked for. The backend wants ISO calendar
 * dates, which is what the picker already produces, so no reformatting is
 * needed here.
 */
const toApiDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Mastercard IPM clearing / settlement file processing.
 *
 * Mirrors the Visa settlement page: upload a file, list processed batches, and
 * browse records by batch or date range. Settlement summaries often lack a
 * STAN, so the records table emphasises message_number / file_id / function_code.
 */
export default function MastercardIPM() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    batches,
    batchesLoading,
    batchesError,
    transactions,
    transactionsLoading,
    transactionsError,
    uploadResult,
    uploadSummary,
    uploadLoading,
    uploadError,
  } = useSelector((state: RootState) => state.mastercardIPM);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [view, setView] = useState<"batches" | "records">("batches");

  const [recordsBatch, setRecordsBatch] = useState<{
    id: string;
    fileName: string;
  } | null>(null);

  const viewBatchRecords = useCallback(
    (batch: MastercardIPMBatchSummary) => {
      setRecordsBatch({ id: batch.id, fileName: batch.file_name });
      setView("records");
      dispatch(fetchMastercardIPMBatchRecords(batch.id));
    },
    [dispatch],
  );

  const batchColumns = useMemo(
    () => buildBatchColumns(viewBatchRecords),
    [viewBatchRecords],
  );
  const transactionColumns = useMemo(() => buildTransactionColumns(), []);

  const showFinancialColumns = useMemo(
    () =>
      transactions.some(
        (tx) =>
          Boolean(tx.pan) ||
          Boolean(tx.stan) ||
          (tx.amount != null && tx.amount !== 0) ||
          Boolean(tx.card_acceptor_name) ||
          Boolean(tx.terminal_id) ||
          Boolean(tx.acquirer_id),
      ),
    [transactions],
  );
  const transactionColumnVisibility = useMemo(
    () =>
      Object.fromEntries(
        FINANCIAL_COLUMN_IDS.map((id) => [id, showFinancialColumns]),
      ),
    [showFinancialColumns],
  );

  const activeBatch = useMemo(() => {
    if (!recordsBatch) return null;
    return (
      batches.find((batch) => batch.id === recordsBatch.id) ??
      (uploadSummary?.id === recordsBatch.id ? uploadSummary : null)
    );
  }, [batches, recordsBatch, uploadSummary]);

  const loadBatches = useCallback(() => {
    const promise = dispatch(fetchMastercardIPMBatches({ limit: 20 }));
    return () => promise.abort();
  }, [dispatch]);

  useEffect(() => loadBatches(), [loadBatches]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      setSelectedFile(file);
      dispatch(clearMastercardIPMUpload());
    },
    [dispatch],
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Choose a Mastercard IPM file first");
      return;
    }

    const result = await dispatch(uploadMastercardIPMFile(selectedFile));

    if (uploadMastercardIPMFile.fulfilled.match(result)) {
      const summary = result.payload.summary;
      const parsed = summary?.parsed_records ?? summary?.total_records ?? 0;
      const inserted = summary?.inserted_records;
      const duplicates = summary?.duplicate_records ?? 0;

      if (parsed > 0 && summary) {
        if (duplicates > 0 && (inserted ?? 0) === 0) {
          toast.info(
            `${selectedFile.name} was already processed: all ${duplicates.toLocaleString()} records were skipped`,
          );
        } else if (duplicates > 0) {
          toast.success(
            `Added ${(inserted ?? 0).toLocaleString()} new record${(inserted ?? 0) === 1 ? "" : "s"} from ${selectedFile.name}, skipped ${duplicates.toLocaleString()} already stored`,
          );
        } else {
          toast.success(
            `Processed ${parsed.toLocaleString()} record${parsed === 1 ? "" : "s"} from ${selectedFile.name}`,
          );
        }

        setRecordsBatch({ id: summary.id, fileName: summary.file_name });
        setView("records");
        dispatch(fetchMastercardIPMBatchRecords(summary.id));
      } else {
        toast.warning(
          `${selectedFile.name} was read but contained no Mastercard IPM records`,
        );
      }
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      loadBatches();
      return;
    }

    if (uploadMastercardIPMFile.rejected.match(result)) {
      toast.error(result.payload?.error || "Failed to process the file");
    }
  }, [dispatch, loadBatches, selectedFile]);

  const handleDateChange = useCallback(
    (next: DateRange | undefined) => {
      if (!next?.from || !next?.to) {
        return;
      }
      setDateRange(next);
      setRecordsBatch(null);
      dispatch(
        fetchMastercardIPMTransactions({
          start: toApiDate(next.from),
          end: toApiDate(next.to),
        }),
      );
    },
    [dispatch],
  );

  return (
    <div className="container mx-auto">
      <div className="py-1">
        <h3 className="text-lg font-semibold tracking-tight">
          Mastercard IPM
        </h3>
        <p className="text-sm text-muted-foreground">
          Process a Mastercard IPM clearing and settlement file, then review the
          parsed messages
        </p>
      </div>

      <Card className="py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Process an IPM file</CardTitle>
          <CardDescription>
            Uploads the file to the processor, which splits it into settlement
            summaries and financial presentments. Nothing is written until the
            whole file has been read.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="mastercard-ipm-file">IPM file</Label>
                <Input
                  id="mastercard-ipm-file"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
                />
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploadLoading || !selectedFile}
              >
                {uploadLoading ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {uploadLoading ? "Processing" : "Process file"}
              </Button>
            </div>

            {selectedFile ? (
              <p className="text-xs text-muted-foreground">
                Selected: {selectedFile.name} (
                {(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            ) : null}
          </div>

          {uploadSummary ? (
            <div
              className={`mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                uploadSummary.status === "FAILED"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border bg-muted/40"
              }`}
            >
              {uploadSummary.status === "FAILED" ? (
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              )}
              <div className="min-w-0">
                <p className="font-medium">
                  {uploadSummary.file_name}
                  {uploadSummary.status ? ` · ${uploadSummary.status}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {uploadSummary.file_id
                    ? `File ID ${uploadSummary.file_id}`
                    : "No file ID on the header"}
                  {(uploadSummary.parsed_messages ?? 0) > 0
                    ? ` · ${uploadSummary.parsed_messages!.toLocaleString()} messages in file`
                    : ""}
                  {` · ${uploadSummary.total_records.toLocaleString()} settlement/financial record${uploadSummary.total_records === 1 ? "" : "s"}`}
                </p>
                {uploadSummary.error_message || uploadResult?.message ? (
                  <p className="text-muted-foreground">
                    {uploadSummary.error_message || uploadResult?.message}
                  </p>
                ) : null}
                {uploadSummary.inserted_records !== undefined ? (
                  <p className="text-muted-foreground">
                    {(uploadSummary.inserted_records ?? 0).toLocaleString()}{" "}
                    new,{" "}
                    {(uploadSummary.duplicate_records ?? 0).toLocaleString()}{" "}
                    already stored
                  </p>
                ) : null}
              </div>
            </div>
          ) : uploadError ? (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p>{uploadError}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="py-2">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            variant={view === "batches" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("batches")}
          >
            Processed files
          </Button>
          <Button
            variant={view === "records" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("records")}
          >
            Records
          </Button>
        </div>

        {view === "batches" ? (
          batchesError ? (
            <Card className="border-destructive/40 py-4">
              <CardContent className="flex items-center gap-2 px-4 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {batchesError}
              </CardContent>
            </Card>
          ) : (
            <DataTable
              loading={batchesLoading}
              columns={batchColumns}
              data={batchesLoading ? [] : batches}
              searchPlaceholder="Search processed files..."
              exportFileName="mastercard-ipm-batches"
              enableColumnVisibility={false}
            />
          )
        ) : (
          <div className="space-y-3">
            {activeBatch ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium">{activeBatch.status || "—"}</p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-xs text-muted-foreground">File ID</p>
                  <p className="truncate font-mono text-sm" title={activeBatch.file_id}>
                    {activeBatch.file_id || "—"}
                  </p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Records</p>
                  <p className="font-medium tabular-nums">
                    {activeBatch.total_records.toLocaleString()}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      stored
                      {(activeBatch.parsed_messages ?? 0) > 0
                        ? ` · ${activeBatch.parsed_messages!.toLocaleString()} in file`
                        : ""}
                    </span>
                  </p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-xs text-muted-foreground">New / skipped</p>
                  <p className="font-medium tabular-nums">
                    {(
                      activeBatch.inserted_records ?? activeBatch.total_records
                    ).toLocaleString()}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      new · {(activeBatch.duplicate_records ?? 0).toLocaleString()}{" "}
                      skipped
                    </span>
                  </p>
                </div>
              </div>
            ) : null}
            {transactionsError ? (
              <Card className="border-destructive/40 py-4">
                <CardContent className="flex items-center gap-2 px-4 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {transactionsError}
                </CardContent>
              </Card>
            ) : null}

            {transactionsLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading records...
              </p>
            ) : transactions.length === 0 ? (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                {recordsBatch ? (
                  <FileUp className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <CalendarRange className="mt-0.5 size-4 shrink-0" />
                )}
                <span>
                  {recordsBatch
                    ? `No records are linked to ${recordsBatch.fileName}. Records uploaded before batch tracking was added cannot be listed this way.`
                    : !dateRange
                      ? "No range is preselected. Pick a start and end date beside Export to list records with a transaction date."
                      : "No records for the selected dates. Process an IPM file covering these dates, or widen the range. Settlement summaries without a transaction date are best viewed from the processed file."}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {transactions.length.toLocaleString()} record
                {transactions.length === 1 ? "" : "s"}
                {recordsBatch
                  ? ` captured from ${recordsBatch.fileName}`
                  : " in the selected date range"}
              </p>
            )}

            <DataTable
              loading={transactionsLoading}
              columns={transactionColumns}
              data={transactionsLoading ? [] : transactions}
              searchPlaceholder="Search message number, file ID, function code..."
              exportFileName="mastercard-ipm-records"
              onDateChange={handleDateChange}
              defaultDate={dateRange}
              initialColumnVisibility={transactionColumnVisibility}
            />
          </div>
        )}
      </div>
    </div>
  );
}
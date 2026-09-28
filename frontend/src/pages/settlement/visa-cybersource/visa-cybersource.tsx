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
  clearVisaSettlementUpload,
  fetchVisaSettlementBatchRecords,
  fetchVisaSettlementBatches,
  fetchVisaSettlementTransactions,
  uploadVisaSettlementFile,
} from "@/features/visa_settlement_slice";
import type { VisaSettlementBatchSummary } from "@/types/visa-settlement";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { buildBatchColumns, buildTransactionColumns } from "./columns";

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
 * No range is preselected, so the user picks the dates they want.
 *
 * Any sensible default is a guess about which file they last processed, and
 * settlement files arrive on their own cycle, so a wrong guess either hides
 * records or shows an arbitrary window. Starting empty also means the records
 * on screen are only ever the result of a range the user chose.
 */
export default function VisaCyberSource() {
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
  } = useSelector((state: RootState) => state.visaSettlement);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // Undefined until the user picks a range, which is what keeps the records
  // table empty on open rather than guessing a window.
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [view, setView] = useState<"batches" | "records">("batches");

  // Shows the records one upload captured, so "View records" on a processed file
  // works without the user having to know which dates that file covers.
  const [recordsBatch, setRecordsBatch] = useState<{
    id: string;
    fileName: string;
  } | null>(null);

  const viewBatchRecords = useCallback(
    (batch: VisaSettlementBatchSummary) => {
      setRecordsBatch({ id: batch.id, fileName: batch.file_name });
      setView("records");
      dispatch(fetchVisaSettlementBatchRecords(batch.id));
    },
    [dispatch],
  );

  const batchColumns = useMemo(
    () => buildBatchColumns(viewBatchRecords),
    [viewBatchRecords],
  );
  const transactionColumns = useMemo(() => buildTransactionColumns(), []);

  const loadBatches = useCallback(() => {
    const promise = dispatch(fetchVisaSettlementBatches({ limit: 20 }));
    return () => promise.abort();
  }, [dispatch]);

  useEffect(() => loadBatches(), [loadBatches]);

  const pickFile = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      setSelectedFile(file);
      // Clear the previous outcome so a new selection never sits next to the
      // result of the file before it.
      dispatch(clearVisaSettlementUpload());
    },
    [dispatch],
  );
  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Choose a settlement file first");
      return;
    }

    const result = await dispatch(uploadVisaSettlementFile(selectedFile));

    if (uploadVisaSettlementFile.fulfilled.match(result)) {
      const summary = result.payload.summary;
      const parsed = summary?.parsed_records ?? summary?.total_records ?? 0;
      const inserted = summary?.inserted_records;
      const duplicates = summary?.duplicate_records ?? 0;

      if (parsed > 0 && summary) {
        if (duplicates > 0 && (inserted ?? 0) === 0) {
          // Every record was already stored, so nothing new was written. This
          // is a normal outcome, not a failure, and is reported as such.
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

        // Show what was actually captured straight away, rather than making the
        // user search for it by a date the parser may not have produced.
        setRecordsBatch({ id: summary.id, fileName: summary.file_name });
        setView("records");
        dispatch(fetchVisaSettlementBatchRecords(summary.id));
      } else {
        // A zero-record parse is not an error, but it is almost never intended,
        // so it is called out rather than reported as a success.
        toast.warning(
          `${selectedFile.name} was read but contained no settlement records`,
        );
      }
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      loadBatches();
      return;
    }

    if (uploadVisaSettlementFile.rejected.match(result)) {
      toast.error(result.payload?.error || "Failed to process the file");
    }
  }, [dispatch, loadBatches, selectedFile]);

  // The range picker lives in the table toolbar beside Export, so a range change
  // arrives from there and triggers the fetch directly. Nothing is fetched until
  // a complete range has been chosen.
  const handleDateChange = useCallback(
    (next: DateRange | undefined) => {
      if (!next?.from || !next?.to) {
        return;
      }
      setDateRange(next);
      setRecordsBatch(null);
      dispatch(
        fetchVisaSettlementTransactions({
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
          Visa Settlement
        </h3>
        <p className="text-sm text-muted-foreground">
          Process a Visa clearing and settlement advice file, then review the
          parsed records
        </p>
      </div>

      <Card className="py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Process a settlement file</CardTitle>
          <CardDescription>
            Uploads the file to the processor, which splits it into the
            transaction records and fee detail. Nothing is written until the
            whole file has been read.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          {/* The row is bottom aligned so the button sits level with the input.
              The selected-file detail therefore sits outside it, because
              inside the row it would grow the row and drag the button down. */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="visa-settlement-file">Settlement file</Label>
                <Input
                  id="visa-settlement-file"
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
                  {uploadSummary.file_name}:{" "}
                  {uploadSummary.total_records.toLocaleString()} record
                  {uploadSummary.total_records === 1 ? "" : "s"}
                </p>
                <p className="text-muted-foreground">
                  {uploadSummary.error_message ?? uploadResult?.message ?? ""}
                </p>
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
              exportFileName="visa-settlement-batches"
              enableColumnVisibility={false}
            />
          )
        ) : (
          <div className="space-y-3">
            {transactionsError ? (
              <Card className="border-destructive/40 py-4">
                <CardContent className="flex items-center gap-2 px-4 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {transactionsError}
                </CardContent>
              </Card>
            ) : null}

            {/* The caption sits above the table because the table's own toolbar
                carries the date range picker, so the table has to render even
                with no rows or there would be no way to choose a range. */}
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
                      ? "No range is preselected. Pick a start and end date beside Export to list records."
                      : "No records for the selected dates. Process a settlement file covering these dates, or widen the range."}
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
              searchPlaceholder="Search records..."
              exportFileName="visa-settlement-records"
              // The table renders the range picker beside Export, so it is shown
              // whatever the row count, otherwise an empty table would have no
              // way to choose a range.
              onDateChange={handleDateChange}
              defaultDate={dateRange}
            />
          </div>
        )}
      </div>
    </div>
  );
}

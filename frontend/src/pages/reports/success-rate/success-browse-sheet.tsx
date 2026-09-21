import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  clearSuccessBrowse,
  fetchSuccessBrowse,
} from "@/features/report_slice";
import {
  SuccessBrowseOutcome,
  SuccessChannel,
  SuccessFlow,
} from "@/types/report";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { browseColumns } from "./browse-columns";

type SuccessBrowseSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  channel: SuccessChannel;
  flow: SuccessFlow;
  dateFrom: string;
  dateTo: string;
  outcome: SuccessBrowseOutcome;
  respCode?: string;
  respLabel?: string;
};

export function SuccessBrowseSheet({
  open,
  onOpenChange,
  title,
  channel,
  flow,
  dateFrom,
  dateTo,
  outcome,
  respCode,
  respLabel,
}: SuccessBrowseSheetProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { successBrowse, successBrowseLoading, successBrowseError } =
    useSelector((state: RootState) => state.report);

  useEffect(() => {
    if (!open) {
      return;
    }

    void (async () => {
      const result = await dispatch(
        fetchSuccessBrowse({
          dateFrom,
          dateTo,
          channel,
          flow,
          outcome,
          respCode,
          limit: 250,
        }),
      );

      if (fetchSuccessBrowse.rejected.match(result)) {
        toast.error(result.payload || "Failed to load transactions");
      }
    })();

    return () => {
      dispatch(clearSuccessBrowse());
    };
  }, [open, dateFrom, dateTo, channel, flow, outcome, respCode, dispatch]);

  const filterHint = [
    outcome === "all" ? "All outcomes" : outcome,
    respCode
      ? `code ${respCode}${respLabel ? ` · ${respLabel}` : ""}`
      : null,
    `${dateFrom} – ${dateTo}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-5xl"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{filterHint}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-muted-foreground">
          <span>
            {successBrowseLoading
              ? "Loading transactions…"
              : successBrowseError
                ? successBrowseError
                : `${successBrowse.length.toLocaleString()} transaction${successBrowse.length === 1 ? "" : "s"} (max 250)`}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={successBrowseLoading}
            onClick={() => {
              void dispatch(
                fetchSuccessBrowse({
                  dateFrom,
                  dateTo,
                  channel,
                  flow,
                  outcome,
                  respCode,
                  limit: 250,
                }),
              );
            }}
          >
            Refresh
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          <DataTable
            loading={successBrowseLoading}
            columns={browseColumns}
            data={successBrowse}
            searchPlaceholder="Search terminal, RRN, reason..."
            exportFileName={`${channel}-${flow}-transactions`}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

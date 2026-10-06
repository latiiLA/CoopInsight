import { format, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { fetchSuccessTransactions } from "@/features/report_slice";
import { toApiDate, toApiEchoDate } from "@/lib/report-range";
import { SuccessChannel, SuccessFlow } from "@/types/report";
import { hasPermission } from "../../../../utility/has-permission";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { SuccessBrowseSheet } from "./success-browse-sheet";
import {
  getSuccessRateCopy,
  SuccessRateView,
  type SuccessRateBrowseRequest,
} from "./success-rate-view";

function getTodayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

export default function SuccessRate({
  channel = "atm",
  flow = "acquiring",
}: {
  channel?: SuccessChannel;
  flow?: SuccessFlow;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const { successRate, successRateLoading } = useSelector(
    (state: RootState) => state.report,
  );
  const permissions = useSelector((state: RootState) => state.user.permissions);
  const todayRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);
  const copy = getSuccessRateCopy(channel, flow);
  const canBrowse = hasPermission(
    [
      "report:browse-success-transactions",
      "report:view-success-transactions",
    ],
    permissions,
  );

  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseFilter, setBrowseFilter] = useState<SuccessRateBrowseRequest>({
    outcome: "all",
  });

  // Only show numbers that belong to this page AND to the dates currently
  // selected. Comparing channel and flow alone let a report for a different
  // range stay on screen after the date picker changed, so its totals were read
  // as the answer for the newly picked range.
  //
  // The API echoes the range it used, normalised to MM-DD-YYYY, so the
  // comparison uses the echo format rather than what was sent.
  const report = useMemo(() => {
    if (!successRate) return null;
    if (successRate.channel !== channel || successRate.flow !== flow) {
      return null;
    }
    if (!dateRange?.from || !dateRange?.to) return null;
    if (
      successRate.dateFrom !== toApiEchoDate(dateRange.from) ||
      successRate.dateTo !== toApiEchoDate(dateRange.to)
    ) {
      return null;
    }
    return successRate;
  }, [successRate, channel, flow, dateRange]);

  const openBrowse = useCallback((next: SuccessRateBrowseRequest) => {
    setBrowseFilter(next);
    setBrowseOpen(true);
  }, []);

  // Returns the raw dispatch promise so the caller can abort it.
  const loadReport = useCallback(
    (date: DateRange | undefined) => {
      if (!date?.from || !date?.to) {
        return null;
      }

      return dispatch(
        fetchSuccessTransactions({
          dateFrom: toApiDate(date.from),
          dateTo: toApiDate(date.to),
          channel,
          flow,
        }),
      );
    },
    [channel, dispatch, flow],
  );

  const handleDateChange = useCallback((date: DateRange | undefined) => {
    if (!date?.from || !date?.to) {
      return;
    }
    setDateRange(date);
  }, []);

  // Opening a different channel/flow starts a fresh report for today. Without
  // this the picker kept the previous page's dates while the request went out
  // for today, so the picker and the loaded report disagreed.
  useEffect(() => {
    setDateRange(todayRange);
  }, [channel, flow, todayRange]);

  // Single fetch path, driven by dateRange. Keeping the picker, the request and
  // the response guard on one value is what stops them disagreeing.
  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return;
    }

    const promise = loadReport(dateRange);

    promise?.then((result) => {
      // An aborted request was superseded by newer filters, so its error is not
      // worth surfacing.
      if (
        fetchSuccessTransactions.rejected.match(result) &&
        !result.meta.aborted
      ) {
        toast.error(
          result.payload || "Failed to fetch success transaction report",
        );
      }
    });

    // Abort whatever is in flight when the range changes or the page unmounts,
    // so a slow response cannot land on top of a newer one.
    return () => {
      promise?.abort();
    };
  }, [dateRange, loadReport]);

  const browseDateFrom = dateRange?.from
    ? format(dateRange.from, "MM/dd/yyyy")
    : format(todayRange.from!, "MM/dd/yyyy");
  const browseDateTo = dateRange?.to
    ? format(dateRange.to, "MM/dd/yyyy")
    : format(todayRange.to!, "MM/dd/yyyy");

  return (
    <>
      <SuccessRateView
        channel={channel}
        flow={flow}
        report={report}
        loading={successRateLoading}
        dateRange={dateRange}
        onDateChange={handleDateChange}
        onBrowse={canBrowse ? openBrowse : undefined}
      />

      {canBrowse ? (
        <SuccessBrowseSheet
          open={browseOpen}
          onOpenChange={setBrowseOpen}
          title={`${copy.title} transactions`}
          channel={channel}
          flow={flow}
          dateFrom={browseDateFrom}
          dateTo={browseDateTo}
          outcome={browseFilter.outcome}
          respCode={browseFilter.respCode}
          respLabel={browseFilter.respLabel}
        />
      ) : null}
    </>
  );
}

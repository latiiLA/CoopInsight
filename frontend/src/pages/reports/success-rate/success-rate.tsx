import { format, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchSuccessTransactions } from "@/features/report_slice";
import { SuccessRateRow } from "@/types/report";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { AcquiringOutcomePie } from "./acquiring-outcome-pie";
import { columns } from "./columns";
import { DeclineReasonsPie } from "./decline-reasons-pie";

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getTodayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

export default function SuccessRate() {
  const dispatch = useDispatch<AppDispatch>();
  const { successRate, successRateLoading } = useSelector(
    (state: RootState) => state.report,
  );
  const todayRange = useMemo(() => getTodayRange(), []);

  const handleDateChange = useCallback(
    async (date: DateRange | undefined) => {
      if (!date?.from || !date?.to) {
        return;
      }

      const result = await dispatch(
        fetchSuccessTransactions({
          dateFrom: format(date.from, "MM/dd/yyyy"),
          dateTo: format(date.to, "MM/dd/yyyy"),
        }),
      );

      if (fetchSuccessTransactions.rejected.match(result)) {
        toast.error(
          result.payload || "Failed to fetch success transaction report",
        );
      }
    },
    [dispatch],
  );

  useEffect(() => {
    void handleDateChange(todayRange);
  }, [handleDateChange, todayRange]);

  const declinedCount = successRate?.declinedCount ?? 0;
  const tableData: SuccessRateRow[] = (successRate?.declineReasons ?? []).map(
    (reason) => ({
      ...reason,
      id: reason.code,
      sharePercent:
        declinedCount > 0 ? (reason.count / declinedCount) * 100 : 0,
    }),
  );

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between py-1">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Acquiring Success Rate
          </h3>
        </div>
      </div>

      <div className="grid gap-4 py-2 md:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Total transactions</CardDescription>
            <CardTitle className="text-2xl">
              {successRate ? formatCount(successRate.totalTransactions) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Amount {successRate ? formatAmount(successRate.totalAmount) : "—"}
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-2xl">
              {successRate ? formatCount(successRate.approvedCount) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Amount {successRate ? formatAmount(successRate.approvedAmount) : "—"}
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Declined</CardDescription>
            <CardTitle className="text-2xl">
              {successRate ? formatCount(successRate.declinedCount) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Amount {successRate ? formatAmount(successRate.declinedAmount) : "—"}
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Acquiring success rate</CardDescription>
            <CardTitle className="text-2xl">
              {successRate ? `${successRate.successRatePercent.toFixed(2)}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            {successRate
              ? `${successRate.dateFrom} – ${successRate.dateTo}`
              : "Loading today's report"}
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 py-2 lg:grid-cols-2">
        <AcquiringOutcomePie
          approvedCount={successRate?.approvedCount ?? 0}
          declinedCount={declinedCount}
          compact
        />
        <DeclineReasonsPie
          rows={tableData}
          declinedCount={declinedCount}
          compact
        />
      </div>

      <DataTable
        loading={successRateLoading}
        columns={columns}
        data={tableData}
        searchPlaceholder="Search acquiring declined reasons..."
        exportFileName="acquiring-success-rate"
        defaultDate={todayRange}
        onDateChange={handleDateChange}
      />
    </div>
  );
}

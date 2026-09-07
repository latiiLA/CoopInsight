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
import { fetchEbirrCardlessWithdrawal } from "@/features/report_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { columns } from "./columns";
import { EbirrByTerminal } from "./ebirr-by-terminal";
import {
  formatAmount,
  formatCount,
  summarizeEbirrWithdrawals,
} from "./ebirr-summary";

function getTodayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

export default function EbirrCardlessWithdrawal() {
  const dispatch = useDispatch<AppDispatch>();
  const { ebirrCardless, ebirrCardlessLoading } = useSelector(
    (state: RootState) => state.report,
  );
  const todayRange = useMemo(() => getTodayRange(), []);
  const summary = useMemo(
    () => summarizeEbirrWithdrawals(ebirrCardless),
    [ebirrCardless],
  );
  const showPlaceholders = ebirrCardlessLoading && ebirrCardless.length === 0;

  const handleDateChange = useCallback(
    async (date: DateRange | undefined) => {
      if (!date?.from || !date?.to) {
        return;
      }

      const result = await dispatch(
        fetchEbirrCardlessWithdrawal({
          dateFrom: format(date.from, "MM/dd/yyyy"),
          dateTo: format(date.to, "MM/dd/yyyy"),
        }),
      );

      if (fetchEbirrCardlessWithdrawal.rejected.match(result)) {
        toast.error(
          result.payload || "Failed to fetch Ebirr cardless withdrawal report",
        );
      }
    },
    [dispatch],
  );

  useEffect(() => {
    void handleDateChange(todayRange);
  }, [handleDateChange, todayRange]);

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between py-1">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Ebirr Cardless Withdrawal
          </h3>
        </div>
      </div>

      <div className="grid gap-4 py-2 md:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Total transactions</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders ? "—" : formatCount(summary.transactionCount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Withdrawals in the selected range
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Total amount</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders ? "—" : formatAmount(summary.totalAmount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Sum of withdrawal amounts
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Terminals</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders ? "—" : formatCount(summary.terminalCount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Terminals with at least one withdrawal
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Average amount</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders ? "—" : formatAmount(summary.averageAmount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Total amount divided by transactions
          </CardContent>
        </Card>
      </div>

      <EbirrByTerminal
        rows={summary.byTerminal}
        loading={showPlaceholders}
      />

      <DataTable
        loading={ebirrCardlessLoading}
        columns={columns}
        data={ebirrCardless}
        searchPlaceholder="Search withdrawals..."
        exportFileName="ebirr-cardless-withdrawal"
        defaultDate={todayRange}
        onDateChange={handleDateChange}
      />
    </div>
  );
}

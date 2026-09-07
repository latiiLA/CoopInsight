import { format, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { fetchEbirrCardlessWithdrawal } from "@/features/report_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { columns } from "./columns";

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

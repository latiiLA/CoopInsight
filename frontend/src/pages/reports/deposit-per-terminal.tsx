import { format, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "../../components/data-table";
import { columns } from "./columns";
import { fetchDepositPerTerminal } from "@/features/terminal_slice";
import { AppDispatch, RootState } from "../../../app/store/store";

function getTodayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

export default function DepositPerTerminal() {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading } = useSelector(
    (state: RootState) => state.depositPerTerminal,
  );
  const todayRange = useMemo(() => getTodayRange(), []);

  const handleDateChange = useCallback(
    async (date: DateRange | undefined) => {
      if (!date?.from || !date?.to) {
        return;
      }

      const result = await dispatch(
        fetchDepositPerTerminal({
          dateFrom: format(date.from, "MM/dd/yyyy"),
          dateTo: format(date.to, "MM/dd/yyyy"),
        }),
      );

      if (fetchDepositPerTerminal.rejected.match(result)) {
        toast.error(
          result.payload || "Failed to fetch deposit per terminal data",
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
            Deposit per Terminal
          </h3>
        </div>
      </div>

      <DataTable
        loading={loading}
        columns={columns}
        data={data}
        searchPlaceholder="Search transactions..."
        exportFileName="deposit-per-terminal"
        defaultDate={todayRange}
        onDateChange={handleDateChange}
      />
    </div>
  );
}

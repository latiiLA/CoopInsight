import { format } from "date-fns";
import { DateRange } from "react-day-picker";

import { DataTable } from "../../components/data-table";
import { columns } from "./columns";
import { fetchDepositPerTerminal } from "@/features/terminal_slice";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../../app/store/store";
import { toast } from "sonner";

export default function DepositPerTerminal() {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector(
    (state: RootState) => state.depositPerTerminal,
  );

  const handleDateChange = async (date: DateRange | undefined) => {
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
      toast.error(result.payload || "Failed to fetch deposit per terminal data");
    }
  };

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
        onDateChange={handleDateChange}
      />
    </div>
  );
}

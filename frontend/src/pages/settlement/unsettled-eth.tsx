import { format, startOfDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import { clearUnsettled, fetchUnsettledETH } from "@/features/unsettled_slice";
import { AppDispatch, RootState } from "../../../app/store/store";
import { unsettledColumns } from "./columns";

function getDefaultRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

type UnsettledETHPageProps = {
  title?: string;
  description?: string;
};

export default function UnsettledETH({
  title = "Unsettled ETH",
  description = "Domestic POS purchases that have been cleared but are not yet settled.",
}: UnsettledETHPageProps) {
  const dispatch = useDispatch<AppDispatch>();
  const columns = useMemo(() => unsettledColumns, []);
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultRange);

  const { rows, loading } = useSelector((state: RootState) => state.unsettled);

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return;
    }

    const promise = dispatch(
      fetchUnsettledETH({
        dateFrom: format(dateRange.from, "MM/dd/yyyy"),
        dateTo: format(dateRange.to, "MM/dd/yyyy"),
      }),
    );

    void promise.then((result) => {
      if (fetchUnsettledETH.rejected.match(result) && !result.meta.aborted) {
        toast.error(result.payload || "Failed to fetch unsettled transactions");
      }
    });

    return () => {
      promise.abort();
    };
  }, [dateRange, dispatch]);

  useEffect(() => {
    return () => {
      dispatch(clearUnsettled());
    };
  }, [dispatch]);

  return (
    <div className="container mx-auto">
      <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        searchPlaceholder="Search unsettled transactions..."
        exportFileName={title.replace(/\s+/g, "")}
      />
    </div>
  );
}

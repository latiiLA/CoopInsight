import { format, startOfDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import {
  clearUncleared,
  fetchUncleared,
  type UnclearedProduct,
} from "@/features/uncleared_slice";
import { AppDispatch, RootState } from "../../../app/store/store";
import { unclearedColumns } from "./columns";

function getDefaultRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

type UnclearedPageProps = {
  product: UnclearedProduct;
  title: string;
  description: string;
};

export default function Uncleared({
  product,
  title,
  description,
}: UnclearedPageProps) {
  const dispatch = useDispatch<AppDispatch>();
  const columns = useMemo(() => unclearedColumns, []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() =>
    getDefaultRange(),
  );

  const { rows, loading } = useSelector((state: RootState) => state.uncleared);

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return;
    }

    const promise = dispatch(
      fetchUncleared({
        dateFrom: format(dateRange.from, "MM/dd/yyyy"),
        dateTo: format(dateRange.to, "MM/dd/yyyy"),
        product,
      }),
    );

    void promise.then((result) => {
      if (fetchUncleared.rejected.match(result) && !result.meta.aborted) {
        toast.error(result.payload || "Failed to fetch uncleared transactions");
      }
    });

    return () => {
      promise.abort();
    };
  }, [dateRange, dispatch, product]);

  useEffect(() => {
    return () => {
      dispatch(clearUncleared());
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
        searchPlaceholder="Search uncleared transactions..."
        exportFileName={title.replace(/\s+/g, "")}
      />
    </div>
  );
}

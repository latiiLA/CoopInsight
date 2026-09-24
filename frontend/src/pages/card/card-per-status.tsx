import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import {
  clearCardStatus,
  fetchCardStatus,
} from "@/features/card_slice";
import { AppDispatch, RootState } from "../../../app/store/store";
import { cardStatusColumns } from "./columns";

type CardStatusPageProps = {
  title: string;
  description: string;
};

export default function CardPerStatus({
  title,
  description,
}: CardStatusPageProps) {
  const dispatch = useDispatch<AppDispatch>();
  const columns = useMemo(() => cardStatusColumns, []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const { rows, loading } = useSelector(
    (state: RootState) => state.card,
  );

  useEffect(() => {
    const dateFrom = dateRange?.from
      ? format(dateRange.from, "MM/dd/yyyy")
      : undefined;

    const dateTo = dateRange?.to
      ? format(dateRange.to, "MM/dd/yyyy")
      : undefined;

    const promise = dispatch(
      fetchCardStatus({
        dateFrom,
        dateTo,
      }),
    );

    promise.then((result) => {
      if (fetchCardStatus.rejected.match(result)) {
        if (!result.meta.aborted) {
          toast.error(
            result.payload || "Failed to fetch card status report",
          );
        }
      }
    });

    return () => {
      promise.abort();
    };
  }, [dateRange, dispatch]);

  useEffect(() => {
    return () => {
      dispatch(clearCardStatus());
    };
  }, [dispatch]);

  return (
    <div className="container mx-auto">
      <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">
            {title}
          </h1>

          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        <DatePickerWithRange
          date={dateRange}
          onDateChange={setDateRange}
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        searchPlaceholder="Search card statuses..."
        exportFileName={title.replace(/\s+/g, "")}
      />
    </div>
  );
}
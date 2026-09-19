import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import {
  clearCleared,
  fetchCleared,
  type ClearedProduct,
} from "@/features/cleared_slice";
import { CLEARING_MAX_AUTO_PAGES } from "@/features/clearing_constants";
import { AppDispatch, RootState } from "../../../app/store/store";
import { clearedColumns } from "./cleared-columns";

type ClearedPageProps = {
  product: ClearedProduct;
  title: string;
  description: string;
};

export default function Cleared({
  product,
  title,
  description,
}: ClearedPageProps) {
  const dispatch = useDispatch<AppDispatch>();
  const columns = useMemo(() => clearedColumns, []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const requestIdRef = useRef(0);

  const { rows, loading, loadingMore, truncated } = useSelector(
    (state: RootState) => state.cleared,
  );

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const dateFrom = format(dateRange.from, "MM/dd/yyyy");
    const dateTo = format(dateRange.to, "MM/dd/yyyy");
    let cancelled = false;
    const controllers: Array<{ abort: () => void }> = [];

    const run = async () => {
      let nextPage = 1;
      let continueFetch = true;

      while (continueFetch && !cancelled && requestId === requestIdRef.current) {
        const promise = dispatch(
          fetchCleared({
            dateFrom,
            dateTo,
            product,
            page: nextPage,
          }),
        );
        controllers.push(promise);

        const result = await promise;
        if (cancelled || requestId !== requestIdRef.current) {
          return;
        }

        if (fetchCleared.rejected.match(result)) {
          if (!result.meta.aborted) {
            toast.error(result.payload || "Failed to fetch cleared transactions");
          }
          return;
        }

        if (!fetchCleared.fulfilled.match(result)) {
          return;
        }

        const { hasMore: more, page: currentPage } = result.payload;
        continueFetch = more && currentPage < CLEARING_MAX_AUTO_PAGES;
        nextPage = currentPage + 1;
      }
    };

    void run();

    return () => {
      cancelled = true;
      controllers.forEach((p) => p.abort());
    };
  }, [dateRange, dispatch, product]);

  useEffect(() => {
    return () => {
      dispatch(clearCleared());
    };
  }, [dispatch]);

  return (
    <div className="container mx-auto">
      <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
          {loadingMore ? (
            <p className="text-xs text-muted-foreground">Loading more…</p>
          ) : null}
          {truncated ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Showing the first {rows.length.toLocaleString()} rows — narrow the
              date range for a complete list.
            </p>
          ) : null}
        </div>
        <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        searchPlaceholder="Search cleared transactions..."
        exportFileName={title.replace(/\s+/g, "")}
      />
    </div>
  );
}

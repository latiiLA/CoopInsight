import { format, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  clearEJCoverage,
  fetchEJCoverage,
} from "@/features/ej_coverage_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";

import { createEjCoverageColumns } from "./columns";

function getTodayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatPct(synced: number, total: number) {
  if (total <= 0) return "-";
  return `${Math.round((synced / total) * 100)}%`;
}

export default function EJCoveragePage() {
  const dispatch = useDispatch<AppDispatch>();
  const todayRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);

  const { data, loading, error } = useSelector(
    (state: RootState) => state.ejCoverage,
  );

  const dayKeys = useMemo(
    () => (data?.days ?? []).map((d) => d.date),
    [data?.days],
  );
  const columns = useMemo(
    () => createEjCoverageColumns(dayKeys),
    [dayKeys],
  );

  const showPlaceholders = loading && !data;

  const loadCoverage = useCallback(
    async (range: DateRange | undefined) => {
      if (!range?.from || !range?.to) return;
      const result = await dispatch(
        fetchEJCoverage({
          dateFrom: format(range.from, "MM/dd/yyyy"),
          dateTo: format(range.to, "MM/dd/yyyy"),
        }),
      );
      if (fetchEJCoverage.rejected.match(result)) {
        if (result.payload && result.payload !== "canceled") {
          toast.error(result.payload);
        }
      }
    },
    [dispatch],
  );

  useEffect(() => {
    void loadCoverage(dateRange);
  }, [dateRange, loadCoverage]);

  useEffect(() => {
    return () => {
      dispatch(clearEJCoverage());
    };
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      // toast already shown on reject; keep banner quiet
    }
  }, [error]);

  return (
    <div className="container mx-auto space-y-4 pb-6">
      <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-lg font-semibold tracking-tight">EJ Coverage</h3>
          <p className="text-sm text-muted-foreground">
            Active ATM terminals with indexed electronic journals for each day.
            Defaults to today; widen the range (up to 31 days) to compare sync
            coverage.
          </p>
        </div>
        <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Active terminals</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders ? "-" : formatCount(data?.totalActive ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            TMS ATMs that are not deleted
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>
              Synced
              {data?.focus?.date ? ` (${data.focus.date})` : ""}
            </CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders ? "-" : formatCount(data?.focus?.synced ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Indexed on the end date of the range
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>
              Missing
              {data?.focus?.date ? ` (${data.focus.date})` : ""}
            </CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders ? "-" : formatCount(data?.focus?.missing ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            No indexed journal for that day
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Week avg synced</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders
                ? "-"
                : (data?.week?.avgSynced ?? 0).toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Average daily synced over 7 days ending{" "}
            {data?.week?.dateTo || "the range end"}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Daily sync counts</h4>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Synced</TableHead>
                <TableHead className="text-right">Missing</TableHead>
                <TableHead className="text-right">Coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showPlaceholders ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (data?.days?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No days in range
                  </TableCell>
                </TableRow>
              ) : (
                data!.days.map((day) => (
                  <TableRow key={day.date}>
                    <TableCell className="font-mono text-xs">
                      {day.date}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(day.synced)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(day.missing)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPct(day.synced, day.totalActive)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Terminals</h4>
        <DataTable
          loading={loading}
          columns={columns}
          data={data?.terminals ?? []}
          searchPlaceholder="Search terminals..."
          exportFileName="ej-coverage"
        />
      </div>
    </div>
  );
}

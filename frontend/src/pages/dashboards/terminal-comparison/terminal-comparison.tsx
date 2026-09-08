import { format, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
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
  clearTerminalComparison,
  fetchTerminalComparison,
} from "@/features/report_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { getColumns } from "./columns";
import { TerminalPerformers } from "./performers";

function getTodayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type TerminalComparisonProps = {
  fleet: "atm" | "pos";
};

export default function TerminalComparison({ fleet }: TerminalComparisonProps) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const todayRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);
  const columns = useMemo(() => getColumns(fleet), [fleet]);
  const isPos = fleet === "pos";

  const { terminalComparison, terminalComparisonLoading } = useSelector(
    (state: RootState) => state.report,
  );

  const showPlaceholders =
    terminalComparisonLoading && !terminalComparison;

  const loadComparison = useCallback(
    async (date: DateRange | undefined) => {
      if (!date?.from || !date?.to) {
        return;
      }

      const result = await dispatch(
        fetchTerminalComparison({
          fleet,
          dateFrom: format(date.from, "MM/dd/yyyy"),
          dateTo: format(date.to, "MM/dd/yyyy"),
        }),
      );

      if (fetchTerminalComparison.rejected.match(result)) {
        toast.error(result.payload || "Failed to fetch terminal comparison");
      }
    },
    [dispatch, fleet],
  );

  useEffect(() => {
    void loadComparison(dateRange);
  }, [dateRange, loadComparison]);

  useEffect(() => {
    return () => {
      dispatch(clearTerminalComparison());
    };
  }, [dispatch]);

  const openTransactions = (terminalId: string) => {
    const base = isPos ? "/pos-terminals" : "/atm-terminals";
    navigate(`${base}/${encodeURIComponent(terminalId)}/transactions`);
  };

  return (
    <div className="container mx-auto">
      <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold tracking-tight">
            {isPos ? "POS Comparison" : "ATM Comparison"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Highest and lowest performing terminals by transaction count.
            Defaults to today; widen the date range to compare a longer period.
          </p>
        </div>
        <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
      </div>

      <div className="grid gap-4 py-2 md:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Live terminals</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders
                ? "—"
                : formatCount(terminalComparison?.terminalCount ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Fleet size used for this comparison
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>With activity</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders
                ? "—"
                : formatCount(terminalComparison?.activeCount ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Terminals that had at least one transaction
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Total transactions</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders
                ? "—"
                : formatCount(terminalComparison?.transactionCount ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Across the selected range
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Total amount</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders
                ? "—"
                : formatAmount(terminalComparison?.totalAmount ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Sum of transaction amounts
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 py-2 xl:grid-cols-2">
        <TerminalPerformers
          title="Highest performing"
          description="Most transactions in this range"
          rows={terminalComparison?.highest ?? []}
          loading={showPlaceholders}
          emptyLabel="No terminal activity in this range"
          onSelect={openTransactions}
        />
        <TerminalPerformers
          title="Lowest performing"
          description="Fewest transactions, including idle terminals"
          rows={terminalComparison?.lowest ?? []}
          loading={showPlaceholders}
          emptyLabel="No terminals to compare"
          onSelect={openTransactions}
        />
      </div>

      <DataTable
        loading={terminalComparisonLoading}
        columns={columns}
        data={terminalComparison?.rows ?? []}
        searchPlaceholder="Search terminals..."
        exportFileName={`${isPos ? "pos" : "atm"}-terminal-comparison`}
      />
    </div>
  );
}

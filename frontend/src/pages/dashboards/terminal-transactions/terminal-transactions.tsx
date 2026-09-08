import { format, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchAtmTerminals } from "@/features/atm_terminal_slice";
import { fetchPosTerminals } from "@/features/pos_terminal_slice";
import {
  clearTerminalTransactions,
  fetchTerminalTransactions,
} from "@/features/report_slice";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { liveTerminals as liveAtmTerminals } from "../atm-terminals/atm-fleet";
import { liveTerminals as livePosTerminals } from "../pos-terminals/pos-fleet";
import { columns } from "./columns";
import {
  TerminalSearchSelect,
  type TerminalOption,
} from "./terminal-search-select";

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

type TerminalTransactionsProps = {
  fleet: "atm" | "pos";
};

export default function TerminalTransactions({
  fleet,
}: TerminalTransactionsProps) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { terminalId: pathTerminalId } = useParams<{ terminalId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const todayRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);

  const fromFleet = Boolean(pathTerminalId);
  const selectedTerminalId = (
    pathTerminalId
      ? decodeURIComponent(pathTerminalId)
      : searchParams.get("terminalId") ?? ""
  ).trim();
  const isPos = fleet === "pos";
  const fleetListPath = isPos ? "/pos-terminals" : "/atm-terminals";

  const { terminalTransactions, terminalTransactionsLoading } = useSelector(
    (state: RootState) => state.report,
  );
  const atmTerminals = useSelector(
    (state: RootState) => state.atmTerminal.terminals,
  );
  const posTerminals = useSelector(
    (state: RootState) => state.posTerminal.terminals,
  );
  const { authUser } = useSelector((state: RootState) => state.user);

  const terminalOptions = useMemo<TerminalOption[]>(() => {
    if (isPos) {
      return livePosTerminals(posTerminals)
        .filter((terminal) => terminal.terminalId.trim())
        .map((terminal) => ({
          id: terminal.terminalId,
          label: terminal.merchantName
            ? `${terminal.terminalId} · ${terminal.merchantName}`
            : terminal.terminalId,
        }));
    }

    return liveAtmTerminals(atmTerminals)
      .filter((terminal) => terminal.terminalId.trim())
      .map((terminal) => ({
        id: terminal.terminalId,
        label: terminal.terminalName
          ? `${terminal.terminalId} · ${terminal.terminalName}`
          : terminal.terminalId,
      }));
  }, [atmTerminals, isPos, posTerminals]);

  const selectedLabel =
    terminalOptions.find((option) => option.id === selectedTerminalId)?.label ??
    selectedTerminalId;

  const showPlaceholders =
    terminalTransactionsLoading && terminalTransactions.length === 0;

  const summary = useMemo(() => {
    let approvedCount = 0;
    let approvedAmount = 0;

    for (const row of terminalTransactions) {
      if (row.response === "00") {
        approvedCount += 1;
        approvedAmount += row.amount;
      }
    }

    return {
      transactionCount: terminalTransactions.length,
      approvedCount,
      declinedCount: terminalTransactions.length - approvedCount,
      approvedAmount,
    };
  }, [terminalTransactions]);

  const loadTransactions = useCallback(
    async (terminalId: string, date: DateRange | undefined) => {
      if (!terminalId || !date?.from || !date?.to) {
        dispatch(clearTerminalTransactions());
        return;
      }

      const result = await dispatch(
        fetchTerminalTransactions({
          fleet,
          terminalId,
          dateFrom: format(date.from, "MM/dd/yyyy"),
          dateTo: format(date.to, "MM/dd/yyyy"),
        }),
      );

      if (fetchTerminalTransactions.rejected.match(result)) {
        toast.error(
          result.payload || "Failed to fetch terminal transactions",
        );
      }
    },
    [dispatch, fleet],
  );

  useEffect(() => {
    if (!authUser) {
      return;
    }

    if (isPos) {
      void dispatch(fetchPosTerminals());
    } else {
      void dispatch(fetchAtmTerminals());
    }
  }, [authUser, dispatch, isPos]);

  useEffect(() => {
    void loadTransactions(selectedTerminalId, dateRange);
  }, [dateRange, loadTransactions, selectedTerminalId]);

  useEffect(() => {
    return () => {
      dispatch(clearTerminalTransactions());
    };
  }, [dispatch]);

  const handleTerminalChange = (terminalId: string) => {
    if (fromFleet) {
      navigate(
        `${fleetListPath}/${encodeURIComponent(terminalId)}/transactions`,
        { replace: true },
      );
      return;
    }

    const next = new URLSearchParams(searchParams);

    if (terminalId) {
      next.set("terminalId", terminalId);
    } else {
      next.delete("terminalId");
    }

    setSearchParams(next, { replace: true });
  };

  const handleDateChange = (date: DateRange | undefined) => {
    setDateRange(date);
  };

  return (
    <div className="container mx-auto">
      <div className="flex flex-col gap-3 py-1 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            {isPos ? "POS Transactions" : "ATM Transactions"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Defaults to today. Search or choose a terminal, then widen the date
            range for a longer period.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Terminal</span>
            <TerminalSearchSelect
              options={terminalOptions}
              value={selectedTerminalId}
              onChange={handleTerminalChange}
            />
          </div>
          {fromFleet && (
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(fleetListPath)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 py-2 md:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Total transactions</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders || !selectedTerminalId
                ? "—"
                : formatCount(summary.transactionCount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            {selectedLabel || "Select a terminal to load activity"}
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders || !selectedTerminalId
                ? "—"
                : formatCount(summary.approvedCount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Response code 00
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Other responses</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders || !selectedTerminalId
                ? "—"
                : formatCount(summary.declinedCount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Declined or incomplete
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Approved amount</CardDescription>
            <CardTitle className="text-2xl">
              {showPlaceholders || !selectedTerminalId
                ? "—"
                : formatAmount(summary.approvedAmount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            Sum of approved amounts
          </CardContent>
        </Card>
      </div>

      <DataTable
        loading={terminalTransactionsLoading}
        columns={columns}
        data={selectedTerminalId ? terminalTransactions : []}
        searchPlaceholder="Search transactions..."
        exportFileName={`${isPos ? "pos" : "atm"}-transactions`}
        defaultDate={todayRange}
        onDateChange={handleDateChange}
      />
    </div>
  );
}

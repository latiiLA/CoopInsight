import { Percent, Repeat2, Route, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchTransactionMix } from "@/features/report_slice";
import { toApiDate, toApiEchoDate } from "@/lib/report-range";
import type { SuccessChannel } from "@/types/report";
import type {
  TransactionMixAxis,
  TransactionMixReport,
  TransactionMixSegment,
  TransactionMixSlice,
} from "@/types/transaction-mix";
import { AppDispatch, RootState } from "../../../../app/store/store";
import { buildMixColumns } from "./columns";
import { MixBreakdown } from "./mix-breakdown";

/** Matches the placeholder other report pages use while a figure is unavailable. */
const NO_VALUE = "\u2014";

const NO_DATA = "No messages for the selected dates";

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getLastSevenDays(): DateRange {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 6);
  return { from, to: today };
}

const detailAxes: { key: TransactionMixAxis; label: string; noun: string }[] = [
  { key: "routing", label: "Destination detail", noun: "destinations" },
  { key: "scheme", label: "Scheme detail", noun: "card schemes" },
  { key: "type", label: "Message type detail", noun: "message types" },
];

/** Spells out what the reversal rate is a share of, so it cannot be misread. */
function reversalHint(report: TransactionMixReport | null) {
  if (!report) {
    return "Reversals as a share of all messages";
  }
  return `${report.reversalCount.toLocaleString()} of ${report.totalCount.toLocaleString()} messages`;
}

export default function TransactionMix() {
  const dispatch = useDispatch<AppDispatch>();
  const { transactionMix, transactionMixLoading } = useSelector(
    (state: RootState) => state.report,
  );

  const todayRange = useMemo(() => getLastSevenDays(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);
  const [channel, setChannel] = useState<SuccessChannel>("switch");

  // Only show figures for the filters currently selected. A response for an
  // older range must not sit on screen under newly chosen dates.
  const report = useMemo(() => {
    if (!transactionMix) return null;
    if (transactionMix.channel !== channel) return null;
    if (!dateRange?.from || !dateRange?.to) return null;
    if (
      transactionMix.dateFrom !== toApiEchoDate(dateRange.from) ||
      transactionMix.dateTo !== toApiEchoDate(dateRange.to)
    ) {
      return null;
    }
    return transactionMix;
  }, [transactionMix, channel, dateRange]);

  const loadMix = useCallback(
    (date: DateRange | undefined) => {
      if (!date?.from || !date?.to) {
        return null;
      }

      return dispatch(
        fetchTransactionMix({
          dateFrom: toApiDate(date.from),
          dateTo: toApiDate(date.to),
          channel,
        }),
      );
    },
    [channel, dispatch],
  );

  // A different channel starts a fresh request for the default range, so the
  // picker and the loaded report never disagree.
  useEffect(() => {
    setDateRange(todayRange);
  }, [channel, todayRange]);

  useEffect(() => {
    const promise = loadMix(dateRange);

    promise?.then((result) => {
      // An aborted request was superseded by newer filters.
      if (
        fetchTransactionMix.rejected.match(result) &&
        !result.meta.aborted
      ) {
        toast.error(result.payload || "Failed to fetch transaction mix report");
      }
    });

    // Abort whatever is in flight when the range changes or the page unmounts.
    return () => {
      promise?.abort();
    };
  }, [dateRange, loadMix]);

  const handleDateChange = useCallback((date: DateRange | undefined) => {
    if (!date?.from || !date?.to) {
      return;
    }
    setDateRange(date);
  }, []);

  const schemeRows: TransactionMixSegment[] = useMemo(
    () => report?.byScheme ?? [],
    [report],
  );
  const routingRows: TransactionMixSegment[] = useMemo(
    () => report?.byRouting ?? [],
    [report],
  );
  const typeRows: TransactionMixSlice[] = useMemo(
    () => report?.byType ?? [],
    [report],
  );

  const segmentColumns = useMemo(
    () => buildMixColumns({ showReversals: true }),
    [],
  );
  const typeColumns = useMemo(() => buildMixColumns(), []);

  const [detailAxis, setDetailAxis] = useState<TransactionMixAxis>("routing");

  const detailRows: (TransactionMixSlice | TransactionMixSegment)[] =
    useMemo(() => {
      if (detailAxis === "routing") return routingRows;
      if (detailAxis === "scheme") return schemeRows;
      return typeRows;
    }, [detailAxis, routingRows, schemeRows, typeRows]);

  return (
    <div className="container mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 py-1">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Transaction Mix
          </h3>
          <p className="text-sm text-muted-foreground">
            Share of switch messages by scheme, destination, and message type
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={channel}
            onValueChange={(value) => setChannel(value as SuccessChannel)}
          >
            <SelectTrigger className="w-32" aria-label="Channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="switch">Switch</SelectItem>
              <SelectItem value="atm">ATM</SelectItem>
              <SelectItem value="pos">POS</SelectItem>
            </SelectContent>
          </Select>
          <DatePickerWithRange date={dateRange} onDateChange={handleDateChange} />
        </div>
      </div>

      <div className="grid gap-4 py-2 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total messages"
          value={report ? report.totalCount.toLocaleString() : NO_VALUE}
          hint={report ? `Value ${formatAmount(report.totalAmount)}` : NO_DATA}
          icon={Route}
          loading={transactionMixLoading}
        />
        <MetricCard
          label="Authorisations"
          value={report ? report.authorisationCount.toLocaleString() : NO_VALUE}
          hint={
            report
              ? `${((report.authorisationCount / (report.totalCount || 1)) * 100).toFixed(2)}% of all messages`
              : NO_DATA
          }
          icon={Wallet}
          loading={transactionMixLoading}
        />
        <MetricCard
          label="Reversals"
          value={report ? report.reversalCount.toLocaleString() : NO_VALUE}
          hint={reversalHint(report)}
          icon={Repeat2}
          loading={transactionMixLoading}
        />
        <MetricCard
          label="Reversal rate"
          value={report ? `${report.reversalPercent.toFixed(2)}%` : NO_VALUE}
          hint={
            report
              ? `Approved ${report.approvedCount.toLocaleString()} messages`
              : NO_DATA
          }
          icon={Percent}
          loading={transactionMixLoading}
        />
      </div>

      <Card className="py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">How to read this page</CardTitle>
          <CardDescription>
            The three breakdowns below are separate views of the same messages,
            not a partition of them. Each one adds up to 100% on its own, so a
            scheme and a destination should never be added together. A message
            with an ETH card routed to CBO appears as ETH in the scheme view
            and as CBO in the destination view.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid min-w-0 gap-4 py-2 lg:grid-cols-2">
        <MixBreakdown
          title="By destination"
          description="Where the switch sent each message"
          slices={routingRows}
          showReversals
          loading={transactionMixLoading}
        />
        <MixBreakdown
          title="By card scheme"
          description="Which scheme the card belonged to"
          slices={schemeRows}
          showReversals
          loading={transactionMixLoading}
        />
      </div>

      <div className="py-2">
        <MixBreakdown
          title="By message type"
          description="Authorisations, reversals, and switch administration traffic"
          slices={typeRows}
          loading={transactionMixLoading}
        />
      </div>

      <div className="py-2">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {detailAxes.map((axis) => (
            <Button
              key={axis.key}
              variant={detailAxis === axis.key ? "default" : "outline"}
              size="sm"
              onClick={() => setDetailAxis(axis.key)}
            >
              {axis.label}
            </Button>
          ))}
        </div>
        <DataTable
          loading={transactionMixLoading}
          columns={detailAxis === "type" ? typeColumns : segmentColumns}
          data={transactionMixLoading ? [] : detailRows}
          searchPlaceholder={`Search ${
            detailAxes.find((axis) => axis.key === detailAxis)?.noun ?? "mix"
          }...`}
          exportFileName={`transaction-mix-by-${detailAxis}`}
        />
      </div>
    </div>
  );
}

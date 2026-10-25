import { startOfDay } from "date-fns";
import {
  Activity,
  ArrowUpDown,
  Ban,
  CheckCircle2,
  CreditCard,
  Percent,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useDispatch, useSelector } from "react-redux";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { toast } from "sonner";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { DatePickerWithRange } from "@/components/date-picker";
import { MetricCard } from "@/components/metric-card";
import {
  Card,
  CardContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCardProductSuccessRate } from "@/features/report_slice";
import { formatMoneyWithCurrency } from "@/lib/iso-currency";
import { toApiDate } from "@/lib/report-range";
import {
  CardProductSuccessReport,
  SuccessChannel,
  SuccessFlow,
} from "@/types/report";
import { hasPermission } from "../../../../utility/has-permission";
import { AppDispatch, RootState } from "../../../../app/store/store";

const NO_VALUE = "-";
/** Switch success-rate amounts are stored in local issuer currency (ETB). */
const AMOUNT_CURRENCY = "ETB";

const CHANNEL_OPTIONS: { value: SuccessChannel; label: string }[] = [
  { value: "switch", label: "Switch" },
  { value: "atm", label: "ATM" },
  { value: "pos", label: "POS" },
];

const FLOW_OPTIONS: {
  value: SuccessFlow;
  label: string;
  channels: SuccessChannel[];
}[] = [
  { value: "overall", label: "Overall", channels: ["switch", "atm", "pos"] },
  { value: "acquiring", label: "Acquiring", channels: ["atm", "pos"] },
  { value: "onus", label: "On-us", channels: ["switch", "atm", "pos"] },
  { value: "offus", label: "Off-us", channels: ["switch", "atm", "pos"] },
  { value: "remote_onus", label: "Remote On-us", channels: ["switch"] },
  { value: "issuing", label: "Issuing", channels: ["switch"] },
  { value: "issuing", label: "Remote On-us", channels: ["atm", "pos"] },
];

function permissionFor(channel: SuccessChannel, flow: SuccessFlow) {
  const slug = flow === "remote_onus" ? "remote-onus" : flow;
  return `report:view-${channel}-${slug}-success-rate`;
}

const CARD_PRODUCT_PERMISSION = "report:view-card-product-success-rate";

function canViewCombo(
  channel: SuccessChannel,
  flow: SuccessFlow,
  permissions: string[],
) {
  if (hasPermission([CARD_PRODUCT_PERMISSION], permissions)) {
    return true;
  }
  const required = [permissionFor(channel, flow)];
  if (channel === "switch" && flow === "remote_onus") {
    required.push("report:view-switch-issuing-success-rate");
  }
  return hasPermission(required, permissions);
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatAmount(value: number) {
  return formatMoneyWithCurrency(value, AMOUNT_CURRENCY);
}

function getTodayRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: today, to: today };
}

const columnHelper = createColumnHelper<
  DataTableFeatures,
  CardProductSuccessReport
>();

function sortableHeader(label: string) {
  return ({
    column,
  }: {
    column: {
      toggleSorting: (asc: boolean) => void;
      getIsSorted: () => false | "asc" | "desc";
    };
  }) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

const productColumns = [
  columnHelper.accessor("cardProductLabel", {
    header: sortableHeader("Card Type"),
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.cardProductLabel || row.original.cardProduct || "-"}
      </span>
    ),
  }),
  columnHelper.accessor("totalTransactions", {
    header: sortableHeader("Tried"),
    cell: ({ row }) => (
      <span>{formatCount(row.original.totalTransactions)}</span>
    ),
  }),
  columnHelper.accessor("approvedCount", {
    header: sortableHeader("Approved"),
    cell: ({ row }) => (
      <span className="text-green-600">
        {formatCount(row.original.approvedCount)}
      </span>
    ),
  }),
  columnHelper.accessor("declinedCount", {
    header: sortableHeader("Declined"),
    cell: ({ row }) => (
      <span className="text-red-600">
        {formatCount(row.original.declinedCount)}
      </span>
    ),
  }),
  columnHelper.accessor("successRatePercent", {
    header: sortableHeader("Success Rate"),
    cell: ({ row }) => (
      <span className="font-semibold">
        {row.original.successRatePercent.toFixed(2)}%
      </span>
    ),
  }),
  columnHelper.accessor("approvedAmount", {
    header: sortableHeader("Approved Amount"),
    cell: ({ row }) => (
      <span>{formatAmount(row.original.approvedAmount)}</span>
    ),
  }),
  columnHelper.accessor("declinedAmount", {
    header: sortableHeader("Declined Amount"),
    cell: ({ row }) => (
      <span>{formatAmount(row.original.declinedAmount)}</span>
    ),
  }),
  columnHelper.accessor("totalAmount", {
    header: sortableHeader("Total Amount"),
    cell: ({ row }) => <span>{formatAmount(row.original.totalAmount)}</span>,
  }),
];

type ChartRow = {
  label: string;
  tried: number;
  approved: number;
  declined: number;
  successRate: number;
};

export default function CardProductSuccessRate() {
  const dispatch = useDispatch<AppDispatch>();
  const permissions = useSelector((state: RootState) => state.user.permissions);
  const {
    cardProductSuccessRate,
    cardProductSuccessRateLoading,
    cardProductSuccessRateError,
  } = useSelector((state: RootState) => state.report);

  const allowedCombos = useMemo(() => {
    const combos: Array<{ channel: SuccessChannel; flow: SuccessFlow }> = [];
    for (const channel of CHANNEL_OPTIONS) {
      for (const flow of FLOW_OPTIONS) {
        if (!flow.channels.includes(channel.value)) continue;
        if (canViewCombo(channel.value, flow.value, permissions)) {
          combos.push({ channel: channel.value, flow: flow.value });
        }
      }
    }
    return combos;
  }, [permissions]);

  const allowedChannels = useMemo(() => {
    const set = new Set(allowedCombos.map((c) => c.channel));
    return CHANNEL_OPTIONS.filter((c) => set.has(c.value));
  }, [allowedCombos]);

  const [channel, setChannel] = useState<SuccessChannel>(
    () => allowedChannels[0]?.value ?? "switch",
  );

  const flowsForChannel = useMemo(
    () =>
      FLOW_OPTIONS.filter(
        (flow) =>
          flow.channels.includes(channel) &&
          canViewCombo(channel, flow.value, permissions),
      ),
    [channel, permissions],
  );

  const [flow, setFlow] = useState<SuccessFlow>(
    () => flowsForChannel[0]?.value ?? "overall",
  );

  const todayRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);

  useEffect(() => {
    if (allowedChannels.length === 0) return;
    if (!allowedChannels.some((c) => c.value === channel)) {
      setChannel(allowedChannels[0].value);
    }
  }, [allowedChannels, channel]);

  useEffect(() => {
    if (flowsForChannel.length === 0) return;
    if (!flowsForChannel.some((f) => f.value === flow)) {
      setFlow(flowsForChannel[0].value);
    }
  }, [flowsForChannel, flow]);

  const loadData = useCallback(
    (date: DateRange | undefined) => {
      if (!date?.from || !date?.to) return null;
      if (!canViewCombo(channel, flow, permissions)) return null;

      return dispatch(
        fetchCardProductSuccessRate({
          dateFrom: toApiDate(date.from),
          dateTo: toApiDate(date.to),
          channel,
          flow,
        }),
      );
    },
    [channel, dispatch, flow, permissions],
  );

  useEffect(() => {
    const promise = loadData(dateRange);
    promise?.then((result) => {
      if (
        fetchCardProductSuccessRate.rejected.match(result) &&
        !result.meta.aborted
      ) {
        toast.error(
          result.payload || "Failed to fetch card type success rate",
        );
      }
    });
    return () => {
      promise?.abort();
    };
  }, [dateRange, loadData]);

  const totals = useMemo(() => {
    const tried = cardProductSuccessRate.reduce(
      (sum, row) => sum + row.totalTransactions,
      0,
    );
    const approved = cardProductSuccessRate.reduce(
      (sum, row) => sum + row.approvedCount,
      0,
    );
    const declined = cardProductSuccessRate.reduce(
      (sum, row) => sum + row.declinedCount,
      0,
    );
    const successRate = tried > 0 ? (approved / tried) * 100 : 0;
    return { tried, approved, declined, successRate };
  }, [cardProductSuccessRate]);

  const chartRows: ChartRow[] = useMemo(
    () =>
      [...cardProductSuccessRate]
        .sort((a, b) => b.totalTransactions - a.totalTransactions)
        .map((row) => ({
          label: row.cardProductLabel || row.cardProduct || "Unknown",
          tried: row.totalTransactions,
          approved: row.approvedCount,
          declined: row.declinedCount,
          successRate: row.successRatePercent,
        })),
    [cardProductSuccessRate],
  );

  if (allowedCombos.length === 0) {
    return (
      <div className="space-y-2 py-6">
        <h2 className="text-lg font-semibold">Card Type Success Rate</h2>
        <p className="text-sm text-muted-foreground">
          You do not have permission to view card type success rates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Card Type Success Rate</h2>
          <p className="text-sm text-muted-foreground">
            Compare tried vs approved transactions and success rate by card type
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
              {allowedChannels.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={flow}
            onValueChange={(value) => setFlow(value as SuccessFlow)}
          >
            <SelectTrigger className="w-40" aria-label="Flow">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {flowsForChannel.map((option) => (
                <SelectItem
                  key={`${option.value}-${option.label}`}
                  value={option.value}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
        </div>
      </div>

      {cardProductSuccessRateError ? (
        <p className="text-sm text-destructive">{cardProductSuccessRateError}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Tried"
          value={
            cardProductSuccessRateLoading
              ? NO_VALUE
              : formatCount(totals.tried)
          }
          hint="Authorisation attempts in range"
          icon={Activity}
          loading={cardProductSuccessRateLoading}
        />
        <MetricCard
          label="Approved"
          value={
            cardProductSuccessRateLoading
              ? NO_VALUE
              : formatCount(totals.approved)
          }
          hint="Successful authorisations"
          icon={CheckCircle2}
          loading={cardProductSuccessRateLoading}
        />
        <MetricCard
          label="Declined"
          value={
            cardProductSuccessRateLoading
              ? NO_VALUE
              : formatCount(totals.declined)
          }
          hint="Failed authorisations"
          icon={Ban}
          loading={cardProductSuccessRateLoading}
        />
        <MetricCard
          label="Overall Success Rate"
          value={
            cardProductSuccessRateLoading
              ? NO_VALUE
              : `${totals.successRate.toFixed(2)}%`
          }
          hint={`${formatCount(cardProductSuccessRate.length)} card types`}
          icon={Percent}
          loading={cardProductSuccessRateLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" />
            Card Type Comparison
          </CardTitle>
          <CardDescription>
            Tried and approved counts with success rate per card type
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cardProductSuccessRateLoading ? (
            <Skeleton className="h-72 w-full rounded-md" />
          ) : chartRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No card type activity for the selected dates
            </p>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartRows}
                  margin={{ top: 8, right: 12, left: 0, bottom: 48 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    yAxisId="count"
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="rate"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const numeric =
                        typeof value === "number" ? value : Number(value) || 0;
                      if (name === "Success rate") {
                        return [`${numeric.toFixed(2)}%`, name];
                      }
                      return [formatCount(numeric), name];
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="count"
                    dataKey="tried"
                    name="Tried"
                    fill="#94a3b8"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    yAxisId="count"
                    dataKey="approved"
                    name="Approved"
                    fill="#22c55e"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    yAxisId="rate"
                    type="monotone"
                    dataKey="successRate"
                    name="Success rate"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Card Type Breakdown</CardTitle>
          <CardDescription>
            Tried, approved, and success rate by card type for the selected
            channel, flow, and dates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={
              productColumns as ColumnDef<
                DataTableFeatures,
                CardProductSuccessReport
              >[]
            }
            data={cardProductSuccessRate}
            searchPlaceholder="Search by card type..."
            loading={cardProductSuccessRateLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

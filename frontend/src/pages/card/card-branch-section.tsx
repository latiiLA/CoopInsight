import { format, parseISO } from "date-fns";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Download,
  Search,
  Trophy,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchCardActivityByBranch,
  fetchCardBranchTrend,
  selectBranch,
} from "@/features/card_activity_slice";
import { CardBranchActivity } from "@/types/card-activity";
import { cn } from "@/lib/utils";
import { AppDispatch, RootState } from "../../../app/store/store";

type MetricKey = "created" | "issued" | "activated" | "total";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "created", label: "Requested" },
  { key: "issued", label: "Printed" },
  { key: "activated", label: "Activated" },
];

const ACTIVITY_METRICS = [
  { key: "created" as const, label: "Requested", color: "var(--chart-1)" },
  { key: "issued" as const, label: "Printed", color: "var(--chart-2)" },
  {
    key: "activated" as const,
    label: "Activated",
    color: "oklch(0.62 0.18 150)",
  },
];

const TREND_SERIES = ACTIVITY_METRICS;

const TOP_N = 5;

function metricValue(branch: CardBranchActivity, metric: MetricKey): number {
  if (metric === "total") {
    return branch.created + branch.issued + branch.activated;
  }
  return branch[metric];
}

function formatCount(value: number) {
  return Number(value ?? 0).toLocaleString();
}

function branchLabel(branch: CardBranchActivity) {
  const name = branch.branchName?.trim();
  const code = branch.branchCode?.trim();
  if (name && code) return `${name} (${code})`;
  return name || code || `Branch ${branch.branchId}`;
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    name?: string;
    value?: number;
    color?: string;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="text-muted-foreground">
          <span style={{ color: entry.color }}>{entry.name}: </span>
          <span className="font-medium tabular-nums text-foreground">
            {formatCount(Number(entry.value ?? 0))}
          </span>
        </div>
      ))}
    </div>
  );
}

function RankList({
  title,
  description,
  icon: Icon,
  branches,
  metric,
  max,
  selectedBranchId,
  loading,
  emptyLabel,
  onSelect,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  branches: CardBranchActivity[];
  metric: MetricKey;
  max: number;
  selectedBranchId: number | null;
  loading: boolean;
  emptyLabel: string;
  onSelect: (branchId: number) => void;
}) {
  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: TOP_N }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <ol className="space-y-2.5">
            {branches.map((branch, index) => {
              const value = metricValue(branch, metric);
              const width = max > 0 ? Math.max((value / max) * 100, 4) : 0;
              const selected = branch.branchId === selectedBranchId;

              return (
                <li key={branch.branchId}>
                  <button
                    type="button"
                    onClick={() => onSelect(branch.branchId)}
                    className={cn(
                      "w-full rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/60",
                      selected && "bg-muted ring-1 ring-foreground/20",
                    )}
                  >
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate leading-snug">
                        <span className="mr-2 font-medium tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        {branchLabel(branch)}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatCount(value)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function TopBranchCard({
  label,
  branch,
  value,
  loading,
  selected,
  onSelect,
}: {
  label: string;
  branch: CardBranchActivity | null;
  value: number;
  loading: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!branch || loading}
      className={cn(
        "rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40 disabled:cursor-default disabled:opacity-70",
        selected && "bg-muted ring-1 ring-foreground/20",
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Trophy className="size-3.5" />
        Highest · {label}
      </div>
      {loading ? (
        <Skeleton className="h-14 w-full" />
      ) : branch ? (
        <>
          <div className="truncate text-sm font-semibold leading-snug">
            {branchLabel(branch)}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCount(value)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Click to view progress over time
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">No activity</div>
      )}
    </button>
  );
}

export default function CardBranchSection({
  dateFrom,
  dateTo,
}: {
  dateFrom?: string;
  dateTo?: string;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const {
    branches,
    branchesLoading,
    branchesError,
    selectedBranchId,
    branchTrend,
    branchTrendLoading,
    branchTrendError,
  } = useSelector((state: RootState) => state.cardActivity);

  const [metric, setMetric] = useState<MetricKey>("total");
  const [query, setQuery] = useState("");
  const trendRef = useRef<HTMLDivElement | null>(null);
  // Stick to a manual pick until the date range changes; otherwise always
  // follow the highest branch for the active metric.
  const userPickedRef = useRef(false);

  useEffect(() => {
    userPickedRef.current = false;
    dispatch(selectBranch(null));
  }, [dateFrom, dateTo, dispatch]);

  useEffect(() => {
    const promise = dispatch(fetchCardActivityByBranch({ dateFrom, dateTo }));
    promise.then((result) => {
      if (
        fetchCardActivityByBranch.rejected.match(result) &&
        !result.meta.aborted
      ) {
        toast.error(result.payload || "Failed to fetch branch activity");
      }
    });
    return () => {
      promise.abort();
    };
  }, [dateFrom, dateTo, dispatch]);

  useEffect(() => {
    if (branchesError) toast.error(branchesError);
  }, [branchesError]);

  useEffect(() => {
    if (branchTrendError) toast.error(branchTrendError);
  }, [branchTrendError]);

  // Default (and metric-toggle) selection: highest branch for the active metric.
  useEffect(() => {
    if (userPickedRef.current) return;
    if (branches.length === 0) return;
    const top = [...branches].sort(
      (a, b) => metricValue(b, metric) - metricValue(a, metric),
    )[0];
    if (top && top.branchId !== selectedBranchId) {
      dispatch(selectBranch(top.branchId));
    }
  }, [branches, metric, selectedBranchId, dispatch]);

  // Load the trend whenever the selected branch or range changes.
  useEffect(() => {
    if (selectedBranchId === null) return;
    const promise = dispatch(
      fetchCardBranchTrend({ branchId: selectedBranchId, dateFrom, dateTo }),
    );
    return () => {
      promise.abort();
    };
  }, [selectedBranchId, dateFrom, dateTo, dispatch]);

  const ranked = useMemo(() => {
    const list = [...branches].sort(
      (a, b) => metricValue(b, metric) - metricValue(a, metric),
    );
    return list;
  }, [branches, metric]);

  const top = useMemo(() => ranked.slice(0, TOP_N), [ranked]);
  const bottom = useMemo(
    () => [...ranked].reverse().slice(0, TOP_N),
    [ranked],
  );

  const maxValue = useMemo(
    () => ranked.reduce((max, b) => Math.max(max, metricValue(b, metric)), 0),
    [ranked, metric],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter((branch) =>
      branchLabel(branch).toLowerCase().includes(q),
    );
  }, [ranked, query]);

  const selectedBranch = useMemo(
    () => branches.find((b) => b.branchId === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  const leaders = useMemo(() => {
    const pick = (key: "created" | "issued" | "activated") => {
      if (branches.length === 0) return null;
      return [...branches].sort(
        (a, b) => b[key] - a[key] || a.branchName.localeCompare(b.branchName),
      )[0];
    };
    return {
      created: pick("created"),
      issued: pick("issued"),
      activated: pick("activated"),
    };
  }, [branches]);

  const trendRows = useMemo(
    () =>
      (branchTrend?.daily ?? []).map((day) => ({
        ...day,
        label: format(parseISO(day.date), "MMM d"),
      })),
    [branchTrend],
  );

  const handleSelect = (branchId: number, nextMetric?: MetricKey) => {
    userPickedRef.current = true;
    if (nextMetric) setMetric(nextMetric);
    dispatch(selectBranch(branchId));
    requestAnimationFrame(() => {
      trendRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const exportBranchesCsv = () => {
    if (ranked.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const headers = [
      "rank",
      "branch_id",
      "branch_code",
      "branch_name",
      "requested",
      "printed",
      "activated",
      "total",
    ];
    const lines = [
      headers.join(","),
      ...ranked.map((branch, index) =>
        [
          index + 1,
          branch.branchId,
          JSON.stringify(branch.branchCode ?? ""),
          JSON.stringify(branch.branchName ?? ""),
          branch.created,
          branch.issued,
          branch.activated,
          metricValue(branch, "total"),
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "card-activity-by-branch.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Branch performance</h2>
          <p className="text-sm text-muted-foreground">
            Highest and lowest branches, full ranking, and per-branch progress
            over time. Select a branch to load its trend.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {METRICS.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={metric === item.key ? "default" : "outline"}
              onClick={() => setMetric(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {ACTIVITY_METRICS.map((item) => {
          const branch = leaders[item.key];
          return (
            <TopBranchCard
              key={item.key}
              label={item.label}
              branch={branch}
              value={branch ? branch[item.key] : 0}
              loading={branchesLoading}
              selected={branch?.branchId === selectedBranchId}
              onSelect={() => {
                if (branch) handleSelect(branch.branchId, item.key);
              }}
            />
          );
        })}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <RankList
          title="Highest branches"
          description={`Top ${TOP_N} by ${metric}`}
          icon={ArrowUpNarrowWide}
          branches={top}
          metric={metric}
          max={maxValue}
          selectedBranchId={selectedBranchId}
          loading={branchesLoading}
          emptyLabel="No branch activity in this range."
          onSelect={(branchId) => handleSelect(branchId)}
        />
        <RankList
          title="Lowest performing branches"
          description={`Bottom ${TOP_N} by ${metric}`}
          icon={ArrowDownWideNarrow}
          branches={bottom}
          metric={metric}
          max={maxValue}
          selectedBranchId={selectedBranchId}
          loading={branchesLoading}
          emptyLabel="No branch activity in this range."
          onSelect={(branchId) => handleSelect(branchId)}
        />
      </div>

      <Card className="py-4">
        <CardHeader className="px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>All branches ranked</CardTitle>
              <CardDescription>
                {filtered.length} branch{filtered.length === 1 ? "" : "es"} ·
                sorted by {metric}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search branches..."
                  className="h-8 w-56 rounded-md border bg-background pl-8 pr-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                disabled={ranked.length === 0}
                onClick={exportBranchesCsv}
              >
                <Download className="size-3.5" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4">
          {branchesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No branches match.
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="sticky top-0 bg-muted/60 text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Branch</th>
                    <th className="py-2 pr-3 text-right font-medium">Requested</th>
                    <th className="py-2 pr-3 text-right font-medium">Printed</th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Activated
                    </th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((branch) => {
                    const rank = ranked.indexOf(branch) + 1;
                    const selected = branch.branchId === selectedBranchId;
                    return (
                      <tr
                        key={branch.branchId}
                        onClick={() => handleSelect(branch.branchId)}
                        className={cn(
                          "cursor-pointer border-b last:border-0 hover:bg-muted/50",
                          selected && "bg-muted",
                        )}
                      >
                        <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                          {rank}
                        </td>
                        <td className="py-2 pr-3 font-medium">
                          {branchLabel(branch)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatCount(branch.created)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatCount(branch.issued)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatCount(branch.activated)}
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {formatCount(metricValue(branch, "total"))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div ref={trendRef}>
        <Card className="py-4">
          <CardHeader className="px-4">
            <CardTitle>
              {selectedBranch
                ? `${branchLabel(selectedBranch)} · progress over time`
                : "Branch progress over time"}
            </CardTitle>
            <CardDescription>
              {branchTrend
                ? `Daily requested, printed, and activated · ${branchTrend.from} to ${branchTrend.to}`
                : "Select a branch to view its daily progress"}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            {selectedBranchId === null ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                Select a branch above.
              </div>
            ) : branchTrendLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : trendRows.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                No activity for this branch in the range.
              </div>
            ) : (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  {TREND_SERIES.map((series) => (
                    <div
                      key={series.key}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <div className="text-muted-foreground">{series.label}</div>
                      <div className="text-xl font-semibold tabular-nums">
                        {formatCount(branchTrend?.totals[series.key] ?? 0)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={trendRows}
                      margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        minTickGap={24}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip content={<TrendTooltip />} />
                      <Legend />
                      {TREND_SERIES.map((series) => (
                        <Line
                          key={series.key}
                          type="monotone"
                          dataKey={series.key}
                          name={series.label}
                          stroke={series.color}
                          strokeWidth={2}
                          dot={trendRows.length <= 40 ? { r: 2 } : false}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

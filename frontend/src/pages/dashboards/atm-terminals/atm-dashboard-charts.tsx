import { type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountSlice, formatCount } from "./atm-fleet";

const SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--color-primary)",
  "var(--chart-3)",
  "var(--chart-5)",
  "oklch(0.62 0.18 150)",
  "oklch(0.58 0.19 300)",
  "oklch(0.68 0.16 20)",
  "var(--chart-4)",
];

const OTHERS = "Others";

type StackedBarRow = {
  name: string;
  [key: string]: string | number;
};

type PieSlice = CountSlice & {
  sharePercent: number;
  fill: string;
};

function nameFromBarClick(data: { payload?: { name?: unknown } } | undefined) {
  const name = data?.payload?.name;
  return typeof name === "string" ? name : undefined;
}

function formatAxisLabel(value: string | number) {
  const label = String(value);
  return label.length > 18 ? `${label.slice(0, 16)}…` : label;
}

function toPieSlices(rows: CountSlice[], total: number): PieSlice[] {
  return rows
    .filter((row) => row.count > 0)
    .map((row, index) => ({
      ...row,
      sharePercent: total > 0 ? (row.count / total) * 100 : 0,
      fill: SLICE_COLORS[index % SLICE_COLORS.length],
    }));
}

function CountTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; count: number; sharePercent?: number } }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const slice = payload[0].payload;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      <div className="font-medium">{slice.name}</div>
      <div className="text-muted-foreground">
        {formatCount(slice.count)}
        {typeof slice.sharePercent === "number"
          ? ` (${slice.sharePercent.toFixed(1)}%)`
          : ""}
      </div>
    </div>
  );
}

export function FleetPie({
  title,
  description,
  rows,
  total,
  loading,
  onSelect,
}: {
  title: string;
  description: string;
  rows: CountSlice[];
  total: number;
  loading: boolean;
  onSelect?: (name: string) => void;
}) {
  const slices = toPieSlices(rows, total);

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : slices.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No terminal data
          </div>
        ) : (
          <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_12rem]">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={84}
                    paddingAngle={2}
                    cursor={onSelect ? "pointer" : undefined}
                    onClick={(_, index) => {
                      const slice = slices[index];
                      if (slice && slice.name !== OTHERS) {
                        onSelect?.(slice.name);
                      }
                    }}
                    label={({ percent }) =>
                      (percent ?? 0) >= 0.08
                        ? `${((percent ?? 0) * 100).toFixed(0)}%`
                        : ""
                    }
                    labelLine={false}
                  >
                    {slices.map((slice) => (
                      <Cell key={slice.name} fill={slice.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CountTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {slices.map((slice) => (
                <li key={slice.name} className="flex items-start gap-2">
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.fill }}
                  />
                  <span className="min-w-0 flex-1 leading-snug">{slice.name}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCount(slice.count)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FleetBar({
  title,
  description,
  rows,
  loading,
  onSelect,
}: {
  title: string;
  description: string;
  rows: CountSlice[];
  loading: boolean;
  onSelect?: (name: string) => void;
}) {
  const height = Math.max(320, rows.length * 32);

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <Skeleton className="h-80 w-full" />
        ) : rows.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            No terminal data
          </div>
        ) : (
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 8, right: 36, left: 4, bottom: 8 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={128}
                  tick={{ fontSize: 11 }}
                  interval={0}
                  tickFormatter={formatAxisLabel}
                />
                <Tooltip content={<CountTooltip />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-primary)"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={22}
                  cursor={onSelect ? "pointer" : undefined}
                  onClick={(data) => {
                    const name = nameFromBarClick(data);
                    if (name && name !== OTHERS) {
                      onSelect?.(name);
                    }
                  }}
                >
                  <LabelList
                    dataKey="count"
                    position="right"
                    className="fill-foreground text-[11px]"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FleetRankList({
  title,
  description,
  rows,
  loading,
  onSelect,
}: {
  title: string;
  description: string;
  rows: CountSlice[];
  loading: boolean;
  onSelect?: (name: string) => void;
}) {
  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No terminal data
          </div>
        ) : (
          <ol className="space-y-2.5">
            {rows.map((row, index) => {
              const clickable = Boolean(onSelect) && row.name !== OTHERS;

              return (
                <li key={row.name}>
                  <button
                    type="button"
                    disabled={!clickable}
                    className="w-full rounded-md px-1 py-1 text-left disabled:cursor-default enabled:hover:bg-muted/50"
                    onClick={() => {
                      if (clickable) {
                        onSelect?.(row.name);
                      }
                    }}
                  >
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 leading-snug">
                        <span className="mr-2 font-medium tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        {row.name}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatCount(row.count)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max((row.count / max) * 100, 6)}%` }}
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

function StackedTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums text-foreground">
            {formatCount(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FleetStackedBar({
  title,
  description,
  rows,
  series,
  loading,
  onSelect,
  actions,
}: {
  title: string;
  description: string;
  rows: StackedBarRow[];
  series: Array<{ key: string; color: string }>;
  loading: boolean;
  onSelect?: (name: string) => void;
  actions?: ReactNode;
}) {
  const height = Math.max(360, rows.length * 34);

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <Skeleton className="h-80 w-full" />
        ) : rows.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            No terminal data
          </div>
        ) : (
          <div className="space-y-3">
            <div style={{ height }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rows}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={128}
                    tick={{ fontSize: 11 }}
                    interval={0}
                    tickFormatter={formatAxisLabel}
                  />
                  <Tooltip content={<StackedTooltip />} />
                  {series.map((item, index) => (
                    <Bar
                      key={item.key}
                      dataKey={item.key}
                      stackId="mix"
                      fill={item.color}
                      maxBarSize={22}
                      cursor={onSelect ? "pointer" : undefined}
                      radius={
                        index === series.length - 1 ? [0, 6, 6, 0] : [0, 0, 0, 0]
                      }
                      onClick={(data) => {
                        const name = nameFromBarClick(data);
                        if (name && name !== OTHERS) {
                          onSelect?.(name);
                        }
                      }}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {series.map((item) => (
                <li key={item.key} className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.key}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

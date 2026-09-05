import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SuccessRateRow } from "@/types/report";

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

const TOP_SLICE_COUNT = 8;

type PieSlice = {
  name: string;
  count: number;
  sharePercent: number;
  fill: string;
};

function buildPieSlices(rows: SuccessRateRow[], declinedCount: number): PieSlice[] {
  const sorted = rows
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  const top = sorted.slice(0, TOP_SLICE_COUNT);
  const restCount = sorted
    .slice(TOP_SLICE_COUNT)
    .reduce((sum, row) => sum + row.count, 0);

  const slices = top.map((row, index) => ({
    name: `${row.label} (${row.code})`,
    count: row.count,
    sharePercent: row.sharePercent,
    fill: SLICE_COLORS[index % SLICE_COLORS.length],
  }));

  if (restCount > 0) {
    slices.push({
      name: "Others",
      count: restCount,
      sharePercent: declinedCount > 0 ? (restCount / declinedCount) * 100 : 0,
      fill: SLICE_COLORS[slices.length % SLICE_COLORS.length],
    });
  }

  return slices;
}

function ShareTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PieSlice }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const slice = payload[0].payload;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      <div className="font-medium">{slice.name}</div>
      <div className="text-muted-foreground">
        {slice.count.toLocaleString()} ({slice.sharePercent.toFixed(2)}%)
      </div>
    </div>
  );
}

export function DeclineReasonsPie({
  rows,
  declinedCount,
}: {
  rows: SuccessRateRow[];
  declinedCount: number;
}) {
  const slices = buildPieSlices(rows, declinedCount);

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle>Decline reasons</CardTitle>
        <CardDescription>
          Share of declined transactions by response code
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {slices.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No declined transactions in this range
          </div>
        ) : (
          <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={96}
                    paddingAngle={2}
                    label={({ percent }) =>
                      percent >= 0.04 ? `${(percent * 100).toFixed(1)}%` : ""
                    }
                    labelLine={false}
                  >
                    {slices.map((slice) => (
                      <Cell key={slice.name} fill={slice.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<ShareTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
              {slices.map((slice) => (
                <li key={slice.name} className="flex items-start gap-2">
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.fill }}
                  />
                  <span className="min-w-0 flex-1 leading-snug">{slice.name}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {slice.sharePercent.toFixed(1)}%
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

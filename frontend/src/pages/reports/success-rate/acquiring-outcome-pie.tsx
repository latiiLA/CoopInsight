import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type OutcomeSlice = {
  name: string;
  count: number;
  sharePercent: number;
  fill: string;
};

const SUCCESS_FILL = "oklch(0.62 0.18 150)";
const DECLINED_FILL = "var(--destructive)";

function ShareTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: OutcomeSlice }>;
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

export function AcquiringOutcomePie({
  approvedCount,
  declinedCount,
  compact = false,
}: {
  approvedCount: number;
  declinedCount: number;
  compact?: boolean;
}) {
  const total = approvedCount + declinedCount;
  const slices: OutcomeSlice[] = [
    {
      name: "Success",
      count: approvedCount,
      sharePercent: total > 0 ? (approvedCount / total) * 100 : 0,
      fill: SUCCESS_FILL,
    },
    {
      name: "Declined",
      count: declinedCount,
      sharePercent: total > 0 ? (declinedCount / total) * 100 : 0,
      fill: DECLINED_FILL,
    },
  ].filter((slice) => slice.count > 0);

  return (
    <Card className={compact ? "h-full min-w-0 gap-4 py-4" : "gap-4 py-4"}>
      <CardHeader className="px-4">
        <CardTitle>Acquiring success rate</CardTitle>
        <CardDescription>
          Success and declined share of acquiring transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {slices.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No acquiring transactions in this range
          </div>
        ) : (
          <div
            className={
              compact
                ? "grid items-start gap-4"
                : "grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]"
            }
          >
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
                    paddingAngle={slices.length > 1 ? 2 : 0}
                    label={({ percent }) => `${((percent ?? 0) * 100).toFixed(1)}%`}
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

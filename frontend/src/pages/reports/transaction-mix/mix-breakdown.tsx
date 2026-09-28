import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TransactionMixSlice } from "@/types/transaction-mix";

/**
 * Colours are assigned by network family, not by rank or by hashing the key.
 *
 * Every card scheme in the switch routes to exactly one destination, verified
 * across all 80M+ rows: GAMTAA and Local CPA go only to CBOBCORTEX, ETB only
 * to 8888888888, VISA only to 04, and MDS only to 05 and 06. So a scheme and
 * its destination are the same money moving through the same pipe, and giving
 * them different colours made the two charts on the page look like they were
 * describing different worlds. Colouring by family makes "CBO 50.71%" in the
 * destination chart and "Gamtaa 46.56% + Local CPA 4.15%" in the scheme chart
 * read as the same story.
 *
 * Two earlier versions were wrong in ways worth recording. Hashing the key and
 * adding the index could put two buckets in one chart on the same or a
 * near-identical swatch, which turned the ATM and POS destination charts
 * entirely blue. Switching to rank fixed the collisions but kept the family
 * split, and put red on ETH even though red means declined everywhere else in
 * this app.
 *
 * There is no red here for that reason.
 */
const FAMILY_FILL: Record<string, string> = {
  // One cyan for the whole CoopBank switch family: the CBO destination, and
  // the two card schemes that only ever route to it.
  CBO: "oklch(0.66 0.12 205)",
  GAMTAA: "oklch(0.66 0.12 205)",
  LOCAL_CPA: "oklch(0.66 0.12 205)",

  // ETH, the national interbank scheme, routes out to the external leg. The
  // scheme axis reports it as ETB, which is the currency code stored in
  // CARDPRODUCT, so both keys resolve to the same colour. Missing ETB here
  // would drop it onto a fallback colour and break the family link.
  ETH: "oklch(0.63 0.15 150)",
  ETB: "oklch(0.63 0.15 150)",

  // International schemes, kept apart from each other because they are small
  // and an operator does need to spot them.
  VISA: "oklch(0.56 0.16 248)",
  MASTERCARD: "oklch(0.57 0.17 305)",

  // MAE rides on the same Mastercard destinations as MDS but is a distinct
  // scheme with its own row in the log, so it gets a distinguishable colour
  // rather than being painted the same purple and reading as a double-count.
  MAE: "oklch(0.6 0.15 342)",

  // Message type axis. Not a family, so these get their own reserved colours
  // and never take a colour from the scheme palette above.
  authorisation: "oklch(0.63 0.15 150)",
  reversal: "oklch(0.71 0.14 44)",
  network: "oklch(0.74 0.14 78)",
  other: "oklch(0.62 0.05 260)",
};

/** Anything not in the table above, so a new bucket is never left colourless. */
const FALLBACK_FILLS = [
  "oklch(0.6 0.15 342)",
  "oklch(0.75 0.14 124)",
  "oklch(0.45 0.06 265)",
];

type ChartSlice = TransactionMixSlice & {
  fill: string;
  reversalPercent?: number;
};

function MixTooltip({
  active,
  payload,
  showReversals,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartSlice }>;
  showReversals?: boolean;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const slice = payload[0].payload;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      <div className="font-medium">{slice.label}</div>
      <div className="text-muted-foreground">
        {slice.count.toLocaleString()} messages ({slice.countPercent.toFixed(2)}%)
      </div>
      <div className="text-muted-foreground">
        {slice.amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}{" "}
        ({slice.amountPercent.toFixed(2)}% of value)
      </div>
      {showReversals && typeof slice.reversalPercent === "number" ? (
        <div className="text-muted-foreground">
          {slice.reversalPercent.toFixed(2)}% of these are reversals
        </div>
      ) : null}
    </div>
  );
}

/**
 * One mix axis as a pie with a scrollable legend.
 *
 * The legend carries the exact percentages rather than the pie labels, because
 * a slice below about 1% cannot hold a readable label inside a 96px radius.
 */
export function MixBreakdown({
  title,
  description,
  slices,
  showReversals = false,
  loading = false,
}: {
  title: string;
  description: string;
  slices: (TransactionMixSlice & { reversalPercent?: number })[];
  showReversals?: boolean;
  loading?: boolean;
}) {
  // Fallback colours are handed out only to keys the family table does not
  // know, counting those keys alone. Using the raw slice index would let a
  // fallback land on a colour already in use by a family in the same chart.
  let fallbackIndex = 0;
  const chartSlices: ChartSlice[] = slices.map((slice) => {
    if (FAMILY_FILL[slice.key]) {
      return { ...slice, fill: FAMILY_FILL[slice.key] };
    }
    const fill = FALLBACK_FILLS[fallbackIndex % FALLBACK_FILLS.length];
    fallbackIndex += 1;
    return { ...slice, fill };
  });

  const total = chartSlices.reduce((sum, slice) => sum + slice.count, 0);

  return (
    <Card className="h-full min-w-0 gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <>
            <Skeleton className="mx-auto h-64 w-64" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          </>
        ) : chartSlices.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No messages for the selected dates
          </div>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartSlices}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={96}
                    paddingAngle={chartSlices.length > 1 ? 2 : 0}
                    label={({ percent }) =>
                      percent && percent > 0.02
                        ? `${(percent * 100).toFixed(1)}%`
                        : ""
                    }
                    labelLine={false}
                  >
                    {chartSlices.map((slice) => (
                      <Cell key={slice.key} fill={slice.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<MixTooltip showReversals={showReversals} />}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto text-sm">
              {chartSlices.map((slice) => (
                <li key={slice.key} className="flex items-start gap-2">
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.fill }}
                  />
                  <span className="min-w-0 flex-1 leading-snug">
                    {slice.label}
                    <span className="block text-xs text-muted-foreground">
                      {slice.count.toLocaleString()} messages
                      {showReversals && typeof slice.reversalPercent === "number"
                        ? `, ${slice.reversalPercent.toFixed(2)}% reversed`
                        : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {slice.countPercent.toFixed(2)}%
                  </span>
                </li>
              ))}
              <li className="flex items-start gap-2 border-t pt-2 text-muted-foreground">
                <span className="min-w-0 flex-1">Total</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {total.toLocaleString()}
                </span>
              </li>
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

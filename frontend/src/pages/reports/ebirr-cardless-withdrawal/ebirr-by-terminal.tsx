import {
  Bar,
  BarChart,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type EbirrTerminalSummary,
  formatAmount,
  formatCount,
} from "./ebirr-summary";

export function EbirrByTerminal({
  rows,
  loading,
}: {
  rows: EbirrTerminalSummary[];
  loading: boolean;
}) {
  const chartRows = rows.slice(0, 8).map((row) => ({
    name: row.terminalId.trim() || "Unknown",
    amount: row.totalAmount,
    count: row.transactionCount,
  }));

  return (
    <div className="grid min-w-0 gap-4 py-2 xl:grid-cols-2">
      <Card className="gap-4 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Top terminals by amount</CardTitle>
          <CardDescription>
            Highest total withdrawal amounts in this date range
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartRows.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No withdrawals in this range
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={96}
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <Tooltip
                    formatter={(value) =>
                      formatAmount(typeof value === "number" ? value : 0)
                    }
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar dataKey="amount" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-4 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">By terminal</CardTitle>
          <CardDescription>
            Transaction count and total amount per terminal
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : rows.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No withdrawals in this range
            </div>
          ) : (
            <div className="max-h-80 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Terminal ID</TableHead>
                    <TableHead className="text-right">Txns</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium tabular-nums">
                        {row.terminalId.trim() || "Unknown"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCount(row.transactionCount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(row.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

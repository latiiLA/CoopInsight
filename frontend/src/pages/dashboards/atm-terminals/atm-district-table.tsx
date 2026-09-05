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
import { cn } from "@/lib/utils";
import {
  type AtmTerminalFilters,
  type DistrictMix,
  formatCount,
} from "./atm-fleet";

function CountCell({
  value,
  onClick,
}: {
  value: number;
  onClick?: () => void;
}) {
  if (value <= 0) {
    return <TableCell className="text-right tabular-nums text-muted-foreground">0</TableCell>;
  }

  return (
    <TableCell className="p-0 text-right tabular-nums">
      <button
        type="button"
        className="h-full w-full px-2 py-2 text-right hover:bg-muted"
        onClick={onClick}
      >
        {formatCount(value)}
      </button>
    </TableCell>
  );
}

export function DistrictMixTable({
  rows,
  loading,
  onOpen,
}: {
  rows: DistrictMix[];
  loading: boolean;
  onOpen: (filters: Partial<AtmTerminalFilters>) => void;
}) {
  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle>District mix</CardTitle>
        <CardDescription>
          Live counts by status, site, and type. Stopped and relocated are no longer operating at the previous site. Click a number to open that list.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <Skeleton className="h-80 w-full" />
        ) : rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No terminal data
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>District</TableHead>
                <TableHead className="text-right">Live</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">New</TableHead>
                <TableHead className="text-right">Onsite</TableHead>
                <TableHead className="text-right">Offsite</TableHead>
                <TableHead className="text-right">CRM</TableHead>
                <TableHead className="text-right">NCR</TableHead>
                <TableHead className="text-right">Stopped</TableHead>
                <TableHead className="text-right">Relocated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.district}>
                  <TableCell className="p-0 font-medium">
                    <button
                      type="button"
                      className={cn(
                        "w-full px-2 py-2 text-left hover:bg-muted",
                        row.district === "Unknown" && "text-muted-foreground",
                      )}
                      onClick={() =>
                        onOpen({ district: row.district })
                      }
                    >
                      {row.district}
                    </button>
                  </TableCell>
                  <CountCell
                    value={row.live}
                    onClick={() => onOpen({ district: row.district })}
                  />
                  <CountCell
                    value={row.active}
                    onClick={() =>
                      onOpen({ district: row.district, status: "Active" })
                    }
                  />
                  <CountCell
                    value={row.newCount}
                    onClick={() =>
                      onOpen({ district: row.district, status: "New" })
                    }
                  />
                  <CountCell
                    value={row.onsite}
                    onClick={() =>
                      onOpen({ district: row.district, site: "Onsite" })
                    }
                  />
                  <CountCell
                    value={row.offsite}
                    onClick={() =>
                      onOpen({ district: row.district, site: "Offsite" })
                    }
                  />
                  <CountCell
                    value={row.crm}
                    onClick={() =>
                      onOpen({ district: row.district, type: "CRM" })
                    }
                  />
                  <CountCell
                    value={row.ncr}
                    onClick={() =>
                      onOpen({ district: row.district, type: "NCR" })
                    }
                  />
                  <CountCell
                    value={row.stopped}
                    onClick={() =>
                      onOpen({ district: row.district, status: "Stopped" })
                    }
                  />
                  <CountCell
                    value={row.relocated}
                    onClick={() =>
                      onOpen({ district: row.district, status: "Relocated" })
                    }
                  />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

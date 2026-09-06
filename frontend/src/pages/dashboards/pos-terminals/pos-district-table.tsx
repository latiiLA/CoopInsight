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
  SITE_BRANCH,
  SITE_MERCHANT,
  TO_BE_RELOCATED,
  type PosDistrictMix,
  type PosTerminalFilters,
  formatCount,
} from "./pos-fleet";

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

export function PosDistrictMixTable({
  rows,
  loading,
  onOpen,
}: {
  rows: PosDistrictMix[];
  loading: boolean;
  onOpen: (filters: Partial<PosTerminalFilters>) => void;
}) {
  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle>District mix</CardTitle>
        <CardDescription>
          Live counts by status and site. Stopped and relocated are no longer operating. Click a number to open that list.
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
                <TableHead className="text-right">To relocate</TableHead>
                <TableHead className="text-right">Merchant</TableHead>
                <TableHead className="text-right">Branch</TableHead>
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
                      onClick={() => onOpen({ district: row.district })}
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
                    value={row.toBeRelocated}
                    onClick={() =>
                      onOpen({ district: row.district, status: TO_BE_RELOCATED })
                    }
                  />
                  <CountCell
                    value={row.merchant}
                    onClick={() =>
                      onOpen({ district: row.district, site: SITE_MERCHANT })
                    }
                  />
                  <CountCell
                    value={row.branch}
                    onClick={() =>
                      onOpen({ district: row.district, site: SITE_BRANCH })
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

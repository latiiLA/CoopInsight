import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableFeatures } from "@/components/data-table-features";
import type { SettledProduct } from "@/features/settled_slice";
import { formatMoneyWithCurrency } from "@/lib/iso-currency";
import { SettledTransaction } from "@/types/settled";

const columnHelper = createColumnHelper<DataTableFeatures, SettledTransaction>();

function formatSettlementAmount(row: SettledTransaction) {
  const amount = row.settlementAmount;
  const currency = row.settlementCurrency;
  if ((!amount || amount === 0) && (!currency || currency === 0)) {
    return "-";
  }
  return formatMoneyWithCurrency(amount, currency);
}

export function getSettledColumns(product: SettledProduct) {
  const showSettlement = product === "MDS";

  return columnHelper.columns([
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }),
    columnHelper.accessor("date", {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    }),
    ...(product === "VISA" || product === "VISACBS"
      ? [
          columnHelper.accessor("txnId", {
            header: "Txn ID",
          }),
        ]
      : []),
    columnHelper.accessor("time", {
      header: "Time",
    }),
    columnHelper.accessor("msgType", {
      header: "Type",
    }),
    columnHelper.accessor("rrn", {
      header: "Reference no.",
    }),
    columnHelper.accessor("stan", {
      header: "Trace no.",
    }),
    columnHelper.accessor("amount", {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {showSettlement ? "Source amount" : "Amount"}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row, getValue }) => (
        <span className="tabular-nums">
          {formatMoneyWithCurrency(getValue(), row.original.currency)}
        </span>
      ),
    }),
    ...(showSettlement
      ? [
          columnHelper.accessor("settlementAmount", {
            header: "Settlement amount",
            cell: ({ row }) => (
              <span className="tabular-nums">
                {formatSettlementAmount(row.original)}
              </span>
            ),
          }),
        ]
      : []),
    columnHelper.accessor("terminalId", {
      header: "Terminal ID",
    }),
    columnHelper.accessor("merchant", {
      header: "Merchant name",
      cell: ({ getValue }) => {
        const value = getValue() || "";
        return value.length > 36 ? `${value.slice(0, 36)}…` : value || "-";
      },
    }),
    columnHelper.accessor("cardProduct", {
      header: "Card product",
    }),
    columnHelper.accessor("respCode", {
      header: "Response",
    }),
    columnHelper.accessor("procCode", {
      header: "Processing code",
    }),
  ]);
}

import { useNavigate } from "react-router-dom";
import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import { TerminalPerformanceRow } from "@/types/report";

const columnHelper = createColumnHelper<
  DataTableFeatures,
  TerminalPerformanceRow
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

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getColumns(fleet: "atm" | "pos") {
  const transactionsPath =
    fleet === "pos" ? "/pos-terminals" : "/atm-terminals";

  return columnHelper.columns([
    columnHelper.accessor("rank", {
      header: sortableHeader("Rank"),
    }),
    columnHelper.accessor("terminalId", {
      header: sortableHeader("Terminal ID"),
    }),
    columnHelper.accessor("terminalName", {
      header: sortableHeader("Name"),
      cell: ({ getValue }) => getValue() || "—",
    }),
    columnHelper.accessor("branchName", {
      header: sortableHeader("Branch"),
      cell: ({ getValue }) => getValue() || "—",
    }),
    columnHelper.accessor("transactionCount", {
      header: sortableHeader("Transactions"),
      cell: ({ getValue }) => getValue().toLocaleString(),
    }),
    columnHelper.accessor("approvedCount", {
      header: sortableHeader("Approved"),
      cell: ({ getValue }) => getValue().toLocaleString(),
    }),
    columnHelper.accessor("amount", {
      header: sortableHeader("Amount"),
      cell: ({ getValue }) => formatAmount(getValue()),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      enableHiding: false,
      cell: ({ row }) => <ViewTransactionsButton
        path={`${transactionsPath}/${encodeURIComponent(row.original.terminalId)}/transactions`}
      />,
    }),
  ]);
}

function ViewTransactionsButton({ path }: { path: string }) {
  const navigate = useNavigate();

  return (
    <Button type="button" variant="ghost" onClick={() => navigate(path)}>
      View
    </Button>
  );
}

import { createColumnHelper } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";

import { DataTableFeatures } from "@/components/data-table-features";
import type { SafTransaction } from "@/types/saf";

const columnHelper = createColumnHelper<DataTableFeatures, SafTransaction>();

const NO_VALUE = "-";

function formatSafDate(value?: string) {
  if (!value) {
    return NO_VALUE;
  }
  try {
    return format(parseISO(value), "dd/MM/yyyy");
  } catch {
    return value;
  }
}

function formatSendTime(value?: number) {
  if (value == null || Number.isNaN(value)) {
    return NO_VALUE;
  }
  // IST SEND_TIME is a unix epoch second (original advice time; may be
  // earlier than SAF_DATE used for the day filter).
  if (value > 1_000_000_000) {
    return new Date(value * 1000).toLocaleString();
  }
  const raw = Math.trunc(value).toString().padStart(6, "0").slice(-6);
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)}:${raw.slice(4, 6)}`;
}

function formatSafStatus(value?: string) {
  switch ((value ?? "").toUpperCase()) {
    case "S":
      return "Skipped";
    case "D":
      return "Done";
    case "P":
      return "Pending";
    default:
      return value || NO_VALUE;
  }
}

export function getSafColumns() {
  return columnHelper.columns([
    columnHelper.accessor("seqNum", {
      header: "Seq num",
    }),
    columnHelper.accessor("msgType", {
      header: "Type",
      cell: ({ row, getValue }) => {
        const decoded = getValue();
        if (decoded != null) {
          return String(decoded);
        }
        return row.original.mti || NO_VALUE;
      },
    }),
    columnHelper.accessor("trace", {
      header: "Trace",
      cell: ({ getValue }) => getValue() || NO_VALUE,
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: ({ getValue }) => formatSafStatus(getValue()),
    }),
    columnHelper.accessor("pcode", {
      header: "Pcode",
      cell: ({ getValue }) => getValue() || NO_VALUE,
    }),
    columnHelper.accessor("amount", {
      header: "Amount",
      cell: ({ getValue }) => getValue() || NO_VALUE,
    }),
    columnHelper.accessor("maskedPan", {
      header: "Pan",
      cell: ({ getValue }) => getValue() || NO_VALUE,
    }),
    columnHelper.accessor("safDate", {
      header: "Skipped date",
      cell: ({ getValue }) => formatSafDate(getValue()),
    }),
    columnHelper.accessor("sendTime", {
      header: "Send time",
      cell: ({ getValue }) => formatSendTime(getValue()),
    }),
    columnHelper.accessor("siteId", {
      header: "Site",
      cell: ({ getValue }) =>
        getValue() == null ? NO_VALUE : String(getValue()),
    }),
  ]);
}

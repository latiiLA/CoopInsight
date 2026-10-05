import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown, ListTree } from "lucide-react";

import { type DataTableFeatures } from "@/components/data-table-features";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  MastercardIPMBatchSummary,
  MastercardIPMTransaction,
} from "@/types/mastercard-ipm";

/** Presentment columns. Hidden until a loaded row actually has them. */
export const FINANCIAL_COLUMN_IDS = [
  "pan",
  "stan",
  "amount",
  "card_acceptor_name",
  "terminal_id",
  "acquirer_id",
] as const;

const FUNCTION_LABELS: Record<string, string> = {
  "200": "First presentment",
  "680": "Currency summary",
  "685": "Financial position",
  "688": "Settlement position",
  "695": "Trailer",
  "697": "Header",
};

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  SETTLEMENT_SUMMARY: "Settlement",
  FINANCIAL: "Financial",
  HEADER: "Header",
  TRAILER: "Trailer",
  OTHER: "Other",
};

const CURRENCY_NAMES: Record<string, string> = {
  "230": "ETB",
  "404": "KES",
  "826": "GBP",
  "840": "USD",
  "978": "EUR",
};

/**
 * Formats minor-unit digits as a decimal amount without losing precision on
 * the 16-digit PDS amounts (beyond Number.MAX_SAFE_INTEGER).
 */
function formatMinorAmount(value: unknown, exponent = 2) {
  const exp = exponent >= 0 && exponent <= 6 ? exponent : 2;
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "\u2014";
  const cleaned = digits.replace(/^0+/, "") || "0";
  let whole: string;
  let frac: string;
  if (exp === 0) {
    whole = cleaned;
    frac = "";
  } else if (cleaned.length <= exp) {
    whole = "0";
    frac = cleaned.padStart(exp, "0");
  } else {
    whole = cleaned.slice(0, cleaned.length - exp);
    frac = cleaned.slice(cleaned.length - exp);
  }
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return exp > 0 ? `${grouped}.${frac}` : grouped;
}

/**
 * PDS 0148 is repeating n-4 groups: ISO numeric currency + one-digit exponent.
 * Falls back to 2, which is what 230 (ETB) and 840 (USD) use in IPM.
 */
function pdsExponent(
  pds: Record<string, string> | undefined,
  currency: string | undefined,
) {
  const raw = pds?.["0148"] ?? "";
  if (!currency) return 2;
  for (let i = 0; i + 4 <= raw.length; i += 4) {
    const chunk = raw.slice(i, i + 4);
    if (!/^\d{4}$/.test(chunk)) break;
    if (chunk.slice(0, 3) === currency) return Number(chunk[3]);
  }
  return 2;
}

/**
 * Settlement PDS amounts are an optional prefix plus a D/C indicator and
 * minor-unit digits (PDS 0380/0381/0384/039x). A zero debit is shown as 0.00,
 * not a minus.
 */
function formatPdsAmount(
  raw: string | undefined,
  exponent: number,
) {
  if (!raw?.trim()) return "—";
  const trimmed = raw.trim();
  const signed = trimmed.match(/([DC])(\d+)$/i);
  if (!signed) {
    return /^\d+$/.test(trimmed)
      ? formatMinorAmount(trimmed, exponent)
      : trimmed;
  }
  const digits = signed[2];
  const negative = signed[1].toUpperCase() === "D" && !/^0+$/.test(digits);
  const formatted = formatMinorAmount(digits, exponent);
  return negative ? `-${formatted}` : formatted;
}

function formatPdsCount(raw: string | undefined) {
  if (!raw || !/^\d+$/.test(raw.trim())) return "—";
  return Number(raw).toLocaleString();
}

/** Go's zero time and an empty parser date both render as an em dash. */
export function isZeroDate(value?: string) {
  if (!value) return true;
  const day = value.slice(0, 10);
  return day === "0001-01-01" || day === "0000-00-00";
}

/**
 * PDS 0105 file id: n-3 file type, n-6 YYMMDD, n-11 processor, n-5 sequence.
 * Example 0032609290000003445702201 -> 2026-09-29.
 */
export function dateFromFileId(fileId?: string) {
  if (!fileId || fileId.length < 9) return undefined;
  const yymmdd = fileId.slice(3, 9);
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const month = Number(yymmdd.slice(2, 4));
  const day = Number(yymmdd.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

function displayTransactionDate(tx: MastercardIPMTransaction) {
  if (tx.transaction_date && !isZeroDate(tx.transaction_date)) {
    return tx.transaction_date.slice(0, 10);
  }
  return dateFromFileId(tx.file_id) ?? "—";
}

function displayTimestamp(value?: string) {
  if (!value || isZeroDate(value)) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function currencyLabel(tx: MastercardIPMTransaction) {
  const txn = tx.currency_code?.trim();
  const recon = tx.settlement_currency?.trim();
  const name = (code?: string) =>
    code && CURRENCY_NAMES[code] ? `${code} ${CURRENCY_NAMES[code]}` : code;
  if (txn && recon && txn !== recon) return `${name(txn)} / ${name(recon)}`;
  return name(txn) || name(recon) || "—";
}

function institutionLabel(tx: MastercardIPMTransaction) {
  const origin = tx.originator_institution_id?.trim();
  const dest = tx.destination_institution_id?.trim();
  if (origin && dest && origin !== dest) return `${origin} → ${dest}`;
  return origin || dest || "—";
}

function sortableHeader(
  label: string,
  column: {
    toggleSorting: (desc?: boolean) => void;
    getIsSorted: () => string | false;
  },
) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

const batchHelper = createColumnHelper<
  DataTableFeatures,
  MastercardIPMBatchSummary
>();

export function buildBatchColumns(
  onViewRecords?: (batch: MastercardIPMBatchSummary) => void,
) {
  const columns = [
    batchHelper.accessor("file_name", {
      header: ({ column }) => sortableHeader("File", column),
    }),
    batchHelper.accessor("file_id", {
      header: ({ column }) => sortableHeader("File ID", column),
      cell: ({ row }) => (
        <span className="font-mono text-xs" title={row.original.file_id}>
          {row.original.file_id || "—"}
        </span>
      ),
    }),
    batchHelper.accessor("status", {
      header: ({ column }) => sortableHeader("Status", column),
      cell: ({ row }) => {
        const status = row.original.status || "—";
        const tone =
          status === "FAILED"
            ? "text-destructive"
            : status === "DUPLICATE"
              ? "text-muted-foreground"
              : "text-foreground";
        return <span className={`font-medium ${tone}`}>{status}</span>;
      },
    }),
    batchHelper.accessor("parsed_messages", {
      header: ({ column }) => sortableHeader("Messages", column),
      cell: ({ row }) =>
        (row.original.parsed_messages ?? 0) > 0
          ? row.original.parsed_messages!.toLocaleString()
          : "—",
    }),
    batchHelper.accessor("total_records", {
      header: ({ column }) => sortableHeader("Records", column),
      cell: ({ row }) => row.original.total_records.toLocaleString(),
    }),
    batchHelper.display({
      id: "newRecords",
      header: "New",
      cell: ({ row }) =>
        (
          row.original.inserted_records ?? row.original.total_records
        ).toLocaleString(),
      enableSorting: false,
    }),
    batchHelper.display({
      id: "skipped",
      header: "Skipped",
      cell: ({ row }) =>
        (row.original.duplicate_records ?? 0) > 0
          ? row.original.duplicate_records!.toLocaleString()
          : "0",
      enableSorting: false,
    }),
    batchHelper.accessor("processed_at", {
      header: ({ column }) => sortableHeader("Processed", column),
      cell: ({ row }) => displayTimestamp(row.original.processed_at),
    }),
    batchHelper.display({
      id: "error",
      header: "Detail",
      cell: ({ row }) =>
        row.original.error_message ? (
          <span className="text-sm text-destructive">
            {row.original.error_message}
          </span>
        ) : null,
      enableSorting: false,
    }),
  ];

  if (onViewRecords) {
    columns.push(
      batchHelper.display({
        id: "viewRecords",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            disabled={row.original.total_records <= 0}
            onClick={() => onViewRecords(row.original)}
          >
            <ListTree className="size-4" />
            View records
          </Button>
        ),
        enableSorting: false,
      }),
    );
  }

  return batchHelper.columns(columns);
}

const txHelper = createColumnHelper<
  DataTableFeatures,
  MastercardIPMTransaction
>();

function pdsColumn(
  tag: string,
  label: string,
  hint: string,
  currencyOf: (tx: MastercardIPMTransaction) => string | undefined,
) {
  return txHelper.accessor((row) => row.pds?.[tag] ?? "", {
    id: `pds_${tag}`,
    header: ({ column }) => (
      <span title={hint}>{sortableHeader(label, column)}</span>
    ),
    cell: ({ row }) =>
      formatPdsAmount(
        row.original.pds?.[tag],
        pdsExponent(row.original.pds, currencyOf(row.original)),
      ),
  });
}

export function buildTransactionColumns() {
  return txHelper.columns([
    txHelper.display({
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
    txHelper.accessor("message_type", {
      header: ({ column }) => sortableHeader("Type", column),
      cell: ({ row }) => {
        const raw = row.original.message_type;
        return (
          <span title={raw}>{MESSAGE_TYPE_LABELS[raw] ?? (raw || "—")}</span>
        );
      },
    }),
    txHelper.accessor("mti", {
      header: ({ column }) => sortableHeader("MTI", column),
      cell: ({ row }) => row.original.mti || "—",
    }),
    txHelper.accessor("function_code", {
      header: ({ column }) => sortableHeader("Function", column),
      cell: ({ row }) => {
        const code = row.original.function_code;
        const label = FUNCTION_LABELS[code];
        if (!code) return "—";
        return (
          <span title={label ? `${code} ${label}` : code}>
            {code}
            {label ? (
              <span className="ml-1 text-muted-foreground">{label}</span>
            ) : null}
          </span>
        );
      },
    }),
    txHelper.accessor("message_number", {
      header: ({ column }) => sortableHeader("Msg #", column),
      cell: ({ row }) => row.original.message_number || "—",
    }),
    txHelper.accessor("file_id", {
      header: ({ column }) => sortableHeader("File ID", column),
      cell: ({ row }) => (
        <span className="font-mono text-xs" title={row.original.file_id}>
          {row.original.file_id || "—"}
        </span>
      ),
    }),
    txHelper.display({
      id: "currency",
      header: "Currency",
      cell: ({ row }) => currencyLabel(row.original),
      enableSorting: false,
    }),
    txHelper.display({
      id: "institution",
      header: "Institution",
      cell: ({ row }) => institutionLabel(row.original),
      enableSorting: false,
    }),
    pdsColumn(
      "0380",
      "Debits",
      "PDS 0380 debits, transaction currency",
      (tx) => tx.currency_code,
    ),
    pdsColumn(
      "0381",
      "Credits",
      "PDS 0381 credits, transaction currency",
      (tx) => tx.currency_code,
    ),
    pdsColumn(
      "0384",
      "Net",
      "PDS 0384 net transaction amount, transaction currency",
      (tx) => tx.currency_code,
    ),
    pdsColumn(
      "0396",
      "Recon net",
      "PDS 0396 net total in reconciliation currency",
      (tx) => tx.settlement_currency || tx.currency_code,
    ),
    txHelper.accessor((row) => row.pds?.["0402"] ?? "", {
      id: "pds_0402",
      header: ({ column }) => (
        <span title="PDS 0402 total transaction count">
          {sortableHeader("Count", column)}
        </span>
      ),
      cell: ({ row }) => formatPdsCount(row.original.pds?.["0402"]),
    }),
    txHelper.accessor("transaction_date", {
      header: ({ column }) => sortableHeader("File date", column),
      cell: ({ row }) => displayTransactionDate(row.original),
    }),
    txHelper.accessor("created_at", {
      header: ({ column }) => sortableHeader("Ingested", column),
      cell: ({ row }) => displayTimestamp(row.original.created_at),
    }),
    txHelper.accessor("business_key", {
      header: ({ column }) => sortableHeader("Business key", column),
      cell: ({ row }) => (
        <span
          className="block max-w-48 truncate font-mono text-xs"
          title={row.original.business_key}
        >
          {row.original.business_key || "—"}
        </span>
      ),
    }),
    txHelper.accessor("acquirer_id", {
      header: ({ column }) => sortableHeader("Acquirer", column),
      cell: ({ row }) => row.original.acquirer_id || "—",
    }),
    txHelper.accessor("stan", {
      header: ({ column }) => sortableHeader("STAN", column),
      cell: ({ row }) => row.original.stan || "—",
    }),
    txHelper.accessor("pan", {
      header: ({ column }) => sortableHeader("PAN", column),
      cell: ({ row }) => row.original.pan || "—",
    }),
    txHelper.accessor("amount", {
      header: ({ column }) => sortableHeader("DE4 amount", column),
      cell: ({ row }) =>
        row.original.amount != null && row.original.amount !== 0
          ? formatMinorAmount(row.original.amount)
          : "—",
    }),
    txHelper.accessor("card_acceptor_name", {
      header: ({ column }) => sortableHeader("Acceptor", column),
      cell: ({ row }) => row.original.card_acceptor_name || "—",
    }),
    txHelper.accessor("terminal_id", {
      header: ({ column }) => sortableHeader("Terminal", column),
      cell: ({ row }) => row.original.terminal_id || "—",
    }),
  ]);
}

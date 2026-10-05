export type MastercardIPMBatchSummary = {
  id: string;
  file_name: string;
  file_id?: string;
  total_records: number;
  processed_at: string;
  status: "COMPLETED" | "FAILED" | "DUPLICATE" | string;
  error_message?: string;
  /** Records the file contained, and how many were actually new. */
  parsed_records?: number;
  inserted_records?: number;
  /** Records skipped because that business key was already stored. */
  duplicate_records?: number;
  /** Total ISO messages found in the file (incl. header/trailer). */
  parsed_messages?: number;
  created_at?: string;
  updated_at?: string;
};

export type MastercardIPMTransaction = {
  id: string;
  batch_id: string;
  business_key?: string;
  mti: string;
  function_code: string;
  message_number: string;
  message_type: string;
  file_id: string;
  file_name: string;
  created_at: string;
  updated_at: string;
  first_seen_batch_id?: string;
  last_seen_batch_id?: string;
  seen_count: number;
  message_reason_code?: string;
  destination_institution_id?: string;
  originator_institution_id?: string;
  acquirer_id?: string;
  currency_code?: string;
  settlement_currency?: string;
  /**
   * DE48 PDS tag -> value. Settlement rows keep amounts here rather than DE4:
   * 0380 debits, 0381 credits, 0384 net (transaction currency),
   * 0390-0396 reconciliation currency, 0400-0402 counts, 0148 exponents.
   */
  pds?: Record<string, string>;
  pan?: string;
  processing_code?: string;
  /** Amount in minor units (DE4). */
  amount?: number;
  transmission_date_time?: string;
  stan?: string;
  local_time?: string;
  local_date?: string;
  merchant_type?: string;
  pos_entry_mode?: string;
  terminal_id?: string;
  card_acceptor_id?: string;
  card_acceptor_name?: string;
  /** Empty string when the parser could not resolve a transaction date. */
  transaction_date?: string;
};

/**
 * Result of an upload.
 *
 * The endpoint answers 200 with the batch summary under `data`, while a 422
 * that parsed but could not be stored answers with it under `summary`. Both
 * are normalised to `summary` before reaching the UI.
 */
export type MastercardIPMUploadResult = {
  message?: string;
  error?: string;
  summary?: MastercardIPMBatchSummary;
};

/** The raw upload body, before normalisation. */
type MastercardIPMUploadBody = {
  message?: string;
  error?: string;
  data?: MastercardIPMBatchSummary;
  summary?: MastercardIPMBatchSummary;
};

/** Collapses the two response shapes into a single `summary` field. */
export function normaliseMastercardIPMUpload(
  body: MastercardIPMUploadBody | undefined,
  index = 0,
): MastercardIPMUploadResult {
  if (!body) {
    return {};
  }

  const summary = body.data ?? body.summary;

  return {
    message: body.message,
    error: body.error,
    summary: summary ? normaliseMastercardIPMBatch(summary, index) : undefined,
  };
}

/** Exported so the page can read a record count off any summary it is given. */
export function normaliseMastercardIPMBatch(
  batch: MastercardIPMBatchSummary,
  index: number,
): MastercardIPMBatchSummary {
  return {
    id: String(batch.id ?? "") || `batch-${index}`,
    file_name: String(batch.file_name ?? ""),
    file_id: batch.file_id ? String(batch.file_id) : "",
    total_records: Number(batch.total_records ?? 0),
    processed_at: String(batch.processed_at ?? ""),
    status: String(batch.status ?? ""),
    error_message: batch.error_message ? String(batch.error_message) : "",
    parsed_records: batch.parsed_records,
    inserted_records: batch.inserted_records,
    duplicate_records: batch.duplicate_records,
    parsed_messages: batch.parsed_messages,
    created_at: batch.created_at,
    updated_at: batch.updated_at,
  };
}
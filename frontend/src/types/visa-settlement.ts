export type VisaSettlementBatchSummary = {
  id: string;
  file_name: string;
  total_records: number;
  processed_at: string;
  status: "COMPLETED" | "FAILED" | "DUPLICATE" | string;
  error_message?: string;
  /** Records the file contained, and how many were actually new. */
  parsed_records?: number;
  inserted_records?: number;
  /** Records skipped because that transaction id was already stored. */
  duplicate_records?: number;
  created_at?: string;
  updated_at?: string;
};

export type VisaSettlementTransaction = {
  id: string;
  report_id: string;
  page_number: number;
  system_date: string;
  cpd: string;
  created_at: string;
  destination_identifier: string;
  source_identifier: string;
  record_identifier: string;
  tran_code: string;
  transaction_id: string;
  account_number: string;
  acquirer_ref_number: string;
  card_acceptor_id: string;
  terminal_id: string;
  source_amount: number;
  source_currency_code: string;
  settlement_amount: number;
  settlement_amount_sign: string;
  settlement_currency: string;
  /** Empty string when the parser could not resolve a purchase date. */
  transaction_date: string;
  interchange_fee_amount: number;
  interchange_fee_sign: string;
  merchant_name: string;
  merchant_category_code: string;
  fee_descriptor: string;
  bii_unique_file_id: string;
  purchase_date: string;
};

/**
 * Result of an upload.
 *
 * The endpoint is not consistent about where the batch summary sits: a success
 * answers 200 with it under `data`, while a 422 that parsed but could not be
 * stored answers with it under `summary`. Both are normalised to `summary`
 * before reaching the UI, so callers only ever read one field. Reading `data`
 * on the success path and `summary` on the failure path is what previously made
 * a successful upload report zero records.
 */
export type VisaSettlementUploadResult = {
  message?: string;
  error?: string;
  summary?: VisaSettlementBatchSummary;
};

/** The raw upload body, before normalisation. */
type VisaSettlementUploadBody = {
  message?: string;
  error?: string;
  data?: VisaSettlementBatchSummary;
  summary?: VisaSettlementBatchSummary;
};

/** Collapses the two response shapes into a single `summary` field. */
export function normaliseVisaSettlementUpload(
  body: VisaSettlementUploadBody | undefined,
  index = 0,
): VisaSettlementUploadResult {
  if (!body) {
    return {};
  }

  const summary = body.data ?? body.summary;

  return {
    message: body.message,
    error: body.error,
    summary: summary ? normaliseVisaSettlementBatch(summary, index) : undefined,
  };
}

/** Exported so the page can read a record count off any summary it is given. */
export function normaliseVisaSettlementBatch(
  batch: VisaSettlementBatchSummary,
  index: number,
): VisaSettlementBatchSummary {
  return {
    id: String(batch.id ?? "") || `batch-${index}`,
    file_name: String(batch.file_name ?? ""),
    total_records: Number(batch.total_records ?? 0),
    processed_at: String(batch.processed_at ?? ""),
    status: String(batch.status ?? ""),
    error_message: batch.error_message ? String(batch.error_message) : "",
    // These are absent on summaries written before re-upload detection existed,
    // so they stay undefined rather than becoming a misleading zero.
    parsed_records: batch.parsed_records,
    inserted_records: batch.inserted_records,
    duplicate_records: batch.duplicate_records,
    created_at: batch.created_at,
    updated_at: batch.updated_at,
  };
}

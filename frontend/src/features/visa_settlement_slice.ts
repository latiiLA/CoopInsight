import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import { RootState } from "../../app/store/store";
import {
  normaliseVisaSettlementBatch,
  normaliseVisaSettlementUpload,
  VisaSettlementBatchSummary,
  VisaSettlementTransaction,
  VisaSettlementUploadResult,
} from "@/types/visa-settlement";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import api from "@/lib/api";

interface VisaSettlementState {
  batches: VisaSettlementBatchSummary[];
  batchesLoading: boolean;
  batchesError: string | null;
  transactions: VisaSettlementTransaction[];
  transactionsLoading: boolean;
  transactionsError: string | null;
  uploadResult: VisaSettlementUploadResult | null;
  uploadSummary: VisaSettlementBatchSummary | null;
  uploadLoading: boolean;
  uploadError: string | null;
}

const initialState: VisaSettlementState = {
  batches: [],
  batchesLoading: false,
  batchesError: null,
  transactions: [],
  transactionsLoading: false,
  transactionsError: null,
  uploadResult: null,
  uploadSummary: null,
  uploadLoading: false,
  uploadError: null,
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown): string {
  return value == null ? "" : String(value);
}

function normalizeBatch(
  batch: VisaSettlementBatchSummary,
  index: number,
): VisaSettlementBatchSummary {
  return normaliseVisaSettlementBatch(batch, index);
}

function normalizeTransaction(
  tx: VisaSettlementTransaction,
  index: number,
): VisaSettlementTransaction {
  return {
    id: toText(tx.id) || `${toText(tx.transaction_id) || "row"}-${index}`,
    report_id: toText(tx.report_id),
    page_number: toNumber(tx.page_number),
    system_date: toText(tx.system_date),
    cpd: toText(tx.cpd),
    created_at: toText(tx.created_at),
    destination_identifier: toText(tx.destination_identifier),
    source_identifier: toText(tx.source_identifier),
    record_identifier: toText(tx.record_identifier),
    tran_code: toText(tx.tran_code),
    transaction_id: toText(tx.transaction_id),
    account_number: toText(tx.account_number),
    acquirer_ref_number: toText(tx.acquirer_ref_number),
    card_acceptor_id: toText(tx.card_acceptor_id),
    terminal_id: toText(tx.terminal_id),
    source_amount: toNumber(tx.source_amount),
    source_currency_code: toText(tx.source_currency_code),
    settlement_amount: toNumber(tx.settlement_amount),
    settlement_amount_sign: toText(tx.settlement_amount_sign),
    settlement_currency: toText(tx.settlement_currency),
    transaction_date: toText(tx.transaction_date),
    interchange_fee_amount: toNumber(tx.interchange_fee_amount),
    interchange_fee_sign: toText(tx.interchange_fee_sign),
    merchant_name: toText(tx.merchant_name),
    merchant_category_code: toText(tx.merchant_category_code),
    fee_descriptor: toText(tx.fee_descriptor),
    bii_unique_file_id: toText(tx.bii_unique_file_id),
    purchase_date: toText(tx.purchase_date),
  };
}

/**
 * These endpoints predate the app's response envelope and answer with a bare
 * `{ count, data }` or `{ message, data }` object, so the unwrap is per-thunk
 * rather than going through a shared helper.
 */
export const fetchVisaSettlementBatches = createAsyncThunk<
  VisaSettlementBatchSummary[],
  { limit?: number } | undefined,
  { state: RootState; rejectValue: string }
>("visaSettlement/fetchBatches", async (args, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      count: number;
      data: VisaSettlementBatchSummary[];
    }>("/visa-settlements/batches", {
      ...withAuthHeader(token),
      params: { limit: args?.limit ?? 20 },
      signal: thunkAPI.signal,
    });

    return (response.data.data ?? []).map(normalizeBatch);
  } catch (error) {
    if (
      thunkAPI.signal.aborted ||
      (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
    ) {
      throw error;
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

/**
 * Records captured by one upload. Preferred over a date range, because the
 * parsed transaction date comes from the file's own header and can fall outside
 * the range a user would think to search.
 */
export const fetchVisaSettlementBatchRecords = createAsyncThunk<
  VisaSettlementTransaction[],
  string,
  { state: RootState; rejectValue: string }
>("visaSettlement/fetchBatchRecords", async (batchId, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      count: number;
      data: VisaSettlementTransaction[];
    }>(
      `/visa-settlements/batches/${encodeURIComponent(batchId)}/transactions`,
      {
        ...withAuthHeader(token),
        signal: thunkAPI.signal,
      },
    );

    return (response.data.data ?? []).map(normalizeTransaction);
  } catch (error) {
    if (
      thunkAPI.signal.aborted ||
      (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
    ) {
      throw error;
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

/**
 * Finds records whose transaction id starts with the given text.
 *
 * A prefix search rather than an exact lookup, because the ids are long and are
 * usually read off a report, so a truncated one is the common case.
 */
export const searchVisaSettlementTransactions = createAsyncThunk<
  VisaSettlementTransaction[],
  string,
  { state: RootState; rejectValue: string }
>("visaSettlement/searchByTransactionId", async (query, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      count: number;
      data: VisaSettlementTransaction[];
    }>("/visa-settlements/transaction-search", {
      ...withAuthHeader(token),
      params: { query },
      signal: thunkAPI.signal,
    });

    return (response.data.data ?? []).map(normalizeTransaction);
  } catch (error) {
    if (
      thunkAPI.signal.aborted ||
      (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
    ) {
      throw error;
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchVisaSettlementTransactions = createAsyncThunk<
  VisaSettlementTransaction[],
  { start: string; end: string } | { accountNumber: string },
  { state: RootState; rejectValue: string }
>("visaSettlement/fetchTransactions", async (params, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const byAccount = "accountNumber" in params;
    const response = await api.get<{
      count: number;
      data: VisaSettlementTransaction[];
    }>(
      byAccount
        ? `/visa-settlements/accounts/${encodeURIComponent(params.accountNumber)}`
        : "/visa-settlements",
      {
        ...withAuthHeader(token),
        params: byAccount
          ? undefined
          : { start: params.start, end: params.end },
        signal: thunkAPI.signal,
      },
    );

    return (response.data.data ?? []).map(normalizeTransaction);
  } catch (error) {
    if (
      thunkAPI.signal.aborted ||
      (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
    ) {
      throw error;
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

/**
 * Uploads a settlement file.
 *
 * The endpoint returns the batch summary under `data` on success and under
 * `summary` on a 422, so both are normalised to one field before leaving the
 * thunk. Reading `summary` on the success path made every successful upload
 * report zero captured records even though the rows were in the database.
 */
export const uploadVisaSettlementFile = createAsyncThunk<
  VisaSettlementUploadResult,
  File,
  { state: RootState; rejectValue: VisaSettlementUploadResult }
>("visaSettlement/upload", async (file, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue({
        error: "Authentication token not found",
      });
    }

    const body = new FormData();
    body.append("file", file);

    const response = await api.post("/visa-settlements/upload", body, {
      ...withAuthHeader(token),
      // Content-Type is intentionally omitted so the browser sets the
      // multipart boundary itself.
      signal: thunkAPI.signal,
    });

    return normaliseVisaSettlementUpload(response.data);
  } catch (error) {
    if (
      thunkAPI.signal.aborted ||
      (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
    ) {
      throw error;
    }

    // Pull the endpoint's own message out of the error body so the UI can show
    // why a file was rejected rather than a generic failure.
    if (axios.isAxiosError(error)) {
      const body = normaliseVisaSettlementUpload(error.response?.data);
      if (body.error || body.summary) {
        return thunkAPI.rejectWithValue(body);
      }
    }

    return thunkAPI.rejectWithValue({ error: getErrorMessage(error) });
  }
});

const visaSettlementSlice = createSlice({
  name: "visaSettlement",
  initialState,
  reducers: {
    clearVisaSettlementUpload: (state) => {
      state.uploadResult = null;
      state.uploadSummary = null;
      state.uploadError = null;
    },
    clearVisaSettlementTransactions: (state) => {
      state.transactions = [];
      state.transactionsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVisaSettlementBatches.pending, (state) => {
        state.batchesLoading = true;
        state.batchesError = null;
      })
      .addCase(fetchVisaSettlementBatches.fulfilled, (state, action) => {
        state.batchesLoading = false;
        state.batches = action.payload;
      })
      .addCase(fetchVisaSettlementBatches.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.batchesLoading = false;
        state.batchesError =
          action.payload || "Failed to load settlement batches";
      })
      .addCase(fetchVisaSettlementTransactions.pending, (state) => {
        state.transactionsLoading = true;
        state.transactionsError = null;
      })
      .addCase(fetchVisaSettlementTransactions.fulfilled, (state, action) => {
        state.transactionsLoading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchVisaSettlementTransactions.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.transactionsLoading = false;
        state.transactions = [];
        state.transactionsError =
          action.payload || "Failed to load settlement records";
      })
      // Without these cases the request still fires and still succeeds, but the
      // records are discarded, so "View records" silently showed an empty table.
      .addCase(fetchVisaSettlementBatchRecords.pending, (state) => {
        state.transactionsLoading = true;
        state.transactionsError = null;
      })
      .addCase(fetchVisaSettlementBatchRecords.fulfilled, (state, action) => {
        state.transactionsLoading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchVisaSettlementBatchRecords.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.transactionsLoading = false;
        state.transactions = [];
        state.transactionsError =
          action.payload || "Failed to load the records for that file";
      })
      // Not dispatched by the page today, which filters through the table's own
      // search, but it is kept working so wiring it up later cannot repeat the
      // missing-reducer problem.
      .addCase(searchVisaSettlementTransactions.pending, (state) => {
        state.transactionsLoading = true;
        state.transactionsError = null;
      })
      .addCase(searchVisaSettlementTransactions.fulfilled, (state, action) => {
        state.transactionsLoading = false;
        state.transactions = action.payload;
      })
      .addCase(searchVisaSettlementTransactions.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.transactionsLoading = false;
        state.transactions = [];
        state.transactionsError =
          action.payload || "Failed to search settlement records";
      })
      .addCase(uploadVisaSettlementFile.pending, (state) => {
        state.uploadLoading = true;
        state.uploadError = null;
        state.uploadResult = null;
        state.uploadSummary = null;
      })
      .addCase(uploadVisaSettlementFile.fulfilled, (state, action) => {
        state.uploadLoading = false;
        state.uploadResult = action.payload;
        // The thunk already normalised the summary from whichever field the
        // endpoint used, so it is stored as-is.
        state.uploadSummary = action.payload.summary ?? null;
        state.uploadError = null;
      })
      .addCase(uploadVisaSettlementFile.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.uploadLoading = false;
        state.uploadResult = action.payload ?? null;
        state.uploadError =
          action.payload?.error || "Failed to process the settlement file";
        state.uploadSummary = action.payload?.summary ?? null;
      });
  },
});

export const { clearVisaSettlementUpload, clearVisaSettlementTransactions } =
  visaSettlementSlice.actions;

export default visaSettlementSlice.reducer;

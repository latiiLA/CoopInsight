import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import { RootState } from "../../app/store/store";
import {
  normaliseMastercardIPMBatch,
  normaliseMastercardIPMUpload,
  MastercardIPMBatchSummary,
  MastercardIPMTransaction,
  MastercardIPMUploadResult,
} from "@/types/mastercard-ipm";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import api from "@/lib/api";

interface MastercardIPMState {
  batches: MastercardIPMBatchSummary[];
  batchesLoading: boolean;
  batchesError: string | null;
  transactions: MastercardIPMTransaction[];
  transactionsLoading: boolean;
  transactionsError: string | null;
  uploadResult: MastercardIPMUploadResult | null;
  uploadSummary: MastercardIPMBatchSummary | null;
  uploadLoading: boolean;
  uploadError: string | null;
}

const initialState: MastercardIPMState = {
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
  batch: MastercardIPMBatchSummary,
  index: number,
): MastercardIPMBatchSummary {
  return normaliseMastercardIPMBatch(batch, index);
}

function normalizeTransaction(
  tx: MastercardIPMTransaction,
  index: number,
): MastercardIPMTransaction {
  const businessKey = toText(tx.business_key);
  const messageNumber = toText(tx.message_number);
  const stan = toText(tx.stan);

  return {
    id:
      toText(tx.id) ||
      businessKey ||
      `${messageNumber || stan || "row"}-${index}`,
    batch_id: toText(tx.batch_id),
    business_key: businessKey || undefined,
    mti: toText(tx.mti),
    function_code: toText(tx.function_code),
    message_number: messageNumber,
    message_type: toText(tx.message_type),
    file_id: toText(tx.file_id),
    file_name: toText(tx.file_name),
    created_at: toText(tx.created_at),
    updated_at: toText(tx.updated_at),
    first_seen_batch_id: tx.first_seen_batch_id
      ? toText(tx.first_seen_batch_id)
      : undefined,
    last_seen_batch_id: tx.last_seen_batch_id
      ? toText(tx.last_seen_batch_id)
      : undefined,
    seen_count: toNumber(tx.seen_count),
    message_reason_code: tx.message_reason_code
      ? toText(tx.message_reason_code)
      : undefined,
    destination_institution_id: tx.destination_institution_id
      ? toText(tx.destination_institution_id)
      : undefined,
    originator_institution_id: tx.originator_institution_id
      ? toText(tx.originator_institution_id)
      : undefined,
    acquirer_id: tx.acquirer_id ? toText(tx.acquirer_id) : undefined,
    currency_code: tx.currency_code ? toText(tx.currency_code) : undefined,
    settlement_currency: tx.settlement_currency
      ? toText(tx.settlement_currency)
      : undefined,
    pds: tx.pds && typeof tx.pds === "object" ? tx.pds : undefined,
    pan: tx.pan ? toText(tx.pan) : undefined,
    processing_code: tx.processing_code
      ? toText(tx.processing_code)
      : undefined,
    amount: tx.amount != null ? toNumber(tx.amount) : undefined,
    transmission_date_time: tx.transmission_date_time
      ? toText(tx.transmission_date_time)
      : undefined,
    stan: stan || undefined,
    local_time: tx.local_time ? toText(tx.local_time) : undefined,
    local_date: tx.local_date ? toText(tx.local_date) : undefined,
    merchant_type: tx.merchant_type ? toText(tx.merchant_type) : undefined,
    pos_entry_mode: tx.pos_entry_mode ? toText(tx.pos_entry_mode) : undefined,
    terminal_id: tx.terminal_id ? toText(tx.terminal_id) : undefined,
    card_acceptor_id: tx.card_acceptor_id
      ? toText(tx.card_acceptor_id)
      : undefined,
    card_acceptor_name: tx.card_acceptor_name
      ? toText(tx.card_acceptor_name)
      : undefined,
    transaction_date: tx.transaction_date
      ? toText(tx.transaction_date)
      : undefined,
  };
}

/**
 * These endpoints answer with a bare `{ count, data }` or `{ message, data }`
 * object, so the unwrap is per-thunk rather than going through a shared helper.
 */
export const fetchMastercardIPMBatches = createAsyncThunk<
  MastercardIPMBatchSummary[],
  { limit?: number } | undefined,
  { state: RootState; rejectValue: string }
>("mastercardIPM/fetchBatches", async (args, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      count: number;
      data: MastercardIPMBatchSummary[];
    }>("/mastercard-ipm/batches", {
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
 * Records captured by one upload. Preferred over a date range, because summary
 * messages often have no transaction date and financial dates come from the
 * file itself.
 */
export const fetchMastercardIPMBatchRecords = createAsyncThunk<
  MastercardIPMTransaction[],
  string,
  { state: RootState; rejectValue: string }
>("mastercardIPM/fetchBatchRecords", async (batchId, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      count: number;
      data: MastercardIPMTransaction[];
    }>(`/mastercard-ipm/batches/${encodeURIComponent(batchId)}/transactions`, {
      ...withAuthHeader(token),
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

/**
 * Finds records whose STAN starts with the given text.
 *
 * Useful for financial presentments; settlement summaries often have an empty
 * STAN, so the page also relies on table search over message_number / file_id.
 */
export const searchMastercardIPMBySTAN = createAsyncThunk<
  MastercardIPMTransaction[],
  string,
  { state: RootState; rejectValue: string }
>("mastercardIPM/searchBySTAN", async (query, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      count: number;
      data: MastercardIPMTransaction[];
    }>("/mastercard-ipm/stan-search", {
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

export const fetchMastercardIPMTransactions = createAsyncThunk<
  MastercardIPMTransaction[],
  { start: string; end: string } | { pan: string },
  { state: RootState; rejectValue: string }
>("mastercardIPM/fetchTransactions", async (params, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const byPan = "pan" in params;
    const response = await api.get<{
      count: number;
      data: MastercardIPMTransaction[];
    }>(
      byPan
        ? `/mastercard-ipm/pans/${encodeURIComponent(params.pan)}`
        : "/mastercard-ipm",
      {
        ...withAuthHeader(token),
        params: byPan ? undefined : { start: params.start, end: params.end },
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
 * Uploads a Mastercard IPM clearing/settlement file.
 *
 * The endpoint returns the batch summary under `data` on success and under
 * `summary` on a 422, so both are normalised to one field before leaving the
 * thunk.
 */
export const uploadMastercardIPMFile = createAsyncThunk<
  MastercardIPMUploadResult,
  File,
  { state: RootState; rejectValue: MastercardIPMUploadResult }
>("mastercardIPM/upload", async (file, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue({
        error: "Authentication token not found",
      });
    }

    const body = new FormData();
    body.append("file", file);

    const response = await api.post("/mastercard-ipm/upload", body, {
      ...withAuthHeader(token),
      // Content-Type is intentionally omitted so the browser sets the
      // multipart boundary itself.
      signal: thunkAPI.signal,
    });

    return normaliseMastercardIPMUpload(response.data);
  } catch (error) {
    if (
      thunkAPI.signal.aborted ||
      (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
    ) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const body = normaliseMastercardIPMUpload(error.response?.data);
      if (body.error || body.summary) {
        return thunkAPI.rejectWithValue(body);
      }
    }

    return thunkAPI.rejectWithValue({ error: getErrorMessage(error) });
  }
});

const mastercardIPMSlice = createSlice({
  name: "mastercardIPM",
  initialState,
  reducers: {
    clearMastercardIPMUpload: (state) => {
      state.uploadResult = null;
      state.uploadSummary = null;
      state.uploadError = null;
    },
    clearMastercardIPMTransactions: (state) => {
      state.transactions = [];
      state.transactionsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMastercardIPMBatches.pending, (state) => {
        state.batchesLoading = true;
        state.batchesError = null;
      })
      .addCase(fetchMastercardIPMBatches.fulfilled, (state, action) => {
        state.batchesLoading = false;
        state.batches = action.payload;
      })
      .addCase(fetchMastercardIPMBatches.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.batchesLoading = false;
        state.batchesError =
          action.payload || "Failed to load Mastercard IPM batches";
      })
      .addCase(fetchMastercardIPMTransactions.pending, (state) => {
        state.transactionsLoading = true;
        state.transactionsError = null;
      })
      .addCase(fetchMastercardIPMTransactions.fulfilled, (state, action) => {
        state.transactionsLoading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchMastercardIPMTransactions.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.transactionsLoading = false;
        state.transactions = [];
        state.transactionsError =
          action.payload || "Failed to load Mastercard IPM records";
      })
      .addCase(fetchMastercardIPMBatchRecords.pending, (state) => {
        state.transactionsLoading = true;
        state.transactionsError = null;
      })
      .addCase(fetchMastercardIPMBatchRecords.fulfilled, (state, action) => {
        state.transactionsLoading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchMastercardIPMBatchRecords.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.transactionsLoading = false;
        state.transactions = [];
        state.transactionsError =
          action.payload || "Failed to load the records for that file";
      })
      .addCase(searchMastercardIPMBySTAN.pending, (state) => {
        state.transactionsLoading = true;
        state.transactionsError = null;
      })
      .addCase(searchMastercardIPMBySTAN.fulfilled, (state, action) => {
        state.transactionsLoading = false;
        state.transactions = action.payload;
      })
      .addCase(searchMastercardIPMBySTAN.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.transactionsLoading = false;
        state.transactions = [];
        state.transactionsError =
          action.payload || "Failed to search Mastercard IPM records";
      })
      .addCase(uploadMastercardIPMFile.pending, (state) => {
        state.uploadLoading = true;
        state.uploadError = null;
        state.uploadResult = null;
        state.uploadSummary = null;
      })
      .addCase(uploadMastercardIPMFile.fulfilled, (state, action) => {
        state.uploadLoading = false;
        state.uploadResult = action.payload;
        state.uploadSummary = action.payload.summary ?? null;
        state.uploadError = null;
      })
      .addCase(uploadMastercardIPMFile.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.uploadLoading = false;
        state.uploadResult = action.payload ?? null;
        state.uploadError =
          action.payload?.error || "Failed to process the Mastercard IPM file";
        state.uploadSummary = action.payload?.summary ?? null;
      });
  },
});

export const { clearMastercardIPMUpload, clearMastercardIPMTransactions } =
  mastercardIPMSlice.actions;

export default mastercardIPMSlice.reducer;
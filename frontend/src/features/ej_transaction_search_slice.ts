import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import { RootState } from "../../app/store/store";
import api from "@/lib/api";
import type {
  EJJournalFileView,
  EJJournalView,
  EJTransaction,
  EJTransactionSearchArgs,
  EJTransactionSearchResult,
} from "@/types/ej-transaction-search";
import { ejTransactionId } from "@/types/ej-transaction-search";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";

export const EJ_TXN_SEARCH_PAGE_SIZE = 100;

interface EJTxnSearchState {
  items: EJTransaction[];
  submitted: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  requestId: string | null;
  lastArgs: EJTransactionSearchArgs | null;
  journal: EJJournalView | null;
  journalLoading: boolean;
  journalError: string | null;
  journalFile: EJJournalFileView | null;
  journalFileLoading: boolean;
  journalFileError: string | null;
}

const initialState: EJTxnSearchState = {
  items: [],
  submitted: false,
  loading: false,
  loadingMore: false,
  error: null,
  page: 0,
  hasMore: false,
  requestId: null,
  lastArgs: null,
  journal: null,
  journalLoading: false,
  journalError: null,
  journalFile: null,
  journalFileLoading: false,
  journalFileError: null,
};

function toParams(args: EJTransactionSearchArgs) {
  const page = args.page ?? 1;
  const status = args.status?.trim().toUpperCase();
  const customerAccount = args.customerAccount?.trim();
  return {
    ...(args.dateFrom ? { dateFrom: args.dateFrom } : {}),
    ...(args.dateTo ? { dateTo: args.dateTo } : {}),
    ...(args.card?.trim() ? { card: args.card.trim() } : {}),
    ...(args.cardFirst4?.trim() ? { cardFirst4: args.cardFirst4.trim() } : {}),
    ...(args.cardLast4?.trim() ? { cardLast4: args.cardLast4.trim() } : {}),
    ...(args.terminal?.trim() ? { terminal: args.terminal.trim() } : {}),
    ...(args.authNum?.trim() ? { authNum: args.authNum.trim() } : {}),
    ...(status === "SUCCESS" || status === "FAILED" ? { status } : {}),
    ...(args.amount != null && Number.isFinite(args.amount)
      ? { amount: args.amount }
      : {}),
    ...(customerAccount ? { customerAccount } : {}),
    page,
    pageSize: args.pageSize ?? EJ_TXN_SEARCH_PAGE_SIZE,
  };
}

function isCanceled(
  thunkAPI: { signal: AbortSignal },
  error: unknown,
): boolean {
  return (
    thunkAPI.signal.aborted ||
    (axios.isCancel?.(error) ?? false) ||
    (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
  );
}

export const fetchEJTransactionSearch = createAsyncThunk<
  EJTransactionSearchResult,
  EJTransactionSearchArgs,
  { state: RootState; rejectValue: string }
>("ejTransactionSearch/fetch", async (args, thunkAPI) => {
  const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
  if (!token) {
    return thunkAPI.rejectWithValue("Authentication token not found");
  }
  try {
    const response = await api.get<{ data: EJTransactionSearchResult }>(
      "/reports/ej-transactions/search",
      {
        ...withAuthHeader(token),
        params: toParams(args),
        signal: thunkAPI.signal,
      },
    );
    return (
      response.data.data ?? {
        page: args.page ?? 1,
        pageSize: args.pageSize ?? EJ_TXN_SEARCH_PAGE_SIZE,
        hasMore: false,
        items: [],
      }
    );
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      return thunkAPI.rejectWithValue("canceled");
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchEJJournal = createAsyncThunk<
  EJJournalView,
  string,
  { state: RootState; rejectValue: string }
>("ejTransactionSearch/journal", async (id, thunkAPI) => {
  const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
  if (!token) {
    return thunkAPI.rejectWithValue("Authentication token not found");
  }
  const trimmed = id.trim();
  if (!trimmed) {
    return thunkAPI.rejectWithValue("Transaction id is required");
  }
  try {
    const response = await api.get<{ data: EJJournalView }>(
      `/reports/ej-transactions/${encodeURIComponent(trimmed)}/journal`,
      {
        ...withAuthHeader(token),
        signal: thunkAPI.signal,
      },
    );
    if (!response.data.data?.rawText) {
      return thunkAPI.rejectWithValue(
        "Journal text is not available for this row yet",
      );
    }
    return response.data.data;
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      return thunkAPI.rejectWithValue("canceled");
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchEJJournalFile = createAsyncThunk<
  EJJournalFileView,
  string,
  { state: RootState; rejectValue: string }
>("ejTransactionSearch/journalFile", async (id, thunkAPI) => {
  const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
  if (!token) {
    return thunkAPI.rejectWithValue("Authentication token not found");
  }
  const trimmed = id.trim();
  if (!trimmed) {
    return thunkAPI.rejectWithValue("Transaction id is required");
  }
  try {
    const response = await api.get<{ data: EJJournalFileView }>(
      `/reports/ej-transactions/${encodeURIComponent(trimmed)}/journal-file`,
      {
        ...withAuthHeader(token),
        signal: thunkAPI.signal,
      },
    );
    if (!response.data.data) {
      return thunkAPI.rejectWithValue("Journal file could not be opened");
    }
    return response.data.data;
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      return thunkAPI.rejectWithValue("canceled");
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

const ejTransactionSearchSlice = createSlice({
  name: "ejTransactionSearch",
  initialState,
  reducers: {
    clearEJTransactionSearch(state) {
      Object.assign(state, initialState);
    },
    clearEJJournal(state) {
      state.journal = null;
      state.journalLoading = false;
      state.journalError = null;
      state.journalFile = null;
      state.journalFileLoading = false;
      state.journalFileError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEJTransactionSearch.pending, (state, action) => {
        const page = action.meta.arg.page ?? 1;
        state.submitted = true;
        state.error = null;
        state.requestId = action.meta.requestId;
        state.lastArgs = action.meta.arg;
        if (page <= 1) {
          state.loading = true;
          state.loadingMore = false;
          state.items = [];
          state.page = 0;
          state.hasMore = false;
        } else {
          state.loadingMore = true;
        }
      })
      .addCase(fetchEJTransactionSearch.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        const page = action.payload.page;
        state.loading = false;
        state.loadingMore = false;
        state.page = page;
        state.hasMore = action.payload.hasMore;
        const rows = action.payload.items ?? [];
        state.items = page <= 1 ? rows : [...state.items, ...rows];
      })
      .addCase(fetchEJTransactionSearch.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        if (action.payload === "canceled") return;
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload || "Search failed";
      })
      .addCase(fetchEJJournal.pending, (state) => {
        state.journalLoading = true;
        state.journalError = null;
      })
      .addCase(fetchEJJournal.fulfilled, (state, action) => {
        state.journalLoading = false;
        state.journal = action.payload;
        state.journalError = null;
        // Backfill locate fields onto the search row (older CRM/NCR index rows).
        const j = action.payload;
        const id = j.id;
        const idx = state.items.findIndex((row) => ejTransactionId(row) === id);
        if (idx >= 0) {
          const row = state.items[idx];
          state.items[idx] = {
            ...row,
            rawText: j.rawText || row.rawText,
            lineStart: j.lineStart || row.lineStart,
            lineEnd: j.lineEnd || row.lineEnd,
            path: j.path || row.path,
            fileOffset: j.fileOffset ?? row.fileOffset,
          };
        }
      })
      .addCase(fetchEJJournal.rejected, (state, action) => {
        if (action.payload === "canceled") return;
        state.journalLoading = false;
        state.journal = null;
        state.journalError = action.payload || "Could not open journal";
      })
      .addCase(fetchEJJournalFile.pending, (state) => {
        state.journalFileLoading = true;
        state.journalFileError = null;
      })
      .addCase(fetchEJJournalFile.fulfilled, (state, action) => {
        state.journalFileLoading = false;
        state.journalFile = action.payload;
        state.journalFileError = null;
      })
      .addCase(fetchEJJournalFile.rejected, (state, action) => {
        if (action.payload === "canceled") return;
        state.journalFileLoading = false;
        state.journalFile = null;
        state.journalFileError =
          action.payload || "Could not open journal file";
      });
  },
});

export const { clearEJTransactionSearch, clearEJJournal } =
  ejTransactionSearchSlice.actions;
export default ejTransactionSearchSlice.reducer;

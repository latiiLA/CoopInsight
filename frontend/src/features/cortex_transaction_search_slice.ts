import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import { RootState } from "../../app/store/store";
import api from "@/lib/api";
import type {
  CortexTransaction,
  CortexTransactionDetail,
  CortexTransactionSearchArgs,
  CortexTransactionSearchResult,
} from "@/types/cortex-transaction-search";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";

export const CORTEX_TXN_SEARCH_PAGE_SIZE = 100;

interface CortexTxnSearchState {
  items: CortexTransaction[];
  submitted: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  requestId: string | null;
  lastArgs: CortexTransactionSearchArgs | null;
  detail: CortexTransactionDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  detailRequestId: string | null;
}

const initialState: CortexTxnSearchState = {
  items: [],
  submitted: false,
  loading: false,
  loadingMore: false,
  error: null,
  page: 0,
  hasMore: false,
  requestId: null,
  lastArgs: null,
  detail: null,
  detailLoading: false,
  detailError: null,
  detailRequestId: null,
};

function toParams(args: CortexTransactionSearchArgs) {
  const page = args.page ?? 1;
  return {
    ...(args.dateFrom ? { dateFrom: args.dateFrom } : {}),
    ...(args.dateTo ? { dateTo: args.dateTo } : {}),
    ...(args.product?.trim() ? { product: args.product.trim() } : {}),
    ...(args.card?.trim() ? { card: args.card.trim() } : {}),
    ...(args.cardholder?.trim() ? { cardholder: args.cardholder.trim() } : {}),
    ...(args.branch?.trim() ? { branch: args.branch.trim() } : {}),
    ...(args.q?.trim() ? { q: args.q.trim() } : {}),
    ...(args.rrn?.trim() ? { rrn: args.rrn.trim() } : {}),
    ...(args.merchant?.trim() ? { merchant: args.merchant.trim() } : {}),
    ...(args.terminal?.trim() ? { terminal: args.terminal.trim() } : {}),
    ...(args.txnCode?.trim() ? { txnCode: args.txnCode.trim() } : {}),
    ...(args.tlogId != null &&
    Number.isFinite(args.tlogId) &&
    args.tlogId > 0
      ? { tlogId: args.tlogId }
      : {}),
    ...(args.stan?.trim() ? { stan: args.stan.trim() } : {}),
    ...(args.account?.trim() ? { account: args.account.trim() } : {}),
    ...(args.approvalCode?.trim()
      ? { approvalCode: args.approvalCode.trim() }
      : {}),
    ...(args.rspCode?.trim() ? { rspCode: args.rspCode.trim() } : {}),
    ...(args.currency?.trim() ? { currency: args.currency.trim() } : {}),
    ...(args.mcc?.trim() ? { mcc: args.mcc.trim() } : {}),
    ...(args.acquiringCountry?.trim()
      ? { acquiringCountry: args.acquiringCountry.trim() }
      : {}),
    ...(args.result ? { result: args.result } : {}),
    ...(args.reversal ? { reversal: args.reversal } : {}),
    ...(args.amountMin != null && !Number.isNaN(args.amountMin)
      ? { amountMin: args.amountMin }
      : {}),
    ...(args.amountMax != null && !Number.isNaN(args.amountMax)
      ? { amountMax: args.amountMax }
      : {}),
    page,
    pageSize: args.pageSize ?? CORTEX_TXN_SEARCH_PAGE_SIZE,
  };
}

function isCanceled(
  thunkAPI: { signal: AbortSignal },
  error: unknown,
): boolean {
  return (
    thunkAPI.signal.aborted ||
    axios.isCancel(error) ||
    (axios.isAxiosError(error) &&
      error.code === "ERR_CANCELED" &&
      !error.response)
  );
}

export const fetchCortexTransactionDetail = createAsyncThunk<
  CortexTransactionDetail,
  { tlogId: number },
  { rejectValue: string; state: RootState }
>("cortexTxnSearch/fetchDetail", async ({ tlogId }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }
    const response = await api.get<{ data: CortexTransactionDetail }>(
      `/reports/cortex-transactions/${tlogId}`,
      {
        ...withAuthHeader(token),
        signal: thunkAPI.signal,
        timeout: 60_000,
      },
    );
    return response.data.data;
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      throw error;
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchCortexTransactionSearch = createAsyncThunk<
  CortexTransactionSearchResult & { append: boolean },
  CortexTransactionSearchArgs & { append?: boolean },
  { rejectValue: string; state: RootState }
>("cortexTxnSearch/fetch", async ({ append = false, ...args }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }
    const response = await api.get<{ data: CortexTransactionSearchResult }>(
      "/reports/cortex-transactions/search",
      {
        ...withAuthHeader(token),
        params: toParams(args),
        signal: thunkAPI.signal,
        timeout: 180_000,
      },
    );
    const payload = response.data.data;
    return {
      page: payload?.page ?? args.page ?? 1,
      pageSize: payload?.pageSize ?? CORTEX_TXN_SEARCH_PAGE_SIZE,
      hasMore: Boolean(payload?.hasMore),
      items: payload?.items ?? [],
      append,
    };
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      throw error;
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

const cortexTxnSearchSlice = createSlice({
  name: "cortexTxnSearch",
  initialState,
  reducers: {
    clearCortexTransactionSearch(state) {
      Object.assign(state, initialState);
    },
    clearCortexTransactionDetail(state) {
      state.detail = null;
      state.detailLoading = false;
      state.detailError = null;
      state.detailRequestId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCortexTransactionSearch.pending, (state, action) => {
        state.error = null;
        state.requestId = action.meta.requestId;
        state.submitted = true;
        {
          const { append: _append, ...rest } = action.meta.arg;
          state.lastArgs = rest;
        }
        if (action.meta.arg.append) {
          state.loadingMore = true;
        } else {
          state.loading = true;
          state.loadingMore = false;
          state.items = [];
          state.page = 0;
          state.hasMore = false;
        }
      })
      .addCase(fetchCortexTransactionSearch.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) {
          return;
        }
        state.loading = false;
        state.loadingMore = false;
        state.page = action.payload.page;
        state.hasMore = action.payload.hasMore;
        if (action.payload.append) {
          state.items = state.items.concat(action.payload.items);
        } else {
          state.items = action.payload.items;
        }
      })
      .addCase(fetchCortexTransactionSearch.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) {
          return;
        }
        state.loading = false;
        state.loadingMore = false;
        if (!action.meta.arg.append) {
          state.items = [];
        }
        if (!action.meta.aborted) {
          state.error = action.payload ?? "Search failed";
        }
      })

      .addCase(fetchCortexTransactionDetail.pending, (state, action) => {
        state.detailLoading = true;
        state.detailError = null;
        state.detailRequestId = action.meta.requestId;
        state.detail = null;
      })
      .addCase(fetchCortexTransactionDetail.fulfilled, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) {
          return;
        }
        state.detailLoading = false;
        state.detail = action.payload;
      })
      .addCase(fetchCortexTransactionDetail.rejected, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) {
          return;
        }
        state.detailLoading = false;
        state.detail = null;
        if (!action.meta.aborted) {
          state.detailError = action.payload ?? "Failed to load detail";
        }
      });
  },
});

export const {
  clearCortexTransactionSearch,
  clearCortexTransactionDetail,
} = cortexTxnSearchSlice.actions;
export default cortexTxnSearchSlice.reducer;

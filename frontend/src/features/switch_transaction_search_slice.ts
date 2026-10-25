import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import { RootState } from "../../app/store/store";
import api from "@/lib/api";
import type {
  SwitchTransaction,
  SwitchTransactionDetail,
  SwitchTransactionSearchArgs,
  SwitchTransactionSearchResult,
} from "@/types/switch-transaction-search";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";

export const SWITCH_TXN_SEARCH_PAGE_SIZE = 100;

interface SwitchTxnSearchState {
  items: SwitchTransaction[];
  submitted: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  hasMoreOlder: boolean;
  appliedDateFrom: string | null;
  appliedDateTo: string | null;
  requestId: string | null;
  lastArgs: SwitchTransactionSearchArgs | null;
  detail: SwitchTransactionDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  detailRequestId: string | null;
}

const initialState: SwitchTxnSearchState = {
  items: [],
  submitted: false,
  loading: false,
  loadingMore: false,
  error: null,
  page: 0,
  hasMore: false,
  hasMoreOlder: false,
  appliedDateFrom: null,
  appliedDateTo: null,
  requestId: null,
  lastArgs: null,
  detail: null,
  detailLoading: false,
  detailError: null,
  detailRequestId: null,
};

function toParams(args: SwitchTransactionSearchArgs) {
  const page = args.page ?? 1;
  return {
    ...(args.dateFrom ? { dateFrom: args.dateFrom } : {}),
    ...(args.dateTo ? { dateTo: args.dateTo } : {}),
    ...(args.product?.trim() ? { product: args.product.trim() } : {}),
    ...(args.card?.trim() ? { card: args.card.trim() } : {}),
    ...(args.q?.trim() ? { q: args.q.trim() } : {}),
    ...(args.rrn?.trim() ? { rrn: args.rrn.trim() } : {}),
    ...(args.merchant?.trim() ? { merchant: args.merchant.trim() } : {}),
    ...(args.terminal?.trim() ? { terminal: args.terminal.trim() } : {}),
    ...(args.txnCode?.trim() ? { txnCode: args.txnCode.trim() } : {}),
    ...(args.trace?.trim() ? { trace: args.trace.trim() } : {}),
    ...(args.account?.trim() ? { account: args.account.trim() } : {}),
    ...(args.approvalCode?.trim()
      ? { approvalCode: args.approvalCode.trim() }
      : {}),
    ...(args.rspCode?.trim() ? { rspCode: args.rspCode.trim() } : {}),
    ...(args.issuerCurrency?.trim()
      ? { issuerCurrency: args.issuerCurrency.trim() }
      : {}),
    ...(args.acquirerCurrency?.trim()
      ? { acquirerCurrency: args.acquirerCurrency.trim() }
      : {}),
    ...(args.mcc?.trim() ? { mcc: args.mcc.trim() } : {}),
    ...(args.acquiringCountry?.trim()
      ? { acquiringCountry: args.acquiringCountry.trim() }
      : {}),
    ...(args.acquirer?.trim() ? { acquirer: args.acquirer.trim() } : {}),
    ...(args.routeId?.trim() ? { routeId: args.routeId.trim() } : {}),
    ...(args.routeMatch ? { routeMatch: args.routeMatch } : {}),
    ...(args.channel ? { channel: args.channel } : {}),
    ...(args.msgType?.trim() ? { msgType: args.msgType.trim() } : {}),
    ...(args.result ? { result: args.result } : {}),
    ...(args.reversal ? { reversal: args.reversal } : {}),
    ...(args.amountMin != null && !Number.isNaN(args.amountMin)
      ? { amountMin: args.amountMin }
      : {}),
    ...(args.amountMax != null && !Number.isNaN(args.amountMax)
      ? { amountMax: args.amountMax }
      : {}),
    ...(args.lookupWindow ? { lookupWindow: "1" } : {}),
    page,
    pageSize: args.pageSize ?? SWITCH_TXN_SEARCH_PAGE_SIZE,
  };
}

/** Normalize API echo (MM-DD-YYYY) back to query form (MM/dd/yyyy). */
function echoDateToParam(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const m = raw.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (!m) return raw.trim();
  return `${m[1]}/${m[2]}/${m[3]}`;
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

export const fetchSwitchTransactionDetail = createAsyncThunk<
  SwitchTransactionDetail,
  { rowId: string },
  { rejectValue: string; state: RootState }
>("switchTxnSearch/fetchDetail", async ({ rowId }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }
    const response = await api.get<{ data: SwitchTransactionDetail }>(
      `/reports/switch-transactions/${encodeURIComponent(rowId)}`,
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

export const fetchSwitchTransactionSearch = createAsyncThunk<
  SwitchTransactionSearchResult & { append: boolean },
  SwitchTransactionSearchArgs & { append?: boolean },
  { rejectValue: string; state: RootState }
>("switchTxnSearch/fetch", async ({ append = false, ...args }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }
    const response = await api.get<{ data: SwitchTransactionSearchResult }>(
      "/reports/switch-transactions/search",
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
      pageSize: payload?.pageSize ?? SWITCH_TXN_SEARCH_PAGE_SIZE,
      hasMore: Boolean(payload?.hasMore),
      hasMoreOlder: Boolean(payload?.hasMoreOlder),
      dateFrom: payload?.dateFrom ?? args.dateFrom,
      dateTo: payload?.dateTo ?? args.dateTo,
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

const switchTxnSearchSlice = createSlice({
  name: "switchTxnSearch",
  initialState,
  reducers: {
    clearSwitchTransactionSearch(state) {
      Object.assign(state, initialState);
    },
    clearSwitchTransactionDetail(state) {
      state.detail = null;
      state.detailLoading = false;
      state.detailError = null;
      state.detailRequestId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSwitchTransactionSearch.pending, (state, action) => {
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
          state.hasMoreOlder = false;
          state.appliedDateFrom = null;
          state.appliedDateTo = null;
        }
      })
      .addCase(fetchSwitchTransactionSearch.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) {
          return;
        }
        state.loading = false;
        state.loadingMore = false;
        state.page = action.payload.page;
        state.hasMore = action.payload.hasMore;
        state.hasMoreOlder = action.payload.hasMoreOlder;
        state.appliedDateFrom = action.payload.dateFrom ?? null;
        state.appliedDateTo = action.payload.dateTo ?? null;
        if (state.lastArgs && (action.payload.dateFrom || action.payload.dateTo)) {
          state.lastArgs = {
            ...state.lastArgs,
            dateFrom:
              echoDateToParam(action.payload.dateFrom) ??
              state.lastArgs.dateFrom,
            dateTo:
              echoDateToParam(action.payload.dateTo) ?? state.lastArgs.dateTo,
            page: action.payload.page,
          };
        }
        if (action.payload.append) {
          state.items = state.items.concat(action.payload.items);
        } else {
          state.items = action.payload.items;
        }
      })
      .addCase(fetchSwitchTransactionSearch.rejected, (state, action) => {
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

      .addCase(fetchSwitchTransactionDetail.pending, (state, action) => {
        state.detailLoading = true;
        state.detailError = null;
        state.detailRequestId = action.meta.requestId;
        state.detail = null;
      })
      .addCase(fetchSwitchTransactionDetail.fulfilled, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) {
          return;
        }
        state.detailLoading = false;
        state.detail = action.payload;
      })
      .addCase(fetchSwitchTransactionDetail.rejected, (state, action) => {
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
  clearSwitchTransactionSearch,
  clearSwitchTransactionDetail,
} = switchTxnSearchSlice.actions;
export default switchTxnSearchSlice.reducer;

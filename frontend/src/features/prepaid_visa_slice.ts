import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import axios from "axios";

import { RootState } from "../../app/store/store";
import api from "@/lib/api";
import {
  PrepaidVisaCardActivity,
  PrepaidVisaDashboard,
  PrepaidVisaPage,
  PrepaidVisaProductFilter,
  PrepaidVisaReconcileReport,
  PrepaidVisaSearchArgs,
  PrepaidVisaSearchKind,
  PrepaidVisaSearchResult,
  PrepaidVisaTopUp,
  PrepaidVisaTransaction,
  PrepaidVisaUnload,
} from "@/types/prepaid-visa";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import {
  CLEARING_MAX_AUTO_PAGES,
  CLEARING_PAGE_SIZE,
} from "./clearing_constants";

export { CLEARING_MAX_AUTO_PAGES, CLEARING_PAGE_SIZE } from "./clearing_constants";

type RangeArgs = {
  dateFrom?: string;
  dateTo?: string;
  product?: PrepaidVisaProductFilter;
  page?: number;
};

interface PrepaidVisaState {
  dashboard: PrepaidVisaDashboard | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  dashboardRequestId: string | null;

  topUps: PrepaidVisaTopUp[];
  topUpsLoading: boolean;
  topUpsLoadingMore: boolean;
  topUpsError: string | null;
  topUpsPage: number;
  topUpsHasMore: boolean;
  topUpsTruncated: boolean;

  unloads: PrepaidVisaUnload[];
  unloadsLoading: boolean;
  unloadsLoadingMore: boolean;
  unloadsError: string | null;
  unloadsPage: number;
  unloadsHasMore: boolean;
  unloadsTruncated: boolean;

  transactions: PrepaidVisaTransaction[];
  transactionsLoading: boolean;
  transactionsLoadingMore: boolean;
  transactionsError: string | null;
  transactionsPage: number;
  transactionsHasMore: boolean;
  transactionsTruncated: boolean;

  searchKind: PrepaidVisaSearchKind;
  searchSubmitted: boolean;
  searchTransactions: PrepaidVisaTransaction[];
  searchTopUps: PrepaidVisaTopUp[];
  searchUnloads: PrepaidVisaUnload[];
  searchLoading: boolean;
  searchError: string | null;
  searchPage: number;
  searchHasMore: boolean;
  searchRequestId: string | null;

  reconcile: PrepaidVisaReconcileReport | null;
  reconcileLoading: boolean;
  reconcileError: string | null;
  reconcileRequestId: string | null;

  cardActivity: PrepaidVisaCardActivity | null;
  cardActivityLoading: boolean;
  cardActivityLoadingMore: boolean;
  cardActivityError: string | null;
  cardActivityRequestId: string | null;
  cardActivityTopUpPage: number;
  cardActivityUnloadPage: number;
  cardActivityLedgerPage: number;
  cardActivityTxnPage: number;
}

const initialState: PrepaidVisaState = {
  dashboard: null,
  dashboardLoading: false,
  dashboardError: null,
  dashboardRequestId: null,

  topUps: [],
  topUpsLoading: false,
  topUpsLoadingMore: false,
  topUpsError: null,
  topUpsPage: 0,
  topUpsHasMore: false,
  topUpsTruncated: false,

  unloads: [],
  unloadsLoading: false,
  unloadsLoadingMore: false,
  unloadsError: null,
  unloadsPage: 0,
  unloadsHasMore: false,
  unloadsTruncated: false,

  transactions: [],
  transactionsLoading: false,
  transactionsLoadingMore: false,
  transactionsError: null,
  transactionsPage: 0,
  transactionsHasMore: false,
  transactionsTruncated: false,

  searchKind: "transactions",
  searchSubmitted: false,
  searchTransactions: [],
  searchTopUps: [],
  searchUnloads: [],
  searchLoading: false,
  searchError: null,
  searchPage: 0,
  searchHasMore: false,
  searchRequestId: null,

  reconcile: null,
  reconcileLoading: false,
  reconcileError: null,
  reconcileRequestId: null,

  cardActivity: null,
  cardActivityLoading: false,
  cardActivityLoadingMore: false,
  cardActivityError: null,
  cardActivityRequestId: null,
  cardActivityTopUpPage: 0,
  cardActivityUnloadPage: 0,
  cardActivityLedgerPage: 0,
  cardActivityTxnPage: 0,
};

function rangeParams({ dateFrom, dateTo, product, page }: RangeArgs) {
  return {
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(product ? { product } : {}),
    ...(page != null ? { page, pageSize: CLEARING_PAGE_SIZE } : {}),
  };
}

function searchParams(args: PrepaidVisaSearchArgs) {
  const {
    kind,
    dateFrom,
    dateTo,
    product,
    page = 1,
    card,
    cardholder,
    branch,
    q,
    rrn,
    merchant,
    terminal,
    result,
    reversal,
    amountMin,
    amountMax,
    account,
    description,
  } = args;
  return {
    kind,
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(product ? { product } : {}),
    page,
    pageSize: CLEARING_PAGE_SIZE,
    ...(card?.trim() ? { card: card.trim() } : {}),
    ...(cardholder?.trim() ? { cardholder: cardholder.trim() } : {}),
    ...(branch?.trim() ? { branch: branch.trim() } : {}),
    ...(q?.trim() ? { q: q.trim() } : {}),
    ...(rrn?.trim() ? { rrn: rrn.trim() } : {}),
    ...(merchant?.trim() ? { merchant: merchant.trim() } : {}),
    ...(terminal?.trim() ? { terminal: terminal.trim() } : {}),
    ...(result ? { result } : {}),
    ...(reversal ? { reversal } : {}),
    ...(amountMin != null && !Number.isNaN(amountMin)
      ? { amountMin }
      : {}),
    ...(amountMax != null && !Number.isNaN(amountMax)
      ? { amountMax }
      : {}),
    ...(account?.trim() ? { account: account.trim() } : {}),
    ...(description?.trim() ? { description: description.trim() } : {}),
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

export const fetchPrepaidVisaDashboard = createAsyncThunk<
  PrepaidVisaDashboard,
  Omit<RangeArgs, "page">,
  { rejectValue: string; state: RootState }
>("prepaidVisa/fetchDashboard", async (args, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }
    const response = await api.get<{ data: PrepaidVisaDashboard }>(
      "/card/prepaid-visa/dashboard",
      {
        ...withAuthHeader(token),
        params: rangeParams(args),
        signal: thunkAPI.signal,
        timeout: 180_000,
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

export const fetchPrepaidVisaTopUps = createAsyncThunk<
  {
    items: PrepaidVisaTopUp[];
    page: number;
    pageSize: number;
    hasMore: boolean;
  },
  RangeArgs,
  { rejectValue: string; state: RootState }
>("prepaidVisa/fetchTopUps", async ({ page = 1, ...args }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }
    const response = await api.get<{ data: PrepaidVisaPage<PrepaidVisaTopUp> }>(
      "/card/prepaid-visa/top-ups",
      {
        ...withAuthHeader(token),
        params: rangeParams({ ...args, page }),
        signal: thunkAPI.signal,
        timeout: 180_000,
      },
    );
    const payload = response.data.data;
    return {
      items: payload?.items ?? [],
      page: payload?.page ?? page,
      pageSize: payload?.pageSize ?? CLEARING_PAGE_SIZE,
      hasMore: Boolean(payload?.hasMore),
    };
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      throw error;
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchPrepaidVisaUnloads = createAsyncThunk<
  {
    items: PrepaidVisaUnload[];
    page: number;
    pageSize: number;
    hasMore: boolean;
  },
  RangeArgs,
  { rejectValue: string; state: RootState }
>("prepaidVisa/fetchUnloads", async ({ page = 1, ...args }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }
    const response = await api.get<{ data: PrepaidVisaPage<PrepaidVisaUnload> }>(
      "/card/prepaid-visa/unloads",
      {
        ...withAuthHeader(token),
        params: rangeParams({ ...args, page }),
        signal: thunkAPI.signal,
        timeout: 180_000,
      },
    );
    const payload = response.data.data;
    return {
      items: payload?.items ?? [],
      page: payload?.page ?? page,
      pageSize: payload?.pageSize ?? CLEARING_PAGE_SIZE,
      hasMore: Boolean(payload?.hasMore),
    };
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      throw error;
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchPrepaidVisaReconciliation = createAsyncThunk<
  PrepaidVisaReconcileReport,
  { product?: PrepaidVisaProductFilter },
  { rejectValue: string; state: RootState }
>("prepaidVisa/fetchReconciliation", async ({ product }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }
    const response = await api.get<{ data: PrepaidVisaReconcileReport }>(
      "/card/prepaid-visa/reconciliation",
      {
        ...withAuthHeader(token),
        params: product ? { product } : {},
        signal: thunkAPI.signal,
        timeout: 180_000,
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

export type FetchCardActivityArgs = {
  cardId: number;
  topUpPage?: number;
  unloadPage?: number;
  ledgerPage?: number;
  txnPage?: number;
  pageSize?: number;
  /** When set, only that section is fetched and appended. */
  append?: "ledger" | "topUps" | "unloads" | "transactions";
};

export const fetchPrepaidVisaCardActivity = createAsyncThunk<
  PrepaidVisaCardActivity & { append?: FetchCardActivityArgs["append"] },
  FetchCardActivityArgs,
  { rejectValue: string; state: RootState }
>(
  "prepaidVisa/fetchCardActivity",
  async (
    {
      cardId,
      topUpPage = 1,
      unloadPage = 1,
      ledgerPage = 1,
      txnPage = 1,
      pageSize = 40,
      append,
    },
    thunkAPI,
  ) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }
      const params: Record<string, string | number> = {
        topUpPage,
        unloadPage,
        ledgerPage,
        txnPage,
        pageSize,
      };
      if (append === "ledger") {
        params.sections = "ledger";
      } else if (append === "topUps") {
        params.sections = "topUps";
      } else if (append === "unloads") {
        params.sections = "unloads";
      } else if (append === "transactions") {
        params.sections = "transactions";
      }
      const response = await api.get<{ data: PrepaidVisaCardActivity }>(
        `/card/prepaid-visa/cards/${cardId}/activity`,
        {
          ...withAuthHeader(token),
          params,
          signal: thunkAPI.signal,
          timeout: 60_000,
        },
      );
      return { ...response.data.data, append };
    } catch (error) {
      if (isCanceled(thunkAPI, error)) {
        throw error;
      }
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchPrepaidVisaTransactions = createAsyncThunk<
  {
    items: PrepaidVisaTransaction[];
    page: number;
    pageSize: number;
    hasMore: boolean;
  },
  RangeArgs,
  { rejectValue: string; state: RootState }
>("prepaidVisa/fetchTransactions", async ({ page = 1, ...args }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }
    const response = await api.get<{
      data: PrepaidVisaPage<PrepaidVisaTransaction>;
    }>("/card/prepaid-visa/transactions", {
      ...withAuthHeader(token),
      params: rangeParams({ ...args, page }),
      signal: thunkAPI.signal,
      timeout: 180_000,
    });
    const payload = response.data.data;
    return {
      items: payload?.items ?? [],
      page: payload?.page ?? page,
      pageSize: payload?.pageSize ?? CLEARING_PAGE_SIZE,
      hasMore: Boolean(payload?.hasMore),
    };
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      throw error;
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchPrepaidVisaSearch = createAsyncThunk<
  PrepaidVisaSearchResult,
  PrepaidVisaSearchArgs,
  { rejectValue: string; state: RootState }
>("prepaidVisa/fetchSearch", async (args, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }
    const response = await api.get<{ data: PrepaidVisaSearchResult }>(
      "/card/prepaid-visa/search",
      {
        ...withAuthHeader(token),
        params: searchParams(args),
        signal: thunkAPI.signal,
        timeout: 180_000,
      },
    );
    const payload = response.data.data;
    return {
      kind: payload?.kind ?? args.kind,
      page: payload?.page ?? args.page ?? 1,
      pageSize: payload?.pageSize ?? CLEARING_PAGE_SIZE,
      hasMore: Boolean(payload?.hasMore),
      transactions: payload?.transactions ?? [],
      topUps: payload?.topUps ?? [],
      unloads: payload?.unloads ?? [],
    };
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      throw error;
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

const prepaidVisaSlice = createSlice({
  name: "prepaidVisa",
  initialState,
  reducers: {
    clearPrepaidVisa(state) {
      Object.assign(state, initialState);
    },
    clearPrepaidVisaSearch(state) {
      state.searchSubmitted = false;
      state.searchTransactions = [];
      state.searchTopUps = [];
      state.searchUnloads = [];
      state.searchLoading = false;
      state.searchError = null;
      state.searchPage = 0;
      state.searchHasMore = false;
      state.searchRequestId = null;
    },
    setPrepaidVisaSearchKind(state, action: PayloadAction<PrepaidVisaSearchKind>) {
      state.searchKind = action.payload;
      state.searchSubmitted = false;
      state.searchTransactions = [];
      state.searchTopUps = [];
      state.searchUnloads = [];
      state.searchError = null;
      state.searchPage = 0;
      state.searchHasMore = false;
    },
    clearPrepaidVisaCardActivity(state) {
      state.cardActivity = null;
      state.cardActivityLoading = false;
      state.cardActivityLoadingMore = false;
      state.cardActivityError = null;
      state.cardActivityRequestId = null;
      state.cardActivityTopUpPage = 0;
      state.cardActivityUnloadPage = 0;
      state.cardActivityLedgerPage = 0;
      state.cardActivityTxnPage = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPrepaidVisaDashboard.pending, (state, action) => {
        state.dashboardLoading = true;
        state.dashboardError = null;
        state.dashboardRequestId = action.meta.requestId;
        state.dashboard = null;
      })
      .addCase(fetchPrepaidVisaDashboard.fulfilled, (state, action) => {
        if (state.dashboardRequestId !== action.meta.requestId) {
          return;
        }
        state.dashboardLoading = false;
        state.dashboard = action.payload;
      })
      .addCase(fetchPrepaidVisaDashboard.rejected, (state, action) => {
        if (state.dashboardRequestId !== action.meta.requestId) {
          return;
        }
        state.dashboardLoading = false;
        state.dashboard = null;
        if (!action.meta.aborted) {
          state.dashboardError =
            action.payload ?? "Failed to load dashboard";
        }
      })

      .addCase(fetchPrepaidVisaTopUps.pending, (state, action) => {
        const page = action.meta.arg.page ?? 1;
        state.topUpsError = null;
        if (page <= 1) {
          state.topUpsLoading = true;
          state.topUpsLoadingMore = false;
          state.topUps = [];
          state.topUpsTruncated = false;
          state.topUpsHasMore = false;
          state.topUpsPage = 0;
        } else {
          state.topUpsLoadingMore = true;
        }
      })
      .addCase(fetchPrepaidVisaTopUps.fulfilled, (state, action) => {
        state.topUpsLoading = false;
        state.topUpsLoadingMore = false;
        state.topUpsPage = action.payload.page;
        state.topUpsHasMore = action.payload.hasMore;
        if (action.payload.page <= 1) {
          state.topUps = action.payload.items;
        } else {
          state.topUps = state.topUps.concat(action.payload.items);
        }
        if (
          action.payload.page >= CLEARING_MAX_AUTO_PAGES &&
          action.payload.hasMore
        ) {
          state.topUpsHasMore = false;
          state.topUpsTruncated = true;
        }
      })
      .addCase(fetchPrepaidVisaTopUps.rejected, (state, action) => {
        if (action.meta.aborted) {
          return;
        }
        state.topUpsLoading = false;
        state.topUpsLoadingMore = false;
        state.topUps = [];
        state.topUpsError = action.payload ?? "Failed to load top-ups";
      })

      .addCase(fetchPrepaidVisaUnloads.pending, (state, action) => {
        const page = action.meta.arg.page ?? 1;
        state.unloadsError = null;
        if (page <= 1) {
          state.unloadsLoading = true;
          state.unloadsLoadingMore = false;
          state.unloads = [];
          state.unloadsTruncated = false;
          state.unloadsHasMore = false;
          state.unloadsPage = 0;
        } else {
          state.unloadsLoadingMore = true;
        }
      })
      .addCase(fetchPrepaidVisaUnloads.fulfilled, (state, action) => {
        state.unloadsLoading = false;
        state.unloadsLoadingMore = false;
        state.unloadsPage = action.payload.page;
        state.unloadsHasMore = action.payload.hasMore;
        if (action.payload.page <= 1) {
          state.unloads = action.payload.items;
        } else {
          state.unloads = state.unloads.concat(action.payload.items);
        }
        if (
          action.payload.page >= CLEARING_MAX_AUTO_PAGES &&
          action.payload.hasMore
        ) {
          state.unloadsHasMore = false;
          state.unloadsTruncated = true;
        }
      })
      .addCase(fetchPrepaidVisaUnloads.rejected, (state, action) => {
        if (action.meta.aborted) {
          return;
        }
        state.unloadsLoading = false;
        state.unloadsLoadingMore = false;
        state.unloads = [];
        state.unloadsError = action.payload ?? "Failed to load unloads";
      })

      .addCase(fetchPrepaidVisaTransactions.pending, (state, action) => {
        const page = action.meta.arg.page ?? 1;
        state.transactionsError = null;
        if (page <= 1) {
          state.transactionsLoading = true;
          state.transactionsLoadingMore = false;
          state.transactions = [];
          state.transactionsTruncated = false;
          state.transactionsHasMore = false;
          state.transactionsPage = 0;
        } else {
          state.transactionsLoadingMore = true;
        }
      })
      .addCase(fetchPrepaidVisaTransactions.fulfilled, (state, action) => {
        state.transactionsLoading = false;
        state.transactionsLoadingMore = false;
        state.transactionsPage = action.payload.page;
        state.transactionsHasMore = action.payload.hasMore;
        if (action.payload.page <= 1) {
          state.transactions = action.payload.items;
        } else {
          state.transactions = state.transactions.concat(action.payload.items);
        }
        if (
          action.payload.page >= CLEARING_MAX_AUTO_PAGES &&
          action.payload.hasMore
        ) {
          state.transactionsHasMore = false;
          state.transactionsTruncated = true;
        }
      })
      .addCase(fetchPrepaidVisaTransactions.rejected, (state, action) => {
        if (action.meta.aborted) {
          return;
        }
        state.transactionsLoading = false;
        state.transactionsLoadingMore = false;
        state.transactions = [];
        state.transactionsError =
          action.payload ?? "Failed to load transactions";
      })

      .addCase(fetchPrepaidVisaSearch.pending, (state, action) => {
        state.searchLoading = true;
        state.searchError = null;
        state.searchRequestId = action.meta.requestId;
        state.searchKind = action.meta.arg.kind;
        state.searchSubmitted = true;
        state.searchTransactions = [];
        state.searchTopUps = [];
        state.searchUnloads = [];
      })
      .addCase(fetchPrepaidVisaSearch.fulfilled, (state, action) => {
        if (state.searchRequestId !== action.meta.requestId) {
          return;
        }
        state.searchLoading = false;
        state.searchKind = action.payload.kind;
        state.searchPage = action.payload.page;
        state.searchHasMore = action.payload.hasMore;
        state.searchTransactions = action.payload.transactions ?? [];
        state.searchTopUps = action.payload.topUps ?? [];
        state.searchUnloads = action.payload.unloads ?? [];
      })
      .addCase(fetchPrepaidVisaSearch.rejected, (state, action) => {
        if (state.searchRequestId !== action.meta.requestId) {
          return;
        }
        state.searchLoading = false;
        state.searchTransactions = [];
        state.searchTopUps = [];
        state.searchUnloads = [];
        if (!action.meta.aborted) {
          state.searchError = action.payload ?? "Search failed";
        }
      })

      .addCase(fetchPrepaidVisaReconciliation.pending, (state, action) => {
        state.reconcileLoading = true;
        state.reconcileError = null;
        state.reconcileRequestId = action.meta.requestId;
        state.reconcile = null;
      })
      .addCase(fetchPrepaidVisaReconciliation.fulfilled, (state, action) => {
        if (state.reconcileRequestId !== action.meta.requestId) {
          return;
        }
        state.reconcileLoading = false;
        state.reconcile = action.payload;
      })
      .addCase(fetchPrepaidVisaReconciliation.rejected, (state, action) => {
        if (state.reconcileRequestId !== action.meta.requestId) {
          return;
        }
        state.reconcileLoading = false;
        state.reconcile = null;
        if (!action.meta.aborted) {
          state.reconcileError =
            action.payload ?? "Failed to load reconciliation";
        }
      })

      .addCase(fetchPrepaidVisaCardActivity.pending, (state, action) => {
        const appending = Boolean(action.meta.arg.append);
        state.cardActivityError = null;
        state.cardActivityRequestId = action.meta.requestId;
        if (appending) {
          state.cardActivityLoadingMore = true;
        } else {
          state.cardActivityLoading = true;
          state.cardActivityLoadingMore = false;
          state.cardActivity = null;
          state.cardActivityTopUpPage = 0;
          state.cardActivityUnloadPage = 0;
          state.cardActivityLedgerPage = 0;
          state.cardActivityTxnPage = 0;
        }
      })
      .addCase(fetchPrepaidVisaCardActivity.fulfilled, (state, action) => {
        if (state.cardActivityRequestId !== action.meta.requestId) {
          return;
        }
        const { append, ...payload } = action.payload;
        state.cardActivityLoading = false;
        state.cardActivityLoadingMore = false;
        if (append && state.cardActivity) {
          if (append === "ledger") {
            state.cardActivity.ledger = [
              ...state.cardActivity.ledger,
              ...(payload.ledger ?? []),
            ];
            state.cardActivity.ledgerHasMore = Boolean(payload.ledgerHasMore);
            state.cardActivityLedgerPage = action.meta.arg.ledgerPage ?? 1;
          } else if (append === "topUps") {
            state.cardActivity.topUps = [
              ...state.cardActivity.topUps,
              ...(payload.topUps ?? []),
            ];
            state.cardActivity.topUpsHasMore = Boolean(payload.topUpsHasMore);
            state.cardActivityTopUpPage = action.meta.arg.topUpPage ?? 1;
          } else if (append === "unloads") {
            state.cardActivity.unloads = [
              ...(state.cardActivity.unloads ?? []),
              ...(payload.unloads ?? []),
            ];
            state.cardActivity.unloadsHasMore = Boolean(payload.unloadsHasMore);
            state.cardActivityUnloadPage = action.meta.arg.unloadPage ?? 1;
          } else if (append === "transactions") {
            state.cardActivity.transactions = [
              ...state.cardActivity.transactions,
              ...(payload.transactions ?? []),
            ];
            state.cardActivity.transactionsHasMore = Boolean(
              payload.transactionsHasMore,
            );
            state.cardActivityTxnPage = action.meta.arg.txnPage ?? 1;
          }
          return;
        }
        state.cardActivity = {
          ...payload,
          unloads: payload.unloads ?? [],
        };
        state.cardActivityTopUpPage = action.meta.arg.topUpPage ?? 1;
        state.cardActivityUnloadPage = action.meta.arg.unloadPage ?? 1;
        state.cardActivityLedgerPage = action.meta.arg.ledgerPage ?? 1;
        state.cardActivityTxnPage = action.meta.arg.txnPage ?? 1;
      })
      .addCase(fetchPrepaidVisaCardActivity.rejected, (state, action) => {
        if (state.cardActivityRequestId !== action.meta.requestId) {
          return;
        }
        state.cardActivityLoading = false;
        state.cardActivityLoadingMore = false;
        if (!action.meta.arg.append) {
          state.cardActivity = null;
        }
        if (!action.meta.aborted) {
          state.cardActivityError =
            action.payload ?? "Failed to load card activity";
        }
      });
  },
});

export const {
  clearPrepaidVisa,
  clearPrepaidVisaSearch,
  setPrepaidVisaSearchKind,
  clearPrepaidVisaCardActivity,
} = prepaidVisaSlice.actions;
export default prepaidVisaSlice.reducer;

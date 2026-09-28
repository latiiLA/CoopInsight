import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

import api from "@/lib/api";
import { CardDetail, CardDetailPage, CardMetric } from "@/types/card-detail";
import { RootState } from "../../app/store/store";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import getErrorMessage from "../../utility/error-message";

/** Matches CLEARING_MAX_AUTO_PAGES: how many pages to stream before stopping. */
export const CARD_DETAIL_MAX_AUTO_PAGES = 20;

type CardDetailState = {
  items: CardDetail[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  metric: CardMetric | null;
  branchId?: number;
  cardholderVisible: boolean;

  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  /** True when auto-paging stopped at the cap and rows remain. */
  truncated: boolean;
};

const initialState: CardDetailState = {
  items: [],
  page: 0,
  pageSize: 0,
  hasMore: false,
  metric: null,
  branchId: undefined,
  cardholderVisible: false,
  loading: false,
  loadingMore: false,
  error: null,
  truncated: false,
};

export type FetchCardDetailsArgs = {
  metric: CardMetric;
  dateFrom: string;
  dateTo: string;
  branchId?: number;
  page?: number;
  pageSize?: number;
  /** True when replacing the list; false when appending a later page. */
  reset?: boolean;
};

function isCanceled(
  thunkAPI: { signal: AbortSignal },
  error: unknown,
): boolean {
  return (
    thunkAPI.signal.aborted ||
    (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
  );
}

export const fetchCardDetails = createAsyncThunk<
  CardDetailPage,
  FetchCardDetailsArgs,
  { state: RootState; rejectValue: string }
>(
  "cardDetail/fetchCardDetails",
  async (
    { metric, dateFrom, dateTo, branchId, page = 1, pageSize = 200 },
    thunkAPI,
  ) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }

      const response = await api.get<{ data: { details: CardDetailPage } }>(
        "/card/details",
        {
          ...withAuthHeader(token),
          params: {
            metric,
            dateFrom,
            dateTo,
            ...(branchId ? { branchId } : {}),
            page,
            pageSize,
          },
          signal: thunkAPI.signal,
          timeout: 180_000,
        },
      );

      return response.data.data?.details;
    } catch (error) {
      if (isCanceled(thunkAPI, error)) {
        throw error;
      }

      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

const cardDetailSlice = createSlice({
  name: "cardDetail",
  initialState,
  reducers: {
    clearCardDetails: () => ({ ...initialState }),
    // Called when the sheet opens for a different drill-down, so a stale list
    // is never shown under a new heading.
    prepareCardDetails: (state, action: PayloadAction<CardMetric | undefined>) => {
      const nextMetric = action.payload ?? state.metric;
      if (nextMetric !== state.metric) {
        state.items = [];
        state.page = 0;
        state.hasMore = false;
        state.truncated = false;
        state.error = null;
      }
      state.metric = nextMetric;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCardDetails.pending, (state, action) => {
        const appending = action.meta.arg.page !== undefined && action.meta.arg.page > 1;
        if (appending) {
          state.loadingMore = true;
        } else {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchCardDetails.fulfilled, (state, action) => {
        const { items, page, pageSize, hasMore, metric, branchId, cardholderVisible } =
          action.payload;
        const appending = action.meta.arg.page !== undefined && action.meta.arg.page > 1;

        state.loading = false;
        state.loadingMore = false;
        state.error = null;
        state.page = page;
        state.pageSize = pageSize;
        state.hasMore = hasMore;
        state.metric = metric;
        state.branchId = branchId;
        state.cardholderVisible = cardholderVisible;

        if (appending) {
          // Guard against a duplicate page arriving twice, which can happen when
          // a range change and a manual refresh overlap.
          const seen = new Set(state.items.map((item) => item.cardId));
          for (const item of items) {
            if (!seen.has(item.cardId)) {
              state.items.push(item);
              seen.add(item.cardId);
            }
          }
        } else {
          state.items = items;
          state.truncated = false;
        }
      })
      .addCase(fetchCardDetails.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload || "Failed to fetch card details";
      });
  },
});

export const { clearCardDetails, prepareCardDetails } = cardDetailSlice.actions;

export default cardDetailSlice.reducer;

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import api from "@/lib/api";
import { ClearedTransaction } from "@/types/cleared";
import { RootState } from "../../app/store/store";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import getErrorMessage from "../../utility/error-message";
import { CLEARING_MAX_AUTO_PAGES, CLEARING_PAGE_SIZE } from "./clearing_constants";

export type ClearedProduct = "ETB" | "VISA" | "MDS";

const clearedProductPath: Record<ClearedProduct, string> = {
  ETB: "eth",
  VISA: "visa",
  MDS: "mastercard",
};

type ClearingPagePayload = {
  items: ClearedTransaction[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

interface ClearedState {
  rows: ClearedTransaction[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  product: ClearedProduct | null;
  page: number;
  hasMore: boolean;
  truncated: boolean;
}

const initialState: ClearedState = {
  rows: [],
  loading: false,
  loadingMore: false,
  error: null,
  dateFrom: null,
  dateTo: null,
  product: null,
  page: 0,
  hasMore: false,
  truncated: false,
};

export type FetchClearedArgs = {
  dateFrom: string;
  dateTo: string;
  product: ClearedProduct;
  page?: number;
};

export const fetchCleared = createAsyncThunk<
  {
    items: ClearedTransaction[];
    dateFrom: string;
    dateTo: string;
    product: ClearedProduct;
    page: number;
    pageSize: number;
    hasMore: boolean;
  },
  FetchClearedArgs,
  { state: RootState; rejectValue: string }
>("cleared/fetchCleared", async ({ dateFrom, dateTo, product, page = 1 }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{ data: ClearingPagePayload }>(
      `/clearing/cleared/${clearedProductPath[product]}`,
      {
        ...withAuthHeader(token),
        params: {
          dateFrom,
          dateTo,
          page,
          pageSize: CLEARING_PAGE_SIZE,
        },
        signal: thunkAPI.signal,
        timeout: 180_000,
      },
    );

    const payload = response.data.data;
    return {
      items: payload?.items ?? [],
      dateFrom,
      dateTo,
      product,
      page: payload?.page ?? page,
      pageSize: payload?.pageSize ?? CLEARING_PAGE_SIZE,
      hasMore: Boolean(payload?.hasMore),
    };
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

const clearedSlice = createSlice({
  name: "cleared",
  initialState,
  reducers: {
    clearCleared: () => ({ ...initialState }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCleared.pending, (state, action) => {
        const page = action.meta.arg.page ?? 1;
        state.error = null;
        if (page <= 1) {
          state.loading = true;
          state.loadingMore = false;
          state.rows = [];
          state.truncated = false;
          state.hasMore = false;
          state.page = 0;
        } else {
          state.loadingMore = true;
        }
      })
      .addCase(fetchCleared.fulfilled, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.dateFrom = action.payload.dateFrom;
        state.dateTo = action.payload.dateTo;
        state.product = action.payload.product;
        state.page = action.payload.page;
        state.hasMore = action.payload.hasMore;
        if (action.payload.page <= 1) {
          state.rows = action.payload.items;
        } else {
          state.rows = state.rows.concat(action.payload.items);
        }
        if (action.payload.page >= CLEARING_MAX_AUTO_PAGES && action.payload.hasMore) {
          state.hasMore = false;
          state.truncated = true;
        }
      })
      .addCase(fetchCleared.rejected, (state, action) => {
        if (action.meta.aborted) {
          return;
        }
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload || "Failed to fetch cleared transactions";
      });
  },
});

export const { clearCleared } = clearedSlice.actions;

export default clearedSlice.reducer;

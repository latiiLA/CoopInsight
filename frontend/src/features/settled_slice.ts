import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import api from "@/lib/api";
import { SettledTransaction } from "@/types/settled";
import { RootState } from "../../app/store/store";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import getErrorMessage from "../../utility/error-message";
import { CLEARING_MAX_AUTO_PAGES, CLEARING_PAGE_SIZE } from "./clearing_constants";

export type SettledProduct = "ETB" | "VISA" | "MDS";

const settledProductPath: Record<SettledProduct, string> = {
  ETB: "eth",
  VISA: "visa",
  MDS: "mastercard",
};

type ClearingPagePayload = {
  items: SettledTransaction[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

interface SettledState {
  rows: SettledTransaction[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  product: SettledProduct | null;
  page: number;
  hasMore: boolean;
  truncated: boolean;
}

const initialState: SettledState = {
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

export type FetchSettledArgs = {
  dateFrom: string;
  dateTo: string;
  product: SettledProduct;
  page?: number;
};

export const fetchSettled = createAsyncThunk<
  {
    items: SettledTransaction[];
    dateFrom: string;
    dateTo: string;
    product: SettledProduct;
    page: number;
    pageSize: number;
    hasMore: boolean;
  },
  FetchSettledArgs,
  { state: RootState; rejectValue: string }
>("settled/fetchSettled", async ({ dateFrom, dateTo, product, page = 1 }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{ data: ClearingPagePayload }>(
      `/settlement/settled/${settledProductPath[product]}`,
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

const settledSlice = createSlice({
  name: "settled",
  initialState,
  reducers: {
    clearSettled: () => ({ ...initialState }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettled.pending, (state, action) => {
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
      .addCase(fetchSettled.fulfilled, (state, action) => {
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
      .addCase(fetchSettled.rejected, (state, action) => {
        if (action.meta.aborted) {
          return;
        }
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload || "Failed to fetch settled transactions";
      });
  },
});

export const { clearSettled } = settledSlice.actions;

export default settledSlice.reducer;

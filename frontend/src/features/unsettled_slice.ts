import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import api from "@/lib/api";
import { UnsettledTransaction } from "@/types/unsettled";
import { RootState } from "../../app/store/store";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import getErrorMessage from "../../utility/error-message";
import { CLEARING_MAX_AUTO_PAGES, CLEARING_PAGE_SIZE } from "./clearing_constants";

export type UnsettledProduct = "ETB" | "VISA" | "MDS" | "VISACBS";

const unsettledProductPath: Record<UnsettledProduct, string> = {
  ETB: "eth",
  VISA: "visa",
  MDS: "mastercard",
  VISACBS: "visacybersource",
};

type ClearingPagePayload = {
  items: UnsettledTransaction[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

interface UnsettledState {
  rows: UnsettledTransaction[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  product: UnsettledProduct | null;
  page: number;
  hasMore: boolean;
  truncated: boolean;
}

const initialState: UnsettledState = {
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

export type FetchUnsettledArgs = {
  dateFrom: string;
  dateTo: string;
  product: UnsettledProduct;
  page?: number;
};

export const fetchUnsettled = createAsyncThunk<
  {
    items: UnsettledTransaction[];
    dateFrom: string;
    dateTo: string;
    product: UnsettledProduct;
    page: number;
    pageSize: number;
    hasMore: boolean;
  },
  FetchUnsettledArgs,
  { state: RootState; rejectValue: string }
>("unsettled/fetchUnsettled", async ({ dateFrom, dateTo, product, page = 1 }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{ data: ClearingPagePayload }>(
      `/settlement/unsettled/${unsettledProductPath[product]}`,
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

const unsettledSlice = createSlice({
  name: "unsettled",
  initialState,
  reducers: {
    clearUnsettled: () => ({ ...initialState }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUnsettled.pending, (state, action) => {
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
      .addCase(fetchUnsettled.fulfilled, (state, action) => {
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
      .addCase(fetchUnsettled.rejected, (state, action) => {
        if (action.meta.aborted) {
          return;
        }
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload || "Failed to fetch unsettled transactions";
      });
  },
});

export const { clearUnsettled } = unsettledSlice.actions;

export default unsettledSlice.reducer;

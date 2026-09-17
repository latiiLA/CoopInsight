import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import api from "@/lib/api";
import { UnclearedTransaction } from "@/types/uncleared";
import { RootState } from "../../app/store/store";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import getErrorMessage from "../../utility/error-message";

export type UnclearedProduct = "ETB" | "VISA" | "MDS";

const unclearedProductPath: Record<UnclearedProduct, string> = {
  ETB: "eth",
  VISA: "visa",
  MDS: "mastercard",
};

interface UnclearedState {
  rows: UnclearedTransaction[];
  loading: boolean;
  error: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  product: UnclearedProduct | null;
}

const initialState: UnclearedState = {
  rows: [],
  loading: false,
  error: null,
  dateFrom: null,
  dateTo: null,
  product: null,
};

export type FetchUnclearedArgs = {
  dateFrom: string;
  dateTo: string;
  product: UnclearedProduct;
};

export const fetchUncleared = createAsyncThunk<
  {
    rows: UnclearedTransaction[];
    dateFrom: string;
    dateTo: string;
    product: UnclearedProduct;
  },
  FetchUnclearedArgs,
  { state: RootState; rejectValue: string }
>("uncleared/fetchUncleared", async ({ dateFrom, dateTo, product }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{ data: UnclearedTransaction[] }>(
      `/clearing/uncleared/${unclearedProductPath[product]}`,
      {
        ...withAuthHeader(token),
        params: { dateFrom, dateTo },
        signal: thunkAPI.signal,
        // Match long Oracle reports; without this a dropped proxy leaves loading=true forever.
        timeout: 180_000,
      },
    );

    return {
      rows: response.data.data ?? [],
      dateFrom,
      dateTo,
      product,
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

const unclearedSlice = createSlice({
  name: "uncleared",
  initialState,
  reducers: {
    clearUncleared: (state) => {
      state.rows = [];
      state.loading = false;
      state.error = null;
      state.dateFrom = null;
      state.dateTo = null;
      state.product = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUncleared.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.rows = [];
      })
      .addCase(fetchUncleared.fulfilled, (state, action) => {
        state.loading = false;
        state.rows = action.payload.rows;
        state.dateFrom = action.payload.dateFrom;
        state.dateTo = action.payload.dateTo;
        state.product = action.payload.product;
      })
      .addCase(fetchUncleared.rejected, (state, action) => {
        if (action.meta.aborted) {
          return;
        }
        state.loading = false;
        state.error = action.payload || "Failed to fetch uncleared transactions";
      });
  },
});

export const { clearUncleared } = unclearedSlice.actions;

export default unclearedSlice.reducer;

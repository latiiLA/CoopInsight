import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import api from "@/lib/api";
import { UnsettledTransaction } from "@/types/unsettled";
import { RootState } from "../../app/store/store";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import getErrorMessage from "../../utility/error-message";

interface UnsettledState {
  rows: UnsettledTransaction[];
  loading: boolean;
  error: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

const initialState: UnsettledState = {
  rows: [],
  loading: false,
  error: null,
  dateFrom: null,
  dateTo: null,
};

export type FetchUnsettledETHArgs = {
  dateFrom: string;
  dateTo: string;
};

export const fetchUnsettledETH = createAsyncThunk<
  {
    rows: UnsettledTransaction[];
    dateFrom: string;
    dateTo: string;
  },
  FetchUnsettledETHArgs,
  { state: RootState; rejectValue: string }
>("unsettled/fetchUnsettledETH", async ({ dateFrom, dateTo }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{ data: UnsettledTransaction[] }>(
      "/settlement/unsettled/eth",
      {
        ...withAuthHeader(token),
        params: { dateFrom, dateTo },
        signal: thunkAPI.signal,
        timeout: 180_000,
      },
    );

    return {
      rows: response.data.data ?? [],
      dateFrom,
      dateTo,
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
    clearUnsettled: (state) => {
      state.rows = [];
      state.loading = false;
      state.error = null;
      state.dateFrom = null;
      state.dateTo = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUnsettledETH.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.rows = [];
      })
      .addCase(fetchUnsettledETH.fulfilled, (state, action) => {
        state.loading = false;
        state.rows = action.payload.rows;
        state.dateFrom = action.payload.dateFrom;
        state.dateTo = action.payload.dateTo;
      })
      .addCase(fetchUnsettledETH.rejected, (state, action) => {
        if (action.meta.aborted) {
          return;
        }
        state.loading = false;
        state.error = action.payload || "Failed to fetch unsettled transactions";
      });
  },
});

export const { clearUnsettled } = unsettledSlice.actions;

export default unsettledSlice.reducer;

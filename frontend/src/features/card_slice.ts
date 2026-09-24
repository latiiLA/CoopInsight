import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import api from "@/lib/api";
import { CardStatusReport } from "@/types/card-status-report";
import { RootState } from "../../app/store/store";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import getErrorMessage from "../../utility/error-message";

type CardStatusPayload = {
  items: CardStatusReport[];
};

interface CardStatusState {
  rows: CardStatusReport[];
  loading: boolean;
  error: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

const initialState: CardStatusState = {
  rows: [],
  loading: false,
  error: null,
  dateFrom: null,
  dateTo: null,
};

export type FetchCardStatusArgs = {
  dateFrom?: string;
  dateTo?: string;
};

export const fetchCardStatus = createAsyncThunk<
  {
    items: CardStatusReport[];
    dateFrom?: string;
    dateTo?: string;
  },
  FetchCardStatusArgs,
  { state: RootState; rejectValue: string }
>("cardStatus/fetchCardStatus", async ({ dateFrom, dateTo }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{ data: CardStatusPayload }>(
      "/card/count-per-status",
      {
        ...withAuthHeader(token),
        params: {
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
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

const cardStatusSlice = createSlice({
  name: "cardStatus",
  initialState,
  reducers: {
    clearCardStatus: () => ({ ...initialState }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCardStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.rows = [];
      })
      .addCase(fetchCardStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.dateFrom = action.payload.dateFrom ?? null;
        state.dateTo = action.payload.dateTo ?? null;
        state.rows = action.payload.items;
      })
      .addCase(fetchCardStatus.rejected, (state, action) => {
        if (action.meta.aborted) {
          return;
        }

        state.loading = false;
        state.error =
          action.payload || "Failed to fetch card status report";
      });
  },
});

export const { clearCardStatus } = cardStatusSlice.actions;

export default cardStatusSlice.reducer;
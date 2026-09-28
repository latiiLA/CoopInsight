import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import api from "@/lib/api";
import {
  CardStatusDateField,
  CardStatusGroupBy,
  CardStatusReport,
  CardStatusResponse,
} from "@/types/card-status-report";
import { RootState } from "../../app/store/store";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import getErrorMessage from "../../utility/error-message";

interface CardStatusState {
  rows: CardStatusReport[];
  loading: boolean;
  error: string | null;
  /** Echoed by the API, so the table can label itself from the server's view. */
  groupBy: CardStatusGroupBy;
  dateField: CardStatusDateField;
  expiringWithinMonths: number;
}

const initialState: CardStatusState = {
  rows: [],
  loading: false,
  error: null,
  groupBy: "status",
  dateField: "created",
  expiringWithinMonths: 60,
};

export type FetchCardStatusArgs = {
  dateFrom?: string;
  dateTo?: string;
  groupBy?: CardStatusGroupBy;
  dateField?: CardStatusDateField;
  expiringWithinMonths?: number;
  productId?: number;
  branchId?: number;
};

export const fetchCardStatus = createAsyncThunk<
  CardStatusResponse,
  FetchCardStatusArgs,
  { state: RootState; rejectValue: string }
>("cardStatus/fetchCardStatus", async (args, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{ data: CardStatusResponse }>(
      "/card/count-per-status",
      {
        ...withAuthHeader(token),
        params: {
          ...(args.dateFrom ? { dateFrom: args.dateFrom } : {}),
          ...(args.dateTo ? { dateTo: args.dateTo } : {}),
          ...(args.groupBy ? { groupBy: args.groupBy } : {}),
          ...(args.dateField ? { dateField: args.dateField } : {}),
          ...(args.expiringWithinMonths !== undefined
            ? { expiringWithinMonths: args.expiringWithinMonths }
            : {}),
          ...(args.productId ? { productId: args.productId } : {}),
          ...(args.branchId ? { branchId: args.branchId } : {}),
        },
        signal: thunkAPI.signal,
        timeout: 180_000,
      },
    );

    const payload = response.data.data;

    return {
      items: payload?.items ?? [],
      groupBy: payload?.groupBy ?? args.groupBy ?? "status",
      dateField: payload?.dateField ?? args.dateField ?? "created",
      expiringWithinMonths: payload?.expiringWithinMonths ?? 60,
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
        state.rows = action.payload.items;
        state.groupBy = action.payload.groupBy;
        state.dateField = action.payload.dateField;
        state.expiringWithinMonths = action.payload.expiringWithinMonths;
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

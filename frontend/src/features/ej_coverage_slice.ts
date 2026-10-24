import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import { RootState } from "../../app/store/store";
import api from "@/lib/api";
import type {
  EJCoverageArgs,
  EJCoverageResult,
} from "@/types/ej-coverage";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";

interface EJCoverageState {
  data: EJCoverageResult | null;
  loading: boolean;
  error: string | null;
  requestId: string | null;
  lastArgs: EJCoverageArgs | null;
}

const initialState: EJCoverageState = {
  data: null,
  loading: false,
  error: null,
  requestId: null,
  lastArgs: null,
};

function isCanceled(
  thunkAPI: { signal: AbortSignal },
  error: unknown,
): boolean {
  return (
    thunkAPI.signal.aborted ||
    (axios.isCancel?.(error) ?? false) ||
    (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
  );
}

export const fetchEJCoverage = createAsyncThunk<
  EJCoverageResult,
  EJCoverageArgs,
  { state: RootState; rejectValue: string }
>("ejCoverage/fetch", async (args, thunkAPI) => {
  const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
  if (!token) {
    return thunkAPI.rejectWithValue("Authentication token not found");
  }
  try {
    const response = await api.get<{ data: EJCoverageResult }>(
      "/reports/ej-coverage",
      {
        ...withAuthHeader(token),
        params: {
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
        },
        signal: thunkAPI.signal,
      },
    );
    return (
      response.data.data ?? {
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
        totalActive: 0,
        focus: {
          date: args.dateTo,
          synced: 0,
          missing: 0,
          totalActive: 0,
        },
        week: {
          dateFrom: args.dateTo,
          dateTo: args.dateTo,
          avgSynced: 0,
          syncedTerminalDays: 0,
          missingTerminalDays: 0,
          totalActive: 0,
          dayCount: 0,
        },
        days: [],
        terminals: [],
      }
    );
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      return thunkAPI.rejectWithValue("canceled");
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

const ejCoverageSlice = createSlice({
  name: "ejCoverage",
  initialState,
  reducers: {
    clearEJCoverage: (state) => {
      state.data = null;
      state.error = null;
      state.lastArgs = null;
      state.requestId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEJCoverage.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.requestId = action.meta.requestId;
        state.lastArgs = action.meta.arg;
      })
      .addCase(fetchEJCoverage.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchEJCoverage.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        if (action.payload === "canceled") return;
        state.loading = false;
        state.error = action.payload || "Failed to load EJ coverage";
      });
  },
});

export const { clearEJCoverage } = ejCoverageSlice.actions;

export default ejCoverageSlice.reducer;

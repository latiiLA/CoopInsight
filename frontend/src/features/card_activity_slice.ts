import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

import api from "@/lib/api";
import {
  CardActivityReport,
  CardBranchActivity,
} from "@/types/card-activity";
import { RootState } from "../../app/store/store";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import getErrorMessage from "../../utility/error-message";

interface CardActivityState {
  report: CardActivityReport | null;
  loading: boolean;
  error: string | null;

  branches: CardBranchActivity[];
  branchesLoading: boolean;
  branchesError: string | null;

  selectedBranchId: number | null;
  branchTrend: CardActivityReport | null;
  branchTrendLoading: boolean;
  branchTrendError: string | null;
}

const initialState: CardActivityState = {
  report: null,
  loading: false,
  error: null,

  branches: [],
  branchesLoading: false,
  branchesError: null,

  selectedBranchId: null,
  branchTrend: null,
  branchTrendLoading: false,
  branchTrendError: null,
};

export type FetchCardActivityArgs = {
  dateFrom?: string;
  dateTo?: string;
};

export type FetchCardBranchTrendArgs = FetchCardActivityArgs & {
  branchId: number;
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

export const fetchCardActivity = createAsyncThunk<
  CardActivityReport | null,
  FetchCardActivityArgs,
  { state: RootState; rejectValue: string }
>("cardActivity/fetchCardActivity", async ({ dateFrom, dateTo }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{ data: { report: CardActivityReport | null } }>(
      "/card/activity",
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

    return response.data.data?.report ?? null;
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      throw error;
    }

    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchCardActivityByBranch = createAsyncThunk<
  CardBranchActivity[],
  FetchCardActivityArgs,
  { state: RootState; rejectValue: string }
>(
  "cardActivity/fetchCardActivityByBranch",
  async ({ dateFrom, dateTo }, thunkAPI) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }

      const response = await api.get<{ data: { items: CardBranchActivity[] } }>(
        "/card/activity/by-branch",
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

      return response.data.data?.items ?? [];
    } catch (error) {
      if (isCanceled(thunkAPI, error)) {
        throw error;
      }

      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchCardBranchTrend = createAsyncThunk<
  { branchId: number; report: CardActivityReport | null },
  FetchCardBranchTrendArgs,
  { state: RootState; rejectValue: string }
>(
  "cardActivity/fetchCardBranchTrend",
  async ({ branchId, dateFrom, dateTo }, thunkAPI) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }

      const response = await api.get<{ data: { report: CardActivityReport | null } }>(
        "/card/activity/branch-trend",
        {
          ...withAuthHeader(token),
          params: {
            branchId,
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {}),
          },
          signal: thunkAPI.signal,
          timeout: 180_000,
        },
      );

      return { branchId, report: response.data.data?.report ?? null };
    } catch (error) {
      if (isCanceled(thunkAPI, error)) {
        throw error;
      }

      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

const cardActivitySlice = createSlice({
  name: "cardActivity",
  initialState,
  reducers: {
    clearCardActivity: () => ({ ...initialState }),
    selectBranch: (state, action: PayloadAction<number | null>) => {
      state.selectedBranchId = action.payload;
      state.branchTrend = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Organization-wide daily activity
      .addCase(fetchCardActivity.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCardActivity.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.report = action.payload;
      })
      .addCase(fetchCardActivity.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.loading = false;
        state.error = action.payload || "Failed to fetch card activity report";
      })

      // Per-branch totals
      .addCase(fetchCardActivityByBranch.pending, (state) => {
        state.branchesLoading = true;
        state.branchesError = null;
      })
      .addCase(fetchCardActivityByBranch.fulfilled, (state, action) => {
        state.branchesLoading = false;
        state.branchesError = null;
        state.branches = action.payload;
      })
      .addCase(fetchCardActivityByBranch.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.branchesLoading = false;
        state.branchesError =
          action.payload || "Failed to fetch card activity by branch";
      })

      // Single-branch daily trend
      .addCase(fetchCardBranchTrend.pending, (state) => {
        state.branchTrendLoading = true;
        state.branchTrendError = null;
      })
      .addCase(fetchCardBranchTrend.fulfilled, (state, action) => {
        state.branchTrendLoading = false;
        state.branchTrendError = null;
        // Ignore a late response for a branch that is no longer selected.
        if (
          state.selectedBranchId === null ||
          state.selectedBranchId === action.payload.branchId
        ) {
          state.branchTrend = action.payload.report;
        }
      })
      .addCase(fetchCardBranchTrend.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.branchTrendLoading = false;
        state.branchTrendError =
          action.payload || "Failed to fetch branch card activity";
      });
  },
});

export const { clearCardActivity, selectBranch } = cardActivitySlice.actions;

export default cardActivitySlice.reducer;

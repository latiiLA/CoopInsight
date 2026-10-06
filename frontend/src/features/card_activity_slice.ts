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

/**
 * Transport for the card activity endpoints, keyed by the logged-in path
 * (e.g. "/card/activity"). A store may supply one through the thunk extra
 * argument; the Grafana embed does, to call the key-gated /api/embed routes
 * instead of the session-authenticated API.
 */
export type CardActivityClient = <T>(
  path: string,
  params: Record<string, string | number>,
  signal: AbortSignal,
) => Promise<T>;

export type CardActivityThunkExtra = { cardActivityClient?: CardActivityClient };

class MissingTokenError extends Error {}

type ThunkContext = {
  getState: () => unknown;
  signal: AbortSignal;
  extra: unknown;
};

async function getCardJson<T>(
  thunkAPI: ThunkContext,
  path: string,
  params: Record<string, string | number>,
): Promise<T> {
  const client = (thunkAPI.extra as CardActivityThunkExtra | undefined)
    ?.cardActivityClient;
  if (client) {
    return client<T>(path, params, thunkAPI.signal);
  }

  const token = getTokenFromAuth((thunkAPI.getState() as RootState).user.authUser);
  if (!token) {
    throw new MissingTokenError("Authentication token not found");
  }

  const response = await api.get<T>(path, {
    ...withAuthHeader(token),
    params,
    signal: thunkAPI.signal,
    timeout: 180_000,
  });
  return response.data;
}

const rangeParams = ({ dateFrom, dateTo }: FetchCardActivityArgs) => ({
  ...(dateFrom ? { dateFrom } : {}),
  ...(dateTo ? { dateTo } : {}),
});

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
>("cardActivity/fetchCardActivity", async (args, thunkAPI) => {
  try {
    const body = await getCardJson<{ data: { report: CardActivityReport | null } }>(
      thunkAPI,
      "/card/activity",
      rangeParams(args),
    );

    return body.data?.report ?? null;
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
>("cardActivity/fetchCardActivityByBranch", async (args, thunkAPI) => {
  try {
    const body = await getCardJson<{ data: { items: CardBranchActivity[] } }>(
      thunkAPI,
      "/card/activity/by-branch",
      rangeParams(args),
    );

    return body.data?.items ?? [];
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      throw error;
    }

    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchCardBranchTrend = createAsyncThunk<
  { branchId: number; report: CardActivityReport | null },
  FetchCardBranchTrendArgs,
  { state: RootState; rejectValue: string }
>(
  "cardActivity/fetchCardBranchTrend",
  async ({ branchId, ...range }, thunkAPI) => {
    try {
      const body = await getCardJson<{ data: { report: CardActivityReport | null } }>(
        thunkAPI,
        "/card/activity/branch-trend",
        { branchId, ...rangeParams(range) },
      );

      return { branchId, report: body.data?.report ?? null };
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
      const next = action.payload;

      // Clearing the selection always drops the trend it belonged to.
      if (next === null) {
        state.selectedBranchId = null;
        state.branchTrend = null;
        return;
      }

      // Re-selecting the branch that is already selected must keep the loaded
      // trend. The fetch effect keys off selectedBranchId, so an unchanged ID
      // never re-fires it and clearing here would blank the chart with no
      // request to refill it.
      if (state.selectedBranchId === next) {
        return;
      }

      state.selectedBranchId = next;
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
        // Adopt the response only if its branch is still the selected one.
        // A null selection means the trend was cleared, so a late response
        // must not repopulate it.
        if (state.selectedBranchId === action.payload.branchId) {
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

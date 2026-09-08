import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import api from "@/lib/api";
import {
  ActivityLogListResult,
  FetchActivityLogsParams,
} from "@/types/activity-log";
import { RootState } from "../../app/store/store";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";

interface ActivityLogState {
  result: ActivityLogListResult | null;
  loading: boolean;
  error: string | null;
}

const initialState: ActivityLogState = {
  result: null,
  loading: false,
  error: null,
};

export const fetchActivityLogs = createAsyncThunk<
  ActivityLogListResult,
  FetchActivityLogsParams,
  { state: RootState; rejectValue: string }
>("activityLog/fetchActivityLogs", async (params, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      isSuccessful: boolean;
      message: string;
      data: ActivityLogListResult;
    }>("/activity-logs", {
      ...withAuthHeader(token),
      params: {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        actor: params.actor || undefined,
        action: params.action || undefined,
        q: params.q || undefined,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 100,
      },
    });

    return (
      response.data.data ?? {
        items: [],
        total: 0,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 100,
      }
    );
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

const activityLogSlice = createSlice({
  name: "activityLog",
  initialState,
  reducers: {
    clearActivityLogs(state) {
      state.result = null;
      state.error = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActivityLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActivityLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.result = action.payload;
      })
      .addCase(fetchActivityLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to fetch activity logs";
      });
  },
});

export const { clearActivityLogs } = activityLogSlice.actions;
export default activityLogSlice.reducer;

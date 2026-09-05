import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../../app/store/store";
import {
  DeclineReason,
  SuccessTransactionReport,
} from "@/types/report";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import api from "@/lib/api";

interface ReportState {
  successRate: SuccessTransactionReport | null;
  successRateLoading: boolean;
  successRateError: string | null;
}

interface FetchSuccessTransactionsParams {
  dateFrom: string;
  dateTo: string;
}

const initialState: ReportState = {
  successRate: null,
  successRateLoading: false,
  successRateError: null,
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDeclineReason(reason: DeclineReason): DeclineReason {
  return {
    code: reason.code,
    label: reason.label,
    count: toNumber(reason.count),
  };
}

function normalizeReport(
  report: SuccessTransactionReport,
): SuccessTransactionReport {
  return {
    dateFrom: report.dateFrom,
    dateTo: report.dateTo,
    totalTransactions: toNumber(report.totalTransactions),
    approvedCount: toNumber(report.approvedCount),
    declinedCount: toNumber(report.declinedCount),
    successRatePercent: toNumber(report.successRatePercent),
    approvedAmount: toNumber(report.approvedAmount),
    declinedAmount: toNumber(report.declinedAmount),
    totalAmount: toNumber(report.totalAmount),
    declineReasons: (report.declineReasons ?? []).map(normalizeDeclineReason),
  };
}

export const fetchSuccessTransactions = createAsyncThunk<
  SuccessTransactionReport,
  FetchSuccessTransactionsParams,
  {
    state: RootState;
    rejectValue: string;
  }
>(
  "report/fetchSuccessTransactions",
  async ({ dateFrom, dateTo }, thunkAPI) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }

      const response = await api.get<{
        isSuccessful: boolean;
        message: string;
        data: SuccessTransactionReport;
      }>("/reports/success-transactions", {
        ...withAuthHeader(token),
        params: {
          dateFrom,
          dateTo,
        },
      });

      const report = response.data.data;

      if (!report) {
        return thunkAPI.rejectWithValue(
          "Failed to fetch success transaction report",
        );
      }

      return normalizeReport(report);
    } catch (error) {
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

const reportSlice = createSlice({
  name: "report",
  initialState,
  reducers: {
    clearSuccessRate: (state) => {
      state.successRate = null;
      state.successRateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSuccessTransactions.pending, (state) => {
        state.successRateLoading = true;
        state.successRateError = null;
      })
      .addCase(fetchSuccessTransactions.fulfilled, (state, action) => {
        state.successRateLoading = false;
        state.successRate = action.payload;
      })
      .addCase(fetchSuccessTransactions.rejected, (state, action) => {
        state.successRateLoading = false;
        state.successRateError =
          action.payload || "Failed to fetch success transaction report";
      });
  },
});

export const { clearSuccessRate } = reportSlice.actions;

export default reportSlice.reducer;

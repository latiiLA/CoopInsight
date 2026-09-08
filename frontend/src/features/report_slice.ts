import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../../app/store/store";
import {
  DeclineReason,
  EbirrCardlessWithdrawal,
  SuccessTransactionReport,
  TerminalTransaction,
} from "@/types/report";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import api from "@/lib/api";

interface ReportState {
  successRate: SuccessTransactionReport | null;
  successRateLoading: boolean;
  successRateError: string | null;
  ebirrCardless: EbirrCardlessWithdrawal[];
  ebirrCardlessLoading: boolean;
  ebirrCardlessError: string | null;
  terminalTransactions: TerminalTransaction[];
  terminalTransactionsLoading: boolean;
  terminalTransactionsError: string | null;
}

interface FetchReportDateParams {
  dateFrom: string;
  dateTo: string;
}

interface FetchTerminalTransactionsParams extends FetchReportDateParams {
  terminalId: string;
  fleet: "atm" | "pos";
}

const initialState: ReportState = {
  successRate: null,
  successRateLoading: false,
  successRateError: null,
  ebirrCardless: [],
  ebirrCardlessLoading: false,
  ebirrCardlessError: null,
  terminalTransactions: [],
  terminalTransactionsLoading: false,
  terminalTransactionsError: null,
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown): string {
  if (value == null) {
    return "";
  }
  return String(value);
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

function normalizeEbirrRow(
  row: Omit<EbirrCardlessWithdrawal, "id">,
  index: number,
): EbirrCardlessWithdrawal {
  const bankTransferId = toText(row.bankTransferId);
  const rrn = toText(row.rrn);
  return {
    id: `${bankTransferId || "row"}-${rrn || index}-${index}`,
    rrn,
    terminalName: toText(row.terminalName),
    terminalLocation: toText(row.terminalLocation),
    terminalId: toText(row.terminalId),
    accountNumber: toText(row.accountNumber),
    response: toText(row.response),
    date: toText(row.date),
    amount: toNumber(row.amount),
    customerMobile: toText(row.customerMobile),
    extTxnId: toText(row.extTxnId),
    bankTransferId,
  };
}

export const fetchSuccessTransactions = createAsyncThunk<
  SuccessTransactionReport,
  FetchReportDateParams,
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

export const fetchEbirrCardlessWithdrawal = createAsyncThunk<
  EbirrCardlessWithdrawal[],
  FetchReportDateParams,
  {
    state: RootState;
    rejectValue: string;
  }
>(
  "report/fetchEbirrCardlessWithdrawal",
  async ({ dateFrom, dateTo }, thunkAPI) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }

      const response = await api.get<{
        isSuccessful: boolean;
        message: string;
        data: Omit<EbirrCardlessWithdrawal, "id">[];
      }>("/reports/ebirr-cardless-withdrawal", {
        ...withAuthHeader(token),
        params: {
          dateFrom,
          dateTo,
        },
      });

      const rows = response.data.data;

      if (!rows) {
        return thunkAPI.rejectWithValue(
          "Failed to fetch Ebirr cardless withdrawal report",
        );
      }

      return rows.map(normalizeEbirrRow);
    } catch (error) {
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

function normalizeTerminalTransaction(
  row: Omit<TerminalTransaction, "id">,
  index: number,
): TerminalTransaction {
  const rrn = toText(row.rrn);
  const txnCode = toText(row.txnCode);
  return {
    id: `${rrn || "row"}-${txnCode || index}-${index}`,
    rrn,
    terminalId: toText(row.terminalId),
    terminalName: toText(row.terminalName),
    terminalLocation: toText(row.terminalLocation),
    txnCode,
    txnType: toText(row.txnType) || txnCode,
    response: toText(row.response),
    status: toText(row.status),
    date: toText(row.date),
    amount: toNumber(row.amount),
  };
}

export const fetchTerminalTransactions = createAsyncThunk<
  TerminalTransaction[],
  FetchTerminalTransactionsParams,
  {
    state: RootState;
    rejectValue: string;
  }
>(
  "report/fetchTerminalTransactions",
  async ({ terminalId, dateFrom, dateTo, fleet }, thunkAPI) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }

      const path =
        fleet === "pos"
          ? "/reports/pos-transactions"
          : "/reports/atm-transactions";

      const response = await api.get<{
        isSuccessful: boolean;
        message: string;
        data: Omit<TerminalTransaction, "id">[];
      }>(path, {
        ...withAuthHeader(token),
        params: {
          terminalId,
          dateFrom,
          dateTo,
        },
      });

      const rows = response.data.data;

      if (!rows) {
        return thunkAPI.rejectWithValue(
          "Failed to fetch terminal transactions",
        );
      }

      return rows.map(normalizeTerminalTransaction);
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
    clearEbirrCardless: (state) => {
      state.ebirrCardless = [];
      state.ebirrCardlessError = null;
    },
    clearTerminalTransactions: (state) => {
      state.terminalTransactions = [];
      state.terminalTransactionsError = null;
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
      })
      .addCase(fetchEbirrCardlessWithdrawal.pending, (state) => {
        state.ebirrCardlessLoading = true;
        state.ebirrCardlessError = null;
      })
      .addCase(fetchEbirrCardlessWithdrawal.fulfilled, (state, action) => {
        state.ebirrCardlessLoading = false;
        state.ebirrCardless = action.payload;
      })
      .addCase(fetchEbirrCardlessWithdrawal.rejected, (state, action) => {
        state.ebirrCardlessLoading = false;
        state.ebirrCardlessError =
          action.payload || "Failed to fetch Ebirr cardless withdrawal report";
      })
      .addCase(fetchTerminalTransactions.pending, (state) => {
        state.terminalTransactionsLoading = true;
        state.terminalTransactionsError = null;
      })
      .addCase(fetchTerminalTransactions.fulfilled, (state, action) => {
        state.terminalTransactionsLoading = false;
        state.terminalTransactions = action.payload;
      })
      .addCase(fetchTerminalTransactions.rejected, (state, action) => {
        state.terminalTransactionsLoading = false;
        state.terminalTransactions = [];
        state.terminalTransactionsError =
          action.payload || "Failed to fetch terminal transactions";
      });
  },
});

export const {
  clearSuccessRate,
  clearEbirrCardless,
  clearTerminalTransactions,
} = reportSlice.actions;

export default reportSlice.reducer;

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import { RootState } from "../../app/store/store";
import {
  DeclineReason,
  EbirrCardlessWithdrawal,
  SuccessBrowseOutcome,
  SuccessChannel,
  SuccessFlow,
  SuccessGranularity,
  SuccessRateTrendPoint,
  SuccessRateTrendReport,
  SuccessTransactionDetail,
  SuccessTransactionReport,
  TerminalPerformanceReport,
  TerminalPerformanceRow,
  TerminalSuccessReport,
  TerminalTransaction,
} from "@/types/report";
import {
  TransactionMixReport,
  TransactionMixSegment,
  TransactionMixSlice,
} from "@/types/transaction-mix";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import api from "@/lib/api";

interface ReportState {
  successRate: SuccessTransactionReport | null;
  successRateLoading: boolean;
  successRateError: string | null;
  /**
   * requestId of the most recently dispatched report request.
   *
   * The report query takes tens of seconds, so a superseded request is often
   * still running when a newer one is issued. Without this the slower stale
   * response lands last and overwrites fresher data, which makes the totals on
   * screen change after they were first drawn.
   */
  successRateRequestId: string | null;
  successRateTrend: SuccessRateTrendReport | null;
  successRateTrendLoading: boolean;
  successRateTrendError: string | null;
  /**
   * requestId of the most recently dispatched trend request.
   *
   * The trend query is heavy, so a superseded request can still be in flight
   * when a newer one is issued. Without this, the slower stale response lands
   * last and overwrites fresher data, which makes the totals on screen change
   * after they were first drawn.
   */
  successRateTrendRequestId: string | null;
  successBrowse: SuccessTransactionDetail[];
  successBrowseLoading: boolean;
  successBrowseError: string | null;
  ebirrCardless: EbirrCardlessWithdrawal[];
  ebirrCardlessLoading: boolean;
  ebirrCardlessError: string | null;
  terminalTransactions: TerminalTransaction[];
  terminalTransactionsLoading: boolean;
  terminalTransactionsError: string | null;
  terminalComparison: TerminalPerformanceReport | null;
  terminalComparisonLoading: boolean;
  terminalComparisonError: string | null;
  terminalSuccessRate: TerminalSuccessReport[];
  terminalSuccessRateLoading: boolean;
  terminalSuccessRateError: string | null;
  /**
   * Channel the rows in terminalSuccessRate belong to.
   *
   * Both fleets share this one slot, so without it a slow POS response could
   * land after the user opened the ATM page and render POS terminals there.
   */
  terminalSuccessRateChannel: string | null;
  transactionMix: TransactionMixReport | null;
  transactionMixLoading: boolean;
  transactionMixError: string | null;
  /**
   * requestId of the most recently dispatched mix request.
   *
   * The mix aggregate reads every row in the range, so a superseded request is
   * regularly still running when newer filters are applied. Without this the
   * slower stale response lands last and replaces fresher percentages.
   */
  transactionMixRequestId: string | null;
}

interface FetchReportDateParams {
  dateFrom: string;
  dateTo: string;
}

interface FetchSuccessTransactionsParams extends FetchReportDateParams {
  channel?: SuccessChannel;
  flow?: SuccessFlow;
}

interface FetchSuccessBrowseParams extends FetchReportDateParams {
  channel: SuccessChannel;
  flow: SuccessFlow;
  outcome?: SuccessBrowseOutcome;
  respCode?: string;
  limit?: number;
}

interface FetchTerminalSuccessRateParams extends FetchReportDateParams {
  channel?: "pos" | "atm";
}

interface FetchSuccessRateTrendParams extends FetchReportDateParams {
  channel: SuccessChannel;
  flow: SuccessFlow;
  granularity?: SuccessGranularity;
}

const successRatePaths: Partial<
  Record<`${SuccessChannel}-${SuccessFlow}`, string>
> = {
  "atm-overall": "/reports/atm-overall-success-rate",
  "atm-acquiring": "/reports/atm-acquiring-success-rate",
  "atm-onus": "/reports/atm-onus-success-rate",
  "atm-offus": "/reports/atm-offus-success-rate",
  "atm-issuing": "/reports/atm-issuing-success-rate",
  "pos-overall": "/reports/pos-overall-success-rate",
  "pos-acquiring": "/reports/pos-acquiring-success-rate",
  "pos-onus": "/reports/pos-onus-success-rate",
  "pos-offus": "/reports/pos-offus-success-rate",
  "pos-issuing": "/reports/pos-issuing-success-rate",
  "switch-overall": "/reports/switch-overall-success-rate",
  "switch-onus": "/reports/switch-onus-success-rate",
  "switch-offus": "/reports/switch-offus-success-rate",
  "switch-issuing": "/reports/switch-issuing-success-rate",
};

interface FetchTerminalTransactionsParams extends FetchReportDateParams {
  terminalId: string;
  fleet: "atm" | "pos";
}

interface FetchTerminalComparisonParams extends FetchReportDateParams {
  fleet: "atm" | "pos";
}

interface FetchTransactionMixParams extends FetchReportDateParams {
  channel?: SuccessChannel;
}

const initialState: ReportState = {
  successRate: null,
  successRateLoading: false,
  successRateError: null,
  successRateRequestId: null,
  successRateTrend: null,
  successRateTrendLoading: false,
  successRateTrendError: null,
  successRateTrendRequestId: null,
  successBrowse: [],
  successBrowseLoading: false,
  successBrowseError: null,
  ebirrCardless: [],
  ebirrCardlessLoading: false,
  ebirrCardlessError: null,
  terminalTransactions: [],
  terminalTransactionsLoading: false,
  terminalTransactionsError: null,
  terminalComparison: null,
  terminalComparisonLoading: false,
  terminalComparisonError: null,
  terminalSuccessRate: [],
  terminalSuccessRateLoading: false,
  terminalSuccessRateError: null,
  terminalSuccessRateChannel: null,
  transactionMix: null,
  transactionMixLoading: false,
  transactionMixError: null,
  transactionMixRequestId: null,
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

function normalizeFlow(flow: string | undefined): SuccessFlow {
  if (
    flow === "overall" ||
    flow === "onus" ||
    flow === "offus" ||
    flow === "issuing" ||
    flow === "acquiring"
  ) {
    return flow;
  }
  return "acquiring";
}

function normalizeGranularity(value: string | undefined): SuccessGranularity {
  if (value === "day" || value === "week" || value === "month") {
    return value;
  }
  return "day";
}

function normalizeTrendPoint(point: SuccessRateTrendPoint): SuccessRateTrendPoint {
  return {
    periodStart: toText(point.periodStart),
    periodLabel: toText(point.periodLabel),
    totalTransactions: toNumber(point.totalTransactions),
    approvedCount: toNumber(point.approvedCount),
    declinedCount: toNumber(point.declinedCount),
    successRatePercent: toNumber(point.successRatePercent),
    approvedAmount: toNumber(point.approvedAmount),
    declinedAmount: toNumber(point.declinedAmount),
    totalAmount: toNumber(point.totalAmount),
  };
}

function normalizeTrendReport(
  report: SuccessRateTrendReport,
): SuccessRateTrendReport {
  return {
    dateFrom: report.dateFrom,
    dateTo: report.dateTo,
    channel:
      report.channel === "pos"
        ? "pos"
        : report.channel === "switch"
          ? "switch"
          : "atm",
    flow: normalizeFlow(report.flow),
    granularity: normalizeGranularity(report.granularity),
    points: (report.points ?? []).map(normalizeTrendPoint),
  };
}

function normalizeReport(
  report: SuccessTransactionReport,
): SuccessTransactionReport {
  return {
    dateFrom: report.dateFrom,
    dateTo: report.dateTo,
    channel: report.channel === "pos" ? "pos" : report.channel === "switch" ? "switch" : "atm",
    flow: normalizeFlow(report.flow),
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
  FetchSuccessTransactionsParams,
  {
    state: RootState;
    rejectValue: string;
  }
>(
  "report/fetchSuccessTransactions",
  async ({ dateFrom, dateTo, channel = "atm", flow = "acquiring" }, thunkAPI) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }

      const path =
        successRatePaths[`${channel}-${flow}`] ??
        "/reports/atm-acquiring-success-rate";

      const response = await api.get<{
        isSuccessful: boolean;
        message: string;
        data: SuccessTransactionReport;
      }>(path, {
        ...withAuthHeader(token),
        params: {
          dateFrom,
          dateTo,
        },
        // Lets a superseded request be cancelled when the filters change again,
        // so a slow response cannot come back to overwrite fresher data.
        signal: thunkAPI.signal,
        timeout: 180_000,
      });

      const report = response.data.data;

      if (!report) {
        return thunkAPI.rejectWithValue(
          "Failed to fetch success transaction report",
        );
      }

      return normalizeReport(report);
    } catch (error) {
      // Rethrow on cancellation so the action is marked aborted and the reducer
      // can ignore it. Swallowing it marks a superseded request as a genuine
      // failure and surfaces a spurious error toast.
      if (
        thunkAPI.signal.aborted ||
        (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
      ) {
        throw error;
      }
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchTerminalSuccessRate = createAsyncThunk<
  TerminalSuccessReport[],
  FetchTerminalSuccessRateParams,
  {
    state: RootState;
    rejectValue: string;
  }
>(
  "report/fetchTerminalSuccessRate",
  async ({ dateFrom, dateTo, channel = "pos" }, thunkAPI) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }

      const response = await api.get<{
        isSuccessful: boolean;
        message: string;
        data: TerminalSuccessReport[];
      }>(`/reports/${channel}-terminal-success-rate`, {
        ...withAuthHeader(token),
        params: {
          dateFrom,
          dateTo,
          channel,
        },
        signal: thunkAPI.signal,
        timeout: 180_000,
      });

      const rows = response.data.data;

      if (!rows) {
        return thunkAPI.rejectWithValue(
          "Failed to fetch terminal success rate",
        );
      }

      return rows.map((row) => ({
        terminalId: toText(row.terminalId),
        channel: toText(row.channel),
        totalTransactions: toNumber(row.totalTransactions),
        approvedCount: toNumber(row.approvedCount),
        declinedCount: toNumber(row.declinedCount),
        successRatePercent: toNumber(row.successRatePercent),
        approvedAmount: toNumber(row.approvedAmount),
        declinedAmount: toNumber(row.declinedAmount),
        totalAmount: toNumber(row.totalAmount),
        declineReasons: (row.declineReasons ?? []).map(normalizeDeclineReason),
      }));
    } catch (error) {
      if (
        thunkAPI.signal.aborted ||
        (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
      ) {
        throw error;
      }
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchSuccessBrowse = createAsyncThunk<
  SuccessTransactionDetail[],
  FetchSuccessBrowseParams,
  {
    state: RootState;
    rejectValue: string;
  }
>(
  "report/fetchSuccessBrowse",
  async (
    { dateFrom, dateTo, channel, flow, outcome = "all", respCode, limit = 250 },
    thunkAPI,
  ) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }

      const response = await api.get<{
        isSuccessful: boolean;
        message: string;
        data: SuccessTransactionDetail[];
      }>("/reports/success-transactions", {
        ...withAuthHeader(token),
        params: {
          dateFrom,
          dateTo,
          channel,
          flow,
          outcome,
          respCode: respCode || undefined,
          limit,
        },
      });

      return (response.data.data ?? []).map((row, index) => ({
        ...row,
        id: row.id || `${row.refNum || "row"}-${index}`,
        amount: Number(row.amount) || 0,
        msgType: Number(row.msgType) || 0,
        merchantType: Number(row.merchantType) || 0,
      }));
    } catch (error) {
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchSuccessRateTrend = createAsyncThunk<
  SuccessRateTrendReport,
  FetchSuccessRateTrendParams,
  {
    state: RootState;
    rejectValue: string;
  }
>(
  "report/fetchSuccessRateTrend",
  async ({ dateFrom, dateTo, channel, flow, granularity }, thunkAPI) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }

      const response = await api.get<{
        isSuccessful: boolean;
        message: string;
        data: SuccessRateTrendReport;
      }>("/reports/success-rate-trend", {
        ...withAuthHeader(token),
        params: {
          dateFrom,
          dateTo,
          channel,
          flow,
          granularity: granularity || undefined,
        },
        // Lets a superseded request be cancelled when the filters change again,
        // so a slow response cannot come back to overwrite fresher data.
        signal: thunkAPI.signal,
        timeout: 180_000,
      });

      const report = response.data.data;
      if (!report) {
        return thunkAPI.rejectWithValue("Failed to fetch success rate trend");
      }

      return normalizeTrendReport(report);
    } catch (error) {
      // Rethrow on cancellation so the action is marked aborted and the reducer
      // can ignore it. Swallowing it here would mark a superseded request as a
      // genuine failure and clear fresher data.
      if (
        thunkAPI.signal.aborted ||
        (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
      ) {
        throw error;
      }
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

function normalizePerformanceRow(
  row: Omit<TerminalPerformanceRow, "id">,
  index: number,
): TerminalPerformanceRow {
  const terminalId = toText(row.terminalId);
  return {
    id: terminalId || `row-${index}`,
    rank: toNumber(row.rank),
    terminalId,
    terminalName: toText(row.terminalName),
    branchName: toText(row.branchName),
    transactionCount: toNumber(row.transactionCount),
    approvedCount: toNumber(row.approvedCount),
    amount: toNumber(row.amount),
    approvedAmount: toNumber(row.approvedAmount),
  };
}

function normalizePerformanceReport(
  report: TerminalPerformanceReport,
): TerminalPerformanceReport {
  return {
    fleet: toText(report.fleet),
    terminalCount: toNumber(report.terminalCount),
    activeCount: toNumber(report.activeCount),
    transactionCount: toNumber(report.transactionCount),
    totalAmount: toNumber(report.totalAmount),
    highest: (report.highest ?? []).map(normalizePerformanceRow),
    lowest: (report.lowest ?? []).map(normalizePerformanceRow),
    rows: (report.rows ?? []).map(normalizePerformanceRow),
  };
}

export const fetchTerminalComparison = createAsyncThunk<
  TerminalPerformanceReport,
  FetchTerminalComparisonParams,
  {
    state: RootState;
    rejectValue: string;
  }
>(
  "report/fetchTerminalComparison",
  async ({ fleet, dateFrom, dateTo }, thunkAPI) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }

      const path =
        fleet === "pos"
          ? "/reports/pos-terminal-comparison"
          : "/reports/atm-terminal-comparison";

      const response = await api.get<{
        isSuccessful: boolean;
        message: string;
        data: TerminalPerformanceReport;
      }>(path, {
        ...withAuthHeader(token),
        params: {
          dateFrom,
          dateTo,
        },
      });

      const report = response.data.data;

      if (!report) {
        return thunkAPI.rejectWithValue(
          "Failed to fetch terminal comparison",
        );
      }

      return normalizePerformanceReport(report);
    } catch (error) {
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

function normalizeMixSlice(
  slice: TransactionMixSlice,
): TransactionMixSlice {
  return {
    key: toText(slice.key),
    label: toText(slice.label),
    count: toNumber(slice.count),
    countPercent: toNumber(slice.countPercent),
    amount: toNumber(slice.amount),
    amountPercent: toNumber(slice.amountPercent),
  };
}

function normalizeMixSegment(
  segment: TransactionMixSegment,
): TransactionMixSegment {
  return {
    ...normalizeMixSlice(segment),
    reversalCount: toNumber(segment.reversalCount),
    reversalPercent: toNumber(segment.reversalPercent),
  };
}

function normalizeTransactionMix(
  report: TransactionMixReport,
): TransactionMixReport {
  return {
    dateFrom: toText(report.dateFrom),
    dateTo: toText(report.dateTo),
    channel:
      report.channel === "pos"
        ? "pos"
        : report.channel === "switch"
          ? "switch"
          : "atm",
    totalCount: toNumber(report.totalCount),
    totalAmount: toNumber(report.totalAmount),
    authorisationCount: toNumber(report.authorisationCount),
    reversalCount: toNumber(report.reversalCount),
    reversalPercent: toNumber(report.reversalPercent),
    approvedCount: toNumber(report.approvedCount),
    byScheme: (report.byScheme ?? []).map(normalizeMixSegment),
    byRouting: (report.byRouting ?? []).map(normalizeMixSegment),
    byType: (report.byType ?? []).map(normalizeMixSlice),
  };
}

export const fetchTransactionMix = createAsyncThunk<
  TransactionMixReport,
  FetchTransactionMixParams,
  {
    state: RootState;
    rejectValue: string;
  }
>(
  "report/fetchTransactionMix",
  async ({ dateFrom, dateTo, channel = "switch" }, thunkAPI) => {
    try {
      const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

      if (!token) {
        return thunkAPI.rejectWithValue("Authentication token not found");
      }

      const response = await api.get<{
        isSuccessful: boolean;
        message: string;
        data: TransactionMixReport;
      }>("/reports/transaction-mix", {
        ...withAuthHeader(token),
        params: {
          dateFrom,
          dateTo,
          channel,
        },
        // Lets a superseded request be cancelled when the filters change again,
        // so a slow response cannot come back to overwrite fresher data.
        signal: thunkAPI.signal,
        timeout: 180_000,
      });

      const report = response.data.data;
      if (!report) {
        return thunkAPI.rejectWithValue("Failed to fetch transaction mix report");
      }

      return normalizeTransactionMix(report);
    } catch (error) {
      // Rethrow on cancellation so the action is marked aborted and the reducer
      // can ignore it. Swallowing it here would mark a superseded request as a
      // genuine failure and clear fresher data.
      if (
        thunkAPI.signal.aborted ||
        (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
      ) {
        throw error;
      }
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
    clearSuccessRateTrend: (state) => {
      state.successRateTrend = null;
      state.successRateTrendError = null;
    },
    clearSuccessBrowse: (state) => {
      state.successBrowse = [];
      state.successBrowseError = null;
    },
    clearEbirrCardless: (state) => {
      state.ebirrCardless = [];
      state.ebirrCardlessError = null;
    },
    clearTerminalTransactions: (state) => {
      state.terminalTransactions = [];
      state.terminalTransactionsError = null;
    },
    clearTerminalComparison: (state) => {
      state.terminalComparison = null;
      state.terminalComparisonError = null;
    },
    clearTerminalSuccessRate: (state) => {
      state.terminalSuccessRate = [];
      state.terminalSuccessRateError = null;
      state.terminalSuccessRateChannel = null;
    },
    clearTransactionMix: (state) => {
      state.transactionMix = null;
      state.transactionMixError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSuccessTransactions.pending, (state, action) => {
        state.successRateLoading = true;
        state.successRateError = null;
        // Claim ownership of the slot. A response from any earlier request is
        // stale from this point on and is discarded when it arrives.
        state.successRateRequestId = action.meta.requestId;
        // Always drop the previous report. It used to be kept when only the
        // date range changed, which left the old range's totals on screen
        // under the newly selected dates.
        state.successRate = null;
      })
      .addCase(fetchSuccessTransactions.fulfilled, (state, action) => {
        if (state.successRateRequestId !== action.meta.requestId) {
          return;
        }
        state.successRateLoading = false;
        state.successRate = action.payload;
      })
      .addCase(fetchSuccessTransactions.rejected, (state, action) => {
        if (action.meta.aborted) return;
        if (state.successRateRequestId !== action.meta.requestId) {
          return;
        }
        state.successRateLoading = false;
        state.successRateError =
          action.payload || "Failed to fetch success transaction report";
      })
      .addCase(fetchSuccessRateTrend.pending, (state, action) => {
        state.successRateTrendLoading = true;
        state.successRateTrendError = null;
        // Claim ownership of the slot. A response from any earlier request is
        // stale from this point on and is discarded when it arrives.
        state.successRateTrendRequestId = action.meta.requestId;
        state.successRateTrend = null;
      })
      .addCase(fetchSuccessRateTrend.fulfilled, (state, action) => {
        if (state.successRateTrendRequestId !== action.meta.requestId) {
          return;
        }
        state.successRateTrendLoading = false;
        state.successRateTrend = action.payload;
      })
      .addCase(fetchSuccessRateTrend.rejected, (state, action) => {
        if (action.meta.aborted) return;
        if (state.successRateTrendRequestId !== action.meta.requestId) {
          return;
        }
        state.successRateTrendLoading = false;
        state.successRateTrend = null;
        state.successRateTrendError =
          action.payload || "Failed to fetch success rate trend";
      })
      .addCase(fetchSuccessBrowse.pending, (state) => {
        state.successBrowseLoading = true;
        state.successBrowseError = null;
      })
      .addCase(fetchSuccessBrowse.fulfilled, (state, action) => {
        state.successBrowseLoading = false;
        state.successBrowse = action.payload;
      })
      .addCase(fetchSuccessBrowse.rejected, (state, action) => {
        state.successBrowseLoading = false;
        state.successBrowse = [];
        state.successBrowseError =
          action.payload || "Failed to fetch success transactions";
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
      })
      .addCase(fetchTerminalComparison.pending, (state) => {
        state.terminalComparisonLoading = true;
        state.terminalComparisonError = null;
      })
      .addCase(fetchTerminalComparison.fulfilled, (state, action) => {
        state.terminalComparisonLoading = false;
        state.terminalComparison = action.payload;
      })
      .addCase(fetchTerminalComparison.rejected, (state, action) => {
        state.terminalComparisonLoading = false;
        state.terminalComparison = null;
        state.terminalComparisonError =
          action.payload || "Failed to fetch terminal comparison";
      })
      .addCase(fetchTerminalSuccessRate.pending, (state, action) => {
        state.terminalSuccessRateLoading = true;
        state.terminalSuccessRateError = null;
        state.terminalSuccessRateChannel =
          action.meta.arg.channel ?? "pos";
        state.terminalSuccessRate = [];
      })
      .addCase(fetchTerminalSuccessRate.fulfilled, (state, action) => {
        // Discard a response the user has already navigated away from.
        if (state.terminalSuccessRateChannel !== (action.meta.arg.channel ?? "pos")) {
          return;
        }
        state.terminalSuccessRateLoading = false;
        state.terminalSuccessRate = action.payload;
      })
      .addCase(fetchTerminalSuccessRate.rejected, (state, action) => {
        if (action.meta.aborted) return;
        if (state.terminalSuccessRateChannel !== (action.meta.arg.channel ?? "pos")) {
          return;
        }
        state.terminalSuccessRateLoading = false;
        state.terminalSuccessRate = [];
        state.terminalSuccessRateError =
          action.payload || "Failed to fetch terminal success rate";
      })
      .addCase(fetchTransactionMix.pending, (state, action) => {
        state.transactionMixLoading = true;
        state.transactionMixError = null;
        // Claim ownership of the slot. A response from any earlier request is
        // stale from this point on and is discarded when it arrives.
        state.transactionMixRequestId = action.meta.requestId;
        state.transactionMix = null;
      })
      .addCase(fetchTransactionMix.fulfilled, (state, action) => {
        if (state.transactionMixRequestId !== action.meta.requestId) {
          return;
        }
        state.transactionMixLoading = false;
        state.transactionMix = action.payload;
      })
      .addCase(fetchTransactionMix.rejected, (state, action) => {
        if (action.meta.aborted) return;
        if (state.transactionMixRequestId !== action.meta.requestId) {
          return;
        }
        state.transactionMixLoading = false;
        state.transactionMix = null;
        state.transactionMixError =
          action.payload || "Failed to fetch transaction mix report";
      });
  },
});

export const {
  clearSuccessRate,
  clearSuccessRateTrend,
  clearSuccessBrowse,
  clearEbirrCardless,
  clearTerminalTransactions,
  clearTerminalComparison,
  clearTerminalSuccessRate,
  clearTransactionMix,
} = reportSlice.actions;

export default reportSlice.reducer;

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

import { RootState } from "../../app/store/store";
import api from "@/lib/api";
import type { EJBrowseArgs, EJBrowseFile, EJBrowseTerminal } from "@/types/ej-browse";
import type { EJJournalFileView } from "@/types/ej-transaction-search";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";

interface EJBrowseState {
  terminals: EJBrowseTerminal[];
  files: EJBrowseFile[];
  selectedTerminal: string | null;
  submitted: boolean;
  terminalsLoading: boolean;
  filesLoading: boolean;
  error: string | null;
  lastArgs: EJBrowseArgs | null;
  journalFile: EJJournalFileView | null;
  journalFileLoading: boolean;
  journalFileError: string | null;
}

const initialState: EJBrowseState = {
  terminals: [],
  files: [],
  selectedTerminal: null,
  submitted: false,
  terminalsLoading: false,
  filesLoading: false,
  error: null,
  lastArgs: null,
  journalFile: null,
  journalFileLoading: false,
  journalFileError: null,
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

export const fetchEJBrowseTerminals = createAsyncThunk<
  EJBrowseTerminal[],
  EJBrowseArgs,
  { state: RootState; rejectValue: string }
>("ejBrowse/fetchTerminals", async (args, thunkAPI) => {
  const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
  if (!token) {
    return thunkAPI.rejectWithValue("Authentication token not found");
  }
  try {
    const response = await api.get<{ data: EJBrowseTerminal[] }>(
      "/reports/ej-browse/terminals",
      {
        ...withAuthHeader(token),
        params: { dateFrom: args.dateFrom, dateTo: args.dateTo },
        signal: thunkAPI.signal,
      },
    );
    return response.data.data ?? [];
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      return thunkAPI.rejectWithValue("canceled");
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchEJBrowseFiles = createAsyncThunk<
  { terminalId: string; files: EJBrowseFile[] },
  EJBrowseArgs & { terminalId: string },
  { state: RootState; rejectValue: string }
>("ejBrowse/fetchFiles", async (args, thunkAPI) => {
  const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
  if (!token) {
    return thunkAPI.rejectWithValue("Authentication token not found");
  }
  const terminalId = args.terminalId.trim().toUpperCase();
  try {
    const response = await api.get<{ data: EJBrowseFile[] }>(
      `/reports/ej-browse/terminals/${encodeURIComponent(terminalId)}/files`,
      {
        ...withAuthHeader(token),
        params: { dateFrom: args.dateFrom, dateTo: args.dateTo },
        signal: thunkAPI.signal,
      },
    );
    return { terminalId, files: response.data.data ?? [] };
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      return thunkAPI.rejectWithValue("canceled");
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchEJBrowseJournalFile = createAsyncThunk<
  EJJournalFileView,
  { terminalId: string; filename: string },
  { state: RootState; rejectValue: string }
>("ejBrowse/fetchJournalFile", async (args, thunkAPI) => {
  const token = getTokenFromAuth(thunkAPI.getState().user.authUser);
  if (!token) {
    return thunkAPI.rejectWithValue("Authentication token not found");
  }
  const terminalId = args.terminalId.trim().toUpperCase();
  const filename = args.filename.trim();
  try {
    const response = await api.get<{ data: EJJournalFileView }>(
      `/reports/ej-browse/terminals/${encodeURIComponent(terminalId)}/files/${encodeURIComponent(filename)}/journal`,
      {
        ...withAuthHeader(token),
        signal: thunkAPI.signal,
        timeout: 120_000,
      },
    );
    if (!response.data.data) {
      return thunkAPI.rejectWithValue("Journal file not found");
    }
    return response.data.data;
  } catch (error) {
    if (isCanceled(thunkAPI, error)) {
      return thunkAPI.rejectWithValue("canceled");
    }
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

const ejBrowseSlice = createSlice({
  name: "ejBrowse",
  initialState,
  reducers: {
    clearEJBrowse: () => initialState,
    clearEJBrowseFiles: (state) => {
      state.files = [];
      state.selectedTerminal = null;
      state.filesLoading = false;
    },
    clearEJBrowseJournal: (state) => {
      state.journalFile = null;
      state.journalFileLoading = false;
      state.journalFileError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEJBrowseTerminals.pending, (state, action) => {
        state.terminalsLoading = true;
        state.error = null;
        state.submitted = true;
        state.lastArgs = action.meta.arg;
        state.terminals = [];
        state.files = [];
        state.selectedTerminal = null;
      })
      .addCase(fetchEJBrowseTerminals.fulfilled, (state, action) => {
        state.terminalsLoading = false;
        state.terminals = action.payload;
      })
      .addCase(fetchEJBrowseTerminals.rejected, (state, action) => {
        if (action.payload === "canceled") return;
        state.terminalsLoading = false;
        state.terminals = [];
        state.error = action.payload || "Failed to list terminals";
      })
      .addCase(fetchEJBrowseFiles.pending, (state) => {
        state.filesLoading = true;
        state.error = null;
        state.files = [];
      })
      .addCase(fetchEJBrowseFiles.fulfilled, (state, action) => {
        state.filesLoading = false;
        state.selectedTerminal = action.payload.terminalId;
        state.files = action.payload.files;
      })
      .addCase(fetchEJBrowseFiles.rejected, (state, action) => {
        if (action.payload === "canceled") return;
        state.filesLoading = false;
        state.files = [];
        state.error = action.payload || "Failed to list journal files";
      })
      .addCase(fetchEJBrowseJournalFile.pending, (state) => {
        state.journalFileLoading = true;
        state.journalFileError = null;
        state.journalFile = null;
      })
      .addCase(fetchEJBrowseJournalFile.fulfilled, (state, action) => {
        state.journalFileLoading = false;
        state.journalFile = action.payload;
      })
      .addCase(fetchEJBrowseJournalFile.rejected, (state, action) => {
        if (action.payload === "canceled") return;
        state.journalFileLoading = false;
        state.journalFile = null;
        state.journalFileError = action.payload || "Failed to open journal";
      });
  },
});

export const { clearEJBrowse, clearEJBrowseFiles, clearEJBrowseJournal } =
  ejBrowseSlice.actions;

export default ejBrowseSlice.reducer;

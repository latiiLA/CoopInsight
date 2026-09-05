import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { RootState } from "../../app/store/store";
import { AtmTerminal } from "@/types/atm-terminal";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import api from "@/lib/api";

interface AtmTerminalState {
  terminals: AtmTerminal[];
  loading: boolean;
  error: string | null;
}

const initialState: AtmTerminalState = {
  terminals: [],
  loading: false,
  error: null,
};

export const fetchAtmTerminals = createAsyncThunk<
  AtmTerminal[],
  void,
  {
    state: RootState;
    rejectValue: string;
  }
>("atmTerminal/fetchAtmTerminals", async (_, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get("/terminals/atm", withAuthHeader(token));

    return response.data.data ?? [];
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

const atmTerminalSlice = createSlice({
  name: "atmTerminal",
  initialState,
  reducers: {
    clearAtmTerminals: (state) => {
      state.terminals = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAtmTerminals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAtmTerminals.fulfilled, (state, action) => {
        state.loading = false;
        state.terminals = action.payload;
      })
      .addCase(fetchAtmTerminals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to fetch ATM terminals";
      });
  },
});

export const { clearAtmTerminals } = atmTerminalSlice.actions;

export default atmTerminalSlice.reducer;

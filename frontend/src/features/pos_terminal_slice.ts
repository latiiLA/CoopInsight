import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { RootState } from "../../app/store/store";
import { PosTerminal } from "@/types/pos-terminal";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import api from "@/lib/api";

interface PosTerminalState {
  terminals: PosTerminal[];
  loading: boolean;
  error: string | null;
}

const initialState: PosTerminalState = {
  terminals: [],
  loading: false,
  error: null,
};

export const fetchPosTerminals = createAsyncThunk<
  PosTerminal[],
  void,
  {
    state: RootState;
    rejectValue: string;
  }
>("posTerminal/fetchPosTerminals", async (_, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get("/terminals/pos", withAuthHeader(token));

    return response.data.data ?? [];
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

const posTerminalSlice = createSlice({
  name: "posTerminal",
  initialState,
  reducers: {
    clearPosTerminals: (state) => {
      state.terminals = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPosTerminals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPosTerminals.fulfilled, (state, action) => {
        state.loading = false;
        state.terminals = action.payload;
      })
      .addCase(fetchPosTerminals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to fetch POS terminals";
      });
  },
});

export const { clearPosTerminals } = posTerminalSlice.actions;

export default posTerminalSlice.reducer;

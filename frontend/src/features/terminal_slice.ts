import config from "@/configs/config";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { RootState } from "../../app/store/store";

export interface DepositPerTerminal {
  BRANCH_CODE: string;
  BRANCH_NAME: string;
  DISTRICT: string;
  NUMBER_TRNX: number;
  TERMINAL_ID: string;
  TERMINAL_NAME: string;
  TOTAL_AMT: number;
}

interface DepositPerTerminalState {
  data: DepositPerTerminal[];
  loading: boolean;
  error: string | null;
}

interface FetchDepositPerTerminalParams {
  dateFrom: string;
  dateTo: string;
}

const initialState: DepositPerTerminalState = {
  data: [],
  loading: false,
  error: null,
};

export const fetchDepositPerTerminal = createAsyncThunk<
  DepositPerTerminal[],
  FetchDepositPerTerminalParams,
  {
    state: RootState;
    rejectValue: string;
  }
>(
  "depositPerTerminal/fetchDepositPerTerminal",
  async ({ dateFrom, dateTo }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().user.authUser?.data.token;

      if (!token) {
        return thunkAPI.rejectWithValue(
          "Authentication token not found",
        );
      }

      const response = await axios.get(
        `${config.API_URL}/tests/test`,
        {
          params: {
            dateFrom,
            dateTo,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data.data.map((item: any) => ({
        ...item,
        NUMBER_TRNX: Number(item.NUMBER_TRNX),
        TOTAL_AMT: Number(item.TOTAL_AMT),
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return thunkAPI.rejectWithValue(
          error.response?.data?.message ||
            "Failed to fetch deposit per terminal data",
        );
      }

      return thunkAPI.rejectWithValue(
        "Failed to fetch deposit per terminal data",
      );
    }
  },
);

const depositPerTerminalSlice = createSlice({
  name: "depositPerTerminal",
  initialState,
  reducers: {
    clearDepositPerTerminal: (state) => {
      state.data = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepositPerTerminal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDepositPerTerminal.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchDepositPerTerminal.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          "Failed to fetch deposit per terminal data";
      });
  },
});

export const { clearDepositPerTerminal } =
  depositPerTerminalSlice.actions;

export default depositPerTerminalSlice.reducer;
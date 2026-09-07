import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../../app/store/store";
import {
  AccountRequest,
  getAccountRequestId,
} from "@/types/account-request";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import api from "@/lib/api";

interface AccountRequestState {
  requests: AccountRequest[];
  requestsLoading: boolean;
  requestsError: string | null;
  selectedRequest: AccountRequest | null;
  requestDetailLoading: boolean;
  requestDetailError: string | null;
}

const initialState: AccountRequestState = {
  requests: [],
  requestsLoading: false,
  requestsError: null,
  selectedRequest: null,
  requestDetailLoading: false,
  requestDetailError: null,
};

export const fetchAccountRequests = createAsyncThunk<
  AccountRequest[],
  void,
  { state: RootState; rejectValue: string }
>("accountRequest/fetchAccountRequests", async (_, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      isSuccessful: boolean;
      message: string;
      data: AccountRequest[];
    }>("/account-requests", withAuthHeader(token));

    return response.data.data ?? [];
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchAccountRequestById = createAsyncThunk<
  AccountRequest,
  string,
  { state: RootState; rejectValue: string }
>("accountRequest/fetchAccountRequestById", async (id, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      isSuccessful: boolean;
      message: string;
      data: AccountRequest;
    }>(`/account-requests/${id}`, withAuthHeader(token));

    const request = response.data.data;

    if (!request || !getAccountRequestId(request)) {
      return thunkAPI.rejectWithValue("Account request not found");
    }

    return request;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

const accountRequestSlice = createSlice({
  name: "accountRequest",
  initialState,
  reducers: {
    clearAccountRequestsError: (state) => {
      state.requestsError = null;
    },
    clearSelectedAccountRequest: (state) => {
      state.selectedRequest = null;
      state.requestDetailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccountRequests.pending, (state) => {
        state.requestsLoading = true;
        state.requestsError = null;
      })
      .addCase(fetchAccountRequests.fulfilled, (state, action) => {
        state.requestsLoading = false;
        state.requests = action.payload;
        state.requestsError = null;
      })
      .addCase(fetchAccountRequests.rejected, (state, action) => {
        state.requestsLoading = false;
        state.requestsError =
          action.payload || "Failed to fetch account requests";
      })
      .addCase(fetchAccountRequestById.pending, (state) => {
        state.requestDetailLoading = true;
        state.requestDetailError = null;
      })
      .addCase(fetchAccountRequestById.fulfilled, (state, action) => {
        state.requestDetailLoading = false;
        state.selectedRequest = action.payload;
        state.requestDetailError = null;
      })
      .addCase(fetchAccountRequestById.rejected, (state, action) => {
        state.requestDetailLoading = false;
        state.selectedRequest = null;
        state.requestDetailError =
          action.payload || "Failed to fetch account request";
      });
  },
});

export const { clearAccountRequestsError, clearSelectedAccountRequest } =
  accountRequestSlice.actions;

export default accountRequestSlice.reducer;

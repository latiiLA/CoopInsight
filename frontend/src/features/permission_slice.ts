import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../../app/store/store";
import { CreatePermissionDTO, Permission } from "@/types/permission";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import api from "@/lib/api";

interface PermissionState {
  allPermissions: Permission[];
  permissionLoading: boolean;
  permissionError: string | null;
  createLoading: boolean;
  createError: string | null;
}

const initialState: PermissionState = {
  allPermissions: [],
  permissionLoading: false,
  permissionError: null,
  createLoading: false,
  createError: null,
};

export const fetchPermissions = createAsyncThunk<
  Permission[],
  void,
  {
    state: RootState;
    rejectValue: string;
  }
>("permission/fetchPermissions", async (_, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get("/permissions", withAuthHeader(token));

    return response.data.data ?? [];
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const createPermission = createAsyncThunk<
  string,
  CreatePermissionDTO,
  {
    state: RootState;
    rejectValue: string;
  }
>("permission/createPermission", async (payload, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.post<{
      isSuccessful: boolean;
      message: string;
    }>("/permissions", payload, withAuthHeader(token));

    return response.data.message || "Permission created successfully";
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

const permissionSlice = createSlice({
  name: "permission",
  initialState,
  reducers: {
    clearPermissions: (state) => {
      state.allPermissions = [];
      state.permissionError = null;
    },
    clearCreateError: (state) => {
      state.createError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPermissions.pending, (state) => {
        state.permissionLoading = true;
        state.permissionError = null;
      })
      .addCase(fetchPermissions.fulfilled, (state, action) => {
        state.permissionLoading = false;
        state.allPermissions = action.payload;
      })
      .addCase(fetchPermissions.rejected, (state, action) => {
        state.permissionLoading = false;
        state.permissionError = action.payload || "Failed to fetch permissions";
      })
      .addCase(createPermission.pending, (state) => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(createPermission.fulfilled, (state) => {
        state.createLoading = false;
        state.createError = null;
      })
      .addCase(createPermission.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload || "Failed to create permission";
      });
  },
});

export const { clearPermissions, clearCreateError } = permissionSlice.actions;

export default permissionSlice.reducer;

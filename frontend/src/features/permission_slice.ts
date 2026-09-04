import config from "@/configs/config";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { RootState } from "../../app/store/store";
import { Permission } from "@/types/permission";

interface PermissionState {
  allPermissions: Permission[];
  permissionLoading: boolean;
  permissionError: string | null;
}

const initialState: PermissionState = {
  allPermissions: [],
  permissionLoading: false,
  permissionError: null,
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
    const token = thunkAPI.getState().user.authUser?.data.token;

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await axios.get(`${config.API_URL}/permissions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data.data ?? []
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message ||
          "Failed to fetch permissions",
      );
    }

    return thunkAPI.rejectWithValue(
      "Failed to fetch permissions",
    );
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
      });
  },
});

export const { clearPermissions } = permissionSlice.actions;

export default permissionSlice.reducer;

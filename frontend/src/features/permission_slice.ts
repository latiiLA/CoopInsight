import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../../app/store/store";
import {
  CreatePermissionDTO,
  Permission,
  UpdatePermissionDTO,
} from "@/types/permission";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import api from "@/lib/api";

interface PermissionState {
  allPermissions: Permission[];
  permissionLoading: boolean;
  permissionError: string | null;
  createLoading: boolean;
  createError: string | null;
  selectedPermission: Permission | null;
  permissionDetailLoading: boolean;
  permissionDetailError: string | null;
  updateLoading: boolean;
  updateError: string | null;
  deleteLoading: boolean;
  deleteError: string | null;
}

const initialState: PermissionState = {
  allPermissions: [],
  permissionLoading: false,
  permissionError: null,
  createLoading: false,
  createError: null,
  selectedPermission: null,
  permissionDetailLoading: false,
  permissionDetailError: null,
  updateLoading: false,
  updateError: null,
  deleteLoading: false,
  deleteError: null,
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

export const fetchPermissionById = createAsyncThunk<
  Permission,
  string,
  {
    state: RootState;
    rejectValue: string;
  }
>("permission/fetchPermissionById", async (id, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      isSuccessful: boolean;
      message: string;
      data: Permission;
    }>(`/permissions/${id}`, withAuthHeader(token));

    const permission = response.data.data;

    if (!permission) {
      return thunkAPI.rejectWithValue("Permission not found");
    }

    return permission;
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

export const updatePermission = createAsyncThunk<
  string,
  { id: string; payload: UpdatePermissionDTO },
  {
    state: RootState;
    rejectValue: string;
  }
>("permission/updatePermission", async ({ id, payload }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.put<{
      isSuccessful: boolean;
      message: string;
    }>(`/permissions/${id}`, payload, withAuthHeader(token));

    return response.data.message || "Permission updated successfully";
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const deletePermission = createAsyncThunk<
  string,
  string,
  {
    state: RootState;
    rejectValue: string;
  }
>("permission/deletePermission", async (id, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.delete<{
      isSuccessful: boolean;
      message: string;
    }>(`/permissions/${id}`, withAuthHeader(token));

    return response.data.message || "Permission deleted successfully";
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
    clearSelectedPermission: (state) => {
      state.selectedPermission = null;
      state.permissionDetailError = null;
    },
    clearUpdateError: (state) => {
      state.updateError = null;
    },
    clearDeleteError: (state) => {
      state.deleteError = null;
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
      .addCase(fetchPermissionById.pending, (state) => {
        state.permissionDetailLoading = true;
        state.permissionDetailError = null;
      })
      .addCase(fetchPermissionById.fulfilled, (state, action) => {
        state.permissionDetailLoading = false;
        state.selectedPermission = action.payload;
      })
      .addCase(fetchPermissionById.rejected, (state, action) => {
        state.permissionDetailLoading = false;
        state.selectedPermission = null;
        state.permissionDetailError =
          action.payload || "Failed to fetch permission";
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
      })
      .addCase(updatePermission.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updatePermission.fulfilled, (state) => {
        state.updateLoading = false;
        state.updateError = null;
      })
      .addCase(updatePermission.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload || "Failed to update permission";
      })
      .addCase(deletePermission.pending, (state) => {
        state.deleteLoading = true;
        state.deleteError = null;
      })
      .addCase(deletePermission.fulfilled, (state) => {
        state.deleteLoading = false;
        state.deleteError = null;
      })
      .addCase(deletePermission.rejected, (state, action) => {
        state.deleteLoading = false;
        state.deleteError = action.payload || "Failed to delete permission";
      });
  },
});

export const {
  clearPermissions,
  clearCreateError,
  clearSelectedPermission,
  clearUpdateError,
  clearDeleteError,
} = permissionSlice.actions;

export default permissionSlice.reducer;

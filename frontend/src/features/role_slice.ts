import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../../app/store/store";
import { CreateRoleDTO, Role, UpdateRoleDTO } from "@/types/role";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import api from "@/lib/api";

interface RoleState {
  roles: Role[];
  roleLoading: boolean;
  roleError: string | null;
  createLoading: boolean;
  createError: string | null;
  selectedRole: Role | null;
  roleDetailLoading: boolean;
  roleDetailError: string | null;
  updateLoading: boolean;
  updateError: string | null;
}

const initialState: RoleState = {
  roles: [],
  roleLoading: false,
  roleError: null,
  createLoading: false,
  createError: null,
  selectedRole: null,
  roleDetailLoading: false,
  roleDetailError: null,
  updateLoading: false,
  updateError: null,
};

export const fetchRoles = createAsyncThunk<
  Role[],
  void,
  {
    state: RootState;
    rejectValue: string;
  }
>("role/fetchRoles", async (_, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get("/roles", withAuthHeader(token));

    return response.data.data ?? [];
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchRoleById = createAsyncThunk<
  Role,
  string,
  {
    state: RootState;
    rejectValue: string;
  }
>("role/fetchRoleById", async (id, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      isSuccessful: boolean;
      message: string;
      data: Role;
    }>(`/roles/${id}`, withAuthHeader(token));

    const role = response.data.data;

    if (!role) {
      return thunkAPI.rejectWithValue("Role not found");
    }

    return role;
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const createRole = createAsyncThunk<
  string,
  CreateRoleDTO,
  {
    state: RootState;
    rejectValue: string;
  }
>("role/createRole", async (payload, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.post<{
      isSuccessful: boolean;
      message: string;
    }>("/roles", payload, withAuthHeader(token));

    return response.data.message || "Role created successfully";
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const updateRole = createAsyncThunk<
  string,
  { id: string; payload: UpdateRoleDTO },
  {
    state: RootState;
    rejectValue: string;
  }
>("role/updateRole", async ({ id, payload }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.put<{
      isSuccessful: boolean;
      message: string;
    }>(`/roles/${id}`, payload, withAuthHeader(token));

    return response.data.message || "Role updated successfully";
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

const roleSlice = createSlice({
  name: "role",
  initialState,
  reducers: {
    clearRoles: (state) => {
      state.roles = [];
      state.roleError = null;
    },
    clearCreateError: (state) => {
      state.createError = null;
    },
    clearSelectedRole: (state) => {
      state.selectedRole = null;
      state.roleDetailError = null;
    },
    clearUpdateError: (state) => {
      state.updateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.roleLoading = true;
        state.roleError = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.roleLoading = false;
        state.roles = action.payload;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.roleLoading = false;
        state.roleError = action.payload || "Failed to fetch roles";
      })
      .addCase(fetchRoleById.pending, (state) => {
        state.roleDetailLoading = true;
        state.roleDetailError = null;
        state.selectedRole = null;
      })
      .addCase(fetchRoleById.fulfilled, (state, action) => {
        state.roleDetailLoading = false;
        state.selectedRole = action.payload;
        state.roleDetailError = null;
      })
      .addCase(fetchRoleById.rejected, (state, action) => {
        state.roleDetailLoading = false;
        state.selectedRole = null;
        state.roleDetailError = action.payload || "Failed to fetch role";
      })
      .addCase(createRole.pending, (state) => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(createRole.fulfilled, (state) => {
        state.createLoading = false;
        state.createError = null;
      })
      .addCase(createRole.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload || "Failed to create role";
      })
      .addCase(updateRole.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateRole.fulfilled, (state) => {
        state.updateLoading = false;
        state.updateError = null;
      })
      .addCase(updateRole.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload || "Failed to update role";
      });
  },
});

export const {
  clearRoles,
  clearCreateError,
  clearSelectedRole,
  clearUpdateError,
} = roleSlice.actions;

export default roleSlice.reducer;

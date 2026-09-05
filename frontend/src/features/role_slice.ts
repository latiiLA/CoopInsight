import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../../app/store/store";
import { CreateRoleDTO, Role } from "@/types/role";
import getErrorMessage from "../../utility/error-message";
import { getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import api from "@/lib/api";

interface RoleState {
  roles: Role[];
  roleLoading: boolean;
  roleError: string | null;
  createLoading: boolean;
  createError: string | null;
}

const initialState: RoleState = {
  roles: [],
  roleLoading: false,
  roleError: null,
  createLoading: false,
  createError: null,
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
      });
  },
});

export const { clearRoles, clearCreateError } = roleSlice.actions;

export default roleSlice.reducer;

import config from "@/configs/config";
import { Auth } from "@/types/auth";
import {
  CreateUserDTO,
  RequestAccountDTO,
  UpdateUserDTO,
  User,
  UserProfile,
} from "@/types/user";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import getErrorMessage from "../../utility/error-message";
import { AUTH_STORAGE_KEY, getTokenFromAuth, withAuthHeader } from "../../utility/auth-token";
import { RootState } from "../../app/store/store";
import { jwtDecode } from "jwt-decode";
import api from "@/lib/api";

export interface UserSliceState {
  authUser: Auth | null;
  isLoggedIn: boolean;
  authLoading: boolean;
  authError: string | null;

  registerLoading: boolean;
  registerError: string | null;

  requestAccountLoading: boolean;
  requestAccountError: string | null;

  permissions: string[];

  users: User[];
  usersLoading: boolean;
  usersError: string | null;

  selectedUser: User | null;
  userDetailLoading: boolean;
  userDetailError: string | null;

  updateLoading: boolean;
  updateError: string | null;
  deleteLoading: boolean;
  deleteError: string | null;

  avatarLoading: boolean;
  profileLoading: boolean;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface JwtPayload {
  permissions?: string[];
}

const getPermissionsFromToken = (token?: string): string[] => {
  if (!token) {
    return [];
  }

  try {
    const decoded = jwtDecode<JwtPayload>(token);

    return decoded.permissions ?? [];
  } catch (error) {
    console.error("Failed to decode authentication token:", error);
    return [];
  }
};

const getInitialStoredUser = (): Auth | null => {
  if (typeof window === "undefined") return null;

  try {
    const item = localStorage.getItem(AUTH_STORAGE_KEY);
    return item ? (JSON.parse(item) as Auth) : null;
  } catch (error) {
    console.error("Failed to parse stored auth session:", error);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

const persistAuth = (auth: Auth | null) => {
  if (typeof window === "undefined") return;

  if (auth) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    return;
  }

  localStorage.removeItem(AUTH_STORAGE_KEY);
};

const initialUser = getInitialStoredUser();

const initialState: UserSliceState = {
  authUser: initialUser,
  isLoggedIn: Boolean(initialUser),
  authLoading: false,
  authError: null,

  registerLoading: false,
  registerError: null,

  requestAccountLoading: false,
  requestAccountError: null,

  permissions: getPermissionsFromToken(initialUser?.data?.token),

  users: [],
  usersLoading: false,
  usersError: null,

  selectedUser: null,
  userDetailLoading: false,
  userDetailError: null,

  updateLoading: false,
  updateError: null,
  deleteLoading: false,
  deleteError: null,

  avatarLoading: false,
  profileLoading: false,
};

export const loginUser = createAsyncThunk<
  Auth,
  LoginCredentials,
  { rejectValue: string }
>("user/loginUser", async (credentials, thunkAPI) => {
  try {
    const loginURL = config.Login_Type || "login";
    const response = await api.post<Auth>(`/auth/${loginURL}`, credentials);

    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const registerAuth = createAsyncThunk<
  string,
  CreateUserDTO,
  { state: RootState; rejectValue: string }
>("user/registerAuth", async (payload, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.post<{
      isSuccessful: boolean;
      message: string;
    }>("/users", payload, withAuthHeader(token));

    return response.data.message || "User registered successfully";
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const requestAccount = createAsyncThunk<
  string,
  RequestAccountDTO,
  { rejectValue: string }
>("user/requestAccount", async (payload, thunkAPI) => {
  try {
    const response = await api.post<{
      isSuccessful: boolean;
      message: string;
    }>("/auth/request-account", payload);

    return (
      response.data.message ||
      "Account request submitted. An administrator will review it before you can sign in."
    );
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchUsers = createAsyncThunk<
  User[],
  void,
  { state: RootState; rejectValue: string }
>("user/fetchUsers", async (_, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      isSuccessful: boolean;
      message: string;
      data: User[];
    }>("/users", withAuthHeader(token));

    return response.data.data ?? [];
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchUserById = createAsyncThunk<
  User,
  string,
  { state: RootState; rejectValue: string }
>("user/fetchUserById", async (id, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.get<{
      isSuccessful: boolean;
      message: string;
      data: User;
    }>(`/users/${id}`, withAuthHeader(token));

    const user = response.data.data;

    if (!user) {
      return thunkAPI.rejectWithValue("User not found");
    }

    return user;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const updateUser = createAsyncThunk<
  string,
  { id: string; payload: UpdateUserDTO },
  { state: RootState; rejectValue: string }
>("user/updateUser", async ({ id, payload }, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.put<{
      isSuccessful: boolean;
      message: string;
    }>(`/users/${id}`, payload, withAuthHeader(token));

    return response.data.message || "User updated successfully";
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const deleteUser = createAsyncThunk<
  string,
  string,
  { state: RootState; rejectValue: string }
>("user/deleteUser", async (id, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.delete<{
      isSuccessful: boolean;
      message: string;
    }>(`/users/${id}`, withAuthHeader(token));

    return response.data.message || "User deleted successfully";
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const updateAvatar = createAsyncThunk<
  string,
  string,
  { state: RootState; rejectValue: string }
>("user/updateAvatar", async (avatar, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.put<{
      isSuccessful: boolean;
      message: string;
      data?: { avatar?: string };
    }>("/account/avatar", { avatar }, withAuthHeader(token));

    return response.data.data?.avatar ?? avatar;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const uploadAvatarPhoto = createAsyncThunk<
  string,
  File,
  { state: RootState; rejectValue: string }
>("user/uploadAvatarPhoto", async (file, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const formData = new FormData();
    formData.append("photo", file);

    const response = await api.post<{
      isSuccessful: boolean;
      message: string;
      data?: { avatar?: string };
    }>("/account/avatar/photo", formData, withAuthHeader(token));

    return response.data.data?.avatar ?? "";
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const updateProfile = createAsyncThunk<
  UserProfile,
  UserProfile,
  { state: RootState; rejectValue: string }
>("user/updateProfile", async (profile, thunkAPI) => {
  try {
    const token = getTokenFromAuth(thunkAPI.getState().user.authUser);

    if (!token) {
      return thunkAPI.rejectWithValue("Authentication token not found");
    }

    const response = await api.put<{
      isSuccessful: boolean;
      message: string;
      data?: { profile?: UserProfile };
    }>("/account/profile", profile, withAuthHeader(token));

    return response.data.data?.profile ?? profile;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<Auth | null>) => {
      state.authUser = action.payload;
      state.isLoggedIn = Boolean(action.payload);
      state.permissions = getPermissionsFromToken(action.payload?.data?.token);
      persistAuth(action.payload);
    },

    logout: (state) => {
      state.authUser = null;
      state.isLoggedIn = false;
      state.authLoading = false;
      state.authError = null;
      state.registerLoading = false;
      state.registerError = null;
      state.requestAccountLoading = false;
      state.requestAccountError = null;
      state.permissions = [];
      state.selectedUser = null;
      state.avatarLoading = false;
      state.profileLoading = false;
      persistAuth(null);
    },

    clearAuthError: (state) => {
      state.authError = null;
    },

    clearRegisterError: (state) => {
      state.registerError = null;
    },

    clearUsersError: (state) => {
      state.usersError = null;
    },

    clearSelectedUser: (state) => {
      state.selectedUser = null;
      state.userDetailError = null;
    },

    clearUpdateError: (state) => {
      state.updateError = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.authLoading = true;
        state.authError = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.authLoading = false;
        state.isLoggedIn = true;
        state.authError = null;
        state.authUser = action.payload;
        state.permissions = getPermissionsFromToken(action.payload?.data?.token);
        persistAuth(action.payload);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.authLoading = false;
        state.isLoggedIn = false;
        state.authUser = null;
        state.permissions = [];
        state.authError = action.payload || "Failed to login user";
        persistAuth(null);
      })

      .addCase(registerAuth.pending, (state) => {
        state.registerLoading = true;
        state.registerError = null;
      })
      .addCase(registerAuth.fulfilled, (state) => {
        state.registerLoading = false;
        state.registerError = null;
      })
      .addCase(registerAuth.rejected, (state, action) => {
        state.registerLoading = false;
        state.registerError = action.payload || "Failed to register user";
      })

      .addCase(requestAccount.pending, (state) => {
        state.requestAccountLoading = true;
        state.requestAccountError = null;
      })
      .addCase(requestAccount.fulfilled, (state) => {
        state.requestAccountLoading = false;
        state.requestAccountError = null;
      })
      .addCase(requestAccount.rejected, (state, action) => {
        state.requestAccountLoading = false;
        state.requestAccountError =
          action.payload || "Failed to submit account request";
      })

      .addCase(fetchUsers.pending, (state) => {
        state.usersLoading = true;
        state.usersError = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.usersLoading = false;
        state.users = action.payload;
        state.usersError = null;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.usersLoading = false;
        state.usersError = action.payload || "Failed to fetch users";
      })

      .addCase(fetchUserById.pending, (state) => {
        state.userDetailLoading = true;
        state.userDetailError = null;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.userDetailLoading = false;
        state.selectedUser = action.payload;
        state.userDetailError = null;
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        state.userDetailLoading = false;
        state.selectedUser = null;
        state.userDetailError = action.payload || "Failed to fetch user";
      })

      .addCase(updateUser.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateUser.fulfilled, (state) => {
        state.updateLoading = false;
        state.updateError = null;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload || "Failed to update user";
      })
      .addCase(deleteUser.pending, (state) => {
        state.deleteLoading = true;
        state.deleteError = null;
      })
      .addCase(deleteUser.fulfilled, (state) => {
        state.deleteLoading = false;
        state.deleteError = null;
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.deleteLoading = false;
        state.deleteError = action.payload || "Failed to delete user";
      })

      .addCase(updateAvatar.pending, (state) => {
        state.avatarLoading = true;
      })
      .addCase(updateAvatar.fulfilled, (state, action) => {
        state.avatarLoading = false;
        if (state.authUser?.data?.user) {
          state.authUser.data.user.avatar = action.payload;
          persistAuth(state.authUser);
        }
      })
      .addCase(updateAvatar.rejected, (state) => {
        state.avatarLoading = false;
      })

      .addCase(uploadAvatarPhoto.pending, (state) => {
        state.avatarLoading = true;
      })
      .addCase(uploadAvatarPhoto.fulfilled, (state, action) => {
        state.avatarLoading = false;
        if (state.authUser?.data?.user) {
          state.authUser.data.user.avatar = action.payload;
          persistAuth(state.authUser);
        }
      })
      .addCase(uploadAvatarPhoto.rejected, (state) => {
        state.avatarLoading = false;
      })

      .addCase(updateProfile.pending, (state) => {
        state.profileLoading = true;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.profileLoading = false;
        if (state.authUser?.data?.user) {
          state.authUser.data.user.profile = action.payload;
          persistAuth(state.authUser);
        }
      })
      .addCase(updateProfile.rejected, (state) => {
        state.profileLoading = false;
      });
  },
});

export const {
  setUser,
  logout,
  clearAuthError,
  clearRegisterError,
  clearUsersError,
  clearSelectedUser,
  clearUpdateError,
} = userSlice.actions;

export default userSlice.reducer;

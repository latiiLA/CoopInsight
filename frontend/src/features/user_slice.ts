import config from "@/configs/config";
import { Auth } from "@/types/auth";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import getErrorMessage from "../../utility/error-message";
import { User } from "@/types/user";
import { RootState } from "../../app/store/store";
import { jwtDecode } from "jwt-decode";

export interface UserSliceState {
  // auth
  authUser: Auth | null;
  isLoggedIn: boolean;
  authLoading: boolean;
  authError: string | null;

  // permissions
  permissions: string[];

  // users list
  users: User[];
  usersLoading: boolean;
  usersError: string | null;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface JwtPayload {
  permissions?: string[];
}

const AUTH_STORAGE_KEY = "coop-hub-auth";

// Decode permissions from JWT
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

// Helper: Safely retrieve initial user from localStorage without breaking SSR
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

const initialUser = getInitialStoredUser();

const initialState: UserSliceState = {
  authUser: initialUser,
  isLoggedIn: Boolean(initialUser),
  authLoading: false,
  authError: null,

  // Get permissions from JWT, NOT from authUser response data
  permissions: getPermissionsFromToken(initialUser?.data?.token),

  users: [],
  usersLoading: false,
  usersError: null,
};

// Async Thunk: Login
export const loginUser = createAsyncThunk<
  Auth,
  LoginCredentials,
  { rejectValue: string }
>("user/loginUser", async (credentials, thunkAPI) => {
  try {
    const loginURL = config.Login_Type || "login";
    const response = await axios.post<Auth>(
      `${config.API_URL}/auth/${loginURL}`,
      credentials,
    );

    return response.data;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(getErrorMessage(error));
  }
});

export const fetchUsers = createAsyncThunk<
  User[],
  void,
  { state: RootState, rejectValue: string }
>("user/fetchUsers", async (_, thunkAPI) => {
  try {
    const token = thunkAPI.getState().user.authUser?.data.token;

      if (!token) {
        return thunkAPI.rejectWithValue(
          "Authentication token not found",
        );
      }

    const response = await axios.get<{
      isSuccessful: boolean;
      message: string;
      data: User[];
    }>(`${config.API_URL}/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data.data;
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

      if (typeof window !== "undefined") {
        if (action.payload) {
          localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify(action.payload),
          );
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    },

    logout: (state) => {
      state.authUser = null;
      state.isLoggedIn = false;
      state.authLoading = false;
      state.authError = null;

      if (typeof window !== "undefined") {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    },

    clearAuthError: (state) => {
      state.authError = null;
    },

    clearUsersError: (state) => {
      state.usersError = null;
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

        // Persist session state on successful login
        if (typeof window !== "undefined") {
          localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify(action.payload),
          );
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.authLoading = false;
        state.isLoggedIn = false;
        state.authUser = null;
        state.authError = action.payload || "Failed to login user";

        if (typeof window !== "undefined") {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
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
      });
  },
});

export const { setUser, logout, clearAuthError, clearUsersError } =
  userSlice.actions;

export default userSlice.reducer;


import config from "@/configs/config";
import { Auth } from "@/types/auth";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import getErrorMessage from "../../utility/error-message";

export interface UserState {
  user: Auth | null;
  isLoggedIn: boolean;
  loading: boolean;
  error: string | null;
}

interface LoginCredentials {
  username: string;
  password: string;
}

const AUTH_STORAGE_KEY  = "coop-hub-auth";

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

const initialState: UserState = {
  user: initialUser,
  isLoggedIn: Boolean(initialUser),
  loading: false,
  error: null,
};

// Async Thunk: Login
export const loginUser = createAsyncThunk<Auth, LoginCredentials, { rejectValue: string }>(
  "user/loginUser",
  async (credentials, thunkAPI) => {
    try {
      const loginURL = config.Login_Type || "login";
      const response = await axios.post<Auth>(
        `${config.API_URL}/users/${loginURL}`,
        credentials
      );

      return response.data;
    } catch (error: unknown) {
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  }
);

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<Auth | null>) => {
      state.user = action.payload;
      state.isLoggedIn = Boolean(action.payload);

      if (typeof window !== "undefined") {
        if (action.payload) {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(action.payload));
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    },

    logout: (state) => {
      state.user = null;
      state.isLoggedIn = false;
      state.loading = false;
      state.error = null;

      if (typeof window !== "undefined") {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    },

    clearError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isLoggedIn = true;
        state.error = null;
        state.user = action.payload;

        // Persist session state on successful login
        if (typeof window !== "undefined") {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(action.payload));
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.isLoggedIn = false;
        state.user = null;
        state.error = action.payload || "Failed to login user";

        if (typeof window !== "undefined") {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      });
  },
});

export const { setUser, logout, clearError } = userSlice.actions;

export default userSlice.reducer;
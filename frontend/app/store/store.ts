import { configureStore } from '@reduxjs/toolkit'
import userReducer from "../.././src/features/user_slice";
import depositPerTerminalReducer from "../.././src/features/terminal_slice";
import permissionReducer from "@/features/permission_slice";
import roleReducer from "@/features/role_slice";

export const store = configureStore({
  reducer: {
      user: userReducer,
      depositPerTerminal: depositPerTerminalReducer,
      permission: permissionReducer,
      role: roleReducer,
  },
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch
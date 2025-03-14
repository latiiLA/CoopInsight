import { Route, Routes } from "react-router-dom";
import "./App.css";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import Chat from "./pages/Chat";
import Home from "./pages/Home";
import React from "react";
import ChatUI from "./pages/ChatUI";

function App() {
  return (
    <>
      <Routes>
        <Route path={"/login"} element={<Login />} />
        <Route path={"/changepassword"} element={<ChangePassword />} />
        <Route path={"/chat"} element={<Chat />} />
        <Route path={"/home"} element={<Home />} />
        <Route path={"/chatui"} element={<ChatUI />} />
        {/* <Route path={"/chat"} element={<Chat />} /> */}
      </Routes>
    </>
  );
}

export default App;

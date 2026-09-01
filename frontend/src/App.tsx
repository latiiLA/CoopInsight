import { Route, Routes } from "react-router-dom";
import "./App.css";
import Layout from "../app/layout";
import Home from "./pages/Home";
import LoginPage from "./pages/Login";
import Transaction from "./pages/transaction/Transaction";

function App() {
  return (
    <>
      <Routes>
        <Route 
          path="/"
          element={
            <LoginPage/>
          }
        />
        
        {/* Dashboard */}
      <Route element={<Layout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/transaction" element={<Transaction />} />
      </Route>
      </Routes>
    </>
  );
}

export default App;

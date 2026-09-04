import { Route, Routes } from "react-router-dom";
import "./App.css";
import Layout from "../app/layout";
import Home from "./pages/Home";
import LoginPage from "./pages/Login";
import Transaction from "./pages/transaction/Transaction";
import DepositPerTerminal from "./pages/reports/deposit-per-terminal";
import ManageUsers from "./pages/system administrations/users/manage-users";
import CreateUser from "./pages/system administrations/users/create-user";
import ManageRoles from "./pages/system administrations/roles/manage-roles";
import CreateRole from "./pages/system administrations/roles/create-role";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        {/* Dashboard */}
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/transaction" element={<Transaction />} />
          <Route
            path="/deposit-per-terminal"
            element={<DepositPerTerminal />}
          />
          <Route
            path="/users"
            element={<ManageUsers />}
          />
          <Route
            path="/user"
            element={<CreateUser />}
          />
          <Route
            path="/roles"
            element={<ManageRoles />}
          />
          <Route
            path="/role"
            element={<CreateRole />}
          />
        </Route>
      </Routes>
    </>
  );
}

export default App;

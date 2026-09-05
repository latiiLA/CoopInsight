import { Route, Routes } from "react-router-dom";
import "./App.css";
import Layout from "../app/layout";
import Home from "./pages/Home";
import LoginPage from "./pages/Login";
import Transaction from "./pages/transaction/Transaction";
import DepositPerTerminal from "./pages/reports/deposit-per-terminal";
import ManageUsers from "./pages/system administrations/users/manage-users";
import CreateUser from "./pages/system administrations/users/create-user";
import ViewUser from "./pages/system administrations/users/view-user";
import EditUser from "./pages/system administrations/users/edit-user";
import ManageRoles from "./pages/system administrations/roles/manage-roles";
import CreateRole from "./pages/system administrations/roles/create-role";
import EditRole from "./pages/system administrations/roles/edit-role";
import ManagePermissions from "./pages/system administrations/permissions/manage-permissions";
import CreatePermission from "./pages/system administrations/permissions/create-permission";


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
            path="/user/:id"
            element={<ViewUser />}
          />
          <Route
            path="/user/:id/edit"
            element={<EditUser />}
          />
          <Route
            path="/roles"
            element={<ManageRoles />}
          />
          <Route
            path="/role"
            element={<CreateRole />}
          />
          <Route
            path="/role/:id/edit"
            element={<EditRole />}
          />
          <Route
            path="/permissions"
            element={<ManagePermissions />}
          />
          <Route
            path="/permission"
            element={<CreatePermission />}
          />
        </Route>
      </Routes>
    </>
  );
}

export default App;

import { Route, Routes } from "react-router-dom";
import "./App.css";
import Layout from "../app/layout";
import Home from "./pages/Home";
import LoginPage from "./pages/Login";
import Transaction from "./pages/transaction/Transaction";
import DepositPerTerminal from "./pages/reports/deposit-per-terminal";
import SuccessRate from "./pages/reports/success-rate/success-rate";
import ManageUsers from "./pages/system administrations/users/manage-users";
import CreateUser from "./pages/system administrations/users/create-user";
import ViewUser from "./pages/system administrations/users/view-user";
import EditUser from "./pages/system administrations/users/edit-user";
import ManageRoles from "./pages/system administrations/roles/manage-roles";
import CreateRole from "./pages/system administrations/roles/create-role";
import EditRole from "./pages/system administrations/roles/edit-role";
import ManagePermissions from "./pages/system administrations/permissions/manage-permissions";
import CreatePermission from "./pages/system administrations/permissions/create-permission";
import { RequirePermission } from "./components/require-permission";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/transaction" element={<Transaction />} />
          <Route
            path="/deposit-per-terminal"
            element={
              <RequirePermission permissions={["report:view-deposit-per-terminal"]}>
                <DepositPerTerminal />
              </RequirePermission>
            }
          />
          <Route
            path="/success-rate"
            element={
              <RequirePermission permissions={["report:view-success-transactions"]}>
                <SuccessRate />
              </RequirePermission>
            }
          />
          <Route
            path="/users"
            element={
              <RequirePermission permissions={["user:view"]}>
                <ManageUsers />
              </RequirePermission>
            }
          />
          <Route
            path="/user"
            element={
              <RequirePermission permissions={["user:create"]}>
                <CreateUser />
              </RequirePermission>
            }
          />
          <Route
            path="/user/:id"
            element={
              <RequirePermission permissions={["user:view-detail"]}>
                <ViewUser />
              </RequirePermission>
            }
          />
          <Route
            path="/user/:id/edit"
            element={
              <RequirePermission permissions={["user:update"]}>
                <EditUser />
              </RequirePermission>
            }
          />
          <Route
            path="/roles"
            element={
              <RequirePermission permissions={["role:view"]}>
                <ManageRoles />
              </RequirePermission>
            }
          />
          <Route
            path="/role"
            element={
              <RequirePermission permissions={["role:create"]}>
                <CreateRole />
              </RequirePermission>
            }
          />
          <Route
            path="/role/:id/edit"
            element={
              <RequirePermission permissions={["role:update"]}>
                <EditRole />
              </RequirePermission>
            }
          />
          <Route
            path="/permissions"
            element={
              <RequirePermission permissions={["permission:view"]}>
                <ManagePermissions />
              </RequirePermission>
            }
          />
          <Route
            path="/permission"
            element={
              <RequirePermission permissions={["permission:create"]}>
                <CreatePermission />
              </RequirePermission>
            }
          />
        </Route>
      </Routes>
    </>
  );
}

export default App;

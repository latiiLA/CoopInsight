import { Route, Routes } from "react-router-dom";
import "./App.css";
import Layout from "../app/layout";
import Home from "./pages/Home";
import LoginPage from "./pages/Login";
import RequestAccountPage from "./pages/request-account";
import Transaction from "./pages/transaction/Transaction";
import DepositPerTerminal from "./pages/reports/deposit-per-terminal";
import SuccessRate from "./pages/reports/success-rate/success-rate";
import EbirrCardlessWithdrawal from "./pages/reports/ebirr-cardless-withdrawal/ebirr-cardless-withdrawal";
import ManageUsers from "./pages/system administrations/users/manage-users";
import CreateUser from "./pages/system administrations/users/create-user";
import ManageAccountRequests from "./pages/system administrations/users/manage-account-requests";
import ViewUser from "./pages/system administrations/users/view-user";
import EditUser from "./pages/system administrations/users/edit-user";
import ManageRoles from "./pages/system administrations/roles/manage-roles";
import CreateRole from "./pages/system administrations/roles/create-role";
import EditRole from "./pages/system administrations/roles/edit-role";
import ViewRole from "./pages/system administrations/roles/view-role";
import ManagePermissions from "./pages/system administrations/permissions/manage-permissions";
import CreatePermission from "./pages/system administrations/permissions/create-permission";
import EditPermission from "./pages/system administrations/permissions/edit-permission";
import ViewPermission from "./pages/system administrations/permissions/view-permission";
import ManageActivityLog from "./pages/system administrations/activity-log/manage-activity-log";
import OnusMonitoring from "./pages/monitoring/onus/onus-monitoring";
import OffusMonitoring from "./pages/monitoring/offus/offus-monitoring";
import MastercardDebitMonitoring from "./pages/monitoring/mastercard-debit/mastercard-debit-monitoring";
import MastercardCreditMonitoring from "./pages/monitoring/mastercard-credit/mastercard-credit-monitoring";
import VisaMonitoring from "./pages/monitoring/visa/visa-monitoring";
import AtmTerminals from "./pages/dashboards/atm-terminals/atm-terminals";
import AtmDashboard from "./pages/dashboards/atm-terminals/atm-dashboard";
import PosTerminals from "./pages/dashboards/pos-terminals/pos-terminals";
import PosDashboard from "./pages/dashboards/pos-terminals/pos-dashboard";
import TerminalTransactions from "./pages/dashboards/terminal-transactions/terminal-transactions";
import TerminalComparison from "./pages/dashboards/terminal-comparison/terminal-comparison";
import Account from "./pages/account/account";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/not-found";
import { RequirePermission } from "./components/require-permission";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/request-account" element={<RequestAccountPage />} />

        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/account" element={<Account />} />
          <Route path="/analytics" element={<Analytics />} />
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
            path="/ebirr-cardless-withdrawal"
            element={
              <RequirePermission permissions={["report:view-ebirr-cardless-withdrawal"]}>
                <EbirrCardlessWithdrawal />
              </RequirePermission>
            }
          />
          <Route
            path="/onus-monitoring"
            element={
              <RequirePermission permissions={["monitoring:view-onus"]}>
                <OnusMonitoring />
              </RequirePermission>
            }
          />
          <Route
            path="/offus-monitoring"
            element={
              <RequirePermission permissions={["monitoring:view-offus"]}>
                <OffusMonitoring />
              </RequirePermission>
            }
          />
          <Route
            path="/mastercard-debit-monitoring"
            element={
              <RequirePermission permissions={["monitoring:view-mastercard-debit"]}>
                <MastercardDebitMonitoring />
              </RequirePermission>
            }
          />
          <Route
            path="/mastercard-credit-monitoring"
            element={
              <RequirePermission permissions={["monitoring:view-mastercard-credit"]}>
                <MastercardCreditMonitoring />
              </RequirePermission>
            }
          />
          <Route
            path="/visa-monitoring"
            element={
              <RequirePermission permissions={["monitoring:view-visa"]}>
                <VisaMonitoring />
              </RequirePermission>
            }
          />
          <Route
            path="/atm-dashboard"
            element={
              <RequirePermission permissions={["terminal:view-atm"]}>
                <AtmDashboard />
              </RequirePermission>
            }
          />
          <Route
            path="/atm-terminals"
            element={
              <RequirePermission permissions={["terminal:view-atm"]}>
                <AtmTerminals />
              </RequirePermission>
            }
          />
          <Route
            path="/atm-terminals/:terminalId/transactions"
            element={
              <RequirePermission permissions={["terminal:view-atm-transaction"]}>
                <TerminalTransactions fleet="atm" />
              </RequirePermission>
            }
          />
          <Route
            path="/atm-transactions"
            element={
              <RequirePermission permissions={["terminal:view-atm-transaction"]}>
                <TerminalTransactions fleet="atm" />
              </RequirePermission>
            }
          />
          <Route
            path="/atm-comparison"
            element={
              <RequirePermission permissions={["terminal:view-atm-transaction"]}>
                <TerminalComparison fleet="atm" />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-dashboard"
            element={
              <RequirePermission permissions={["terminal:view-pos"]}>
                <PosDashboard />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-terminals"
            element={
              <RequirePermission permissions={["terminal:view-pos"]}>
                <PosTerminals />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-terminals/:terminalId/transactions"
            element={
              <RequirePermission permissions={["terminal:view-pos-transaction"]}>
                <TerminalTransactions fleet="pos" />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-transactions"
            element={
              <RequirePermission permissions={["terminal:view-pos-transaction"]}>
                <TerminalTransactions fleet="pos" />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-comparison"
            element={
              <RequirePermission permissions={["terminal:view-pos-transaction"]}>
                <TerminalComparison fleet="pos" />
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
            path="/account-requests"
            element={
              <RequirePermission permissions={["user:view", "user:create"]}>
                <ManageAccountRequests />
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
              <RequirePermission permissions={["user:view-details"]}>
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
            path="/role/:id"
            element={
              <RequirePermission permissions={["role:view-details"]}>
                <ViewRole />
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
          <Route
            path="/permission/:id/edit"
            element={
              <RequirePermission permissions={["permission:update"]}>
                <EditPermission />
              </RequirePermission>
            }
          />
          <Route
            path="/permission/:id"
            element={
              <RequirePermission permissions={["permission:view-details"]}>
                <ViewPermission />
              </RequirePermission>
            }
          />
          <Route
            path="/activity-log"
            element={
              <RequirePermission permissions={["activity:view"]}>
                <ManageActivityLog />
              </RequirePermission>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;

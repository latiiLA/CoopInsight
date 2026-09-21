import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import Layout from "../app/layout";
import Home from "./pages/Home";
import LoginPage from "./pages/Login";
import RequestAccountPage from "./pages/request-account";
import Transaction from "./pages/transaction/Transaction";
import DepositPerTerminal from "./pages/reports/deposit-per-terminal";
import SuccessRate from "./pages/reports/success-rate/success-rate";
import SuccessRateTrends from "./pages/reports/success-rate/success-rate-trends";
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
import Uncleared from "./pages/clearing/uncleared";
import Cleared from "./pages/clearing/cleared";
import Unsettled from "./pages/settlement/unsettled";
import Settled from "./pages/settlement/settled";
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
            path="/success-rate-trends"
            element={
              <RequirePermission
                permissions={[
                  "report:view-success-transactions",
                  "report:view-atm-overall-success-rate",
                  "report:view-atm-acquiring-success-rate",
                  "report:view-atm-onus-success-rate",
                  "report:view-atm-offus-success-rate",
                  "report:view-atm-issuing-success-rate",
                  "report:view-pos-overall-success-rate",
                  "report:view-pos-acquiring-success-rate",
                  "report:view-pos-onus-success-rate",
                  "report:view-pos-offus-success-rate",
                  "report:view-pos-issuing-success-rate",
                  "report:view-switch-overall-success-rate",
                  "report:view-switch-onus-success-rate",
                  "report:view-switch-offus-success-rate",
                  "report:view-switch-issuing-success-rate",
                ]}
              >
                <SuccessRateTrends />
              </RequirePermission>
            }
          />
          <Route
            path="/switch-overall-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-switch-overall-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="switch" flow="overall" />
              </RequirePermission>
            }
          />
          <Route
            path="/switch-onus-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-switch-onus-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="switch" flow="onus" />
              </RequirePermission>
            }
          />
          <Route
            path="/switch-offus-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-switch-offus-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="switch" flow="offus" />
              </RequirePermission>
            }
          />
          <Route
            path="/switch-issuing-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-switch-issuing-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="switch" flow="issuing" />
              </RequirePermission>
            }
          />
          <Route
            path="/success-rate"
            element={<Navigate to="/atm-overall-success-rate" replace />}
          />
          <Route
            path="/atm-overall-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-atm-overall-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="atm" flow="overall" />
              </RequirePermission>
            }
          />
          <Route
            path="/atm-acquiring-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-atm-acquiring-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="atm" flow="acquiring" />
              </RequirePermission>
            }
          />
          <Route
            path="/atm-onus-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-atm-onus-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="atm" flow="onus" />
              </RequirePermission>
            }
          />
          <Route
            path="/atm-offus-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-atm-offus-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="atm" flow="offus" />
              </RequirePermission>
            }
          />
          <Route
            path="/atm-issuing-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-atm-issuing-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="atm" flow="issuing" />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-success-rate"
            element={<Navigate to="/pos-overall-success-rate" replace />}
          />
          <Route
            path="/pos-overall-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-pos-overall-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="pos" flow="overall" />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-acquiring-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-pos-acquiring-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="pos" flow="acquiring" />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-onus-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-pos-onus-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="pos" flow="onus" />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-offus-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-pos-offus-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="pos" flow="offus" />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-issuing-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-pos-issuing-success-rate",
                  "report:view-success-transactions",
                ]}
              >
                <SuccessRate channel="pos" flow="issuing" />
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
            path="/uncleared-eth"
            element={
              <RequirePermission permissions={["clearing:view-uncleared-eth"]}>
                <Uncleared
                  key="ETB"
                  product="ETB"
                  title="Uncleared ETH"
                  description="Approved domestic POS purchases that still need clearing."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/uncleared-visa"
            element={
              <RequirePermission permissions={["clearing:view-uncleared-visa"]}>
                <Uncleared
                  key="VISA"
                  product="VISA"
                  title="Uncleared VISA"
                  description="Approved Visa POS purchases that still need clearing."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/uncleared-mastercard"
            element={
              <RequirePermission
                permissions={["clearing:view-uncleared-mastercard"]}
              >
                <Uncleared
                  key="MDS"
                  product="MDS"
                  title="Uncleared Mastercard"
                  description="Approved Mastercard POS purchases that still need clearing."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/uncleared"
            element={
              <RequirePermission permissions={["clearing:view-uncleared-eth"]}>
                <Uncleared
                  key="ETB-alias"
                  product="ETB"
                  title="Uncleared ETH"
                  description="Approved domestic POS purchases that still need clearing."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/cleared-eth"
            element={
              <RequirePermission permissions={["clearing:view-cleared-eth"]}>
                <Cleared
                  key="cleared-ETB"
                  product="ETB"
                  title="Cleared ETH"
                  description="Approved domestic POS purchases that have been posted for clearing."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/cleared-visa"
            element={
              <RequirePermission permissions={["clearing:view-cleared-visa"]}>
                <Cleared
                  key="cleared-VISA"
                  product="VISA"
                  title="Cleared VISA"
                  description="Approved Visa POS purchases that have been posted for clearing."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/cleared-mastercard"
            element={
              <RequirePermission
                permissions={["clearing:view-cleared-mastercard"]}
              >
                <Cleared
                  key="cleared-MDS"
                  product="MDS"
                  title="Cleared Mastercard"
                  description="Approved Mastercard POS purchases that have been posted for clearing."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/unsettled-eth"
            element={
              <RequirePermission permissions={["settlement:view-unsettled-eth"]}>
                <Unsettled
                  key="unsettled-ETB"
                  product="ETB"
                  title="Unsettled ETH"
                  description="Domestic POS purchases that have been cleared but are not yet settled."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/unsettled-visa"
            element={
              <RequirePermission permissions={["settlement:view-unsettled-visa"]}>
                <Unsettled
                  key="unsettled-VISA"
                  product="VISA"
                  title="Unsettled VISA"
                  description="Visa POS purchases that have been cleared but are not yet settled."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/unsettled-mastercard"
            element={
              <RequirePermission
                permissions={["settlement:view-unsettled-mastercard"]}
              >
                <Unsettled
                  key="unsettled-MDS"
                  product="MDS"
                  title="Unsettled Mastercard"
                  description="Mastercard POS purchases that have been cleared but are not yet settled."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/settled-eth"
            element={
              <RequirePermission permissions={["settlement:view-settled-eth"]}>
                <Settled
                  key="settled-ETB"
                  product="ETB"
                  title="Settled ETH"
                  description="Domestic POS purchases that have been cleared and settled."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/settled-visa"
            element={
              <RequirePermission permissions={["settlement:view-settled-visa"]}>
                <Settled
                  key="settled-VISA"
                  product="VISA"
                  title="Settled VISA"
                  description="Visa POS purchases that have been cleared and settled."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/settled-mastercard"
            element={
              <RequirePermission
                permissions={["settlement:view-settled-mastercard"]}
              >
                <Settled
                  key="settled-MDS"
                  product="MDS"
                  title="Settled Mastercard"
                  description="Mastercard POS purchases that have been cleared and settled."
                />
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

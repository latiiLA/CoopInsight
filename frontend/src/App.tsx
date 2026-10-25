import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import Layout from "../app/layout";
import LoginPage from "./pages/Login";
import { RequirePermission } from "./components/require-permission";

const RequestAccountPage = lazy(() => import("./pages/request-account"));
const Home = lazy(() => import("./pages/Home"));
const Transaction = lazy(() => import("./pages/transaction/Transaction"));
const DepositPerTerminal = lazy(
  () => import("./pages/reports/deposit-per-terminal"),
);
const SuccessRate = lazy(
  () => import("./pages/reports/success-rate/success-rate"),
);
const SuccessRateTrends = lazy(
  () => import("./pages/reports/success-rate/success-rate-trends"),
);
const TerminalSuccessRate = lazy(
  () => import("./pages/reports/success-rate/terminal-success-rate"),
);
const CardProductSuccessRate = lazy(
  () => import("./pages/reports/success-rate/card-product-success-rate"),
);
const EbirrCardlessWithdrawal = lazy(
  () => import("./pages/reports/ebirr-cardless-withdrawal/ebirr-cardless-withdrawal"),
);
const TransactionMix = lazy(
  () => import("./pages/reports/transaction-mix/transaction-mix"),
);
const CortexTransactionSearch = lazy(
  () =>
    import(
      "./pages/reports/cortex-transaction-search/cortex-transaction-search"
    ),
);
const SwitchTransactionSearch = lazy(
  () =>
    import(
      "./pages/reports/switch-transaction-search/switch-transaction-search"
    ),
);
const TerminalReconExport = lazy(
  () =>
    import("./pages/reports/terminal-recon-export/terminal-recon-export"),
);
const EJTransactionSearch = lazy(
  () =>
    import("./pages/reports/ej-transaction-search/ej-transaction-search"),
);
const EJCoverage = lazy(
  () => import("./pages/reports/ej-coverage/ej-coverage"),
);
const EJByTerminal = lazy(
  () => import("./pages/reports/ej-by-terminal/ej-by-terminal"),
);
const ManageUsers = lazy(
  () => import("./pages/system administrations/users/manage-users"),
);
const CreateUser = lazy(
  () => import("./pages/system administrations/users/create-user"),
);
const ManageAccountRequests = lazy(
  () => import("./pages/system administrations/users/manage-account-requests"),
);
const ViewUser = lazy(
  () => import("./pages/system administrations/users/view-user"),
);
const EditUser = lazy(
  () => import("./pages/system administrations/users/edit-user"),
);
const ManageRoles = lazy(
  () => import("./pages/system administrations/roles/manage-roles"),
);
const CreateRole = lazy(
  () => import("./pages/system administrations/roles/create-role"),
);
const EditRole = lazy(
  () => import("./pages/system administrations/roles/edit-role"),
);
const ViewRole = lazy(
  () => import("./pages/system administrations/roles/view-role"),
);
const ManagePermissions = lazy(
  () => import("./pages/system administrations/permissions/manage-permissions"),
);
const CreatePermission = lazy(
  () => import("./pages/system administrations/permissions/create-permission"),
);
const EditPermission = lazy(
  () => import("./pages/system administrations/permissions/edit-permission"),
);
const ViewPermission = lazy(
  () => import("./pages/system administrations/permissions/view-permission"),
);
const ManageActivityLog = lazy(
  () => import("./pages/system administrations/activity-log/manage-activity-log"),
);
const OnusMonitoring = lazy(
  () => import("./pages/monitoring/onus/onus-monitoring"),
);
const OffusMonitoring = lazy(
  () => import("./pages/monitoring/offus/offus-monitoring"),
);
const MastercardDebitMonitoring = lazy(
  () => import("./pages/monitoring/mastercard-debit/mastercard-debit-monitoring"),
);
const MastercardCreditMonitoring = lazy(
  () => import("./pages/monitoring/mastercard-credit/mastercard-credit-monitoring"),
);
const VisaMonitoring = lazy(
  () => import("./pages/monitoring/visa/visa-monitoring"),
);
const IstMonitoring = lazy(
  () => import("./pages/monitoring/ist/ist-monitoring"),
);
const SafMonitoring = lazy(
  () => import("./pages/monitoring/saf/saf-monitoring"),
);
const AtmTerminals = lazy(
  () => import("./pages/dashboards/atm-terminals/atm-terminals"),
);
const AtmDashboard = lazy(
  () => import("./pages/dashboards/atm-terminals/atm-dashboard"),
);
const PosTerminals = lazy(
  () => import("./pages/dashboards/pos-terminals/pos-terminals"),
);
const PosDashboard = lazy(
  () => import("./pages/dashboards/pos-terminals/pos-dashboard"),
);
const TerminalTransactions = lazy(
  () => import("./pages/dashboards/terminal-transactions/terminal-transactions"),
);
const TerminalComparison = lazy(
  () => import("./pages/dashboards/terminal-comparison/terminal-comparison"),
);
const Account = lazy(() => import("./pages/account/account"));
const Analytics = lazy(() => import("./pages/Analytics"));
const ClearingHub = lazy(() => import("./pages/clearing/clearing-hub"));
const SettlementHub = lazy(() => import("./pages/settlement/settlement-hub"));
const NotFound = lazy(() => import("./pages/not-found"));
const CardPerStatus = lazy(() => import("./pages/card/card-per-status"));
const CardActivityPage = lazy(() => import("./pages/card/card-activity-page"));
const PrepaidVisaDashboard = lazy(
  () => import("./pages/card/prepaid-visa/prepaid-visa-dashboard"),
);
const PrepaidVisaTopUps = lazy(
  () => import("./pages/card/prepaid-visa/prepaid-visa-top-ups"),
);
const PrepaidVisaUnloads = lazy(
  () => import("./pages/card/prepaid-visa/prepaid-visa-unloads"),
);
const PrepaidVisaTransactions = lazy(
  () => import("./pages/card/prepaid-visa/prepaid-visa-transactions"),
);
const PrepaidVisaReconciliation = lazy(
  () => import("./pages/card/prepaid-visa/prepaid-visa-reconciliation"),
);
const PrepaidVisaSearch = lazy(
  () => import("./pages/card/prepaid-visa/prepaid-visa-search"),
);

function PageFallback() {
  return (
    <div
      className="flex min-h-svh w-full items-center justify-center bg-background"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
    </div>
  );
}

function App() {
  return (
    <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/request-account"
          element={
            <Suspense fallback={<PageFallback />}>
              <RequestAccountPage />
            </Suspense>
          }
        />

        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/account" element={<Account />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/transaction" element={<Transaction />} />
          <Route
            path="/deposit-per-terminal"
            element={
              <RequirePermission
                permissions={["report:view-deposit-per-terminal"]}
              >
                <DepositPerTerminal />
              </RequirePermission>
            }
          />
          <Route
            path="/success-rate-trends"
            element={
              <RequirePermission
                permissions={[
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
                  "report:view-switch-remote-onus-success-rate",
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
                ]}
              >
                <SuccessRate channel="switch" flow="issuing" />
              </RequirePermission>
            }
          />
          <Route
            path="/switch-remote-onus-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-switch-remote-onus-success-rate",
                  "report:view-switch-issuing-success-rate",
                ]}
              >
                <SuccessRate channel="switch" flow="remote_onus" />
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
                ]}
              >
                <SuccessRate channel="pos" flow="issuing" />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-terminal-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-pos-acquiring-success-rate",
                ]}
              >
                <TerminalSuccessRate channel="pos" />
              </RequirePermission>
            }
          />
          <Route
            path="/atm-terminal-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-atm-acquiring-success-rate",
                ]}
              >
                <TerminalSuccessRate channel="atm" />
              </RequirePermission>
            }
          />
          <Route
            path="/card-product-success-rate"
            element={
              <RequirePermission
                permissions={[
                  "report:view-card-product-success-rate",
                  "report:view-switch-overall-success-rate",
                  "report:view-atm-acquiring-success-rate",
                  "report:view-atm-overall-success-rate",
                  "report:view-pos-acquiring-success-rate",
                  "report:view-pos-overall-success-rate",
                ]}
              >
                <CardProductSuccessRate />
              </RequirePermission>
            }
          />
          <Route
            path="/ebirr-cardless-withdrawal"
            element={
              <RequirePermission
                permissions={["report:view-ebirr-cardless-withdrawal"]}
              >
                <EbirrCardlessWithdrawal />
              </RequirePermission>
            }
          />
          <Route
            path="/transaction-mix"
            element={
              <RequirePermission permissions={["report:view-transaction-mix"]}>
                <TransactionMix />
              </RequirePermission>
            }
          />
          <Route
            path="/cortex-transaction-search"
            element={
              <RequirePermission
                permissions={["report:search-cortex-transactions"]}
              >
                <CortexTransactionSearch />
              </RequirePermission>
            }
          />
          <Route
            path="/switch-transaction-search"
            element={
              <RequirePermission
                permissions={["report:search-switch-transactions"]}
              >
                <SwitchTransactionSearch />
              </RequirePermission>
            }
          />
          <Route
            path="/terminal-recon-export"
            element={
              <RequirePermission
                permissions={[
                  "report:export-switch-terminal-recon",
                  "report:export-cortex-terminal-recon",
                ]}
              >
                <TerminalReconExport />
              </RequirePermission>
            }
          />
          <Route
            path="/ej-finder"
            element={
              <RequirePermission
                permissions={["report:search-ej-transactions"]}
              >
                <EJTransactionSearch />
              </RequirePermission>
            }
          />
          <Route
            path="/ej-transaction-search"
            element={
              <RequirePermission
                permissions={["report:search-ej-transactions"]}
              >
                <EJTransactionSearch />
              </RequirePermission>
            }
          />
          <Route
            path="/ej-coverage"
            element={
              <RequirePermission
                permissions={["report:search-ej-transactions"]}
              >
                <EJCoverage />
              </RequirePermission>
            }
          />
          <Route
            path="/ej-by-terminal"
            element={
              <RequirePermission
                permissions={["report:search-ej-transactions"]}
              >
                <EJByTerminal />
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
              <RequirePermission
                permissions={["monitoring:view-mastercard-debit"]}
              >
                <MastercardDebitMonitoring />
              </RequirePermission>
            }
          />
          <Route
            path="/mastercard-credit-monitoring"
            element={
              <RequirePermission
                permissions={["monitoring:view-mastercard-credit"]}
              >
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
            path="/ist-monitoring"
            element={
              <RequirePermission permissions={["monitoring:view-ist"]}>
                <IstMonitoring />
              </RequirePermission>
            }
          />
          <Route
            path="/saf-monitoring"
            element={
              <RequirePermission permissions={["monitoring:view-saf"]}>
                <SafMonitoring />
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
              <RequirePermission
                permissions={["terminal:view-atm-transaction"]}
              >
                <TerminalTransactions fleet="atm" />
              </RequirePermission>
            }
          />
          <Route
            path="/atm-transactions"
            element={
              <RequirePermission
                permissions={["terminal:view-atm-transaction"]}
              >
                <TerminalTransactions fleet="atm" />
              </RequirePermission>
            }
          />
          <Route
            path="/atm-comparison"
            element={
              <RequirePermission
                permissions={["terminal:view-atm-transaction"]}
              >
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
              <RequirePermission
                permissions={["terminal:view-pos-transaction"]}
              >
                <TerminalTransactions fleet="pos" />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-transactions"
            element={
              <RequirePermission
                permissions={["terminal:view-pos-transaction"]}
              >
                <TerminalTransactions fleet="pos" />
              </RequirePermission>
            }
          />
          <Route
            path="/pos-comparison"
            element={
              <RequirePermission
                permissions={["terminal:view-pos-transaction"]}
              >
                <TerminalComparison fleet="pos" />
              </RequirePermission>
            }
          />
          <Route
            path="/clearing/uncleared"
            element={
              <RequirePermission
                permissions={[
                  "clearing:view-uncleared-eth",
                  "clearing:view-uncleared-visa",
                  "clearing:view-uncleared-visa-cybersource",
                  "clearing:view-uncleared-mastercard",
                ]}
              >
                <ClearingHub stage="uncleared" />
              </RequirePermission>
            }
          />
          <Route
            path="/clearing/cleared"
            element={
              <RequirePermission
                permissions={[
                  "clearing:view-cleared-eth",
                  "clearing:view-cleared-visa",
                  "clearing:view-cleared-visa-cybersource",
                  "clearing:view-uncleared-visa-cybersource",
                  "clearing:view-cleared-mastercard",
                ]}
              >
                <ClearingHub stage="cleared" />
              </RequirePermission>
            }
          />
          <Route
            path="/settlement/unsettled"
            element={
              <RequirePermission
                permissions={[
                  "settlement:view-unsettled-eth",
                  "settlement:view-unsettled-visa",
                  "settlement:view-unsettled-visa-cybersource",
                  "settlement:view-unsettled-mastercard",
                ]}
              >
                <SettlementHub stage="unsettled" />
              </RequirePermission>
            }
          />
          <Route
            path="/settlement/settled"
            element={
              <RequirePermission
                permissions={[
                  "settlement:view-settled-eth",
                  "settlement:view-settled-visa",
                  "settlement:view-settled-mastercard",
                ]}
              >
                <SettlementHub stage="settled" />
              </RequirePermission>
            }
          />
          <Route
            path="/uncleared-eth"
            element={
              <Navigate to="/clearing/uncleared?scheme=eth" replace />
            }
          />
          <Route
            path="/uncleared-visa"
            element={
              <Navigate to="/clearing/uncleared?scheme=visa" replace />
            }
          />
          <Route
            path="/uncleared-visa-cybersource"
            element={
              <Navigate to="/clearing/uncleared?scheme=visacbs" replace />
            }
          />
          <Route
            path="/uncleared-mastercard"
            element={
              <Navigate to="/clearing/uncleared?scheme=mastercard" replace />
            }
          />
          <Route
            path="/uncleared"
            element={
              <Navigate to="/clearing/uncleared?scheme=eth" replace />
            }
          />
          <Route
            path="/cleared-eth"
            element={<Navigate to="/clearing/cleared?scheme=eth" replace />}
          />
          <Route
            path="/cleared-visa"
            element={<Navigate to="/clearing/cleared?scheme=visa" replace />}
          />
          <Route
            path="/cleared-visa-cybersource"
            element={
              <Navigate to="/clearing/cleared?scheme=visacbs" replace />
            }
          />
          <Route
            path="/cleared-mastercard"
            element={
              <Navigate to="/clearing/cleared?scheme=mastercard" replace />
            }
          />
          <Route
            path="/unsettled-eth"
            element={
              <Navigate to="/settlement/unsettled?scheme=eth" replace />
            }
          />
          <Route
            path="/unsettled-visa"
            element={
              <Navigate to="/settlement/unsettled?scheme=visa" replace />
            }
          />
          <Route
            path="/unsettled-visa-cybersource"
            element={
              <Navigate to="/settlement/unsettled?scheme=visacbs" replace />
            }
          />
          <Route
            path="/unsettled-mastercard"
            element={
              <Navigate to="/settlement/unsettled?scheme=mastercard" replace />
            }
          />
          <Route
            path="/settled-eth"
            element={
              <Navigate to="/settlement/settled?scheme=eth" replace />
            }
          />
          <Route
            path="/settled-visa"
            element={
              <Navigate to="/settlement/settled?scheme=visa" replace />
            }
          />
          <Route
            path="/visa-settlement"
            element={
              <Navigate to="/settlement/settled?scheme=visa" replace />
            }
          />
          <Route
            path="/mastercard-ipm"
            element={
              <Navigate to="/settlement/settled?scheme=mastercard" replace />
            }
          />
          <Route
            path="/settled-mastercard"
            element={
              <Navigate to="/settlement/settled?scheme=mastercard" replace />
            }
          />
          <Route
            path="/cards-per-status"
            element={
              <RequirePermission
                permissions={["card:view-number-of-cards-per-status"]}
              >
                <CardPerStatus
                  title="Card count per status"
                  description="Shows total cards issued per their current status."
                />
              </RequirePermission>
            }
          />
          <Route
            path="/card-activity"
            element={
              <RequirePermission permissions={["card:view-activity-dashboard"]}>
                <CardActivityPage />
              </RequirePermission>
            }
          />
          <Route
            path="/prepaid-visa"
            element={
              <RequirePermission permissions={["card:view-prepaid-visa"]}>
                <PrepaidVisaDashboard />
              </RequirePermission>
            }
          />
          <Route
            path="/prepaid-visa/search"
            element={
              <RequirePermission permissions={["card:view-prepaid-visa"]}>
                <PrepaidVisaSearch />
              </RequirePermission>
            }
          />
          <Route
            path="/prepaid-visa/top-ups"
            element={
              <RequirePermission permissions={["card:view-prepaid-visa"]}>
                <PrepaidVisaTopUps />
              </RequirePermission>
            }
          />
          <Route
            path="/prepaid-visa/unloads"
            element={
              <RequirePermission permissions={["card:view-prepaid-visa"]}>
                <PrepaidVisaUnloads />
              </RequirePermission>
            }
          />
          <Route
            path="/prepaid-visa/transactions"
            element={
              <RequirePermission permissions={["card:view-prepaid-visa"]}>
                <PrepaidVisaTransactions />
              </RequirePermission>
            }
          />
          <Route
            path="/prepaid-visa/reconciliation"
            element={
              <RequirePermission permissions={["card:view-prepaid-visa"]}>
                <PrepaidVisaReconciliation />
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
  );
}

export default App;

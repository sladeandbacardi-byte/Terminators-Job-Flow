import { Switch, Route, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/auth/login-form";
import { getDefaultDashboardRoute, getDashboardRole, type DashboardRole } from "@/lib/dashboardRole";
import { ShieldOff } from "lucide-react";
import AppShell from "@/components/layout/app-shell";

const NotFound            = lazy(() => import("@/pages/not-found"));
const Dashboard           = lazy(() => import("@/pages/dashboard"));
const Jobs                = lazy(() => import("@/pages/jobs"));
const ContractJobs        = lazy(() => import("@/pages/contract-jobs"));
const Workers             = lazy(() => import("@/pages/workers"));
const Clients             = lazy(() => import("@/pages/clients"));
const Inventory           = lazy(() => import("@/pages/inventory"));
const Contracts           = lazy(() => import("@/pages/contracts"));
const Invoices            = lazy(() => import("@/pages/invoices"));
const Emails              = lazy(() => import("@/pages/emails"));
const Reports             = lazy(() => import("@/pages/reports"));
const CustomReports       = lazy(() => import("@/pages/custom-reports"));
const Suppliers           = lazy(() => import("@/pages/suppliers"));
const PurchaseOrders      = lazy(() => import("@/pages/purchase-orders"));
const Mobile              = lazy(() => import("@/pages/mobile"));
const Calendar            = lazy(() => import("@/pages/calendar"));
const JobCard             = lazy(() => import("@/pages/job-card"));
const DailyDepartmentCard = lazy(() => import("@/pages/daily-department-card"));
const QuoteRequest        = lazy(() => import("@/pages/quote-request"));
const Leads               = lazy(() => import("@/pages/leads"));
const Backup              = lazy(() => import("@/pages/backup"));
const Quotes              = lazy(() => import("@/pages/quotes"));
const Fleet               = lazy(() => import("@/pages/fleet"));
const FleetKmLog          = lazy(() => import("@/pages/fleet-km-log"));
const FleetInspection     = lazy(() => import("@/pages/fleet-inspection"));
const FleetFuel           = lazy(() => import("@/pages/fleet-fuel"));
const FleetReportIssue    = lazy(() => import("@/pages/fleet-report-issue"));
const FleetMaintenance    = lazy(() => import("@/pages/fleet-maintenance"));
const FleetVehicleMaintenance = lazy(() => import("@/pages/fleet-vehicle-maintenance"));
const FleetVehicleProfile = lazy(() => import("@/pages/fleet-vehicle-profile"));
const Attendance          = lazy(() => import("@/pages/attendance"));
const TeamManagement      = lazy(() => import("@/pages/team-management"));
const SageExport          = lazy(() => import("@/pages/sage-export"));
const Debtors             = lazy(() => import("@/pages/debtors"));
const Creditors           = lazy(() => import("@/pages/creditors"));
const UsersRoles          = lazy(() => import("@/pages/users-roles"));
const Permissions         = lazy(() => import("@/pages/permissions"));
const Settings            = lazy(() => import("@/pages/settings"));
const SystemLogs          = lazy(() => import("@/pages/system-logs"));
const TestingChecklist    = lazy(() => import("@/pages/testing-checklist"));
const FinanceDashboard    = lazy(() => import("@/pages/finance-dashboard"));
const HRDashboard         = lazy(() => import("@/pages/hr-dashboard"));
const Expenses            = lazy(() => import("@/pages/expenses"));
const OvertimeTimeOff     = lazy(() => import("@/pages/overtime-time-off"));
const StockDashboard      = lazy(() => import("@/pages/stock-dashboard"));
const StockReports        = lazy(() => import("@/pages/stock-reports"));
const ServiceScheduling   = lazy(() => import("@/pages/service-scheduling"));
const ServiceContracts    = lazy(() => import("@/pages/service-contracts"));
const PricingLibraryPage  = lazy(() => import("@/pages/pricing-library"));
const FollowUpsPage       = lazy(() => import("@/pages/follow-ups"));
const ContractsPendingPage = lazy(() => import("@/pages/contracts-pending"));
const ClientProfile       = lazy(() => import("@/pages/client-profile"));
const DataIntegrity       = lazy(() => import("@/pages/data-integrity"));
const SalesDashboard      = lazy(() => import("@/pages/sales-dashboard"));
const CommissionReports   = lazy(() => import("@/pages/commission-reports"));
const AcceptedWork        = lazy(() => import("@/pages/accepted-work"));
const SalesReports        = lazy(() => import("@/pages/sales-reports"));
const EquipmentChecklists = lazy(() => import("@/pages/equipment-checklists"));
const MyOvertime          = lazy(() => import("@/pages/my-time"));
const MobileOvertime      = lazy(() => import("@/components/mobile/mobile-my-time"));
const OvertimeApproval    = lazy(() => import("@/pages/time-overtime"));
const TimeBalance         = lazy(() => import("@/pages/time-balance"));
const Opportunities       = lazy(() => import("@/pages/opportunities"));
const FieldDiaries        = lazy(() => import("@/pages/field-diaries"));
const TreatmentReports    = lazy(() => import("@/pages/treatment-reports"));
const TreatmentReportPrint = lazy(() => import("@/pages/treatment-report-print"));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
        <p className="mt-2 text-gray-500 text-sm">Loading…</p>
      </div>
    </div>
  );
}

function AccessDenied() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm px-6">
        <div className="flex justify-center mb-4">
          <div className="bg-red-100 rounded-full p-4">
            <ShieldOff className="h-10 w-10 text-red-500" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-500 text-sm mb-6">You do not have permission to access this page.</p>
        <button
          onClick={() => navigate(getDefaultDashboardRoute(user ?? {}), { replace: true })}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          Go to my dashboard
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles: DashboardRole[] }) {
  const { user } = useAuth();
  const role = getDashboardRole(user ?? {});
  if (!roles.includes(role)) return <AccessDenied />;
  return <Component />;
}

function RoleDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(getDefaultDashboardRoute(user ?? {}), { replace: true });
  }, []);
  return null;
}

function AuthenticatedApp() {
  const { isAuthenticated, isLoading, login, user } = useAuth();
  const [location, navigate] = useLocation();

  // The technician app owns its own employee-ID/PIN session and must be
  // reachable without first signing into the desktop profile-picker flow.
  if (location === "/mobile") {
    return (
      <Suspense fallback={<PageLoader />}>
        <Mobile />
      </Suspense>
    );
  }

  // A mobile technician can follow a FleetGuard link without being sent
  // through the office profile-picker flow. Keep office-authenticated users
  // on the existing desktop FleetGuard route.
  if (location === "/fleet" && !isLoading && !isAuthenticated && localStorage.getItem("mobile_session_token")) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Mobile />
      </Suspense>
    );
  }

  // Mobile technicians use a separate signed token and must be able to follow
  // the shared overtime URL without being sent through the office login flow.
  if (location === "/my-overtime" && localStorage.getItem("mobile_session_token") && !isAuthenticated) {
    return (
      <Suspense fallback={<PageLoader />}>
        <MobileOvertime />
      </Suspense>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const handleLogin = (token: string, userData: any) => {
      login(token, userData);
      navigate(getDefaultDashboardRoute(userData), { replace: true });
    };
    return <LoginForm onSuccess={handleLogin} />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Standalone views — no shell */}
        <Route path="/mobile" component={Mobile} />
        <Route path="/jobs/:id/card" component={JobCard} />
        <Route path="/treatment-reports/:id/print" component={TreatmentReportPrint} />
        <Route path="/daily-department-card" component={DailyDepartmentCard} />

        {/* All other authenticated routes wrapped in AppShell */}
        <Route>{() => (
          <AppShell>
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/" component={RoleDashboard} />
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/jobs" component={Jobs} />
                <Route path="/once-off-jobs" component={Jobs} />
                <Route path="/contract-jobs" component={ContractJobs} />
                <Route path="/clients" component={Clients} />
                <Route path="/clients/:id" component={ClientProfile} />
                <Route path="/inventory" component={Inventory} />
                <Route path="/contracts" component={Contracts} />
                <Route path="/emails" component={Emails} />
                <Route path="/reports" component={Reports} />
                <Route path="/finance-reports" component={Reports} />
                <Route path="/custom-reports" component={CustomReports} />
                <Route path="/calendar" component={Calendar} />

                {/* ── Sales ────────────────────────────────────────────── */}
                <Route path="/leads">{() => <ProtectedRoute component={Leads} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/quotes">{() => <ProtectedRoute component={Quotes} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/accepted-work">{() => <ProtectedRoute component={AcceptedWork} roles={["admin","manager","sales"]} />}</Route>
                {/* Legacy Sales Diary URL now opens the shared calendar. */}
                <Route path="/sales-diary">{() => { window.location.replace(`/calendar${window.location.search}`); return null; }}</Route>
                <Route path="/sales-dashboard">{() => <ProtectedRoute component={SalesDashboard} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/opportunities">{() => <ProtectedRoute component={Opportunities} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/follow-ups">{() => <ProtectedRoute component={FollowUpsPage} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/sales-reports">{() => <ProtectedRoute component={SalesReports} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/commission-reports">{() => <ProtectedRoute component={CommissionReports} roles={["admin","manager","sales"]} />}</Route>

                {/* ── Finance ──────────────────────────────────────────── */}
                <Route path="/finance-dashboard">{() => <ProtectedRoute component={FinanceDashboard} roles={["admin","accounts"]} />}</Route>
                <Route path="/invoices">{() => <ProtectedRoute component={Invoices} roles={["admin","accounts","manager"]} />}</Route>
                <Route path="/receipts">{() => <ProtectedRoute component={Invoices} roles={["admin","accounts","manager"]} />}</Route>
                <Route path="/expenses">{() => <ProtectedRoute component={Expenses} roles={["admin","accounts"]} />}</Route>
                <Route path="/debtors">{() => <ProtectedRoute component={Debtors} roles={["admin","accounts"]} />}</Route>
                <Route path="/statements">{() => <ProtectedRoute component={Debtors} roles={["admin","accounts"]} />}</Route>
                <Route path="/creditors">{() => <ProtectedRoute component={Creditors} roles={["admin","accounts"]} />}</Route>
                <Route path="/supplier-payments">{() => <ProtectedRoute component={Creditors} roles={["admin","accounts"]} />}</Route>
                <Route path="/sage-export">{() => <ProtectedRoute component={SageExport} roles={["admin","accounts"]} />}</Route>

                {/* ── Admin-only ───────────────────────────────────────── */}
                <Route path="/backup">{() => <ProtectedRoute component={Backup} roles={["admin","manager"]} />}</Route>
                <Route path="/users-roles">{() => <ProtectedRoute component={UsersRoles} roles={["admin","manager"]} />}</Route>
                <Route path="/permissions">{() => <ProtectedRoute component={Permissions} roles={["admin","manager"]} />}</Route>
                <Route path="/settings">{() => <ProtectedRoute component={Settings} roles={["admin","manager"]} />}</Route>
                <Route path="/system-logs">{() => <ProtectedRoute component={SystemLogs} roles={["admin","manager"]} />}</Route>
                <Route path="/data-integrity">{() => <ProtectedRoute component={DataIntegrity} roles={["admin","manager"]} />}</Route>
                <Route path="/pricing-library">{() => <ProtectedRoute component={PricingLibraryPage} roles={["admin","manager"]} />}</Route>

                {/* ── Suppliers / Purchase Orders ──────────────────────── */}
                <Route path="/suppliers">{() => <ProtectedRoute component={Suppliers} roles={["admin","manager","coordinator"]} />}</Route>
                <Route path="/purchase-orders">{() => <ProtectedRoute component={PurchaseOrders} roles={["admin","manager","coordinator","accounts"]} />}</Route>
                <Route path="/workers">{() => <ProtectedRoute component={Workers} roles={["admin","manager","coordinator","accounts"]} />}</Route>

                {/* ── Service / Operations ─────────────────────────────── */}
                <Route path="/field-diaries">{() => { window.location.replace("/calendar"); return null; }}</Route>
                <Route path="/stock-management">{() => { window.location.replace("/inventory"); return null; }}</Route>
                <Route path="/treatment-reports">{() => <ProtectedRoute component={TreatmentReports} roles={["admin","manager","coordinator","service"]} />}</Route>
                <Route path="/fleet" component={Fleet} />
                <Route path="/fleet/vehicles" component={Fleet} />
                <Route path="/fleet/km-log" component={FleetKmLog} />
                <Route path="/fleet/inspection" component={FleetInspection} />
                <Route path="/fleet/fuel" component={FleetFuel} />
                <Route path="/fleet/report-issue" component={FleetReportIssue} />
                <Route path="/fleet/vehicles/:id" component={FleetVehicleProfile} />
                <Route path="/fleet/maintenance/:vehicleId" component={FleetVehicleMaintenance} />
                <Route path="/fleet/maintenance" component={FleetMaintenance} />
                 <Route path="/operations/fleet" component={Fleet} />
                 <Route path="/operations/fleet/vehicles" component={Fleet} />
                 <Route path="/operations/fleet/daily-check" component={FleetInspection} />
                 <Route path="/operations/fleet/fuel" component={FleetFuel} />
                 <Route path="/operations/fleet/inspections" component={Fleet} />
                 <Route path="/operations/fleet/faults" component={FleetMaintenance} />
                 <Route path="/operations/fleet/service-history" component={FleetMaintenance} />
                 <Route path="/operations/fleet/reports" component={Fleet} />
                <Route path="/attendance" component={Attendance} />
                <Route path="/team-management" component={TeamManagement} />
                <Route path="/testing-checklist" component={TestingChecklist} />
                <Route path="/overtime-time-off" component={OvertimeTimeOff} />
                <Route path="/stock-dashboard" component={StockDashboard} />
                <Route path="/stock-reports" component={StockReports} />
                <Route path="/stock-usage" component={Inventory} />
                <Route path="/stock-adjustments" component={Inventory} />
                <Route path="/service-contracts">{() => <ProtectedRoute component={ServiceContracts} roles={["admin","manager","coordinator"]} />}</Route>
                <Route path="/contracts-pending" component={ContractsPendingPage} />
                <Route path="/hr-dashboard" component={HRDashboard} />
                <Route path="/service-scheduling" component={ServiceScheduling} />
                <Route path="/equipment-checklists" component={EquipmentChecklists} />
                 <Route path="/my-overtime" component={MyOvertime} />
                 <Route path="/overtime-approval">{() => <ProtectedRoute component={OvertimeApproval} roles={["admin","manager"]} />}</Route>
                 <Route path="/time-balance">{() => <ProtectedRoute component={TimeBalance} roles={["admin","manager"]} />}</Route>
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </AppShell>
        )}</Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  const [location] = useLocation();

  if (location === '/quote-request') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<PageLoader />}>
            <QuoteRequest />
          </Suspense>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <AuthenticatedApp />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

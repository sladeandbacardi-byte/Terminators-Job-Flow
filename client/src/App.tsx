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
const FieldDiaries        = lazy(() => import("@/pages/field-diaries"));
const Quotes              = lazy(() => import("@/pages/quotes"));
const SalesDiary          = lazy(() => import("@/pages/sales-diary"));
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
const ServiceScheduling   = lazy(() => import("@/pages/service-scheduling"));
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
  const [, navigate] = useLocation();

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
        <Route path="/daily-department-card" component={DailyDepartmentCard} />

        {/* All other authenticated routes wrapped in AppShell */}
        <Route>{() => (
          <AppShell>
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/" component={RoleDashboard} />
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/jobs" component={Jobs} />
                <Route path="/clients" component={Clients} />
                <Route path="/clients/:id" component={ClientProfile} />
                <Route path="/inventory" component={Inventory} />
                <Route path="/contracts" component={Contracts} />
                <Route path="/emails" component={Emails} />
                <Route path="/reports" component={Reports} />
                <Route path="/custom-reports" component={CustomReports} />
                <Route path="/calendar" component={Calendar} />

                {/* ── Sales ────────────────────────────────────────────── */}
                <Route path="/leads">{() => <ProtectedRoute component={Leads} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/quotes">{() => <ProtectedRoute component={Quotes} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/accepted-work">{() => <ProtectedRoute component={AcceptedWork} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/sales-diary">{() => <ProtectedRoute component={SalesDiary} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/sales-dashboard">{() => <ProtectedRoute component={SalesDashboard} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/follow-ups">{() => <ProtectedRoute component={FollowUpsPage} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/sales-reports">{() => <ProtectedRoute component={SalesReports} roles={["admin","manager","sales"]} />}</Route>
                <Route path="/commission-reports">{() => <ProtectedRoute component={CommissionReports} roles={["admin","manager","sales"]} />}</Route>

                {/* ── Finance ──────────────────────────────────────────── */}
                <Route path="/finance-dashboard">{() => <ProtectedRoute component={FinanceDashboard} roles={["admin","accounts"]} />}</Route>
                <Route path="/invoices">{() => <ProtectedRoute component={Invoices} roles={["admin","accounts","manager"]} />}</Route>
                <Route path="/expenses">{() => <ProtectedRoute component={Expenses} roles={["admin","accounts"]} />}</Route>
                <Route path="/debtors">{() => <ProtectedRoute component={Debtors} roles={["admin","accounts"]} />}</Route>
                <Route path="/creditors">{() => <ProtectedRoute component={Creditors} roles={["admin","accounts"]} />}</Route>
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
                <Route path="/purchase-orders">{() => <ProtectedRoute component={PurchaseOrders} roles={["admin","manager","coordinator"]} />}</Route>
                <Route path="/workers">{() => <ProtectedRoute component={Workers} roles={["admin","manager","coordinator","accounts"]} />}</Route>

                {/* ── Service / Operations ─────────────────────────────── */}
                <Route path="/field-diaries" component={FieldDiaries} />
                <Route path="/fleet" component={Fleet} />
                <Route path="/fleet/km-log" component={FleetKmLog} />
                <Route path="/fleet/inspection" component={FleetInspection} />
                <Route path="/fleet/fuel" component={FleetFuel} />
                <Route path="/fleet/report-issue" component={FleetReportIssue} />
                <Route path="/fleet/vehicles/:id" component={FleetVehicleProfile} />
                <Route path="/fleet/maintenance/:vehicleId" component={FleetVehicleMaintenance} />
                <Route path="/fleet/maintenance" component={FleetMaintenance} />
                <Route path="/attendance" component={Attendance} />
                <Route path="/team-management" component={TeamManagement} />
                <Route path="/testing-checklist" component={TestingChecklist} />
                <Route path="/service-contracts">{() => { window.location.replace("/contracts"); return null; }}</Route>
                <Route path="/contracts-pending" component={ContractsPendingPage} />
                <Route path="/hr-dashboard" component={HRDashboard} />
                <Route path="/service-scheduling" component={ServiceScheduling} />
                <Route path="/equipment-checklists" component={EquipmentChecklists} />
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

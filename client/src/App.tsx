import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/auth/login-form";
import { getDefaultDashboardRoute, getDashboardRole, type DashboardRole } from "@/lib/dashboardRole";
import { ShieldOff } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Jobs from "@/pages/jobs";
import Workers from "@/pages/workers";
import Clients from "@/pages/clients";
import Inventory from "@/pages/inventory";
import Contracts from "@/pages/contracts";
import Invoices from "@/pages/invoices";
import Emails from "@/pages/emails";
import Reports from "@/pages/reports";
import CustomReports from "@/pages/custom-reports";
import Suppliers from "@/pages/suppliers";
import PurchaseOrders from "@/pages/purchase-orders";
import Mobile from "@/pages/mobile";
import Calendar from "@/pages/calendar";
import JobCard from "@/pages/job-card";
import DailyDepartmentCard from "@/pages/daily-department-card";
import QuoteRequest from "@/pages/quote-request";
import Leads from "@/pages/leads";
import Backup from "@/pages/backup";
import FieldDiaries from "@/pages/field-diaries";
import Quotes from "@/pages/quotes";
import SalesDiary from "@/pages/sales-diary";
import Fleet from "@/pages/fleet";
import FleetKmLog from "@/pages/fleet-km-log";
import FleetInspection from "@/pages/fleet-inspection";
import FleetFuel from "@/pages/fleet-fuel";
import FleetReportIssue from "@/pages/fleet-report-issue";
import FleetMaintenance from "@/pages/fleet-maintenance";
import FleetVehicleMaintenance from "@/pages/fleet-vehicle-maintenance";
import FleetVehicleProfile from "@/pages/fleet-vehicle-profile";
import Attendance from "@/pages/attendance";
import TeamManagement from "@/pages/team-management";
import SageExport from "@/pages/sage-export";
import Debtors from "@/pages/debtors";
import Creditors from "@/pages/creditors";
import UsersRoles from "@/pages/users-roles";
import Permissions from "@/pages/permissions";
import Settings from "@/pages/settings";
import SystemLogs from "@/pages/system-logs";
import TestingChecklist from "@/pages/testing-checklist";
import FinanceDashboard from "@/pages/finance-dashboard";
import HRDashboard from "@/pages/hr-dashboard";
import Expenses from "@/pages/expenses";
import ServiceScheduling from "@/pages/service-scheduling";
import PricingLibraryPage from "@/pages/pricing-library";
import FollowUpsPage from "@/pages/follow-ups";
import ContractsPendingPage from "@/pages/contracts-pending";
import ClientProfile from "@/pages/client-profile";
import DataIntegrity from "@/pages/data-integrity";
import SalesDashboard from "@/pages/sales-dashboard";
import CommissionReports from "@/pages/commission-reports";
import AcceptedWork from "@/pages/accepted-work";
import SalesReports from "@/pages/sales-reports";
import EquipmentChecklists from "@/pages/equipment-checklists";

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
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
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

/** Redirects "/" to the role-appropriate dashboard — never shows SalesDashboard by default */
function RoleDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(getDefaultDashboardRoute(user ?? {}), { replace: true });
  }, []);
  return null;
}

function AuthenticatedApp() {
  const { isAuthenticated, isLoading, login, loginDemo, user } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
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
    const handleDemoLogin = (profile: any) => {
      loginDemo(profile);
      navigate(getDefaultDashboardRoute(profile.user ?? {}), { replace: true });
    };
    return <LoginForm onSuccess={handleLogin} onDemoLogin={handleDemoLogin} />;
  }

  return (
    <Switch>
      <Route path="/mobile" component={Mobile} />
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
      <Route path="/jobs/:id/card" component={JobCard} />
      <Route path="/daily-department-card" component={DailyDepartmentCard} />
      {/* ── Sales (admin, manager, sales) ───────────────────────────────── */}
      <Route path="/leads">{() => <ProtectedRoute component={Leads} roles={["admin","manager","sales"]} />}</Route>
      <Route path="/quotes">{() => <ProtectedRoute component={Quotes} roles={["admin","manager","sales"]} />}</Route>
      <Route path="/accepted-work">{() => <ProtectedRoute component={AcceptedWork} roles={["admin","manager","sales"]} />}</Route>
      <Route path="/sales-diary">{() => <ProtectedRoute component={SalesDiary} roles={["admin","manager","sales"]} />}</Route>
      <Route path="/sales-dashboard">{() => <ProtectedRoute component={SalesDashboard} roles={["admin","manager","sales"]} />}</Route>
      <Route path="/follow-ups">{() => <ProtectedRoute component={FollowUpsPage} roles={["admin","manager","sales"]} />}</Route>
      <Route path="/sales-reports">{() => <ProtectedRoute component={SalesReports} roles={["admin","manager","sales"]} />}</Route>
      <Route path="/commission-reports">{() => <ProtectedRoute component={CommissionReports} roles={["admin","manager","sales"]} />}</Route>

      {/* ── Finance (admin, accounts) ────────────────────────────────────── */}
      <Route path="/finance-dashboard">{() => <ProtectedRoute component={FinanceDashboard} roles={["admin","accounts"]} />}</Route>
      <Route path="/invoices">{() => <ProtectedRoute component={Invoices} roles={["admin","accounts","manager"]} />}</Route>
      <Route path="/expenses">{() => <ProtectedRoute component={Expenses} roles={["admin","accounts"]} />}</Route>
      <Route path="/debtors">{() => <ProtectedRoute component={Debtors} roles={["admin","accounts"]} />}</Route>
      <Route path="/creditors">{() => <ProtectedRoute component={Creditors} roles={["admin","accounts"]} />}</Route>
      <Route path="/sage-export">{() => <ProtectedRoute component={SageExport} roles={["admin","accounts"]} />}</Route>

      {/* ── Admin-only ───────────────────────────────────────────────────── */}
      <Route path="/backup">{() => <ProtectedRoute component={Backup} roles={["admin","manager"]} />}</Route>
      <Route path="/users-roles">{() => <ProtectedRoute component={UsersRoles} roles={["admin","manager"]} />}</Route>
      <Route path="/permissions">{() => <ProtectedRoute component={Permissions} roles={["admin","manager"]} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} roles={["admin","manager"]} />}</Route>
      <Route path="/system-logs">{() => <ProtectedRoute component={SystemLogs} roles={["admin","manager"]} />}</Route>
      <Route path="/data-integrity">{() => <ProtectedRoute component={DataIntegrity} roles={["admin","manager"]} />}</Route>
      <Route path="/pricing-library">{() => <ProtectedRoute component={PricingLibraryPage} roles={["admin","manager"]} />}</Route>

      {/* ── Suppliers / Purchase Orders (admin, manager, coordinator) ────── */}
      <Route path="/suppliers">{() => <ProtectedRoute component={Suppliers} roles={["admin","manager","coordinator"]} />}</Route>
      <Route path="/purchase-orders">{() => <ProtectedRoute component={PurchaseOrders} roles={["admin","manager","coordinator"]} />}</Route>
      <Route path="/workers">{() => <ProtectedRoute component={Workers} roles={["admin","manager","coordinator","accounts"]} />}</Route>

      {/* ── Service / Operations (open to service roles) ─────────────────── */}
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
  );
}

function App() {
  const [location] = useLocation();

  // Public routes that don't require authentication
  if (location === '/quote-request') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <QuoteRequest />
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

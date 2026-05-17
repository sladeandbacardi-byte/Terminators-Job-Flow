import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/auth/login-form";
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
import TestingChecklist from "@/pages/testing-checklist";
import Fleet from "@/pages/fleet";
import FleetKmLog from "@/pages/fleet-km-log";
import FleetInspection from "@/pages/fleet-inspection";
import FleetFuel from "@/pages/fleet-fuel";

function AuthenticatedApp() {
  const { isAuthenticated, isLoading, login, loginDemo } = useAuth();

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
    return <LoginForm onSuccess={login} onDemoLogin={loginDemo} />;
  }

  return (
    <Switch>
      <Route path="/mobile" component={Mobile} />
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/workers" component={Workers} />
      <Route path="/clients" component={Clients} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/contracts" component={Contracts} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/emails" component={Emails} />
      <Route path="/reports" component={Reports} />
      <Route path="/custom-reports" component={CustomReports} />
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/purchase-orders" component={PurchaseOrders} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/jobs/:id/card" component={JobCard} />
      <Route path="/daily-department-card" component={DailyDepartmentCard} />
      <Route path="/leads" component={Leads} />
      <Route path="/backup" component={Backup} />
      <Route path="/field-diaries" component={FieldDiaries} />
      <Route path="/quotes" component={Quotes} />
      <Route path="/testing-checklist" component={TestingChecklist} />
      <Route path="/fleet" component={Fleet} />
      <Route path="/fleet/km-log" component={FleetKmLog} />
      <Route path="/fleet/inspection" component={FleetInspection} />
      <Route path="/fleet/fuel" component={FleetFuel} />
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

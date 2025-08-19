import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import Suppliers from "@/pages/suppliers";
import PurchaseOrders from "@/pages/purchase-orders";

function Router() {
  return (
    <Switch>
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
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/purchase-orders" component={PurchaseOrders} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

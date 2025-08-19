import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Shield, BarChart3, Calendar, Users, Box, FileText, BarChart, Receipt, Mail, Building2, ShoppingCart } from "lucide-react";
import { TerminatorsLogo } from "@/components/terminators-logo";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Job Scheduling", href: "/jobs", icon: Calendar },
  { name: "Field Workers", href: "/workers", icon: Users },
  { name: "Clients", href: "/clients", icon: Shield },
  { name: "Inventory", href: "/inventory", icon: Box },
  { name: "Rental Contracts", href: "/contracts", icon: FileText },
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Email Center", href: "/emails", icon: Mail },
  { name: "Suppliers", href: "/suppliers", icon: Building2 },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Reports", href: "/reports", icon: BarChart },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="bg-white shadow-lg w-64 hidden md:block" data-testid="sidebar">
      <div className="p-6 border-b border-gray-200">
        <TerminatorsLogo size="sm" data-testid="sidebar-logo" />
      </div>
      
      <nav className="p-4 space-y-2" data-testid="navigation">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
          
          return (
            <Link key={item.name} href={item.href} className={cn(
              "flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors",
              isActive 
                ? "bg-primary-50 text-primary-700" 
                : "text-gray-700 hover:bg-gray-100"
            )} data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}>
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

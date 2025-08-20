import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  Users,
  Shield,
  Box,
  FileText,
  Receipt,
  Mail,
  Building2,
  ShoppingCart,
  BarChart,
  DollarSign,
  Wrench,
  CreditCard,
  Settings,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { TerminatorsLogo } from "@/components/terminators-logo";

const navigationCategories = [
  {
    name: "Sales",
    icon: DollarSign,
    items: [
      { name: "Clients", href: "/clients", icon: Shield },
      { name: "Rental Contracts", href: "/contracts", icon: FileText },
      { name: "Email Center", href: "/emails", icon: Mail },
    ]
  },
  {
    name: "Service",
    icon: Wrench,
    items: [
      { name: "Job Scheduling", href: "/jobs", icon: Calendar },
      { name: "Field Workers", href: "/workers", icon: Users },
      { name: "Stock Management", href: "/inventory", icon: Box },
      { name: "Suppliers", href: "/suppliers", icon: Building2 },
      { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
    ]
  },
  {
    name: "Finance",
    icon: CreditCard,
    items: [
      { name: "Invoices", href: "/invoices", icon: Receipt },
    ]
  },
  {
    name: "Admin",
    icon: Settings,
    items: [
      { name: "Reports", href: "/reports", icon: BarChart },
    ]
  },
];

const quickNavigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="bg-white shadow-lg w-64 hidden md:block" data-testid="sidebar">
      <div className="p-6 border-b border-gray-200">
        <TerminatorsLogo size="sm" data-testid="sidebar-logo" />
      </div>
      
      <nav className="p-4 space-y-6" data-testid="navigation">
        {/* Dashboard Quick Access */}
        {quickNavigation.map((item) => {
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

        {/* Categorized Navigation */}
        {navigationCategories.map((category) => {
          const CategoryIcon = category.icon;
          
          return (
            <div key={category.name} className="space-y-2">
              <div className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-gray-600 uppercase tracking-wider">
                <CategoryIcon className="h-4 w-4" />
                <span>{category.name}</span>
              </div>
              
              <div className="space-y-1">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  
                  return (
                    <Link key={item.name} href={item.href} className={cn(
                      "flex items-center space-x-3 px-6 py-2 rounded-lg font-medium transition-colors",
                      isActive 
                        ? "bg-primary-50 text-primary-700" 
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )} data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}>
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

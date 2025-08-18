import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Shield, BarChart3, Calendar, Users, Box, FileText, BarChart } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Job Scheduling", href: "/jobs", icon: Calendar },
  { name: "Field Workers", href: "/workers", icon: Users },
  { name: "Inventory", href: "/inventory", icon: Box },
  { name: "Rental Contracts", href: "/contracts", icon: FileText },
  { name: "Reports", href: "/reports", icon: BarChart },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="bg-white shadow-lg w-64 hidden lg:block" data-testid="sidebar">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" data-testid="logo-icon" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900" data-testid="company-name">The Terminators</h1>
            <p className="text-sm text-gray-500" data-testid="company-subtitle">Field Service Management</p>
          </div>
        </div>
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

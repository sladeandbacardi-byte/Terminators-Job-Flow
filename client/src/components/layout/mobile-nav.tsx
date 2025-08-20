import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { BarChart3, Calendar, Users, Shield, Box, BarChart, Receipt, Mail, FileText, Building2, ShoppingCart } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Clients", href: "/clients", icon: Shield, category: "Sales" },
  { name: "Contracts", href: "/contracts", icon: FileText, category: "Sales" },
  { name: "Emails", href: "/emails", icon: Mail, category: "Sales" },
  { name: "Jobs", href: "/jobs", icon: Calendar, category: "Service" },
  { name: "Workers", href: "/workers", icon: Users, category: "Service" },
  { name: "Stock", href: "/inventory", icon: Box, category: "Service" },
  { name: "Suppliers", href: "/suppliers", icon: Building2, category: "Service" },
  { name: "Orders", href: "/purchase-orders", icon: ShoppingCart, category: "Service" },
  { name: "Invoices", href: "/invoices", icon: Receipt, category: "Finance" },
  { name: "Reports", href: "/reports", icon: BarChart, category: "Admin" },
];

export default function MobileNavigation() {
  const [location] = useLocation();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50" data-testid="mobile-navigation">
      <div className="grid grid-cols-4 gap-1 overflow-x-auto"
           style={{ gridTemplateColumns: `repeat(${navigation.length}, minmax(60px, 1fr))` }}>
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
          
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={cn(
                "flex flex-col items-center p-3 transition-colors",
                isActive 
                  ? "text-primary-600 bg-primary-50" 
                  : "text-gray-600"
              )} 
              data-testid={`mobile-nav-${item.name.toLowerCase()}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs mt-1">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

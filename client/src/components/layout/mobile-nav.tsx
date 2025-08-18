import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { BarChart3, Calendar, Users, Box, BarChart } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Jobs", href: "/jobs", icon: Calendar },
  { name: "Workers", href: "/workers", icon: Users },
  { name: "Inventory", href: "/inventory", icon: Box },
  { name: "Reports", href: "/reports", icon: BarChart },
];

export default function MobileNavigation() {
  const [location] = useLocation();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50" data-testid="mobile-navigation">
      <div className="grid grid-cols-5 gap-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
          
          return (
            <Link key={item.name} href={item.href}>
              <a className={cn(
                "flex flex-col items-center p-3 transition-colors",
                isActive 
                  ? "text-primary-600 bg-primary-50" 
                  : "text-gray-600"
              )} data-testid={`mobile-nav-${item.name.toLowerCase()}`}>
                <Icon className="h-5 w-5" />
                <span className="text-xs mt-1">{item.name}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  BarChart3, Calendar, Users, Shield, Box, FileText, Receipt, Mail,
  Building2, ShoppingCart, BarChart, DollarSign, Wrench, CreditCard,
  Settings, TrendingUp, ExternalLink, Database, ClipboardList, Briefcase,
  Truck, Gauge, Fuel, ClipboardCheck, AlertCircle, UserCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";

// All possible nav categories
const ALL_CATEGORIES = [
  // ── SALES ────────────────────────────────────────────────────────────────
  {
    name: "Sales",
    icon: DollarSign,
    roles: ["admin", "manager", "sales"],
    items: [
      { name: "Leads",            href: "/leads",     icon: TrendingUp, roles: ["admin", "manager", "sales"] },
      { name: "Quotes",           href: "/quotes",    icon: FileText,   roles: ["admin", "manager", "sales"] },
      { name: "Clients",          href: "/clients",   icon: Shield,     roles: ["admin", "manager", "sales"] },
      { name: "Rental Contracts", href: "/contracts", icon: FileText,   roles: ["admin", "manager", "sales"] },
      { name: "Email Center",     href: "/emails",    icon: Mail,       roles: ["admin", "manager", "sales"] },
    ],
  },

  // ── SERVICE (full ops — admin, manager, coordinator) ─────────────────────
  {
    name: "Service",
    icon: Wrench,
    roles: ["admin", "manager", "coordinator"],
    items: [
      { name: "Calendar",         href: "/calendar",        icon: Calendar,     roles: ["admin", "manager", "coordinator"] },
      { name: "Staff Schedule",    href: "/field-diaries",   icon: ClipboardList,roles: ["admin", "manager", "coordinator"] },
      { name: "Job Scheduling",   href: "/jobs",            icon: Calendar,     roles: ["admin", "manager", "coordinator"] },
      { name: "Team Attendance",  href: "/attendance",      icon: UserCheck,    roles: ["admin", "manager", "coordinator"] },
      { name: "Clients",          href: "/clients",         icon: Shield,       roles: ["admin", "manager", "coordinator"] },
      { name: "Staff",            href: "/workers",         icon: Users,        roles: ["admin", "manager", "coordinator"] },
      { name: "Stock Management", href: "/inventory",       icon: Box,          roles: ["admin", "manager", "coordinator"] },
      { name: "Stock Manager Pro",href: "https://stock-manager-pro-sladeandbacardi.replit.app/login", icon: ExternalLink, roles: ["admin", "manager", "coordinator"], external: true },
      { name: "Suppliers",        href: "/suppliers",       icon: Building2,    roles: ["admin", "manager", "coordinator"] },
      { name: "Purchase Orders",  href: "/purchase-orders", icon: ShoppingCart, roles: ["admin", "manager", "coordinator"] },
    ],
  },

  // ── SERVICE (field technician — own jobs, diaries, calendar only) ─────────
  {
    name: "Service",
    icon: Wrench,
    roles: ["service"],
    items: [
      { name: "Calendar",        href: "/calendar",      icon: Calendar,      roles: ["service"], tooltip: "View your assigned jobs by date." },
      { name: "My Jobs",         href: "/jobs",          icon: Briefcase,     roles: ["service"], tooltip: "Your main job list and daily work sheet." },
      { name: "Field Diaries",   href: "/field-diaries", icon: ClipboardList, roles: ["service"], tooltip: "Submit and view job reports linked to completed work." },
      { name: "Team Attendance", href: "/attendance",    icon: UserCheck,     roles: ["service"], tooltip: "Mark your team's attendance for today." },
    ],
  },

  // ── SERVICE (accounts/finance — limited view) ─────────────────────────────
  {
    name: "Service",
    icon: Wrench,
    roles: ["accounts"],
    items: [
      { name: "Calendar",        href: "/calendar",        icon: Calendar,     roles: ["accounts"] },
      { name: "Job Scheduling",  href: "/jobs",            icon: Calendar,     roles: ["accounts"] },
      { name: "Clients",         href: "/clients",         icon: Shield,       roles: ["accounts"] },
      { name: "Suppliers",       href: "/suppliers",       icon: Building2,    roles: ["accounts"] },
      { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, roles: ["accounts"] },
    ],
  },

  // ── FINANCE ───────────────────────────────────────────────────────────────
  {
    name: "Finance",
    icon: CreditCard,
    roles: ["admin", "manager", "accounts", "coordinator"],
    items: [
      { name: "Invoices", href: "/invoices", icon: Receipt, roles: ["admin", "manager", "accounts", "coordinator"] },
    ],
  },

  // ── ADMIN ────────────────────────────────────────────────────────────────
  {
    name: "Admin",
    icon: Settings,
    roles: ["admin", "manager", "coordinator", "accounts"],
    items: [
      { name: "Team Management",   href: "/team-management",   icon: Users,         roles: ["admin", "manager"] },
      { name: "Reports",           href: "/reports",           icon: BarChart,      roles: ["admin", "manager", "coordinator", "accounts"] },
      { name: "Custom Reports",    href: "/custom-reports",    icon: BarChart3,     roles: ["admin", "manager"] },
      { name: "Testing Checklist", href: "/testing-checklist", icon: ClipboardList, roles: ["admin", "manager", "coordinator"] },
      { name: "Backup & Restore",  href: "/backup",            icon: Database,      roles: ["admin"] },
    ],
  },

  // ── FLEET ─────────────────────────────────────────────────────────────────
  {
    name: "Fleet",
    icon: Truck,
    roles: ["admin", "manager", "coordinator", "service", "accounts", "sales"],
    items: [
      { name: "Fleet Dashboard",    href: "/fleet",              icon: Truck,         roles: ["admin", "manager", "coordinator"] },
      { name: "Maintenance",        href: "/fleet/maintenance",  icon: Wrench,        roles: ["admin", "manager", "coordinator"] },
      { name: "Report Issue",       href: "/fleet/report-issue", icon: AlertCircle,   roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Log KMs",            href: "/fleet/km-log",       icon: Gauge,         roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Vehicle Inspection", href: "/fleet/inspection",   icon: ClipboardCheck, roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Fuel Fill-up",       href: "/fleet/fuel",         icon: Fuel,          roles: ["admin", "manager", "coordinator", "service"] },
    ],
  },
];

const quickNavigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = user ? getDashboardRole(user) : "admin";

  // For sales role: show Sales section + only Calendar from Service (no Service heading)
  const isSales = role === "sales";

  const visibleCategories = ALL_CATEGORIES
    .map(cat => ({
      ...cat,
      visibleItems: cat.items.filter(item => item.roles.includes(role)),
    }))
    .filter(cat => {
      if (!cat.roles.includes(role) && !cat.visibleItems.length) return false;
      // Sales: show Sales category normally; show Service only if it has visible items
      return cat.visibleItems.length > 0;
    });

  return (
    <div className="bg-white shadow-lg w-64 hidden md:flex flex-col" data-testid="sidebar">
      <nav className="p-4 space-y-4 overflow-y-auto flex-1" data-testid="navigation">
        {/* Dashboard */}
        {quickNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || location === "/dashboard";
          return (
            <Link key={item.name} href={item.href} className={cn(
              "flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors",
              isActive ? "bg-primary-50 text-primary-700" : "text-gray-700 hover:bg-gray-100"
            )} data-testid="nav-link-dashboard">
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}

        {/* Role-filtered categories */}
        {visibleCategories.map((category) => {
          const CategoryIcon = category.icon;
          return (
            <div key={category.name} className="space-y-1">
              <div className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <CategoryIcon className="h-3.5 w-3.5" />
                <span>{category.name}</span>
              </div>
              <div className="space-y-0.5">
                {category.visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  const linkClass = cn(
                    "flex items-center space-x-3 px-6 py-2 rounded-lg font-medium transition-colors text-sm",
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  );
                  if ((item as any).external) {
                    return (
                      <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer"
                        className={linkClass}
                        data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}>
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </a>
                    );
                  }
                  return (
                    <Link key={item.name} href={item.href} className={linkClass}
                      title={(item as any).tooltip}
                      data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}>
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

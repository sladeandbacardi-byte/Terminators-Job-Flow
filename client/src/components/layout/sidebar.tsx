import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  BarChart3, Calendar, Users, Shield, Box, FileText, Receipt, Mail,
  Building2, ShoppingCart, BarChart, DollarSign, Wrench, CreditCard,
  Settings, TrendingUp, ExternalLink, Database, ClipboardList, Briefcase,
  Truck, Gauge, Fuel, ClipboardCheck, AlertCircle, UserCheck, FileSpreadsheet,
  ChevronDown, ChevronRight, UserCog, Lock, ScrollText, HandCoins, Wallet,
  CheckSquare, Cog, ListOrdered, BookOpen, LayoutDashboard, Heart,
  Bell, Tag, Clock, PieChart,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";

type NavItem = {
  name: string;
  href: string;
  icon: any;
  roles: string[];
  external?: boolean;
  tooltip?: string;
};

type NavSection = {
  key: string;
  name: string;
  icon: any;
  roles: string[];
  items: NavItem[];
};

// Role groups (per spec):
//  admin    → Managing Member (everything)
//  manager  → Managing Member
//  coordinator → Service Coordinator
//  service  → Technician (simplified)
//  sales    → Sales
//  accounts → Finance
const ALL_SECTIONS: NavSection[] = [
  {
    key: "sales",
    name: "Sales",
    icon: DollarSign,
    roles: ["admin", "manager", "sales"],
    items: [
      { name: "Leads",         href: "/leads",         icon: TrendingUp,  roles: ["admin", "manager", "sales"] },
      { name: "Quotes",        href: "/quotes",        icon: FileText,    roles: ["admin", "manager", "sales"] },
      { name: "Accepted Work", href: "/accepted-work", icon: CheckSquare, roles: ["admin", "manager", "sales"] },
      { name: "Diary",         href: "/sales-diary",   icon: BookOpen,    roles: ["admin", "manager", "sales"] },
      { name: "Clients",       href: "/clients",       icon: Shield,      roles: ["admin", "manager", "sales"] },
      { name: "Follow-ups",    href: "/follow-ups",    icon: Bell,        roles: ["admin", "manager", "sales"] },
      { name: "Reports",       href: "/sales-reports", icon: BarChart3,   roles: ["admin", "manager", "sales"] },
      { name: "Email Center",  href: "/emails",        icon: Mail,        roles: ["admin", "manager", "sales"] },
    ],
  },
  {
    key: "service",
    name: "Service",
    icon: Wrench,
    roles: ["admin", "manager", "coordinator", "service", "accounts"],
    items: [
      { name: "Jobs",             href: "/jobs",              icon: Briefcase,    roles: ["admin", "manager", "coordinator", "accounts"] },
      { name: "My Jobs",          href: "/jobs",              icon: Briefcase,    roles: ["service"], tooltip: "Your main job list and daily work sheet." },
      { name: "Calendar",              href: "/calendar",              icon: Calendar,      roles: ["admin", "manager", "coordinator", "service", "accounts"] },
      { name: "Contracts",             href: "/contracts",             icon: ListOrdered,   roles: ["admin", "manager", "coordinator"] },
      { name: "Equipment Checklists",  href: "/equipment-checklists",  icon: ClipboardCheck, roles: ["admin", "manager", "coordinator"] },
      { name: "Daily Diaries",         href: "/field-diaries",         icon: BookOpen,      roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Stock Management",      href: "/inventory",             icon: Box,           roles: ["admin", "manager", "coordinator"] },
      { name: "Reports",               href: "/reports",               icon: BarChart,      roles: ["admin", "manager", "coordinator"] },
    ],
  },
  {
    key: "finance",
    name: "Finance",
    icon: CreditCard,
    roles: ["admin"],
    items: [
      { name: "Finance Overview",  href: "/finance-dashboard", icon: LayoutDashboard, roles: ["admin"] },
      { name: "Invoices",          href: "/invoices",    icon: Receipt,         roles: ["admin"] },
      { name: "Expense Capture",   href: "/expenses",    icon: Wallet,          roles: ["admin"] },
      { name: "Debtors",           href: "/debtors",     icon: HandCoins,       roles: ["admin"] },
      { name: "Creditors",         href: "/creditors",   icon: Wallet,          roles: ["admin"] },
      { name: "Sage Export",       href: "/sage-export", icon: FileSpreadsheet, roles: ["admin"] },
      { name: "Reports",           href: "/reports",     icon: BarChart,        roles: ["admin"] },
    ],
  },
  {
    key: "operations",
    name: "Operations",
    icon: Users,
    roles: ["admin", "manager", "coordinator", "accounts", "service"],
    items: [
      { name: "HR Dashboard",       href: "/hr-dashboard",       icon: Heart,         roles: ["admin", "manager", "accounts"] },
      { name: "Staff",              href: "/workers",            icon: Users,         roles: ["admin", "manager", "coordinator", "accounts"] },
      { name: "Team Attendance",    href: "/attendance",         icon: UserCheck,     roles: ["admin", "manager", "coordinator", "accounts"] },
      { name: "Teams",              href: "/team-management",    icon: Users,         roles: ["admin", "manager"] },
      { name: "Fleet Dashboard",    href: "/fleet",              icon: Truck,         roles: ["admin", "manager", "coordinator"] },
      { name: "Maintenance",        href: "/fleet/maintenance",  icon: Wrench,        roles: ["admin", "manager", "coordinator"] },
      { name: "Report Issue",       href: "/fleet/report-issue", icon: AlertCircle,   roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Log KMs",            href: "/fleet/km-log",       icon: Gauge,         roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Vehicle Inspection", href: "/fleet/inspection",   icon: ClipboardCheck, roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Fuel Fill-up",       href: "/fleet/fuel",         icon: Fuel,          roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Testing Checklist",  href: "/testing-checklist",  icon: CheckSquare,   roles: ["admin", "manager", "coordinator"] },
    ],
  },
  {
    key: "admin",
    name: "Admin",
    icon: Cog,
    roles: ["admin", "manager"],
    items: [
      { name: "Users & Roles",    href: "/users-roles",    icon: UserCog,    roles: ["admin", "manager"] },
      { name: "Permissions",      href: "/permissions",    icon: Lock,       roles: ["admin", "manager"] },
      { name: "Pricing Library",  href: "/pricing-library", icon: Tag,       roles: ["admin", "manager"] },
      { name: "Custom Reports",   href: "/custom-reports", icon: BarChart3,  roles: ["admin", "manager"] },
      { name: "Settings",         href: "/settings",       icon: Settings,   roles: ["admin", "manager"] },
      { name: "Data Integrity",   href: "/data-integrity", icon: AlertCircle, roles: ["admin"] },
      { name: "System Logs",      href: "/system-logs",    icon: ScrollText, roles: ["admin"] },
      { name: "Backup & Restore", href: "/backup",         icon: Database,   roles: ["admin"] },
    ],
  },
];

// Section that owns a given route, used to auto-expand on navigation
function sectionKeyForPath(sections: NavSection[], path: string): string | null {
  for (const s of sections) {
    if (s.items.some(i => !i.external && (i.href === path || (i.href !== "/" && path.startsWith(i.href + "/"))))) {
      return s.key;
    }
  }
  return null;
}

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = user ? getDashboardRole(user) : "admin";

  // Filter sections & items by role
  const visibleSections: NavSection[] = ALL_SECTIONS
    .map(s => ({ ...s, items: s.items.filter(i => i.roles.includes(role)) }))
    .filter(s => s.roles.includes(role) && s.items.length > 0);

  // Accordion: one section open at a time. Defaults to the section that owns the current route.
  const initialOpen = sectionKeyForPath(visibleSections, location) ?? visibleSections[0]?.key ?? null;
  const [openKey, setOpenKey] = useState<string | null>(initialOpen);

  // Auto-expand the section for the active route when navigating
  useEffect(() => {
    const k = sectionKeyForPath(visibleSections, location);
    if (k && k !== openKey) setOpenKey(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const isDashboardActive = location === "/" || location === "/dashboard" || location === "/sales-dashboard";

  return (
    <div className="bg-white shadow-lg w-64 hidden md:flex flex-col" data-testid="sidebar">
      <nav className="p-3 space-y-1 overflow-y-auto flex-1" data-testid="navigation">
        {/* Dashboard — top-level link */}
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors",
            isDashboardActive ? "bg-primary-50 text-primary-700" : "text-gray-700 hover:bg-gray-100"
          )}
          data-testid="nav-link-dashboard"
        >
          <BarChart3 className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>

        {/* Collapsible sections */}
        {visibleSections.map(section => {
          const SectionIcon = section.icon;
          const isOpen = openKey === section.key;
          const hasActive = section.items.some(i => !i.external && i.href === location);

          return (
            <div key={section.key} className="pt-1">
              <button
                onClick={() => setOpenKey(isOpen ? null : section.key)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                  hasActive
                    ? "text-primary-700 bg-primary-50/60"
                    : "text-gray-700 hover:bg-gray-100"
                )}
                aria-expanded={isOpen}
                data-testid={`nav-section-${section.key}`}
              >
                <span className="flex items-center gap-3">
                  <SectionIcon className="h-4 w-4" />
                  <span>{section.name}</span>
                </span>
                {isOpen
                  ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                }
              </button>

              {isOpen && (
                <div className="mt-1 ml-2 pl-3 border-l border-gray-100 space-y-0.5">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const isActive = !item.external && location === item.href;
                    const linkClass = cn(
                      "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    );
                    if (item.external) {
                      return (
                        <a
                          key={item.name}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkClass}
                          data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </a>
                      );
                    }
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={linkClass}
                        title={item.tooltip}
                        data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

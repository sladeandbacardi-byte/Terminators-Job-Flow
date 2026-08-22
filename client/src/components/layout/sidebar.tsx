import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BarChart3, Calendar, Users, Shield, Box, FileText, Receipt, Mail,
  Building2, ShoppingCart, BarChart, DollarSign, Wrench, CreditCard,
  Settings, TrendingUp, ExternalLink, Database, ClipboardList, Briefcase,
  Truck, Gauge, Fuel, ClipboardCheck, AlertCircle, UserCheck, FileSpreadsheet,
  ChevronDown, ChevronRight, ChevronLeft, UserCog, Lock, ScrollText, HandCoins,
  Wallet, CheckSquare, Cog, ListOrdered, BookOpen, LayoutDashboard, Heart,
  Bell, Tag, Clock, PieChart, Lightbulb,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole, getDefaultDashboardRoute } from "@/lib/dashboardRole";
import jobFlowLogo from "@assets/job-flow-header-logo_1779307679615.png";

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
      { name: "Opportunities", href: "/opportunities", icon: Lightbulb,   roles: ["admin", "manager", "sales"] },
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
      { name: "Once Off Jobs",             href: "/jobs",              icon: Briefcase,    roles: ["admin", "manager", "coordinator", "accounts"] },
      { name: "Once Off Jobs",             href: "/jobs",              icon: Briefcase,    roles: ["service"], tooltip: "Your main job list and daily work sheet." },
      { name: "Calendar",                  href: "/calendar",          icon: Calendar,      roles: ["admin", "manager", "coordinator", "service", "accounts"] },
      { name: "Contracts",                 href: "/contracts",         icon: ListOrdered,   roles: ["admin", "manager", "coordinator"] },
      { name: "Equipment Checklists",      href: "/equipment-checklists", icon: ClipboardCheck, roles: ["admin", "manager", "coordinator"] },
      { name: "Daily Diaries",             href: "/field-diaries",     icon: BookOpen,      roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Stock Management",          href: "/inventory",         icon: Box,           roles: ["admin", "manager", "coordinator"] },
      { name: "Reports",                   href: "/reports",           icon: BarChart,      roles: ["admin", "manager", "coordinator"] },
    ],
  },
  {
    key: "finance",
    name: "Finance",
    icon: CreditCard,
    roles: ["admin", "accounts"],
    items: [
      { name: "Finance Overview",  href: "/finance-dashboard", icon: LayoutDashboard, roles: ["admin", "accounts"] },
      { name: "Invoices",          href: "/invoices",    icon: Receipt,         roles: ["admin", "accounts"] },
      { name: "Expense Capture",   href: "/expenses",    icon: Wallet,          roles: ["admin", "accounts"] },
      { name: "Debtors",           href: "/debtors",     icon: HandCoins,       roles: ["admin", "accounts"] },
      { name: "Creditors",         href: "/creditors",   icon: Wallet,          roles: ["admin", "accounts"] },
      { name: "Sage Export",       href: "/sage-export", icon: FileSpreadsheet, roles: ["admin", "accounts"] },
      { name: "Reports",           href: "/reports",     icon: BarChart,        roles: ["admin", "accounts"] },
    ],
  },
  {
    key: "operations",
    name: "Operations",
    icon: Users,
    roles: ["admin", "manager", "coordinator", "accounts", "service", "sales"],
    items: [
      { name: "HR Dashboard",       href: "/hr-dashboard",       icon: Heart,          roles: ["admin", "manager", "accounts"] },
      { name: "Staff",              href: "/workers",            icon: Users,          roles: ["admin", "manager", "coordinator", "accounts"] },
      { name: "Team Attendance",    href: "/attendance",         icon: UserCheck,      roles: ["admin", "manager", "coordinator", "accounts"] },
      { name: "Teams",              href: "/team-management",    icon: Users,          roles: ["admin", "manager"] },
      { name: "Fleet Dashboard",    href: "/fleet",              icon: Truck,          roles: ["admin", "manager", "coordinator"] },
      { name: "Maintenance",        href: "/fleet/maintenance",  icon: Wrench,         roles: ["admin", "manager", "coordinator"] },
      { name: "Report Issue",       href: "/fleet/report-issue", icon: AlertCircle,    roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Log KMs",            href: "/fleet/km-log",       icon: Gauge,          roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Vehicle Inspection", href: "/fleet/inspection",   icon: ClipboardCheck, roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Fuel Fill-up",       href: "/fleet/fuel",         icon: Fuel,           roles: ["admin", "manager", "coordinator", "service"] },
      { name: "Testing Checklist",  href: "/testing-checklist",  icon: CheckSquare,    roles: ["admin", "manager", "coordinator"] },
      { name: "My Overtime",        href: "/my-overtime",        icon: Clock,          roles: ["admin", "manager", "coordinator", "accounts", "service", "sales"] },
      { name: "Overtime Approval",  href: "/overtime-approval",  icon: CheckSquare,    roles: ["admin", "manager"] },
    ],
  },
  {
    key: "admin",
    name: "Admin",
    icon: Cog,
    roles: ["admin", "manager"],
    items: [
      { name: "Users & Roles",    href: "/users-roles",     icon: UserCog,     roles: ["admin", "manager"] },
      { name: "Permissions",      href: "/permissions",     icon: Lock,        roles: ["admin", "manager"] },
      { name: "Pricing Library",  href: "/pricing-library", icon: Tag,         roles: ["admin", "manager"] },
      { name: "Custom Reports",   href: "/custom-reports",  icon: BarChart3,   roles: ["admin", "manager"] },
      { name: "Settings",         href: "/settings",        icon: Settings,    roles: ["admin", "manager"] },
      { name: "Data Integrity",   href: "/data-integrity",  icon: AlertCircle, roles: ["admin"] },
      { name: "System Logs",      href: "/system-logs",     icon: ScrollText,  roles: ["admin"] },
      { name: "Backup & Restore", href: "/backup",          icon: Database,    roles: ["admin"] },
    ],
  },
];

function sectionKeyForPath(sections: NavSection[], path: string): string | null {
  for (const s of sections) {
    if (s.items.some(i => !i.external && (i.href === path || (i.href !== "/" && path.startsWith(i.href + "/"))))) {
      return s.key;
    }
  }
  return null;
}

const COLLAPSE_KEY = "jobflow-sidebar-collapsed";

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps = {}) {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = user ? getDashboardRole(user) : "admin";

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "true"
  );

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  };

  const visibleSections: NavSection[] = ALL_SECTIONS
    .map(s => ({ ...s, items: s.items.filter(i => i.roles.includes(role)) }))
    .filter(s => s.roles.includes(role) && s.items.length > 0);

  const initialOpen = sectionKeyForPath(visibleSections, location) ?? visibleSections[0]?.key ?? null;
  const [openKey, setOpenKey] = useState<string | null>(initialOpen);

  useEffect(() => {
    const k = sectionKeyForPath(visibleSections, location);
    if (k && k !== openKey) setOpenKey(k);
  }, [location]);

  const dashboardHref = getDefaultDashboardRoute(user ?? {});
  const isDashboardActive =
    location === "/" || location === "/dashboard" ||
    location === "/sales-dashboard" || location === "/finance-dashboard" ||
    location === "/hr-dashboard";

  const sidebarContent = (
    <div className={cn(
      "bg-white border-r border-gray-100 flex flex-col h-full transition-all duration-200",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Brand / collapse toggle */}
      <div className={cn(
        "flex items-center border-b border-gray-100 shrink-0 h-14",
        collapsed ? "justify-center px-2" : "px-3 gap-2"
      )}>
        {collapsed ? (
          <button
            onClick={toggleCollapsed}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors group"
            title="Expand sidebar"
          >
            <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center text-white font-bold text-xs leading-none group-hover:bg-red-700 transition-colors">
              J
            </div>
          </button>
        ) : (
          <>
            <img
              src={jobFlowLogo}
              alt="Job Flow"
              className="h-8 w-auto object-contain flex-1 min-w-0"
            />
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-px" data-testid="navigation">
        {/* Dashboard */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={dashboardHref}
                className={cn(
                  "flex items-center justify-center h-10 w-full transition-colors",
                  isDashboardActive
                    ? "bg-red-50 text-red-700"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                )}
                data-testid="nav-link-dashboard"
              >
                <BarChart3 className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Dashboard</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href={dashboardHref}
            className={cn(
              "flex items-center gap-3 px-3 h-9 mx-2 rounded-lg font-medium text-sm transition-colors",
              isDashboardActive
                ? "bg-red-50 text-red-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
            data-testid="nav-link-dashboard"
          >
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span>Dashboard</span>
          </Link>
        )}

        {/* Sections */}
        {visibleSections.map(section => {
          const SectionIcon = section.icon;
          const isOpen = openKey === section.key;
          const hasActive = section.items.some(i => !i.external && i.href === location);

          if (collapsed) {
            return (
              <div key={section.key} className="border-t border-gray-50 pt-px mt-px">
                {/* Section icon — click to expand sidebar + open section */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        setCollapsed(false);
                        localStorage.setItem(COLLAPSE_KEY, "false");
                        setOpenKey(section.key);
                      }}
                      className={cn(
                        "flex items-center justify-center h-9 w-full transition-colors",
                        hasActive
                          ? "text-red-700"
                          : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                      )}
                    >
                      <SectionIcon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-semibold">{section.name}</TooltipContent>
                </Tooltip>

                {/* Items as icons */}
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = !item.external && location === item.href;
                  const cls = cn(
                    "flex items-center justify-center h-9 w-full transition-colors",
                    isActive
                      ? "bg-red-50 text-red-700"
                      : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                  );
                  return (
                    <Tooltip key={item.href + item.name}>
                      <TooltipTrigger asChild>
                        {item.external ? (
                          <a href={item.href} target="_blank" rel="noopener noreferrer" className={cls}>
                            <Icon className="h-4 w-4" />
                          </a>
                        ) : (
                          <Link href={item.href} className={cls}>
                            <Icon className="h-4 w-4" />
                          </Link>
                        )}
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.name}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            );
          }

          return (
            <div key={section.key} className="px-2">
              <button
                onClick={() => setOpenKey(isOpen ? null : section.key)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2 h-8 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors mt-2",
                  hasActive
                    ? "text-red-700"
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                )}
                aria-expanded={isOpen}
                data-testid={`nav-section-${section.key}`}
              >
                <span className="flex items-center gap-2">
                  <SectionIcon className="h-3.5 w-3.5" />
                  <span>{section.name}</span>
                </span>
                {isOpen
                  ? <ChevronDown className="h-3 w-3 opacity-60" />
                  : <ChevronRight className="h-3 w-3 opacity-40" />
                }
              </button>

              {isOpen && (
                <div className="mt-0.5 ml-2 border-l-2 border-gray-100 pl-2 space-y-px pb-1">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const isActive = !item.external && location === item.href;
                    const cls = cn(
                      "flex items-center gap-2.5 px-2.5 h-8 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-red-50 text-red-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    );
                    if (item.external) {
                      return (
                        <a
                          key={item.name + item.href}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cls}
                          data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{item.name}</span>
                        </a>
                      );
                    }
                    return (
                      <Link
                        key={item.name + item.href}
                        href={item.href}
                        className={cls}
                        title={item.tooltip}
                        data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
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

      {/* Bottom strip */}
      {!collapsed && (
        <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400 font-medium tracking-wide">
          Job Flow FSM
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-screen sticky top-0 shrink-0" data-testid="sidebar">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" data-testid="mobile-sidebar">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <div className="relative z-10 h-full shadow-2xl">
            <div className="bg-white border-r border-gray-100 flex flex-col h-full w-64">
              {sidebarContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

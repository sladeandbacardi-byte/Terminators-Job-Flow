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
  Wallet, CheckSquare, Cog, ListOrdered, LayoutDashboard, Heart,
  Bell, Tag, Clock, PieChart,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole, getDefaultDashboardRoute } from "@/lib/dashboardRole";
import { JobFlowBrandLockup } from "@/components/terminators-logo";

type NavItem = {
  name: string;
  href: string;
  icon: any;
  roles: string[];
  external?: boolean;
  tooltip?: string;
};

type NavGroup = {
  type: "group";
  key: string;
  name: string;
  icon: any;
  roles: string[];
  items: NavItem[];
};

type NavEntry = NavItem | NavGroup;

type NavSection = {
  key: string;
  name: string;
  icon: any;
  roles: string[];
  items: NavEntry[];
};

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "type" in entry && entry.type === "group";
}

function entryKey(entry: NavEntry): string {
  return isNavGroup(entry) ? entry.key : entry.name + entry.href;
}

function entryHasActivePath(entry: NavEntry, path: string): boolean {
  if (isNavGroup(entry)) {
    return entry.items.some(item => entryHasActivePath(item, path));
  }
  return !entry.external && (
    entry.href === path ||
    (entry.href !== "/" && path.startsWith(entry.href + "/"))
  );
}

const ALL_SECTIONS: NavSection[] = [
  {
    key: "sales",
    name: "Sales",
    icon: DollarSign,
    roles: ["admin", "manager", "sales"],
    items: [
      { name: "Leads",         href: "/leads",         icon: TrendingUp,  roles: ["admin", "manager", "sales"] },
      { name: "Quotes",        href: "/quotes",        icon: FileText,    roles: ["admin", "manager", "sales"] },
      { name: "Calendar",      href: "/calendar",      icon: Calendar,    roles: ["admin", "manager", "sales"] },
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
      {
        type: "group",
        key: "service-jobs",
        name: "Jobs",
        icon: Briefcase,
        roles: ["admin", "manager", "coordinator", "service", "accounts"],
        items: [
          { name: "Contract Jobs", href: "/contract-jobs", icon: ListOrdered, roles: ["admin", "manager", "coordinator", "service", "accounts"] },
          { name: "Once-off Jobs", href: "/once-off-jobs", icon: Briefcase, roles: ["admin", "manager", "coordinator", "service", "accounts"], tooltip: "Your main job list and daily work sheet." },
        ],
      },
      { name: "Calendar",  href: "/calendar",          icon: Calendar,    roles: ["admin", "manager", "coordinator", "service", "accounts", "sales"] },
      { name: "Contracts", href: "/service-contracts", icon: ListOrdered, roles: ["admin", "manager", "coordinator"] },
      { name: "Reports",   href: "/reports",           icon: BarChart,    roles: ["admin", "manager", "coordinator"] },
    ],
  },
  {
    key: "finance",
    name: "Finance",
    icon: CreditCard,
    roles: ["admin", "accounts"],
    items: [
      { name: "Finance Dashboard", href: "/finance-dashboard", icon: LayoutDashboard, roles: ["admin", "accounts"] },
      {
        type: "group",
        key: "finance-income",
        name: "Income",
        icon: TrendingUp,
        roles: ["admin", "accounts"],
        items: [
          { name: "Invoices",  href: "/invoices",  icon: Receipt,   roles: ["admin", "accounts"] },
          { name: "Receipts",  href: "/receipts",  icon: Receipt,   roles: ["admin", "accounts"] },
          { name: "Debtors",   href: "/debtors",   icon: HandCoins, roles: ["admin", "accounts"] },
          { name: "Statements", href: "/statements", icon: FileText, roles: ["admin", "accounts"] },
        ],
      },
      {
        type: "group",
        key: "finance-expenses",
        name: "Expenses",
        icon: Wallet,
        roles: ["admin", "accounts"],
        items: [
          { name: "Expense Capture",   href: "/expenses",           icon: Wallet,     roles: ["admin", "accounts"] },
          { name: "Purchase Orders",   href: "/purchase-orders",   icon: ShoppingCart, roles: ["admin", "accounts"] },
          { name: "Creditors",         href: "/creditors",          icon: Wallet,     roles: ["admin", "accounts"] },
          { name: "Supplier Payments", href: "/supplier-payments",  icon: CreditCard, roles: ["admin", "accounts"] },
        ],
      },
      { name: "Reports",     href: "/finance-reports", icon: BarChart,        roles: ["admin", "accounts"] },
      { name: "Sage Export", href: "/sage-export",     icon: FileSpreadsheet, roles: ["admin", "accounts"] },
    ],
  },
  {
    key: "operations",
    name: "Operations",
    icon: Users,
    roles: ["admin", "manager", "coordinator", "accounts", "service", "sales"],
    items: [
      {
        type: "group",
        key: "operations-hr",
        name: "HR",
        icon: Heart,
        roles: ["admin", "manager", "coordinator", "accounts", "service", "sales"],
        items: [
          { name: "HR Dashboard",      href: "/hr-dashboard",      icon: Heart,       roles: ["admin", "manager", "accounts"] },
          { name: "Staff",             href: "/workers",           icon: Users,       roles: ["admin", "manager", "coordinator", "accounts"] },
          { name: "Team Attendance",   href: "/attendance",        icon: UserCheck,   roles: ["admin", "manager", "coordinator", "accounts"] },
          { name: "Overtime & Time Off", href: "/overtime-time-off", icon: Clock,      roles: ["admin", "manager", "coordinator", "accounts", "service", "sales"] },
          { name: "Time Balance Report", href: "/time-balance", icon: PieChart, roles: ["admin", "manager"] },
          { name: "Teams",             href: "/team-management",   icon: Users,       roles: ["admin", "manager"] },
        ],
      },
      {
        type: "group",
        key: "operations-fleet",
        name: "Fleet",
        icon: Truck,
        roles: ["admin", "manager", "coordinator", "service"],
        items: [
          { name: "Dashboard",       href: "/operations/fleet",                 icon: LayoutDashboard, roles: ["admin", "manager", "coordinator", "service"] },
          { name: "Vehicles",        href: "/operations/fleet/vehicles",        icon: Truck,           roles: ["admin", "manager", "coordinator", "service"] },
          { name: "Daily Check",     href: "/operations/fleet/daily-check",     icon: ClipboardCheck,  roles: ["admin", "manager", "coordinator", "service"] },
          { name: "Fuel",            href: "/operations/fleet/fuel",            icon: Fuel,            roles: ["admin", "manager", "coordinator", "service"] },
          { name: "Inspections",     href: "/operations/fleet/inspections",     icon: ClipboardCheck,  roles: ["admin", "manager", "coordinator", "service"] },
          { name: "Faults",          href: "/operations/fleet/faults",          icon: AlertCircle,     roles: ["admin", "manager", "coordinator", "service"] },
          { name: "Service History", href: "/operations/fleet/service-history", icon: Wrench,          roles: ["admin", "manager", "coordinator", "service"] },
          { name: "Reports",         href: "/operations/fleet/reports",         icon: BarChart,        roles: ["admin", "manager", "coordinator", "service"] },
        ],
      },
      {
        type: "group",
        key: "operations-stock",
        name: "Stock",
        icon: Box,
        roles: ["admin", "manager", "coordinator", "accounts", "service"],
        items: [
          { name: "Stock Dashboard",      href: "/stock-dashboard",    icon: LayoutDashboard, roles: ["admin", "manager", "coordinator", "accounts", "service"] },
          { name: "Stock Management",    href: "/inventory",          icon: Box,             roles: ["admin", "manager", "coordinator", "accounts", "service"] },
          { name: "Pest Product Library", href: "/treatment-reports",   icon: ClipboardCheck,  roles: ["admin", "manager", "coordinator", "service"] },
          { name: "Suppliers",            href: "/suppliers",           icon: Building2,       roles: ["admin", "manager", "coordinator", "accounts"] },
          { name: "Purchase Orders",      href: "/purchase-orders",    icon: ShoppingCart,    roles: ["admin", "manager", "coordinator", "accounts"] },
          { name: "Stock Usage",          href: "/stock-usage",        icon: ClipboardList,   roles: ["admin", "manager", "coordinator", "accounts", "service"] },
          { name: "Stock Adjustments",    href: "/stock-adjustments",  icon: CheckSquare,     roles: ["admin", "manager", "coordinator", "accounts", "service"] },
          { name: "Stock Reports",        href: "/stock-reports",      icon: BarChart,        roles: ["admin", "manager", "coordinator", "accounts", "service"] },
        ],
      },
      {
        type: "group",
        key: "operations-tools",
        name: "Operational Tools",
        icon: Wrench,
        roles: ["admin", "manager", "coordinator", "service"],
        items: [
          { name: "Equipment Checklists", href: "/equipment-checklists", icon: CheckSquare, roles: ["admin", "manager", "coordinator", "service"] },
        ],
      },
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
    if (s.items.some(i => entryHasActivePath(i, path))) {
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
    .map(s => ({
      ...s,
      items: s.items
        .map(entry => {
          if (!entry.roles.includes(role)) return null;
          if (isNavGroup(entry)) {
            const items = entry.items.filter(item => item.roles.includes(role));
            return items.length > 0 ? { ...entry, items } : null;
          }
          return entry;
        })
        .filter((entry): entry is NavEntry => entry !== null),
    }))
    .filter(s => s.roles.includes(role) && s.items.length > 0);

  const initialOpen = sectionKeyForPath(visibleSections, location) ?? visibleSections[0]?.key ?? null;
  const [openKey, setOpenKey] = useState<string | null>(initialOpen);
  const [openGroupKeys, setOpenGroupKeys] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      visibleSections.flatMap(section =>
        section.items
          .filter(isNavGroup)
          .filter(group => entryHasActivePath(group, location))
          .map(group => [group.key, true] as const)
      )
    )
  );

  useEffect(() => {
    const k = sectionKeyForPath(visibleSections, location);
    if (k && k !== openKey) setOpenKey(k);
    const activeGroups = visibleSections.flatMap(section =>
      section.items
        .filter(isNavGroup)
        .filter(group => entryHasActivePath(group, location))
        .map(group => group.key)
    );
    if (activeGroups.length > 0) {
      setOpenGroupKeys(previous => {
        const next = { ...previous };
        let changed = false;
        for (const groupKey of activeGroups) {
          if (!next[groupKey]) {
            next[groupKey] = true;
            changed = true;
          }
        }
        return changed ? next : previous;
      });
    }
  }, [location]);

  const dashboardHref = getDefaultDashboardRoute(user ?? {});
  const isDashboardActive =
    location === "/" || location === "/dashboard" ||
    location === "/sales-dashboard" || location === "/finance-dashboard" ||
    location === "/hr-dashboard";

  const navTestId = (name: string) => `nav-link-${name.toLowerCase().replace(/\s+/g, "-")}`;

  const renderExpandedItem = (item: NavItem, nested = false) => {
    const Icon = item.icon;
    const isActive = !item.external && location === item.href;
    const cls = cn(
      "flex items-center gap-2.5 rounded-md text-sm transition-colors",
      nested ? "px-2.5 h-8 ml-1" : "px-2.5 h-8",
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
          data-testid={navTestId(item.name)}
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
        data-testid={navTestId(item.name)}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{item.name}</span>
      </Link>
    );
  };

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
            <JobFlowBrandLockup size="xs" stacked data-testid="collapsed-brand-lockup" />
          </button>
        ) : (
          <>
            <JobFlowBrandLockup size="sm" className="min-w-0" data-testid="sidebar-brand-lockup" />
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
          const hasActive = section.items.some(entry => entryHasActivePath(entry, location));

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
                {section.items.flatMap(entry => {
                  const items = isNavGroup(entry) ? entry.items : [entry];
                  return items.map(item => {
                    const Icon = item.icon;
                    const isActive = !item.external && location === item.href;
                    const cls = cn(
                      "flex items-center justify-center h-9 w-full transition-colors",
                      isActive
                        ? "bg-red-50 text-red-700"
                        : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                    );
                    return (
                      <Tooltip key={entryKey(entry) + item.href + item.name}>
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
                  });
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
                  {section.items.map(entry => {
                    if (!isNavGroup(entry)) return renderExpandedItem(entry);

                    const groupOpen = openGroupKeys[entry.key] ?? false;
                    const groupActive = entryHasActivePath(entry, location);
                    const GroupIcon = entry.icon;
                    return (
                      <div key={entry.key} className="space-y-px">
                        <button
                          type="button"
                          onClick={() => setOpenGroupKeys(previous => ({
                            ...previous,
                            [entry.key]: !groupOpen,
                          }))}
                          className={cn(
                            "w-full flex items-center justify-between gap-2 px-2.5 h-8 rounded-md text-sm transition-colors",
                            groupActive
                              ? "text-red-700 font-medium"
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                          )}
                          aria-expanded={groupOpen}
                          data-testid={`nav-group-${entry.key}`}
                        >
                          <span className="flex items-center gap-2.5">
                            <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>{entry.name}</span>
                          </span>
                          {groupOpen
                            ? <ChevronDown className="h-3 w-3 opacity-60" />
                            : <ChevronRight className="h-3 w-3 opacity-40" />
                          }
                        </button>
                        {groupOpen && (
                          <div className="ml-3 border-l border-gray-100 pl-1 space-y-px">
                            {entry.items.map(item => renderExpandedItem(item, true))}
                          </div>
                        )}
                      </div>
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

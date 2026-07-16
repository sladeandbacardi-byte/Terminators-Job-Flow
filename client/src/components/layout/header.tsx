import { useState, useEffect, useRef } from "react";
import {
  Menu, LogOut, ChevronDown, User, FlaskConical, Bell,
  AlertTriangle, Wrench, CheckCircle, Info, UserCog,
} from "lucide-react";
import { formatDateTime, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onMobileMenuToggle?: () => void;
}

const SEVERITY_ICON: Record<string, any> = {
  critical: AlertTriangle,
  high: AlertTriangle,
  medium: Wrench,
  low: Info,
};
const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-600",
  high: "text-orange-500",
  medium: "text-amber-500",
  low: "text-blue-500",
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/notifications"],
    refetchInterval: 60_000,
  });

  const critical = notifications.filter(
    (n: any) => n.severity === "critical" || n.severity === "high"
  );
  const count = critical.length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
        onClick={() => setOpen(o => !o)}
        aria-label="Fleet notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5 leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-800">Fleet Alerts</span>
            {count > 0 ? (
              <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                {count} critical
              </span>
            ) : (
              <span className="text-xs text-gray-400">All clear</span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                <CheckCircle className="h-5 w-5 mx-auto mb-2 text-green-400" />
                No fleet alerts
              </div>
            ) : (
              notifications.slice(0, 12).map((n: any) => {
                const Icon = SEVERITY_ICON[n.severity] ?? Info;
                const color = SEVERITY_COLOR[n.severity] ?? "text-gray-400";
                return (
                  <div key={n.id} className="px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-2">
                      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 text-center">
              <a href="/fleet" className="text-xs text-blue-600 hover:underline font-medium">
                View fleet dashboard →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Header({ title, subtitle, onMobileMenuToggle }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user, logout, isDemoMode } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const userName = user ? `${user.firstName} ${user.lastName}` : "Guest";
  const userRole = user?.role || "User";

  return (
    <>
      {/* Demo mode banner */}
      {isDemoMode && (
        <div className="bg-amber-400 text-amber-950 text-xs font-semibold flex items-center justify-center gap-2 py-1 px-4 w-full shrink-0">
          <FlaskConical className="h-3 w-3 shrink-0" />
          <span>DEMO MODE — Sample data only. Destructive actions are disabled.</span>
        </div>
      )}

      <header
        className="bg-white border-b border-gray-100 px-4 sm:px-5 h-14 flex items-center justify-between shrink-0 sticky top-0 z-30"
        data-testid="header"
      >
        {/* LEFT — mobile hamburger + page title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="md:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors shrink-0"
            onClick={onMobileMenuToggle}
            data-testid="mobile-menu-toggle"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {title && (
            <div className="min-w-0">
              <h1
                className="text-base font-semibold text-gray-900 truncate leading-tight"
                data-testid="page-title"
              >
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-gray-500 truncate leading-tight">{subtitle}</p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — demo badge + time + notifications + user */}
        <div className="flex items-center gap-1 shrink-0">
          {isDemoMode && (
            <span className="hidden sm:flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full mr-1">
              <FlaskConical className="h-3 w-3" />
              Demo
            </span>
          )}

          <span className="hidden lg:block text-xs text-gray-400 mr-2 tabular-nums" data-testid="current-time">
            {formatDateTime(currentTime)}
          </span>

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition-colors ml-1"
                data-testid="user-menu-trigger"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isDemoMode ? "bg-amber-500" : "bg-red-600"}`}
                  data-testid="user-avatar"
                >
                  {isDemoMode ? (
                    <FlaskConical className="text-white h-3.5 w-3.5" />
                  ) : (
                    <span className="text-white text-xs font-semibold leading-none">
                      {getInitials(userName)}
                    </span>
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900 leading-tight" data-testid="user-name">
                    {userName}
                  </p>
                  <p className="text-[11px] text-gray-400 leading-tight truncate max-w-[120px]" data-testid="user-role">
                    {userRole}
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">{userName}</span>
                  {isDemoMode ? (
                    <span className="text-xs font-normal text-amber-600">Demo Mode — sample data</span>
                  ) : (
                    <span className="text-xs font-normal text-gray-400">{user?.email || ""}</span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!isDemoMode && (
                <DropdownMenuItem onClick={() => setLocation("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleLogout}>
                <UserCog className="mr-2 h-4 w-4" />
                Switch User
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                {isDemoMode ? "Exit Demo Mode" : "Sign Out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
}

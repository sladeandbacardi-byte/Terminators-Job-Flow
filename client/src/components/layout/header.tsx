import { useState, useEffect, useRef } from "react";
import { Menu, LogOut, ChevronDown, User, FlaskConical, Bell, AlertTriangle, Wrench, CheckCircle, Info, UserCog } from "lucide-react";
import { formatDateTime, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import jobFlowLogo from "@assets/job-flow-header-logo_1779307679615.png";

interface HeaderProps {
  title?: string;
  onMobileMenuToggle?: () => void;
}

const SEVERITY_ICON: Record<string, any> = {
  critical: AlertTriangle,
  high:     AlertTriangle,
  medium:   Wrench,
  low:      Info,
};
const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-600",
  high:     "text-orange-500",
  medium:   "text-amber-500",
  low:      "text-blue-500",
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["/api/fleet/notifications"],
    refetchInterval: 60_000,
  });

  const critical = notifications.filter((n: any) => n.severity === "critical" || n.severity === "high");
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
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
        onClick={() => setOpen(o => !o)}
        aria-label="Fleet notifications"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-800">Fleet Alerts</span>
            {count > 0
              ? <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">{count} critical</span>
              : <span className="text-xs text-gray-400">All clear</span>
            }
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-400" />
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

export default function Header({ title, onMobileMenuToggle }: HeaderProps) {
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
      {/* Demo mode banner — full-width strip above header */}
      {isDemoMode && (
        <div className="bg-amber-400 text-amber-950 text-xs font-semibold flex items-center justify-center gap-2 py-1.5 px-4 w-full">
          <FlaskConical className="h-3.5 w-3.5 shrink-0" />
          <span>DEMO MODE — Sample data only. Destructive actions are disabled.</span>
        </div>
      )}

      <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 py-3" data-testid="header">
        <div className="flex items-center justify-between h-[52px]">

          {/* LEFT — Job Flow logo + optional page title */}
          <div className="flex items-center gap-3">
            <img
              src={jobFlowLogo}
              alt="Job Flow Field Service Management"
              className="h-[38px] sm:h-[45px] w-auto object-contain pointer-events-none flex-shrink-0"
            />
            <button
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
              onClick={onMobileMenuToggle}
              data-testid="mobile-menu-toggle"
            >
              <Menu className="h-5 w-5" />
            </button>
            {title && (
              <span className="hidden sm:block text-sm font-medium text-gray-500 border-l border-gray-200 pl-3" data-testid="page-title">
                {title}
              </span>
            )}
          </div>

          {/* RIGHT — demo badge + notifications + date/time + user profile */}
          <div className="flex items-center gap-3">

            {/* Demo badge */}
            {isDemoMode && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full">
                <FlaskConical className="h-3 w-3" />
                Demo Mode
              </span>
            )}

            {/* Fleet notification bell */}
            <NotificationBell />

            <span className="hidden md:block text-sm text-gray-500" data-testid="current-time">
              {formatDateTime(currentTime)} SAST
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 hover:bg-gray-100 rounded-lg p-2 transition-colors cursor-pointer"
                  data-testid="user-menu-trigger"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDemoMode ? "bg-amber-500" : "bg-primary-600"}`} data-testid="user-avatar">
                    {isDemoMode
                      ? <FlaskConical className="text-white h-4 w-4" />
                      : <span className="text-white text-sm font-medium">{getInitials(userName)}</span>
                    }
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-900 leading-tight" data-testid="user-name">{userName}</p>
                    <p className="text-xs text-gray-500" data-testid="user-role">{userRole}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-500 hidden md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{userName}</span>
                    {isDemoMode
                      ? <span className="text-xs font-normal text-amber-600">Demo Mode — sample data</span>
                      : <span className="text-xs font-normal text-gray-500">{user?.email || ""}</span>
                    }
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
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  {isDemoMode ? "Exit Demo Mode" : "Sign Out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </header>
    </>
  );
}

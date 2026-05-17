import { useState, useEffect } from "react";
import { Menu, LogOut, ChevronDown, User, FlaskConical } from "lucide-react";
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
import jobFlowLogo from "@assets/job-flow-header-logo_1779017630067.png";

interface HeaderProps {
  title?: string;
  onMobileMenuToggle?: () => void;
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
              alt="Job Flow"
              className="h-[38px] sm:h-[52px] w-auto object-contain pointer-events-none flex-shrink-0"
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

          {/* RIGHT — demo badge + date/time + user profile */}
          <div className="flex items-center gap-3">

            {/* Demo badge */}
            {isDemoMode && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full">
                <FlaskConical className="h-3 w-3" />
                Demo Mode
              </span>
            )}

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
                {!isDemoMode && <DropdownMenuSeparator />}
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

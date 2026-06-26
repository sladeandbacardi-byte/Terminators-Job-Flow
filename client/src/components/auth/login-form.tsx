import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, Shield, Wrench, TrendingUp, DollarSign,
  Settings, ChevronRight, ChevronDown, ChevronUp, LogIn, User, Loader2,
} from "lucide-react";
import { getDashboardRole, dashboardRoleLabels } from "@/lib/dashboardRole";
import { DEMO_PROFILES } from "@/lib/demoProfiles";

const profileByKey = (key: string) => DEMO_PROFILES.find(p => p.key === key)!;

const ROLE_CARDS = [
  {
    key: "admin",
    label: "Managing Member",
    description: "Full system access",
    Icon: Shield,
    border: "border-indigo-200",
    bg: "bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200",
    text: "text-indigo-900",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    profile: () => profileByKey("admin"),
  },
  {
    key: "manager",
    label: "Service Manager",
    description: "Service jobs, calendar, teams, invoices",
    Icon: Wrench,
    border: "border-teal-200",
    bg: "bg-teal-50 hover:bg-teal-100 active:bg-teal-200",
    text: "text-teal-900",
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
    profile: () => profileByKey("manager"),
  },
  {
    key: "sales",
    label: "Sales",
    description: "Leads, quotes, clients, follow-ups",
    Icon: TrendingUp,
    border: "border-pink-200",
    bg: "bg-pink-50 hover:bg-pink-100 active:bg-pink-200",
    text: "text-pink-900",
    iconBg: "bg-pink-100",
    iconColor: "text-pink-600",
    profile: () => profileByKey("sales"),
  },
  {
    key: "accounts",
    label: "Finance",
    description: "Invoices, debtors, reports, backups",
    Icon: DollarSign,
    border: "border-amber-200",
    bg: "bg-amber-50 hover:bg-amber-100 active:bg-amber-200",
    text: "text-amber-900",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    profile: () => profileByKey("accounts"),
  },
  {
    key: "admin-settings",
    label: "Admin",
    description: "Users, roles, settings, backups",
    Icon: Settings,
    border: "border-slate-200",
    bg: "bg-slate-50 hover:bg-slate-100 active:bg-slate-200",
    text: "text-slate-900",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    profile: () => profileByKey("admin"),
  },
];

interface StaffMember {
  id: string;
  name: string;
  role: string | null;
  departmentId: string | null;
}

// Client-side fallback — shown if /api/auth/staff returns empty or fails
const FALLBACK_STAFF: StaffMember[] = [
  { id: "worker-1", name: "Julien Botha",      role: "Operations Manager",             departmentId: "div-6" },
  { id: "worker-2", name: "Maryka Venter",     role: "Pest Control Services Manager",  departmentId: "div-6" },
  { id: "worker-3", name: "Mariette Koekemoer",role: "Hygiene Services Manager",       departmentId: "div-6" },
  { id: "worker-4", name: "Juli Holtshausen",  role: "Finance & HR Manager",           departmentId: "div-7" },
  { id: "worker-5", name: "Sheryl-Lyn Lee",    role: "Existing Clients Sales & Admin", departmentId: "div-5" },
  { id: "worker-6", name: "Chane du Toit",     role: "Sales Rep",                      departmentId: "div-5" },
];

interface LoginFormProps {
  onSuccess: (token: string, user: any) => void;
  onDemoLogin?: (profile: any) => void;
}

export function LoginForm({ onSuccess, onDemoLogin }: LoginFormProps) {
  const [showRealLogin, setShowRealLogin] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loginError, setLoginError] = useState("");

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");

  useEffect(() => {
    if (!showRealLogin || staff.length > 0) return;
    setStaffLoading(true);
    setStaffError("");
    fetch("/api/auth/staff")
      .then(r => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json();
      })
      .then((data: StaffMember[]) => {
        setStaff(data.length > 0 ? data : FALLBACK_STAFF);
        setStaffLoading(false);
      })
      .catch(err => {
        console.error("[login] staff fetch failed, using fallback:", err);
        setStaff(FALLBACK_STAFF);
        setStaffLoading(false);
      });
  }, [showRealLogin]);

  const loginMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error("Login failed");
      return response.json();
    },
    onSuccess: (data: { token: string; user: any }) => {
      setLoginError("");
      onSuccess(data.token, data.user);
    },
    onError: () => setLoginError("Login failed. Please try again."),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <div className="w-full max-w-lg space-y-6">

        {/* Logo */}
        <div className="flex justify-center">
          <img
            src="/images/job-flow-full-logo.png"
            alt="Job Flow Field Service Management"
            className="w-[260px] sm:w-[320px] h-auto object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* Heading */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Select Your Login</h1>
          <p className="text-sm text-gray-500 mt-1">Choose your role to continue</p>
        </div>

        {/* Role cards grid */}
        <div className="grid grid-cols-2 gap-3">
          {ROLE_CARDS.map(({ key, label, description, Icon, border, bg, text, iconBg, iconColor, profile }) => (
            <button
              key={key}
              onClick={() => onDemoLogin?.(profile())}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 ${border} ${bg} ${text} transition-all duration-150 text-left shadow-sm hover:shadow-md active:scale-[0.98]`}
            >
              <div className={`shrink-0 w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight">{label}</p>
                <p className="text-xs opacity-60 mt-0.5 leading-tight">{description}</p>
              </div>
              <ChevronRight className="h-4 w-4 opacity-30 shrink-0" />
            </button>
          ))}
        </div>

        {/* Real User Login — collapsible */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowRealLogin(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              Real User Login
            </div>
            {showRealLogin
              ? <ChevronUp className="h-4 w-4 text-gray-400" />
              : <ChevronDown className="h-4 w-4 text-gray-400" />
            }
          </button>

          {showRealLogin && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400">Sign in with your individual staff account.</p>

              {loginError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}

              {staffError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{staffError}</AlertDescription>
                </Alert>
              )}

              {staffLoading ? (
                <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading staff...
                </div>
              ) : staff.length === 0 && !staffError ? (
                <p className="text-sm text-gray-400 py-1">No staff accounts found.</p>
              ) : (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose your profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map(member => {
                      const roleLabel = dashboardRoleLabels[getDashboardRole(member)] ?? member.role ?? "Staff";
                      return (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} — {roleLabel}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}

              <Button
                onClick={() => selectedUserId && loginMutation.mutate(selectedUserId)}
                disabled={loginMutation.isPending || !selectedUserId || staffLoading}
                className="w-full"
              >
                <LogIn className="h-4 w-4 mr-2" />
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

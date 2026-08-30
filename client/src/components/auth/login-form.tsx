import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle, ArrowLeft, BriefcaseBusiness, Eye, EyeOff, Loader2,
  ShieldCheck, Smartphone, UserRound, ChevronRight, FlaskConical,
} from "lucide-react";
import { JobFlowBrandLockup } from "@/components/terminators-logo";
import { DEMO_PROFILES } from "@/lib/demoProfiles";

type LoginStep = "choose-type" | "staff-list" | "staff-credentials" | "admin-list" | "admin-credentials";

interface Technician {
  id: string;
  name: string;
  role: string;
  department: string;
}

interface Administrator {
  id: string;
  name: string;
  username?: string;
  role: string;
  department: string;
  authMethod: "password";
}

interface LoginDirectory {
  staff: Technician[];
  admins: Administrator[];
}

const FALLBACK_DIRECTORY: LoginDirectory = {
  staff: [
    ["mobile-tech-01", "Re-Althon"], ["mobile-tech-02", "Leon"],
    ["mobile-tech-03", "Garth"], ["mobile-tech-04", "Jackie"],
    ["mobile-tech-06", "Zain"],
    ["mobile-tech-07", "Mike"], ["mobile-tech-08", "X"],
    ["mobile-tech-09", "Reece"],
  ].map(([id, name]) => ({ id, name, role: "Technician", department: "Field Service" })),
  admins: [
    { id: "fallback-admin", name: "Administrator", username: "admin", role: "Administrator", department: "Administration", authMethod: "password" },
  ],
};

interface LoginFormProps {
  onSuccess: (token: string, user: any) => void;
  onDemoLogin?: (profile: (typeof DEMO_PROFILES)[number]) => void;
}

export function LoginForm({ onSuccess, onDemoLogin }: LoginFormProps) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [step, setStep] = useState<LoginStep>(() => {
    if (new URLSearchParams(search).get("login") === "admin") return "admin-list";
    return "choose-type";
  });
  const [directory, setDirectory] = useState<LoginDirectory>(FALLBACK_DIRECTORY);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<Administrator | null>(null);
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    fetch("/api/auth/staff")
      .then(response => {
        if (!response.ok) throw new Error(`Server error ${response.status}`);
        return response.json();
      })
      .then((data: LoginDirectory) => {
        if (!Array.isArray(data.staff) || !Array.isArray(data.admins)) throw new Error("Invalid login directory");
        setDirectory({
          staff: data.staff.length ? data.staff : FALLBACK_DIRECTORY.staff,
          admins: data.admins.length ? data.admins : FALLBACK_DIRECTORY.admins,
        });
      })
      .catch(() => setDirectory(FALLBACK_DIRECTORY))
      .finally(() => setDirectoryLoading(false));
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (
      credentials:
        | { mode: "mobile"; workerId: string; pin: string }
        | { mode: "admin"; username: string; password: string },
    ) => {
      const response = await fetch(
        credentials.mode === "mobile"
          ? "/api/auth/mobile-login"
          : credentials.mode === "admin"
            ? "/api/auth/admin-login"
            : "/api/auth/admin-login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            credentials.mode === "mobile"
              ? { workerId: credentials.workerId, pin: credentials.pin }
              : { username: credentials.username, password: credentials.password },
          ),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Login failed");
      return { mode: credentials.mode, data };
    },
    onSuccess: ({ mode, data }) => {
      setLoginError("");
      if (mode === "mobile") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        localStorage.removeItem("auth_user_role");
        localStorage.removeItem("auth_user_type");
        localStorage.removeItem("demo_mode");
        localStorage.setItem("mobile_worker_id", data.worker.id);
        localStorage.setItem("mobile_session_token", data.token);
        localStorage.setItem("mobile_worker_data", JSON.stringify(data.worker));
        localStorage.setItem("mobile_user_role", data.worker.role || "Technician");
        localStorage.setItem("mobile_user_type", "staff");
        navigate("/mobile", { replace: true });
        return;
      }
      onSuccess(data.token, data.user);
    },
    onError: (error: Error) => setLoginError(error.message || "Login failed. Please try again."),
  });

  const resetCredentials = () => {
    setPassword("");
    setPin("");
    setShowPassword(false);
    setLoginError("");
  };

  const selectTechnician = (technician: Technician) => {
    resetCredentials();
    setSelectedTechnician(technician);
    setStep("staff-credentials");
  };

  const selectAdmin = (administrator: Administrator) => {
    resetCredentials();
    setSelectedAdmin(administrator);
    setStep("admin-credentials");
  };

  const goBack = () => {
    resetCredentials();
    if (step === "staff-list" || step === "admin-list") setStep("choose-type");
    if (step === "staff-credentials") setStep("staff-list");
    if (step === "admin-credentials") setStep("admin-list");
  };

  const selectionCard = (
    label: string,
    description: string,
    icon: React.ReactNode,
    onClick: () => void,
    color: "red" | "indigo",
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        color === "red"
          ? "border-red-200 bg-red-50 hover:border-red-400 hover:bg-red-100 focus:ring-red-600"
          : "border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 focus:ring-indigo-600"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`rounded-xl p-3 text-white ${color === "red" ? "bg-red-600" : "bg-indigo-600"}`}>
          {icon}
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">{label}</h2>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </button>
  );

  const userCard = (
    user: Technician | Administrator,
    onClick: () => void,
    type: "staff" | "admin",
  ) => (
    <button
      key={user.id}
      type="button"
      onClick={onClick}
      disabled={loginMutation.isPending}
      className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-2.5 ${type === "staff" ? "bg-red-100 text-red-700" : "bg-indigo-100 text-indigo-700"}`}>
          {type === "staff" ? <UserRound className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{user.name}</p>
          <p className="mt-0.5 text-sm text-gray-600">{user.role}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">{user.department}</p>
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center space-y-6">
        <div className="flex justify-center">
          <JobFlowBrandLockup size="lg" className="max-w-full" data-testid="login-brand-lockup" />
        </div>

        <main className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg sm:p-6">
          {step === "choose-type" && (
            <div className="space-y-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900">Select Login Type</h1>
                <p className="mt-2 text-sm text-gray-600">Choose the workspace you need to access.</p>
              </div>
              {selectionCard("Staff Login", "For technicians and mobile field staff.", <Smartphone className="h-6 w-6" />, () => setStep("staff-list"), "red")}
              {selectionCard("Admin / Office Login", "For office, sales, service, finance and management users.", <BriefcaseBusiness className="h-6 w-6" />, () => setStep("admin-list"), "indigo")}
            </div>
          )}

          {(step === "staff-list" || step === "admin-list") && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Button type="button" variant="ghost" size="icon" onClick={goBack} aria-label="Back to login type">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{step === "staff-list" ? "Staff Login" : "Admin Login"}</h1>
                  <p className="mt-1 text-sm text-gray-600">
                    {step === "staff-list" ? "Select your profile and enter your PIN." : "Select a protected administrator account."}
                  </p>
                </div>
              </div>

              {directoryLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
                </div>
              ) : (
                <div className="space-y-3">
                  {loginMutation.isPending && (
                    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Opening {selectedTechnician?.name ?? selectedAdmin?.name ?? "your"} dashboard…
                    </div>
                  )}
                  <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                    {step === "staff-list"
                      ? directory.staff.map(technician => userCard(technician, () => selectTechnician(technician), "staff"))
                      : directory.admins.map(administrator => userCard(administrator, () => selectAdmin(administrator), "admin"))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "staff-credentials" && selectedTechnician && (
            <form
              className="space-y-5"
              onSubmit={event => {
                event.preventDefault();
                loginMutation.mutate({ mode: "mobile", workerId: selectedTechnician.id, pin });
              }}
            >
              <div className="flex items-start gap-3">
                <Button type="button" variant="ghost" size="icon" onClick={goBack} aria-label="Back to staff list">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Welcome, {selectedTechnician.name}</h1>
                  <p className="mt-1 text-sm text-gray-600">Enter your 4-digit PIN to open the technician dashboard.</p>
                </div>
              </div>

              <div className="rounded-xl bg-red-50 p-4 text-sm">
                <p className="font-medium text-red-900">{selectedTechnician.role} · {selectedTechnician.department}</p>
              </div>
              {loginError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <label htmlFor="technician-pin" className="text-sm font-medium text-gray-700">PIN</label>
                <Input id="technician-pin" type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} className="h-12 text-center text-lg tracking-[0.5em]" required autoFocus />
              </div>
              <Button type="submit" className="h-12 w-full bg-red-600 text-base hover:bg-red-700" disabled={loginMutation.isPending || pin.length !== 4}>
                {loginMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : <><Smartphone className="mr-2 h-4 w-4" /> Open Technician Dashboard</>}
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={() => { resetCredentials(); setStep("staff-list"); }}>
                Switch user
              </Button>
            </form>
          )}

          {step === "admin-credentials" && selectedAdmin && selectedAdmin.authMethod === "password" && (
            <form
              className="space-y-5"
              onSubmit={event => {
                event.preventDefault();
                loginMutation.mutate({ mode: "admin", username: selectedAdmin.username!, password });
              }}
            >
              <div className="flex items-start gap-3">
                <Button type="button" variant="ghost" size="icon" onClick={goBack} aria-label="Back to administrator list">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Welcome, {selectedAdmin.name}</h1>
                  <p className="mt-1 text-sm text-gray-600">Enter your password to access the office workspace.</p>
                </div>
              </div>

              <div className="rounded-xl bg-indigo-50 p-4 text-sm">
                <p className="font-medium text-indigo-900">{selectedAdmin.role} · {selectedAdmin.department}</p>
                <p className="mt-1 text-indigo-700">Username: {selectedAdmin.username}</p>
              </div>
              {loginError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <label htmlFor="admin-password" className="text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    className="h-12 pr-11"
                    required
                    autoFocus
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-12 w-11" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="h-12 w-full bg-indigo-600 text-base hover:bg-indigo-700" disabled={loginMutation.isPending || !password}>
                {loginMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : <><ShieldCheck className="mr-2 h-4 w-4" /> Sign in securely</>}
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={() => { resetCredentials(); setStep("admin-list"); }}>
                Switch user
              </Button>
            </form>
          )}
        </main>

        {onDemoLogin && (
          <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
              <div className="mb-1 flex items-center gap-2">
                <FlaskConical className="h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm font-semibold text-amber-900">Demo / Safe Review Access</p>
              </div>
              <p className="text-xs leading-snug text-amber-700">
                Demo Mode uses sample data only. Destructive actions are disabled.
              </p>
            </div>
            <div className="space-y-2 p-3">
              {DEMO_PROFILES.map(profile => (
                <button
                  key={profile.key}
                  type="button"
                  onClick={() => onDemoLogin(profile)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all hover:shadow-sm active:scale-[0.99] ${profile.colorClass}`}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0 opacity-60" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{profile.label}</p>
                    <p className="mt-0.5 text-xs opacity-60">{profile.description}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-35" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
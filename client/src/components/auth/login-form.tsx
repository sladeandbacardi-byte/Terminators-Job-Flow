import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle, ArrowLeft, BriefcaseBusiness, Eye, EyeOff, Loader2,
  ShieldCheck, Smartphone, UserRound,
} from "lucide-react";

type LoginStep = "choose-type" | "staff-list" | "staff-credentials" | "admin-list" | "admin-credentials";

interface Technician {
  id: string;
  name: string;
  role: string;
  department: string;
  employeeId: string;
}

interface Administrator {
  id: string;
  name: string;
  username?: string;
  role: string;
  department: string;
  authMethod: "password" | "profile_picker";
}

interface LoginDirectory {
  staff: Technician[];
  admins: Administrator[];
}

const FALLBACK_DIRECTORY: LoginDirectory = {
  staff: [
    ["mobile-tech-01", "Re-Althon", "MT-001"], ["mobile-tech-02", "Leon", "MT-002"],
    ["mobile-tech-03", "Garth", "MT-003"], ["mobile-tech-04", "Jackie", "MT-004"],
    ["mobile-tech-06", "Zain", "MT-006"],
    ["mobile-tech-07", "Mike", "MT-007"], ["mobile-tech-08", "X", "MT-008"],
    ["mobile-tech-09", "Reece", "MT-009"],
  ].map(([id, name, employeeId]) => ({ id, name, employeeId, role: "Technician", department: "Field Service" })),
  admins: [
    { id: "fallback-admin", name: "Administrator", username: "admin", role: "Administrator", department: "Administration", authMethod: "password" },
    { id: "worker-1", name: "Julien Botha", role: "Operations Manager", department: "Admin", authMethod: "profile_picker" },
    { id: "worker-2", name: "Maryka Venter", role: "Pest Control Services Manager", department: "Admin", authMethod: "profile_picker" },
    { id: "worker-3", name: "Mariette Koekemoer", role: "Hygiene Services Manager", department: "Admin", authMethod: "profile_picker" },
    { id: "worker-4", name: "Juli Holtshausen", role: "Finance & HR Manager", department: "Accounts", authMethod: "profile_picker" },
    { id: "worker-5", name: "Sheryl-Lyn Lee", role: "Existing Clients Sales & Admin", department: "Sales", authMethod: "profile_picker" },
    { id: "worker-6", name: "Sales 2", role: "Sales Rep", department: "Sales", authMethod: "profile_picker" },
  ],
};

interface LoginFormProps {
  onSuccess: (token: string, user: any) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<LoginStep>("choose-type");
  const [directory, setDirectory] = useState<LoginDirectory>(FALLBACK_DIRECTORY);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<Administrator | null>(null);
  const [password, setPassword] = useState("");
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
        | { mode: "mobile"; employeeId: string }
        | { mode: "admin"; username: string; password: string }
        | { mode: "profile"; userId: string },
    ) => {
      const response = await fetch(
        credentials.mode === "mobile"
          ? "/api/auth/mobile-login"
          : credentials.mode === "admin"
            ? "/api/auth/admin-login"
            : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            credentials.mode === "mobile"
              ? { employeeId: credentials.employeeId }
              : credentials.mode === "admin"
                ? { username: credentials.username, password: credentials.password }
                : { userId: credentials.userId },
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
        localStorage.setItem("mobile_worker_id", data.worker.id);
        localStorage.setItem("mobile_session_token", data.token);
        localStorage.setItem("mobile_worker_data", JSON.stringify(data.worker));
        navigate("/mobile", { replace: true });
        return;
      }
      onSuccess(data.token, data.user);
    },
    onError: (error: Error) => setLoginError(error.message || "Login failed. Please try again."),
  });

  const resetCredentials = () => {
    setPassword("");
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
    color: "emerald" | "indigo",
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        color === "emerald"
          ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 focus:ring-emerald-600"
          : "border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 focus:ring-indigo-600"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`rounded-xl p-3 text-white ${color === "emerald" ? "bg-emerald-600" : "bg-indigo-600"}`}>
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
      className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-2.5 ${type === "staff" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"}`}>
          {type === "staff" ? <UserRound className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{user.name}</p>
          <p className="mt-0.5 text-sm text-gray-600">{user.role}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">{user.department}</p>
          {type === "admin" && (user as Administrator).authMethod === "profile_picker" && (
            <p className="mt-1 text-xs text-gray-500">Office profile</p>
          )}
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center space-y-6">
        <div className="flex justify-center">
          <img
            src="/images/job-flow-full-logo.png"
            alt="Job Flow Field Service Management"
            className="h-auto w-[260px] object-contain sm:w-[320px]"
            onError={event => { (event.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        <main className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg sm:p-6">
          {step === "choose-type" && (
            <div className="space-y-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900">Select Login Type</h1>
                <p className="mt-2 text-sm text-gray-600">Choose the workspace you need to access.</p>
              </div>
              {selectionCard("Staff Login", "Technician work orders, field diaries and fleet updates.", <Smartphone className="h-6 w-6" />, () => setStep("staff-list"), "emerald")}
              {selectionCard("Admin Login", "Office, management and administrator access.", <BriefcaseBusiness className="h-6 w-6" />, () => setStep("admin-list"), "indigo")}
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
                    {step === "staff-list" ? "Select your profile to open the technician dashboard." : "Select an office profile or protected administrator account."}
                  </p>
                </div>
              </div>

              {directoryLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
                </div>
              ) : (
                <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                  {step === "staff-list"
                    ? directory.staff.map(technician => userCard(technician, () => selectTechnician(technician), "staff"))
                    : directory.admins.map(administrator => userCard(administrator, () => selectAdmin(administrator), "admin"))}
                </div>
              )}
            </div>
          )}

          {step === "staff-credentials" && selectedTechnician && (
            <form
              className="space-y-5"
              onSubmit={event => {
                event.preventDefault();
                loginMutation.mutate({ mode: "mobile", employeeId: selectedTechnician.employeeId });
              }}
            >
              <div className="flex items-start gap-3">
                <Button type="button" variant="ghost" size="icon" onClick={goBack} aria-label="Back to staff list">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Welcome, {selectedTechnician.name}</h1>
                  <p className="mt-1 text-sm text-gray-600">Confirm your employee ID to open the technician dashboard.</p>
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4 text-sm">
                <p className="font-medium text-emerald-900">{selectedTechnician.role} · {selectedTechnician.department}</p>
                <p className="mt-1 text-emerald-700">Employee ID: {selectedTechnician.employeeId}</p>
              </div>
              {loginError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                PIN verification is temporarily disabled. Keep your employee ID private.
              </div>
              <Button type="submit" className="h-12 w-full bg-emerald-600 text-base hover:bg-emerald-700" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : <><Smartphone className="mr-2 h-4 w-4" /> Open Technician Dashboard</>}
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={() => { resetCredentials(); setStep("staff-list"); }}>
                Switch user
              </Button>
            </form>
          )}

          {step === "admin-credentials" && selectedAdmin && selectedAdmin.authMethod === "profile_picker" && (
            <form
              className="space-y-5"
              onSubmit={event => {
                event.preventDefault();
                loginMutation.mutate({ mode: "profile", userId: selectedAdmin.id });
              }}
            >
              <div className="flex items-start gap-3">
                <Button type="button" variant="ghost" size="icon" onClick={goBack} aria-label="Back to office user list">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Welcome, {selectedAdmin.name}</h1>
                  <p className="mt-1 text-sm text-gray-600">Continue to your office workspace.</p>
                </div>
              </div>
              <div className="rounded-xl bg-indigo-50 p-4 text-sm">
                <p className="font-medium text-indigo-900">{selectedAdmin.role} · {selectedAdmin.department}</p>
                <p className="mt-2 text-indigo-700">This office profile provides staff-level access. Administrator actions still require the protected administrator account.</p>
              </div>
              {loginError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="h-12 w-full bg-indigo-600 text-base hover:bg-indigo-700" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : <><UserRound className="mr-2 h-4 w-4" /> Continue to workspace</>}
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={() => { resetCredentials(); setStep("admin-list"); }}>
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
      </div>
    </div>
  );
}
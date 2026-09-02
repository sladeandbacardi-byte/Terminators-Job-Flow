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
import { SOLE_SUPERADMIN } from "@shared/superadmin";
import { getOfficeOrganogramBranch, OFFICE_ORGANOGRAM_BRANCHES } from "@shared/officeOrganogram";
import { MOBILE_STAFF_ROSTER, MOBILE_STAFF_TEAM_GROUPS } from "@shared/organogram";
import { storeMobileSession } from "@/lib/mobile-auth";

type LoginStep = "choose-type" | "staff-list" | "admin-list" | "admin-credentials";

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
  authMethod: "password" | "passwordless";
}

interface LoginDirectory {
  staff: Technician[];
  admins: Administrator[];
}

const FALLBACK_DIRECTORY: LoginDirectory = {
  staff: MOBILE_STAFF_ROSTER.map(person => ({
    id: person.id,
    name: person.name,
    role: person.title,
    department: person.team,
  })),
  admins: [
    {
      id: SOLE_SUPERADMIN.workerId,
      name: SOLE_SUPERADMIN.name,
      username: SOLE_SUPERADMIN.username,
      role: SOLE_SUPERADMIN.roleLabel,
      department: SOLE_SUPERADMIN.department,
      authMethod: "password",
    },
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
        | { mode: "mobile"; workerId: string }
        | { mode: "admin"; username: string; password: string }
        | { mode: "office"; workerId: string },
    ) => {
      const response = await fetch(
        credentials.mode === "mobile"
          ? "/api/auth/mobile-login"
          : credentials.mode === "office"
            ? "/api/auth/office-login"
          : credentials.mode === "admin"
            ? "/api/auth/admin-login"
            : "/api/auth/admin-login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(credentials.mode === "mobile" && localStorage.getItem("mobile_session_token")
              ? { Authorization: `Bearer ${localStorage.getItem("mobile_session_token")}` }
              : {}),
          },
          body: JSON.stringify(
            credentials.mode === "mobile"
              ? { workerId: credentials.workerId }
              : credentials.mode === "office"
                ? { workerId: credentials.workerId }
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
        storeMobileSession({ workerId: data.worker.id, token: data.token, worker: data.worker });
        window.location.replace("/mobile");
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
    loginMutation.mutate({ mode: "mobile", workerId: technician.id });
  };

  const selectAdmin = (administrator: Administrator) => {
    resetCredentials();
    setSelectedAdmin(administrator);
    if (administrator.authMethod === "passwordless") {
      loginMutation.mutate({ mode: "office", workerId: administrator.id });
      return;
    }
    if (!administrator.username) return;
    setStep("admin-credentials");
  };

  const goBack = () => {
    resetCredentials();
    if (step === "staff-list" || step === "admin-list") setStep("choose-type");
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
  ) => {
    return (
    <button
      key={user.id}
      type="button"
      onClick={onClick}
      disabled={loginMutation.isPending}
      aria-label={`${user.name}, ${user.role}, ${user.department}`}
      className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-2.5 ${type === "staff" ? "bg-red-100 text-red-700" : "bg-indigo-100 text-indigo-700"}`}>
          {type === "staff" ? <UserRound className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="break-words font-semibold text-gray-900">{user.name}</p>
          <p className="mt-0.5 break-words text-sm text-gray-600">{user.role}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">{user.department}</p>
        </div>
      </div>
    </button>
    );
  };

  const officeOrganogram = () => {
    const julien = directory.admins.find(person => person.id === SOLE_SUPERADMIN.workerId);
    const branches = OFFICE_ORGANOGRAM_BRANCHES.map(branch => ({
      branch,
      people: directory.admins
        .filter(person => person.id !== SOLE_SUPERADMIN.workerId && getOfficeOrganogramBranch(person) === branch)
        .sort((a, b) => a.name.localeCompare(b.name)),
    })).filter(group => group.people.length > 0);
    const branchClasses = {
      "Administration Team": "border-sky-200 bg-sky-50/70 text-sky-950",
      "Finance / HR": "border-amber-200 bg-amber-50/70 text-amber-950",
      "Marketing & Sales": "border-emerald-200 bg-emerald-50/70 text-emerald-950",
    } as const;

    return (
      <div className="office-organogram space-y-5" data-testid="office-organogram">
        {julien && (
          <div className="mx-auto max-w-xs rounded-2xl border-2 border-red-200 bg-red-50/70 p-2">
            <div className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Operations</div>
            {userCard(julien, () => selectAdmin(julien), "admin")}
          </div>
        )}
        <div className="mx-auto hidden h-7 w-px bg-indigo-300 md:block" aria-hidden="true" />
        <div className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="absolute -top-4 left-[16.67%] right-[16.67%] hidden border-t border-indigo-300 xl:block" aria-hidden="true" />
          {branches.map(({ branch, people }) => (
            <section key={branch} className={`relative rounded-2xl border p-3 ${branchClasses[branch]}`} aria-labelledby={`office-branch-${branch}`}>
              <div className="absolute -top-4 left-1/2 hidden h-4 border-l border-indigo-300 xl:block" aria-hidden="true" />
              <h2 id={`office-branch-${branch}`} className="mb-3 text-center text-sm font-bold text-indigo-950">{branch}</h2>
              <div className="space-y-2">
                {people.map(person => userCard(person, () => selectAdmin(person), "admin"))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  };

  const mobileStaffGroups = MOBILE_STAFF_TEAM_GROUPS.map(group => ({
    team: group.department,
    people: directory.staff.filter(person => (group.teams as readonly string[]).includes(person.department)),
  })).filter(group => group.people.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <div className={`mx-auto flex min-h-[calc(100vh-4rem)] w-full flex-col justify-center space-y-6 ${
        step === "admin-list" ? "max-w-md md:max-w-4xl xl:max-w-6xl" : "max-w-md"
      }`}>
        <div className="flex justify-center">
          <JobFlowBrandLockup size="lg" className="max-w-full" data-testid="login-brand-lockup" />
        </div>

        <main className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-lg sm:p-6 ${
          step === "admin-list" ? "md:p-7 xl:p-8" : ""
        }`}>
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
                  <h1 className="text-xl font-bold text-gray-900">{step === "staff-list" ? "Staff Login" : "Admin / Office Login"}</h1>
                  <p className="mt-1 text-sm text-gray-600">
                     {step === "staff-list" ? "Select your profile to open the technician dashboard." : "Select your name to open the office workspace."}
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
                  <div className={`space-y-3 pr-1 ${
                    step === "admin-list"
                      ? "max-h-[64vh] overflow-y-auto md:max-h-none md:overflow-visible"
                      : "max-h-[52vh] overflow-y-auto"
                  }`}>
                    {step === "staff-list"
                      ? mobileStaffGroups.map(group => (
                        <section key={group.team} aria-labelledby={`staff-team-${group.team}`} className="space-y-2">
                          <h2 id={`staff-team-${group.team}`} className="border-b border-red-100 pb-1 text-xs font-bold uppercase tracking-wide text-red-700">
                            {group.team}
                          </h2>
                          {group.people.map(technician => userCard(technician, () => selectTechnician(technician), "staff"))}
                        </section>
                      ))
                      : officeOrganogram()}
                  </div>
                </div>
              )}
            </div>
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
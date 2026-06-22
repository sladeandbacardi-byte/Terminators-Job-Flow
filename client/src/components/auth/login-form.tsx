import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LogIn, AlertCircle, User, Briefcase, TrendingUp, DollarSign, Shield,
  FlaskConical, ChevronRight, Wrench,
} from "lucide-react";
import { getDashboardRole, dashboardRoleLabels } from "@/lib/dashboardRole";
import { DEMO_PROFILES } from "@/lib/demoProfiles";
import type { Worker } from "@shared/schema";
import jobFlowFullLogo from "@assets/job-flow-full-logo_1779307679614.png";

const roleIcons: Record<string, JSX.Element> = {
  admin:       <Shield className="h-3.5 w-3.5" />,
  manager:     <Briefcase className="h-3.5 w-3.5" />,
  sales:       <TrendingUp className="h-3.5 w-3.5" />,
  service:     <Wrench className="h-3.5 w-3.5" />,
  accounts:    <DollarSign className="h-3.5 w-3.5" />,
  coordinator: <Briefcase className="h-3.5 w-3.5" />,
};

const roleColors: Record<string, string> = {
  admin:       "bg-indigo-100 text-indigo-700",
  manager:     "bg-teal-100 text-teal-700",
  sales:       "bg-pink-100 text-pink-700",
  service:     "bg-green-100 text-green-700",
  accounts:    "bg-amber-100 text-amber-700",
  coordinator: "bg-cyan-100 text-cyan-700",
};

const DEMO_ICONS: Record<string, JSX.Element> = {
  admin:       <Shield className="h-4 w-4" />,
  coordinator: <Briefcase className="h-4 w-4" />,
  accounts:    <DollarSign className="h-4 w-4" />,
  sales:       <TrendingUp className="h-4 w-4" />,
  service:     <Wrench className="h-4 w-4" />,
};

interface LoginFormProps {
  onSuccess: (token: string, user: any) => void;
  onDemoLogin?: (profile: any) => void;
}

export function LoginForm({ onSuccess, onDemoLogin }: LoginFormProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: allWorkers = [], isLoading: workersLoading } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  // Show all active workers — role preview badge tells the user what dashboard they'll see
  const workers = allWorkers.filter(w => w.isActive !== false);

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
      onSuccess(data.token, data.user);
    },
  });

  const selectedWorker = workers.find(w => w.id === selectedUserId);
  const previewRole = selectedWorker ? getDashboardRole(selectedWorker) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <div className="w-full max-w-md space-y-6">

        {/* ── Sign-in card ──────────────────────────────────────────────────── */}
        <Card className="shadow-xl">
          <CardContent className="pt-4 pb-5 space-y-4">

            {/* Logo — centred, bottom margin trims image's built-in whitespace */}
            <div className="flex justify-center -mb-4">
              <img
                src={jobFlowFullLogo}
                alt="Job Flow Field Service Management"
                className="w-[240px] sm:w-[300px] h-auto object-contain"
              />
            </div>

            {loginMutation.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {loginMutation.error instanceof Error ? loginMutation.error.message : "Login failed"}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="user-select">Select your profile</Label>
              <Select
                value={selectedUserId}
                onValueChange={setSelectedUserId}
                disabled={loginMutation.isPending || workersLoading}
              >
                <SelectTrigger data-testid="select-user">
                  <SelectValue placeholder={workersLoading ? "Loading..." : "Choose a user to continue"} />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((worker) => {
                    const role = getDashboardRole(worker);
                    return (
                      <SelectItem key={worker.id} value={worker.id} data-testid={`user-option-${worker.id}`}>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                            <User className="h-3.5 w-3.5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{worker.name}</p>
                            <p className="text-xs text-gray-400">{worker.role}</p>
                          </div>
                          <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${roleColors[role]}`}>
                            {roleIcons[role]}
                            {dashboardRoleLabels[role]}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {previewRole && (
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${roleColors[previewRole]}`}>
                {roleIcons[previewRole]}
                <span>You'll see the <strong>{dashboardRoleLabels[previewRole]} Dashboard</strong></span>
              </div>
            )}

            <Button
              onClick={() => selectedUserId && loginMutation.mutate(selectedUserId)}
              className="w-full bg-[#1d4ed8] hover:bg-[#1e40af] text-white"
              disabled={loginMutation.isPending || !selectedUserId}
              data-testid="button-login"
            >
              <LogIn className="h-4 w-4 mr-2" />
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>

            <p className="text-center text-xs text-gray-400">
              Each user sees a dashboard tailored to their role
            </p>
          </CardContent>
        </Card>

        {/* ── Demo / Safe Review Access ─────────────────────────────────────── */}
        <div className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">

          {/* Section header */}
          <div className="bg-amber-50 border-b border-amber-100 px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm font-semibold text-amber-900">Demo / Safe Review Access</p>
            </div>
            {/* Yellow warning — always visible */}
            <p className="text-xs text-amber-700 leading-snug">
              Demo Mode — uses sample data only. Destructive actions are disabled.
            </p>
          </div>

          {/* Demo role buttons — visible immediately, no click required */}
          <div className="p-3 space-y-2">
            {DEMO_PROFILES.map(profile => {
              const icon = DEMO_ICONS[profile.key] ?? <User className="h-4 w-4" />;
              return (
                <button
                  key={profile.key}
                  onClick={() => onDemoLogin?.(profile)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all hover:shadow-sm active:scale-[0.99] ${profile.colorClass}`}
                >
                  <span className="shrink-0 opacity-60">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">{profile.label}</p>
                    <p className="text-xs opacity-60 mt-0.5">{profile.description}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 opacity-35 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

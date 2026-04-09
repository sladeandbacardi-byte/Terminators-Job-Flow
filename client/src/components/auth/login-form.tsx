import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogIn, AlertCircle, User, Briefcase, TrendingUp, DollarSign, Shield } from "lucide-react";
import { getDashboardRole, dashboardRoleLabels } from "@/lib/dashboardRole";
import { TerminatorsLogo } from "@/components/terminators-logo";
import type { Worker } from "@shared/schema";

const roleIcons: Record<string, JSX.Element> = {
  admin: <Shield className="h-3.5 w-3.5" />,
  manager: <Briefcase className="h-3.5 w-3.5" />,
  sales: <TrendingUp className="h-3.5 w-3.5" />,
  service: <Briefcase className="h-3.5 w-3.5" />,
  accounts: <DollarSign className="h-3.5 w-3.5" />,
};

const roleColors: Record<string, string> = {
  admin: "bg-indigo-100 text-indigo-700",
  manager: "bg-teal-100 text-teal-700",
  sales: "bg-pink-100 text-pink-700",
  service: "bg-green-100 text-green-700",
  accounts: "bg-amber-100 text-amber-700",
};

interface LoginFormProps {
  onSuccess: (token: string, user: any) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: workers = [], isLoading: workersLoading } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

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

  const handleLogin = () => {
    if (selectedUserId) loginMutation.mutate(selectedUserId);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center pb-4">
          <div className="mx-auto pt-2">
            <TerminatorsLogo size="lg" />
          </div>
          <CardDescription className="text-gray-600 font-medium">Terminators Job Flow</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
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
            <Select value={selectedUserId} onValueChange={setSelectedUserId}
              disabled={loginMutation.isPending || workersLoading}>
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

          {/* Preview what dashboard they'll see */}
          {previewRole && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${roleColors[previewRole]}`}>
              {roleIcons[previewRole]}
              <span>You'll see the <strong>{dashboardRoleLabels[previewRole]} Dashboard</strong></span>
            </div>
          )}

          <Button onClick={handleLogin} className="w-full bg-green-600 hover:bg-green-700"
            disabled={loginMutation.isPending || !selectedUserId} data-testid="button-login">
            {loginMutation.isPending ? "Signing in..." : "Sign In"}
          </Button>

          <p className="text-center text-xs text-gray-400">
            Each user sees a dashboard tailored to their role
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertCircle, LogIn, Loader2 } from "lucide-react";
import { getDashboardRole, dashboardRoleLabels } from "@/lib/dashboardRole";

interface StaffMember {
  id: string;
  name: string;
  role: string | null;
  departmentId: string | null;
}

const FALLBACK_STAFF: StaffMember[] = [
  { id: "worker-1", name: "Julien Botha",       role: "Operations Manager",             departmentId: "div-6" },
  { id: "worker-2", name: "Maryka Venter",      role: "Pest Control Services Manager",  departmentId: "div-6" },
  { id: "worker-3", name: "Mariette Koekemoer", role: "Hygiene Services Manager",       departmentId: "div-6" },
  { id: "worker-4", name: "Juli Holtshausen",   role: "Finance & HR Manager",           departmentId: "div-7" },
  { id: "worker-5", name: "Sheryl-Lyn Lee",     role: "Existing Clients Sales & Admin", departmentId: "div-5" },
  { id: "worker-6", name: "sales2",              role: "Sales Rep",                      departmentId: "div-5" },
];

interface LoginFormProps {
  onSuccess: (token: string, user: any) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loginError, setLoginError] = useState("");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/staff")
      .then(r => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json();
      })
      .then((data: StaffMember[]) => {
        setStaff(data.length > 0 ? data : FALLBACK_STAFF);
        setStaffLoading(false);
      })
      .catch(() => {
        setStaff(FALLBACK_STAFF);
        setStaffLoading(false);
      });
  }, []);

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
      <div className="w-full max-w-sm space-y-6">

        <div className="flex justify-center">
          <img
            src="/images/job-flow-full-logo.png"
            alt="Job Flow Field Service Management"
            className="w-[260px] sm:w-[320px] h-auto object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <p className="text-sm text-gray-500">Select your profile to sign in.</p>

          {loginError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{loginError}</AlertDescription>
            </Alert>
          )}

          {staffLoading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose your profile…" />
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
            {loginMutation.isPending ? "Signing in…" : "Sign In"}
          </Button>
        </div>

      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Smartphone, UserRound } from "lucide-react";
import type { Worker } from "@shared/schema";
import { JobFlowBrandLockup } from "@/components/terminators-logo";

type StaffProfile = { id: string; name: string; role: string; department: string };

interface MobileLoginProps {
  onSuccess: (worker: Worker) => void;
}

const FALLBACK_STAFF: StaffProfile[] = [
  ["mobile-tech-01", "Re-Althon"], ["mobile-tech-02", "Leon Coltman"],
  ["mobile-tech-03", "Garth du Preez"], ["mobile-tech-04", "Jackie Roelfse"],
  ["mobile-tech-06", "Zain Abdol"], ["mobile-tech-07", "Michael Meyer"],
  ["mobile-tech-08", "Xolani Ndzotoyi"], ["mobile-tech-09", "Reece Ebrahim"],
].map(([id, name]) => ({ id, name, role: "Technician", department: "Field Service" }));

export function MobileLogin({ onSuccess }: MobileLoginProps) {
  const [staff, setStaff] = useState<StaffProfile[]>(FALLBACK_STAFF);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [selected, setSelected] = useState<StaffProfile | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/staff")
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load staff")))
      .then(data => { if (Array.isArray(data.staff) && data.staff.length) setStaff(data.staff); })
      .catch(() => setStaff(FALLBACK_STAFF))
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (profile: StaffProfile) => {
    setError("");
    setSigningIn(profile.id);
    try {
      const response = await fetch("/api/auth/mobile-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: profile.id, pin }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to sign in");
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
      onSuccess(data.worker);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setSigningIn(null);
    }
  };

  return <div className="min-h-screen bg-gray-50 px-4 py-8">
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center space-y-6">
      <div className="flex justify-center"><JobFlowBrandLockup size="md" className="max-w-full" data-testid="mobile-login-brand-lockup" /></div>
      <main className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <button type="button" onClick={() => { window.location.href = "/"; }} className="mb-4 flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-red-600"><ArrowLeft className="h-4 w-4" />Back to Main Login</button>
         <div className="mb-5 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 text-white"><Smartphone className="h-6 w-6" /></div><h1 className="text-2xl font-bold text-gray-900">Staff Login</h1><p className="mt-2 text-sm text-gray-600">For technicians and mobile field staff</p></div>
        {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {loading ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading staff…</div> : selected ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); void signIn(selected); }}>
            <button type="button" onClick={() => { setSelected(null); setPin(""); setError(""); }} className="text-sm font-semibold text-gray-600 hover:text-red-600">Choose another profile</button>
            <div className="rounded-xl bg-red-50 p-4"><p className="font-semibold text-red-900">{selected.name}</p><p className="text-sm text-red-700">{selected.role} · {selected.department}</p></div>
            <input type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="4-digit PIN" aria-label="Mobile PIN" required className="h-12 w-full rounded-md border border-gray-300 px-3 text-center text-lg tracking-[0.4em] focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200" />
            <button type="submit" disabled={pin.length !== 4 || Boolean(signingIn)} className="flex h-12 w-full items-center justify-center rounded-md bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-50">{signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}</button>
          </form> : <div className="space-y-2">{staff.map(profile => <button key={profile.id} type="button" onClick={() => { setError(""); setSelected(profile); }} disabled={Boolean(signingIn)} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-red-400 hover:bg-red-50 hover:shadow-md disabled:cursor-wait disabled:opacity-60"><div className="rounded-full bg-red-100 p-2.5 text-red-700"><UserRound className="h-5 w-5" /></div><div><p className="font-semibold text-gray-900">{profile.name}</p><p className="text-sm text-gray-600">{profile.role}</p><p className="text-xs uppercase tracking-wide text-gray-400">{profile.department}</p></div></button>)}</div>}
      </main>
      <p className="text-center text-xs text-gray-400">Job Flow · Field Service Management</p>
    </div>
  </div>;
}
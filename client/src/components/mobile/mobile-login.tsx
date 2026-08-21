import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, BriefcaseBusiness, Loader2, UserRound } from "lucide-react";
import type { Worker } from '@shared/schema';

interface MobileLoginProps {
  onSuccess: (worker: Worker) => void;
}

export function MobileLogin({ onSuccess }: MobileLoginProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const goToMainLogin = () => {
    window.location.href = '/';
  };

  const goToAdminLogin = () => {
    // Return to root login; admin can select "Admin Login" from there
    window.location.href = '/?login=admin';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/mobile-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employeeId.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      localStorage.setItem('mobile_worker_id', data.worker.id);
      localStorage.setItem('mobile_session_token', data.token);
      localStorage.setItem('mobile_worker_data', JSON.stringify(data.worker));

      onSuccess(data.worker);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/images/job-flow-full-logo.png"
            alt="Job Flow Field Service Management"
            className="h-auto w-[220px] object-contain sm:w-[260px]"
            onError={event => {
              const img = event.target as HTMLImageElement;
              img.src = '/images/job-flow-header-logo.png';
              img.onerror = () => { img.style.display = 'none'; };
            }}
          />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">

          {/* Heading */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Staff Login</h1>
            <p className="mt-1.5 text-sm text-gray-500">Mobile access for field staff and technicians</p>
            <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-red-600">
              The Terminators · Mobile Staff Access
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="employeeId" className="text-sm font-medium text-gray-700">Employee ID</Label>
              <Input
                id="employeeId"
                type="text"
                placeholder="Enter your employee ID"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                className="h-12 text-base"
                required
                autoComplete="username"
                data-testid="input-employee-id"
              />
              <p className="text-xs text-gray-500">Keep your employee ID private.</p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base bg-red-600 hover:bg-red-700 text-white"
              disabled={isLoading || !employeeId.trim()}
              data-testid="button-login"
            >
              {isLoading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</>
                : 'Sign In'}
            </Button>
          </form>

          {/* Navigation links */}
          <div className="mt-6 flex flex-col items-center gap-3 border-t border-gray-100 pt-5">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={goToMainLogin}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Main Login
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full h-10 text-gray-600 hover:text-gray-900"
              onClick={goToAdminLogin}
            >
              <BriefcaseBusiness className="mr-2 h-4 w-4" />
              Admin / Office Login
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400">
          Job Flow · Field Service Management
        </p>
      </div>
    </div>
  );
}

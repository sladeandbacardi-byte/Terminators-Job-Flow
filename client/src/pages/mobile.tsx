import { MobileAuthProvider, useMobileAuth } from "@/hooks/useMobileAuth";
import { MobileLogin } from "@/components/mobile/mobile-login";
import { MobileTechnicianDashboard } from "@/components/mobile/mobile-technician-dashboard";

function MobileApp() {
  const { worker, isAuthenticated, isLoading, login, logout } = useMobileAuth();

  if (isLoading) {
    return (
    <>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    </>
    );
  }

  if (!isAuthenticated || !worker) {
    return <MobileLogin onSuccess={login} />;
  }

  return <MobileTechnicianDashboard worker={worker} onLogout={logout} />;
}

export default function Mobile() {
  return (
    <MobileAuthProvider>
      <MobileApp />
    </MobileAuthProvider>
  );
}
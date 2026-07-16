import { useState } from "react";
import Sidebar from "./sidebar";
import Header from "./header";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AppShell({ children, title, subtitle }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          onMobileMenuToggle={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

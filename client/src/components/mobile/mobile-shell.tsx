import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ChevronRight, LogOut, Menu, X } from "lucide-react";
import jobFlowLogo from "@assets/job-flow-header-logo_1779307679615.png";

export type MobileNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
};

interface MobileShellProps {
  title: string;
  subtitle?: string;
  workerName: string;
  workerRole?: string | null;
  activeItem?: string;
  items: MobileNavItem[];
  onLogout: () => void;
  onBack?: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
}

export function MobileShell({
  title,
  subtitle,
  workerName,
  workerRole = "Technician",
  activeItem,
  items,
  onLogout,
  onBack,
  headerAction,
  children,
}: MobileShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const selectItem = (item: MobileNavItem) => {
    setMenuOpen(false);
    if (item.onSelect) item.onSelect();
    else if (item.href) window.location.href = item.href;
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label={onBack ? "Back" : "Open menu"}
              onClick={onBack ?? (() => setMenuOpen(true))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              {onBack ? <ArrowLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <img src={jobFlowLogo} alt="JobFlow" className="hidden h-8 w-auto max-w-[112px] object-contain sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-tight text-gray-900">{title}</h1>
              <p className="truncate text-xs text-gray-500">
                {workerName}{workerRole ? ` · ${workerRole}` : ""}
                {subtitle ? ` · ${subtitle}` : ""}
              </p>
            </div>
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-gray-950/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <img src={jobFlowLogo} alt="JobFlow" className="h-8 w-auto max-w-[150px] object-contain" />
                <p className="mt-2 truncate text-sm font-semibold text-gray-900">{workerName}</p>
                <p className="text-xs text-gray-500">{workerRole || "Technician"}</p>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3" aria-label="Mobile navigation">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                Field service
              </p>
              <div className="space-y-1">
                {items.map(item => {
                  const Icon = item.icon;
                  const active = item.id === activeItem;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectItem(item)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors ${
                        active ? "bg-red-50 text-red-700" : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-red-600" : "text-gray-500"}`} />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className={`h-4 w-4 ${active ? "text-red-400" : "text-gray-300"}`} />
                    </button>
                  );
                })}
              </div>
            </nav>
            <div className="border-t border-gray-100 p-4">
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="mx-auto w-full max-w-3xl px-4 py-5 pb-10 sm:px-6">{children}</div>
    </main>
  );
}
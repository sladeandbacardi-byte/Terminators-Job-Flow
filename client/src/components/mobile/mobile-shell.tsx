import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ChevronRight, LogOut, Menu, X } from "lucide-react";
import { JobFlowBrandLockup } from "@/components/terminators-logo";

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
  footer?: ReactNode;
  compact?: boolean;
  hideHeader?: boolean;
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
  footer,
  compact = false,
  hideHeader = false,
  children,
}: MobileShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerHistoryRef = useRef(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const closeMenu = (restoreHistory = true) => {
    if (!menuOpen) return;
    setMenuOpen(false);
    const hadDrawerHistory = drawerHistoryRef.current;
    drawerHistoryRef.current = false;
    if (restoreHistory && hadDrawerHistory) {
      window.history.back();
    }
  };

  const openMenu = () => {
    if (menuOpen) return;
    window.history.pushState({ ...(window.history.state ?? {}), mobileDrawer: true }, "");
    drawerHistoryRef.current = true;
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onPopState = () => {
      drawerHistoryRef.current = false;
      setMenuOpen(false);
      const pendingAction = pendingActionRef.current;
      pendingActionRef.current = null;
      pendingAction?.();
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const drawer = document.getElementById("mobile-navigation-drawer");
      if (!drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("popstate", onPopState);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("keydown", onKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  const selectItem = (item: MobileNavItem) => {
    const activate = () => {
      if (item.onSelect) item.onSelect();
      else if (item.href) window.location.assign(item.href);
    };
    if (drawerHistoryRef.current) {
      pendingActionRef.current = activate;
      drawerHistoryRef.current = false;
      window.history.back();
    } else {
      setMenuOpen(false);
      activate();
    }
  };

  const signOut = () => {
    if (drawerHistoryRef.current) {
      pendingActionRef.current = onLogout;
      drawerHistoryRef.current = false;
      window.history.back();
    } else {
      setMenuOpen(false);
      onLogout();
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {!hideHeader && <header className="sticky top-0 z-20 border-b border-gray-100 bg-white shadow-sm">
        <div className={`mx-auto flex h-16 w-full items-center justify-between gap-3 px-4 ${compact ? "max-w-md" : "max-w-3xl"}`}>
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label={onBack ? "Back" : "Open menu"}
              aria-controls={onBack ? undefined : "mobile-navigation-drawer"}
              aria-expanded={onBack ? undefined : menuOpen}
              onClick={onBack ?? openMenu}
              ref={menuButtonRef}
              data-testid={onBack ? undefined : "mobile-menu-toggle"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
              {onBack ? <ArrowLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <JobFlowBrandLockup size="xs" className="shrink-0" data-testid="mobile-header-brand-lockup" />
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
      </header>}

      {hideHeader && (
        <button
          type="button"
          aria-label="Open menu"
          aria-controls="mobile-navigation-drawer"
          aria-expanded={menuOpen}
          onClick={openMenu}
          ref={menuButtonRef}
          data-testid="mobile-menu-toggle"
          className="fixed left-4 top-4 z-30 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      {menuOpen && (
        <div className="fixed inset-0 z-40" aria-label="Navigation drawer">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-gray-950/45"
            onClick={() => closeMenu()}
          />
          <aside
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-navigation-title"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-gray-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <JobFlowBrandLockup size="sm" data-testid="mobile-menu-brand-lockup" />
                <p id="mobile-navigation-title" className="mt-2 truncate text-sm font-semibold text-gray-900">{workerName}</p>
                <p className="text-xs text-gray-500">{workerRole || "Technician"}</p>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => closeMenu()}
                ref={closeButtonRef}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
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
                      className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 ${
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
                 onClick={signOut}
                 className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className={`mx-auto w-full px-4 py-5 pb-10 sm:px-6 ${compact ? "max-w-md" : "max-w-3xl"}`}>{children}</div>
      {footer}
    </main>
  );
}
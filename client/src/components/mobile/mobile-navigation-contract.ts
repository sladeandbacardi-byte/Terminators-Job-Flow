import type { Permission } from "@shared/permissionMatrix";

export type MobileNavigationDefinition = {
  id: string;
  label: string;
  href?: string;
  permission?: Permission;
};

export const MOBILE_NAVIGATION: readonly MobileNavigationDefinition[] = [
  { id: "home", label: "JobFlow Home", permission: "dashboard" },
  { id: "jobs", label: "My Jobs", permission: "jobs" },
  { id: "my-time", label: "My Time", href: "/my-overtime", permission: "time:self" },
  { id: "my-day", label: "My Day", permission: "calendar" },
  { id: "calendar", label: "Calendar", permission: "calendar" },
  // This is the technician's job-linked field submission flow, not access to
  // the office Sales workspace.
  { id: "opportunities", label: "Additional Opportunities", permission: "jobs" },
  { id: "fleet", label: "Fleet", permission: "fleet" },
];

export function allowedMobileNavigation(
  permissions: readonly Permission[],
): MobileNavigationDefinition[] {
  return MOBILE_NAVIGATION.filter(item => !item.permission || permissions.includes(item.permission));
}

const MOBILE_SCREEN_PERMISSIONS: Readonly<Record<string, Permission>> = {
  dashboard: "dashboard",
  jobs: "jobs",
  diaries: "calendar",
  calendar: "calendar",
  opportunities: "jobs",
  fleet: "fleet",
  kmMorning: "fleet",
  kmAfternoon: "fleet",
  fuel: "fleet",
  inspection: "fleet",
  monthlyInspection: "fleet",
  issue: "fleet",
};

export function canAccessMobileScreen(screen: string, permissions: readonly Permission[]): boolean {
  const permission = MOBILE_SCREEN_PERMISSIONS[screen];
  return Boolean(permission && permissions.includes(permission));
}

export function isMobileViewport(width: number): boolean {
  return width < 768;
}
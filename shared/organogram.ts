export const CANONICAL_WORKER_NAMES = {
  "worker-6": "Anzel Marais",
} as const;

export const OFFICE_ORGANOGRAM_WORKER_IDS = [
  "worker-1", "worker-2", "worker-3", "worker-4", "worker-5", "worker-6",
] as const;

export const MOBILE_STAFF_ROSTER = [
  { id: "mobile-tech-01", name: "Re-Althon", title: "Sanitary Bin Service A Team Supervisor", team: "Sanitary Bin Service A Team" },
  { id: "mobile-tech-04", name: "Jackie Roelfse", title: "Sanitary Bin Service B Team Supervisor", team: "Sanitary Bin Service B Team" },
  { id: "mobile-tech-06", name: "Zain Abdol", title: "Washroom Services Supervisor", team: "Washroom Services" },
  { id: "mobile-tech-10", name: "Zuki Sandi", title: "Ablution Deep Cleaning Supervisor", team: "Ablution Deep Cleaning" },
  { id: "mobile-tech-09", name: "Reece Ebrahim", title: "Pest Control Operator", team: "Pest Control Team" },
  { id: "mobile-tech-03", name: "Garth du Preez", title: "Pest Control Operator", team: "Pest Control Team" },
  { id: "mobile-tech-07", name: "Michael Meyer", title: "Pest Control Operator", team: "Pest Control Team" },
  { id: "mobile-tech-08", name: "Xolani Ndzotoyi", title: "Pest Control Operator", team: "Pest Control Team" },
  { id: "mobile-tech-02", name: "Leon Coltman", title: "Pest Control Assistant", team: "Pest Control Team" },
] as const;

export const MOBILE_STAFF_TEAMS = [
  "Sanitary Bin Service A Team",
  "Sanitary Bin Service B Team",
  "Washroom Services",
  "Ablution Deep Cleaning",
  "Pest Control Team",
] as const;

export function getCanonicalWorkerName(workerId: string): string | undefined {
  return CANONICAL_WORKER_NAMES[workerId as keyof typeof CANONICAL_WORKER_NAMES];
}
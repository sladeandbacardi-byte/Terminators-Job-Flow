import type { DashboardRole } from "./dashboardRole";

export interface DemoProfile {
  key: string;
  dashboardRole: DashboardRole;
  label: string;
  description: string;
  colorClass: string;
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    departmentId: string;
  };
}

export const DEMO_PROFILES: DemoProfile[] = [
  {
    key: "admin",
    dashboardRole: "admin",
    label: "Operations Manager Demo",
    description: "Full access — all sections",
    colorClass: "bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100",
    user: {
      id: "demo-admin",
      username: "Demo Operations Manager",
      email: "demo@demo.co.za",
      firstName: "Demo",
      lastName: "Operations Manager",
      role: "Operations Manager",
      departmentId: "div-6",
    },
  },
  {
    key: "coordinator",
    dashboardRole: "coordinator",
    label: "Service Coordinator Demo",
    description: "Service tools, invoices, reports",
    colorClass: "bg-cyan-50 border-cyan-200 text-cyan-800 hover:bg-cyan-100",
    user: {
      id: "demo-coordinator",
      username: "Demo Service Coordinator",
      email: "demo@demo.co.za",
      firstName: "Demo",
      lastName: "Coordinator",
      role: "Service Coordinator",
      departmentId: "div-6",
    },
  },
  {
    key: "manager",
    dashboardRole: "manager",
    label: "Service Manager Demo",
    description: "Service jobs, calendar, teams, invoices",
    colorClass: "bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100",
    user: {
      id: "demo-manager",
      username: "Demo Service Manager",
      email: "demo@demo.co.za",
      firstName: "Demo",
      lastName: "Manager",
      role: "Service Manager",
      departmentId: "div-6",
    },
  },
  {
    key: "accounts",
    dashboardRole: "accounts",
    label: "Finance Demo",
    description: "Invoices, finance & supplier tools",
    colorClass: "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100",
    user: {
      id: "demo-accounts",
      username: "Demo Finance",
      email: "demo@demo.co.za",
      firstName: "Demo",
      lastName: "Finance",
      role: "Finance Manager",
      departmentId: "div-7",
    },
  },
  {
    key: "sales",
    dashboardRole: "sales",
    label: "Sales Demo",
    description: "Leads, quotes, clients & contracts",
    colorClass: "bg-pink-50 border-pink-200 text-pink-800 hover:bg-pink-100",
    user: {
      id: "demo-sales",
      username: "Demo Sales Consultant",
      email: "demo@demo.co.za",
      firstName: "Demo",
      lastName: "Sales",
      role: "Sales Consultant",
      departmentId: "div-5",
    },
  },
  {
    key: "service",
    dashboardRole: "service",
    label: "Technician Demo",
    description: "My jobs, field diaries & calendar",
    colorClass: "bg-green-50 border-green-200 text-green-800 hover:bg-green-100",
    user: {
      id: "demo-technician",
      username: "Demo Technician",
      email: "demo@demo.co.za",
      firstName: "Demo",
      lastName: "Technician",
      role: "Pest Control Technician",
      departmentId: "div-1",
    },
  },
];

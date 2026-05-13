import { useState, useEffect } from "react";
import { CheckSquare, Square, RotateCcw, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Sidebar from "@/components/layout/sidebar";
import MobileNav from "@/components/layout/mobile-nav";

const STORAGE_KEY = "app-testing-checklist-v1";

interface ChecklistItem {
  id: string;
  label: string;
}

interface ChecklistSection {
  section: string;
  items: ChecklistItem[];
}

const CHECKLIST: ChecklistSection[] = [
  {
    section: "Authentication & Login",
    items: [
      { id: "auth-1", label: "Login as Julien (Manager) — dashboard shows manager view" },
      { id: "auth-2", label: "Login as Maryka or Mariette (Service) — service sidebar visible" },
      { id: "auth-3", label: "Login as Juli (Accounts) — accounts sidebar and finance access" },
      { id: "auth-4", label: "Login as Sheryl-Lyn or Chanè (Sales) — sales sidebar only" },
      { id: "auth-5", label: "Logout and login again — session resets correctly" },
    ],
  },
  {
    section: "Client Management",
    items: [
      { id: "clients-1", label: "Create a new client with all required fields" },
      { id: "clients-2", label: "Edit an existing client's details" },
      { id: "clients-3", label: "Search clients by name" },
      { id: "clients-4", label: "Filter clients by status (Active / Inactive / Suspended)" },
      { id: "clients-5", label: "Click the Suspended stat card — table filters to suspended only" },
      { id: "clients-6", label: "Suspend a client (Accounts role) — client becomes blocked" },
      { id: "clients-7", label: "Reinstate a suspended client (Accounts role)" },
      { id: "clients-8", label: "Confirm suspended client does NOT appear in job/contract dropdowns" },
      { id: "clients-9", label: "Sales role can add and edit clients but cannot delete" },
      { id: "clients-10", label: "Export client list to CSV/Excel" },
    ],
  },
  {
    section: "Job Scheduling",
    items: [
      { id: "jobs-1", label: "Create a new job — select client, department, worker, date" },
      { id: "jobs-2", label: "Suspended client is NOT selectable when creating a job" },
      { id: "jobs-3", label: "Edit an existing job's details" },
      { id: "jobs-4", label: "Change job status (Scheduled → In Progress → Completed)" },
      { id: "jobs-5", label: "Assign inventory items to a job" },
      { id: "jobs-6", label: "View job card / printable summary" },
      { id: "jobs-7", label: "Filter jobs by department" },
      { id: "jobs-8", label: "Filter jobs by status" },
      { id: "jobs-9", label: "Search jobs by client or job number" },
    ],
  },
  {
    section: "Calendar",
    items: [
      { id: "cal-1", label: "Month view loads and displays jobs correctly" },
      { id: "cal-2", label: "Week view loads and displays events" },
      { id: "cal-3", label: "Day view loads and displays events" },
      { id: "cal-4", label: "Department filter works in day view" },
      { id: "cal-5", label: "Click a day to open appointment creator" },
      { id: "cal-6", label: "Create a calendar appointment — appears on calendar" },
      { id: "cal-7", label: "Toggle between Business Hours and Full Day view" },
      { id: "cal-8", label: "Overlapping events show side-by-side without overlap" },
      { id: "cal-9", label: "Print Daily Schedule — opens correct print layout" },
    ],
  },
  {
    section: "Staff / Workers",
    items: [
      { id: "workers-1", label: "Staff list loads with all team members" },
      { id: "workers-2", label: "View individual staff profile" },
      { id: "workers-3", label: "Staff are correctly assigned to their departments" },
      { id: "workers-4", label: "Service coordinators visible to service role" },
    ],
  },
  {
    section: "Quotes & Leads",
    items: [
      { id: "quotes-1", label: "Public quote request form is accessible without login" },
      { id: "quotes-2", label: "Submit a quote request — appears in Quotes page" },
      { id: "quotes-3", label: "Filter quotes by status (New / Reviewed / Accepted / Declined)" },
      { id: "quotes-4", label: "Update a quote status inline" },
      { id: "quotes-5", label: "Edit notes on a quote submission" },
      { id: "quotes-6", label: "Leads page loads and displays leads" },
      { id: "quotes-7", label: "Convert a lead to a client" },
    ],
  },
  {
    section: "Rental Contracts",
    items: [
      { id: "contracts-1", label: "Create a new rental contract for an active client" },
      { id: "contracts-2", label: "Suspended client does NOT appear in contract dropdown" },
      { id: "contracts-3", label: "Edit an existing contract" },
      { id: "contracts-4", label: "Sales role can view contracts but not create/edit/delete" },
      { id: "contracts-5", label: "Contract list filters and search work" },
    ],
  },
  {
    section: "Invoices & Finance",
    items: [
      { id: "inv-1", label: "Create a new invoice for an active client" },
      { id: "inv-2", label: "Add line items to an invoice" },
      { id: "inv-3", label: "Mark invoice as Paid" },
      { id: "inv-4", label: "Export invoice for Sage (CSV download)" },
      { id: "inv-5", label: "Send invoice via email" },
      { id: "inv-6", label: "Accounts role can access invoices" },
      { id: "inv-7", label: "Filter invoices by status" },
    ],
  },
  {
    section: "Stock Management",
    items: [
      { id: "stock-1", label: "Stock list loads with all items" },
      { id: "stock-2", label: "Add a new stock item" },
      { id: "stock-3", label: "Edit stock item quantity" },
      { id: "stock-4", label: "Low stock items flagged visually" },
      { id: "stock-5", label: "Create a purchase order for a supplier" },
      { id: "stock-6", label: "Approve a purchase order — email sent to supplier" },
      { id: "stock-7", label: "Supplier list loads and can be edited" },
    ],
  },
  {
    section: "Field Diaries",
    items: [
      { id: "diary-1", label: "Field diaries page loads correctly" },
      { id: "diary-2", label: "Create a new diary entry for a job" },
      { id: "diary-3", label: "View diary entries filtered by worker" },
      { id: "diary-4", label: "Diary entries show correct date and job details" },
    ],
  },
  {
    section: "Email Centre",
    items: [
      { id: "email-1", label: "Email centre loads without errors" },
      { id: "email-2", label: "Compose and send a client email" },
      { id: "email-3", label: "Email templates are selectable" },
      { id: "email-4", label: "Email log shows sent history" },
    ],
  },
  {
    section: "Dashboard & Reports",
    items: [
      { id: "dash-1", label: "Manager dashboard shows all department KPIs" },
      { id: "dash-2", label: "Accounts dashboard shows finance summary" },
      { id: "dash-3", label: "Sales dashboard shows pipeline and client stats" },
      { id: "dash-4", label: "Service dashboard shows job and staff data" },
      { id: "dash-5", label: "Suspended Services widget appears when clients are suspended" },
      { id: "dash-6", label: "Reports page generates correctly" },
      { id: "dash-7", label: "Custom Reports page works" },
    ],
  },
  {
    section: "Role-Based Access Control",
    items: [
      { id: "rbac-1", label: "Sales role cannot delete clients" },
      { id: "rbac-2", label: "Sales role cannot create/edit/delete contracts" },
      { id: "rbac-3", label: "Accounts role can suspend/reinstate clients only" },
      { id: "rbac-4", label: "Service role can view clients" },
      { id: "rbac-5", label: "Accounts role does NOT see Sales or Admin sections" },
      { id: "rbac-6", label: "Service role does NOT see Finance section" },
    ],
  },
  {
    section: "General UX & Responsive",
    items: [
      { id: "ux-1", label: "App loads in under 3 seconds on first visit" },
      { id: "ux-2", label: "Mobile nav works on narrow screen (hamburger menu)" },
      { id: "ux-3", label: "All form validations show helpful error messages" },
      { id: "ux-4", label: "Toast notifications appear on create/edit/delete actions" },
      { id: "ux-5", label: "No console errors on initial page load" },
      { id: "ux-6", label: "All pages render without blank white screen" },
    ],
  },
];

const ALL_ITEM_IDS = CHECKLIST.flatMap((s) => s.items.map((i) => i.id));

export default function TestingChecklist() {
  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...checked]));
  }, [checked]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const reset = () => {
    if (confirm("Clear all ticked items and start fresh?")) {
      setChecked(new Set());
    }
  };

  const totalItems = ALL_ITEM_IDS.length;
  const doneCount = ALL_ITEM_IDS.filter((id) => checked.has(id)).length;
  const percent = Math.round((doneCount / totalItems) * 100);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <MobileNav />
        <div className="p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">App Testing Checklist</h1>
                <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 ml-1">
                  Internal
                </Badge>
              </div>
              <p className="text-sm text-gray-500">
                Track what's been tested as we build. Ticks are saved automatically in your browser.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={reset} className="flex items-center gap-1 shrink-0">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset all
            </Button>
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-xl border p-4 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall progress</span>
              <span className="text-sm font-semibold text-blue-700">
                {doneCount} / {totalItems} — {percent}%
              </span>
            </div>
            <Progress value={percent} className="h-3" />
            {percent === 100 && (
              <p className="text-xs text-green-600 font-medium mt-2">
                All items checked — great work!
              </p>
            )}
          </div>

          {/* Sections */}
          <div className="space-y-5">
            {CHECKLIST.map((section) => {
              const sectionIds = section.items.map((i) => i.id);
              const sectionDone = sectionIds.filter((id) => checked.has(id)).length;
              const allDone = sectionDone === sectionIds.length;

              return (
                <div key={section.section} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className={`px-4 py-3 flex items-center justify-between border-b ${allDone ? "bg-green-50" : "bg-gray-50"}`}>
                    <h2 className={`font-semibold text-sm ${allDone ? "text-green-700" : "text-gray-800"}`}>
                      {section.section}
                    </h2>
                    <Badge
                      variant="outline"
                      className={allDone
                        ? "bg-green-100 text-green-700 border-green-300"
                        : sectionDone > 0
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "text-gray-500 border-gray-200"}
                    >
                      {sectionDone}/{sectionIds.length}
                    </Badge>
                  </div>
                  <ul className="divide-y">
                    {section.items.map((item) => {
                      const done = checked.has(item.id);
                      return (
                        <li
                          key={item.id}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${done ? "opacity-60" : ""}`}
                          onClick={() => toggle(item.id)}
                        >
                          {done ? (
                            <CheckSquare className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-300 mt-0.5 shrink-0" />
                          )}
                          <span className={`text-sm leading-snug ${done ? "line-through text-gray-400" : "text-gray-700"}`}>
                            {item.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-400 text-center mt-8">
            Ticks are saved in your browser's local storage — they persist across refreshes but are browser-specific.
          </p>
        </div>
      </div>
    </div>
  );
}

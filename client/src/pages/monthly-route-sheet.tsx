import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import type { MonthlyServiceSequence, Department } from "@shared/schema";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function useQueryParams() {
  const [loc] = useLocation();
  const qs = loc.includes("?") ? loc.split("?")[1] : "";
  return new URLSearchParams(qs);
}

export default function MonthlyRouteSheet() {
  const params = useQueryParams();
  const now = new Date();
  const year = Number(params.get("year")) || now.getFullYear();
  const month = Number(params.get("month")) || now.getMonth() + 1;
  const deptFilter = params.get("dept") || "all";

  const { data: sequences = [] } = useQuery<MonthlyServiceSequence[]>({
    queryKey: ["/api/monthly-service-sequences"],
  });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);

  // Only include sequences that would actually fire in the selected month
  const firesInMonth = (freq: string) => {
    switch (freq) {
      case "Weekly":
      case "Fortnightly":
      case "Monthly":           return true;
      case "Every 2 Months":    return month % 2 === 1;
      case "Quarterly":         return month % 3 === 1;
      case "Once-off":          return false;
      default:                  return true;
    }
  };

  const filtered = useMemo(
    () => sequences
      .filter(s => s.activeStatus !== false)
      .filter(s => deptFilter === "all" || s.departmentId === deptFilter)
      .filter(s => firesInMonth(s.serviceFrequency)),
    [sequences, deptFilter, month]
  );

  const grouped = useMemo(() => {
    const m = new Map<number, Map<string, MonthlyServiceSequence[]>>();
    for (const s of filtered) {
      if (!m.has(s.serviceWeek)) m.set(s.serviceWeek, new Map());
      const dayMap = m.get(s.serviceWeek)!;
      if (!dayMap.has(s.serviceDay)) dayMap.set(s.serviceDay, []);
      dayMap.get(s.serviceDay)!.push(s);
    }
    for (const dm of m.values())
      for (const arr of dm.values()) arr.sort((a, b) => a.jobSequence - b.jobSequence);
    return m;
  }, [filtered]);

  const sortedWeeks = Array.from(grouped.keys()).sort((a, b) => a - b);
  const deptLabel = deptFilter === "all" ? "All Departments" : deptMap.get(deptFilter)?.name ?? deptFilter;

  return (
    <div className="min-h-screen bg-white">
      {/* Print-only style */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .page { padding: 0 !important; max-width: none !important; }
          @page { margin: 0.4in; size: A4 portrait; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          h2 { page-break-after: avoid; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print bg-gray-50 border-b px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <Link href="/monthly-sequence">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        </Link>
        <div className="flex-1" />
        <Button size="sm" onClick={() => window.print()} data-testid="button-print">
          <Printer className="h-4 w-4 mr-1.5" /> Print / Export PDF
        </Button>
      </div>

      <div className="page max-w-4xl mx-auto p-6">
        <header className="border-b-2 border-gray-900 pb-2 mb-4">
          <h1 className="text-xl font-bold">Monthly Route Sheet</h1>
          <p className="text-sm text-gray-600">
            {MONTHS[month - 1]} {year} · {deptLabel} ·
            {" "}{filtered.length} customer{filtered.length !== 1 ? "s" : ""}
          </p>
        </header>

        {sortedWeeks.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No active sequences for the selected filter.</p>
        ) : sortedWeeks.map(wk => {
          const dayMap = grouped.get(wk)!;
          const days = Array.from(dayMap.keys()).sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
          return (
            <section key={wk} className="mb-5">
              <h2 className="text-base font-bold bg-gray-100 px-3 py-1.5 border border-gray-300">Week {wk}</h2>
              {days.map(day => {
                const rows = dayMap.get(day)!;
                return (
                  <div key={day} className="mb-2">
                    <h3 className="text-sm font-semibold bg-gray-50 px-3 py-1 border-l border-r border-b border-gray-300">{day}</h3>
                    <table className="w-full text-xs border-l border-r border-b border-gray-300">
                      <thead className="bg-gray-50">
                        <tr className="text-left">
                          <th className="px-2 py-1 w-10 border-b border-gray-200">#</th>
                          <th className="px-2 py-1 border-b border-gray-200">Customer</th>
                          <th className="px-2 py-1 border-b border-gray-200">Address</th>
                          <th className="px-2 py-1 border-b border-gray-200">Technician / Team</th>
                          <th className="px-2 py-1 border-b border-gray-200">Department</th>
                          <th className="px-2 py-1 border-b border-gray-200">Maps</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(s => {
                          const d = deptMap.get(s.departmentId);
                          return (
                            <tr key={s.id} className="align-top">
                              <td className="px-2 py-1.5 border-b border-gray-100 font-bold">{s.jobSequence}</td>
                              <td className="px-2 py-1.5 border-b border-gray-100">
                                <div className="font-medium">{s.customerName}</div>
                                <div className="text-[10px] text-gray-500">
                                  {s.serviceType}
                                  {s.defaultStartTime ? ` · ${s.defaultStartTime}` : ""}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 border-b border-gray-100 text-gray-700">{s.address ?? "—"}</td>
                              <td className="px-2 py-1.5 border-b border-gray-100">
                                {s.assignedTechnicianName ?? s.assignedTeamName ?? <span className="text-gray-400">—</span>}
                              </td>
                              <td className="px-2 py-1.5 border-b border-gray-100">{d?.name ?? "—"}</td>
                              <td className="px-2 py-1.5 border-b border-gray-100">
                                {s.googleMapsLink
                                  ? <a href={s.googleMapsLink} target="_blank" rel="noreferrer" className="text-blue-700 underline">link</a>
                                  : <span className="text-gray-400">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </section>
          );
        })}

        <footer className="text-[10px] text-gray-400 mt-6 pt-2 border-t border-gray-200">
          Generated from Job Flow · Monthly Service Sequence · {new Date().toLocaleString()}
        </footer>
      </div>
    </div>
  );
}

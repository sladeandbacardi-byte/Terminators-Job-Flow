import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DepartmentOverview } from "./department-overview";
import { WorkerJobsSummary } from "./worker-jobs-summary";
import {
  Users, AlertTriangle, Package,
  ShoppingCart, CalendarDays, MapPin, Eye, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { Job, Worker, Client, PurchaseOrder, InventoryItem } from "@shared/schema";
import { format, subDays, isValid } from "date-fns";

type Range = "7" | "14" | "30";

function buildDailyData(days: number, jobs: Job[]) {
  const result = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(now, i);
    const dayStr = format(day, "yyyy-MM-dd");
    const label = format(day, days <= 7 ? "EEE" : "dd MMM");

    const dayJobs = jobs.filter(j => {
      if (!j.scheduledDate) return false;
      const d = new Date(j.scheduledDate);
      return isValid(d) && format(d, "yyyy-MM-dd") === dayStr;
    });

    result.push({
      label,
      totalJobs: dayJobs.length,
      completedJobs: dayJobs.filter(j => j.status === "completed").length,
    });
  }
  return result;
}

const RANGE_OPTIONS: { label: string; value: Range }[] = [
  { label: "7 Days", value: "7" },
  { label: "14 Days", value: "14" },
  { label: "30 Days", value: "30" },
];

export function ManagerDashboard() {
  const [range, setRange] = useState<Range>("14");

  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({ queryKey: ["/api/purchase-orders"] });
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ["/api/inventory"] });

  const todayDate = new Date();
  const today = todayDate.toDateString();
  const todaysJobs = jobs.filter(j => j.scheduledDate && new Date(j.scheduledDate).toDateString() === today);
  const completedToday = todaysJobs.filter(j => j.status === "completed");
  const notCompletedToday = todaysJobs.filter(j => j.status !== "completed" && j.status !== "cancelled");
  const overdueJobs = jobs.filter(j => {
    if (!j.scheduledDate || j.status === "completed" || j.status === "cancelled") return false;
    return new Date(j.scheduledDate) < new Date(todayDate.toDateString());
  });
  const unassignedJobs = jobs.filter(j => !j.workerId && j.status === "pending");
  const pendingPOs = purchaseOrders.filter(po => po.status === "pending");
  const lowStock = inventory.filter(i => i.quantity <= (i.minStockLevel ?? 0));

  const days = parseInt(range);
  const dailyData = buildDailyData(days, jobs);

  const jobStatusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-6">
      {/* Range toggle */}
      <div className="flex justify-end">
        <div className="flex gap-1">
          {RANGE_OPTIONS.map(opt => (
            <Button key={opt.value} size="sm" variant={range === opt.value ? "default" : "outline"}
              className="text-xs h-8 px-3" onClick={() => setRange(opt.value)}>
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ─── 2. Alert Cards (urgent operational items) ─────────────────────── */}
      {(pendingPOs.length > 0 || lowStock.length > 0 || overdueJobs.length > 0 ||
        notCompletedToday.length > 0 || unassignedJobs.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pendingPOs.length > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <ShoppingCart className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700">{pendingPOs.length} PO{pendingPOs.length > 1 ? "s" : ""} Awaiting Approval</p>
                <p className="text-xs text-amber-500">Review and approve purchase orders</p>
              </div>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <Package className="h-5 w-5 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-700">{lowStock.length} Low Stock Item{lowStock.length > 1 ? "s" : ""}</p>
                <p className="text-xs text-orange-500">Reorder before stock runs out</p>
              </div>
            </div>
          )}
          {overdueJobs.length > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">{overdueJobs.length} Overdue Job{overdueJobs.length > 1 ? "s" : ""}</p>
                <p className="text-xs text-red-500">Scheduled before today and not completed</p>
              </div>
            </div>
          )}
          {notCompletedToday.length > 0 && (
            <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">{notCompletedToday.length} Job{notCompletedToday.length > 1 ? "s" : ""} Not Completed Today</p>
                <p className="text-xs text-yellow-700">{completedToday.length} of {todaysJobs.length} done so far</p>
              </div>
            </div>
          )}
          {unassignedJobs.length > 0 && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4">
              <Users className="h-5 w-5 text-rose-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-rose-700">{unassignedJobs.length} Unassigned Job{unassignedJobs.length > 1 ? "s" : ""}</p>
                <p className="text-xs text-rose-500">Assign workers before scheduled date</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 3. Today's Schedule (with per-row actions) ─────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-500" /> Today's Schedule
            <span className="ml-auto text-xs font-normal text-gray-400">
              {completedToday.length}/{todaysJobs.length} completed
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todaysJobs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No jobs scheduled for today</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {todaysJobs.map(job => {
                const worker = workers.find(w => w.id === job.workerId);
                const client = clients.find(c => c.id === job.clientId);
                const timeStr = job.scheduledDate
                  ? new Date(job.scheduledDate).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })
                  : "—";
                return (
                  <div key={job.id} className="flex flex-col sm:flex-row sm:items-center gap-2 border rounded-lg px-3 py-2.5 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{client?.name ?? "Unknown Client"}</p>
                        <Badge className={`text-xs ${jobStatusColor[job.status ?? "pending"] ?? "bg-gray-100 text-gray-600"}`}>
                          {job.status?.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="font-medium">{timeStr}</span>
                        {" · "}
                        {worker ? worker.name : <span className="text-red-500">Unassigned</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link href={`/jobs?id=${job.id}`}>
                        <Button size="sm" variant="outline" className="h-8 text-xs">
                          <Eye className="h-3.5 w-3.5 mr-1" /> View Job
                        </Button>
                      </Link>
                      {job.googleMapsLink ? (
                        <a href={job.googleMapsLink} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-8 text-xs border-green-400 text-green-700 hover:bg-green-50">
                            <MapPin className="h-3.5 w-3.5 mr-1" /> Open Map
                          </Button>
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No map link</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 4. Jobs Per Worker ────────────────────────────────────────────── */}
      <WorkerJobsSummary />

      {/* ─── 5. Department Overview ────────────────────────────────────────── */}
      <DepartmentOverview />

      {/* ─── 6. Charts (moved to the bottom) ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Jobs Per Day — Last {range} Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
              <Tooltip formatter={(v: number, name: string) => [v, name === "completedJobs" ? "Completed" : "Scheduled"]} />
              <Legend formatter={(v) => v === "completedJobs" ? "Completed" : "Scheduled"} />
              <Bar dataKey="totalJobs" name="totalJobs" fill="#93c5fd" radius={[3, 3, 0, 0]} />
              <Bar dataKey="completedJobs" name="completedJobs" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  );
}

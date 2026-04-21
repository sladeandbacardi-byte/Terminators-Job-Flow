import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format, subDays, subMonths, subYears,
  addDays, addWeeks, addMonths,
  getWeek, getYear,
  startOfWeek, startOfMonth, startOfYear,
  endOfDay,
} from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  BarChart3, TrendingUp, FileText, Calendar as CalendarIcon,
  DollarSign, User, Target, Activity, CheckCircle2, Clock, AlertCircle
} from "lucide-react";
import { ExportButton } from "@/components/export-button";
import { exportAllData } from "@/lib/data-export";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Job, RentalContract, Worker, Department } from "@shared/schema";

// ─── Quick-preset helpers ─────────────────────────────────────────────────────
type Preset = '7d' | '30d' | '90d' | '6m' | 'ytd' | '1y' | 'custom';
const today = () => endOfDay(new Date());
const presetRange = (p: Preset): { from: Date; to: Date } => {
  const to = today();
  switch (p) {
    case '7d':  return { from: subDays(to, 6), to };
    case '30d': return { from: subDays(to, 29), to };
    case '90d': return { from: subDays(to, 89), to };
    case '6m':  return { from: subMonths(to, 6), to };
    case 'ytd': return { from: startOfYear(to), to };
    case '1y':  return { from: subYears(to, 1), to };
    default:    return { from: subDays(to, 29), to };
  }
};

type GroupBy = 'day' | 'week' | 'month' | 'year';

interface ChartBucket {
  label: string;
  sortKey: string;
  total: number;
  completed: number;
  inProgress: number;
  scheduled: number;
  cancelled: number;
}

function buildChartData(jobs: Job[], groupBy: GroupBy, from: Date, to: Date): ChartBucket[] {
  const buckets: Record<string, ChartBucket> = {};

  // Generate all empty buckets for the range so gaps show as 0
  let cursor = new Date(from);
  while (cursor <= to) {
    let sortKey: string;
    let label: string;
    switch (groupBy) {
      case 'day':
        sortKey = format(cursor, 'yyyy-MM-dd');
        label = format(cursor, 'd MMM');
        cursor = addDays(cursor, 1);
        break;
      case 'week': {
        const wk = String(getWeek(cursor)).padStart(2, '0');
        const yr = getYear(cursor);
        sortKey = `${yr}-W${wk}`;
        label = `W${wk} '${String(yr).slice(2)}`;
        cursor = addWeeks(cursor, 1);
        break;
      }
      case 'month':
        sortKey = format(cursor, 'yyyy-MM');
        label = format(cursor, 'MMM yy');
        cursor = addMonths(cursor, 1);
        break;
      case 'year':
        sortKey = format(cursor, 'yyyy');
        label = format(cursor, 'yyyy');
        cursor = new Date(cursor.getFullYear() + 1, 0, 1);
        break;
    }
    if (!buckets[sortKey]) {
      buckets[sortKey] = { label, sortKey, total: 0, completed: 0, inProgress: 0, scheduled: 0, cancelled: 0 };
    }
  }

  // Place jobs into buckets
  for (const job of jobs) {
    const d = new Date(job.scheduledDate);
    if (d < from || d > to) continue;
    let sortKey: string;
    switch (groupBy) {
      case 'day':   sortKey = format(d, 'yyyy-MM-dd'); break;
      case 'week':  sortKey = `${getYear(d)}-W${String(getWeek(d)).padStart(2, '0')}`; break;
      case 'month': sortKey = format(d, 'yyyy-MM'); break;
      case 'year':  sortKey = format(d, 'yyyy'); break;
    }
    if (!buckets[sortKey]) continue;
    buckets[sortKey].total++;
    if (job.status === 'completed')  buckets[sortKey].completed++;
    if (job.status === 'in_progress') buckets[sortKey].inProgress++;
    if (job.status === 'scheduled' || job.status === 'pending') buckets[sortKey].scheduled++;
    if (job.status === 'cancelled')  buckets[sortKey].cancelled++;
  }

  return Object.values(buckets).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export default function Reports() {
  // ── Existing overview / staff / contract state ────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [selectedStaffMember, setSelectedStaffMember] = useState<string>("");
  const [staffDateRange, setStaffDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  // ── Activity report state ─────────────────────────────────────────────────
  const [actPreset, setActPreset] = useState<Preset>('30d');
  const [actCustomRange, setActCustomRange] = useState<DateRange | undefined>();
  const [actGroupBy, setActGroupBy] = useState<GroupBy>('day');
  const [actDept, setActDept] = useState('all');
  const [actWorker, setActWorker] = useState('all');
  const [actStatus, setActStatus] = useState('all');

  const actRange = actPreset === 'custom' && actCustomRange?.from && actCustomRange?.to
    ? { from: actCustomRange.from, to: actCustomRange.to }
    : presetRange(actPreset);

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ['/api/jobs'] });
  const { data: contracts = [] } = useQuery<RentalContract[]>({ queryKey: ['/api/contracts'] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ['/api/workers'] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ['/api/departments'] });

  const { data: staffPerformance, isLoading: isLoadingStaffPerformance } = useQuery({
    queryKey: ['/api/reports/staff-performance', selectedStaffMember, staffDateRange?.from, staffDateRange?.to],
    queryFn: async () => {
      if (!selectedStaffMember || !staffDateRange?.from || !staffDateRange?.to) return null;
      const params = new URLSearchParams({
        startDate: staffDateRange.from.toISOString(),
        endDate: staffDateRange.to.toISOString(),
      });
      const response = await fetch(`/api/reports/staff-performance/${selectedStaffMember}?${params}`);
      if (!response.ok) throw new Error('Failed to fetch staff performance');
      return response.json();
    },
    enabled: !!selectedStaffMember && !!staffDateRange?.from && !!staffDateRange?.to,
  });

  // ── Overview calculations ─────────────────────────────────────────────────
  const filteredJobs = jobs.filter(job => {
    if (!dateRange?.from || !dateRange?.to) return true;
    const d = new Date(job.scheduledDate);
    return d >= dateRange.from && d <= dateRange.to;
  });

  const jobStats = {
    total: filteredJobs.length,
    completed: filteredJobs.filter(j => j.status === 'completed').length,
    inProgress: filteredJobs.filter(j => j.status === 'in_progress').length,
    pending: filteredJobs.filter(j => j.status === 'pending').length,
    cancelled: filteredJobs.filter(j => j.status === 'cancelled').length,
  };

  const departmentStats = departments.map(dept => {
    const dJobs = filteredJobs.filter(j => j.departmentId === dept.id);
    return {
      department: dept,
      jobCount: dJobs.length,
      completedJobs: dJobs.filter(j => j.status === 'completed').length,
      activeWorkers: workers.filter(w => w.departmentId === dept.id && w.isActive).length,
      completionRate: dJobs.length > 0 ? Math.round((dJobs.filter(j => j.status === 'completed').length / dJobs.length) * 100) : 0,
    };
  });

  const workerStats = workers.map(worker => {
    const wJobs = filteredJobs.filter(j => j.workerId === worker.id);
    return {
      worker,
      department: departments.find(d => d.id === worker.departmentId),
      jobCount: wJobs.length,
      completedJobs: wJobs.filter(j => j.status === 'completed').length,
      completionRate: wJobs.length > 0 ? Math.round((wJobs.filter(j => j.status === 'completed').length / wJobs.length) * 100) : 0,
    };
  }).sort((a, b) => b.jobCount - a.jobCount);

  const activeContracts = contracts.filter(c => c.isActive);
  const expiringContracts = contracts.filter(c => {
    if (!c.endDate || !c.isActive) return false;
    const end = new Date(c.endDate);
    const soon = new Date(); soon.setDate(soon.getDate() + 30);
    return end <= soon;
  });
  const totalMonthlyRevenue = activeContracts.reduce((s, c) => s + Number(c.monthlyPrice), 0);

  // ── Activity report calculations ──────────────────────────────────────────
  const activityJobs = useMemo(() => jobs.filter(j => {
    const d = new Date(j.scheduledDate);
    if (d < actRange.from || d > actRange.to) return false;
    if (actDept !== 'all' && j.departmentId !== actDept) return false;
    if (actWorker !== 'all' && j.workerId !== actWorker) return false;
    if (actStatus !== 'all' && j.status !== actStatus) return false;
    return true;
  }), [jobs, actRange, actDept, actWorker, actStatus]);

  const chartData = useMemo(
    () => buildChartData(activityJobs, actGroupBy, actRange.from, actRange.to),
    [activityJobs, actGroupBy, actRange]
  );

  const actStats = useMemo(() => ({
    total: activityJobs.length,
    completed: activityJobs.filter(j => j.status === 'completed').length,
    inProgress: activityJobs.filter(j => j.status === 'in_progress').length,
    scheduled: activityJobs.filter(j => j.status === 'scheduled' || j.status === 'pending').length,
    cancelled: activityJobs.filter(j => j.status === 'cancelled').length,
    avgPerBucket: chartData.length > 0 ? (activityJobs.length / chartData.filter(b => b.total > 0).length || 1).toFixed(1) : '0',
    busiest: chartData.reduce((best, b) => b.total > best.total ? b : best, { label: '—', total: 0, sortKey: '', completed: 0, inProgress: 0, scheduled: 0, cancelled: 0 }),
  }), [activityJobs, chartData]);

  // Workers filtered to chosen department for the worker dropdown
  const filteredWorkers = actDept === 'all' ? workers : workers.filter(w => w.departmentId === actDept);

  const presetLabel = (p: Preset) => ({ '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', '6m': 'Last 6 months', 'ytd': 'Year to date', '1y': 'Last year', 'custom': 'Custom' }[p]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reports & Analytics" />

        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          {/* Global date range (for overview tabs) */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Business Reports</h3>
              <p className="text-sm text-gray-600">Analyse performance and generate insights for your business</p>
            </div>
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[260px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (dateRange.to ? <>{formatDate(dateRange.from)} – {formatDate(dateRange.to)}</> : formatDate(dateRange.from)) : <span>Pick a date range</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                </PopoverContent>
              </Popover>
              <ExportButton onExportCSV={() => exportAllData()} entityName="All Business Data" variant="default" />
            </div>
          </div>

          <Tabs defaultValue="activity" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="jobs">Job Status</TabsTrigger>
              <TabsTrigger value="workers">Workers</TabsTrigger>
              <TabsTrigger value="staff">Staff</TabsTrigger>
              <TabsTrigger value="contracts">Contracts</TabsTrigger>
            </TabsList>

            {/* ═══════════════════════════════════════════════════════════════════
                ACTIVITY REPORT TAB
            ═══════════════════════════════════════════════════════════════════ */}
            <TabsContent value="activity" className="space-y-5">

              {/* ── Filters row ─────────────────────────────────────────────── */}
              <Card>
                <CardContent className="pt-5">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

                    {/* Date preset */}
                    <div className="col-span-2 md:col-span-1">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Period</label>
                      <Select value={actPreset} onValueChange={(v) => { setActPreset(v as Preset); }}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(['7d','30d','90d','6m','ytd','1y','custom'] as Preset[]).map(p => (
                            <SelectItem key={p} value={p}>{presetLabel(p)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom range picker — shown only when preset = custom */}
                    {actPreset === 'custom' && (
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Custom Range</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="h-9 w-full justify-start text-sm font-normal">
                              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                              {actCustomRange?.from ? (actCustomRange.to ? <>{formatDate(actCustomRange.from)} – {formatDate(actCustomRange.to)}</> : formatDate(actCustomRange.from)) : 'Pick dates'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0"><Calendar initialFocus mode="range" selected={actCustomRange} onSelect={setActCustomRange} numberOfMonths={2} /></PopoverContent>
                        </Popover>
                      </div>
                    )}

                    {/* Group by */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Group by</label>
                      <div className="flex rounded-md border overflow-hidden h-9">
                        {(['day','week','month','year'] as GroupBy[]).map(g => (
                          <button
                            key={g}
                            onClick={() => setActGroupBy(g)}
                            className={cn(
                              "flex-1 text-xs font-medium transition-colors border-r last:border-r-0 capitalize",
                              actGroupBy === g ? "bg-primary text-white" : "bg-white hover:bg-gray-50 text-gray-600"
                            )}
                          >{g}</button>
                        ))}
                      </div>
                    </div>

                    {/* Department */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Department</label>
                      <Select value={actDept} onValueChange={(v) => { setActDept(v); setActWorker('all'); }}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All departments</SelectItem>
                          {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Worker */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Service person</label>
                      <Select value={actWorker} onValueChange={setActWorker}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All staff</SelectItem>
                          {filteredWorkers.filter(w => w.isActive).map(w => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
                      <Select value={actStatus} onValueChange={setActStatus}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Active filter summary */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">
                      {formatDate(actRange.from)} – {formatDate(actRange.to)}
                    </Badge>
                    {actDept !== 'all' && <Badge variant="secondary" className="text-xs">{departments.find(d => d.id === actDept)?.name}</Badge>}
                    {actWorker !== 'all' && <Badge variant="secondary" className="text-xs">{workers.find(w => w.id === actWorker)?.name}</Badge>}
                    {actStatus !== 'all' && <Badge variant="secondary" className="text-xs capitalize">{actStatus.replace('_', ' ')}</Badge>}
                  </div>
                </CardContent>
              </Card>

              {/* ── KPI row ──────────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total Jobs', value: actStats.total, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Completed', value: actStats.completed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'In Progress', value: actStats.inProgress, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50' },
                  { label: 'Scheduled', value: actStats.scheduled, icon: CalendarIcon, color: 'text-gray-500', bg: 'bg-gray-100' },
                  { label: 'Cancelled', value: actStats.cancelled, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
                  { label: `Avg / ${actGroupBy}`, value: actStats.avgPerBucket, icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className={cn("rounded-lg border p-4", bg)}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={cn("h-4 w-4", color)} />
                      <span className="text-xs font-medium text-gray-500">{label}</span>
                    </div>
                    <p className={cn("text-2xl font-bold", color)}>{value}</p>
                  </div>
                ))}
              </div>

              {/* ── Main bar chart ─────────────────────────────────────────────── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    Jobs per {actGroupBy}
                    {actDept !== 'all' && ` — ${departments.find(d => d.id === actDept)?.name}`}
                    {actWorker !== 'all' && ` — ${workers.find(w => w.id === actWorker)?.name}`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                      <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">No jobs found for the selected filters.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData} margin={{ top: 4, right: 16, left: -10, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(value: number, name: string) => [value, name.replace(/([A-Z])/g, ' $1').trim()]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {actStatus === 'all' ? (
                          <>
                            <Bar dataKey="completed"  name="Completed"   fill="#22c55e" stackId="s" radius={[0,0,0,0]} />
                            <Bar dataKey="inProgress" name="In Progress" fill="#f97316" stackId="s" />
                            <Bar dataKey="scheduled"  name="Scheduled"   fill="#94a3b8" stackId="s" />
                            <Bar dataKey="cancelled"  name="Cancelled"   fill="#ef4444" stackId="s" radius={[4,4,0,0]} />
                          </>
                        ) : (
                          <Bar dataKey="total" name="Jobs" fill="#3b82f6" radius={[4,4,0,0]} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* ── Per-department breakdown chart ────────────────────────────── */}
              {actDept === 'all' && actStatus === 'all' && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-500" />
                      Jobs by Department — {presetLabel(actPreset)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={departments.map(dept => {
                          const dJobs = activityJobs.filter(j => j.departmentId === dept.id);
                          return {
                            name: dept.name,
                            Completed: dJobs.filter(j => j.status === 'completed').length,
                            "In Progress": dJobs.filter(j => j.status === 'in_progress').length,
                            Scheduled: dJobs.filter(j => j.status === 'scheduled' || j.status === 'pending').length,
                            Cancelled: dJobs.filter(j => j.status === 'cancelled').length,
                            color: dept.colorCode,
                          };
                        })}
                        margin={{ top: 4, right: 16, left: -10, bottom: 4 }}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="Completed"   fill="#22c55e" stackId="d" />
                        <Bar dataKey="In Progress" fill="#f97316" stackId="d" />
                        <Bar dataKey="Scheduled"   fill="#94a3b8" stackId="d" />
                        <Bar dataKey="Cancelled"   fill="#ef4444" stackId="d" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* ── Detailed breakdown table ──────────────────────────────────── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Period Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          <th className="text-left px-4 py-2.5">Period</th>
                          <th className="text-center px-3 py-2.5">Total</th>
                          <th className="text-center px-3 py-2.5 text-green-600">Done</th>
                          <th className="text-center px-3 py-2.5 text-orange-500">Active</th>
                          <th className="text-center px-3 py-2.5 text-gray-500">Sched.</th>
                          <th className="text-center px-3 py-2.5 text-red-500">Cancel.</th>
                          <th className="text-right px-4 py-2.5">Completion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {chartData.length === 0 && (
                          <tr><td colSpan={7} className="text-center py-8 text-gray-400">No data</td></tr>
                        )}
                        {chartData.map(row => {
                          const pct = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
                          return (
                            <tr key={row.sortKey} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 font-medium">{row.label}</td>
                              <td className="text-center px-3 py-2.5 font-semibold">{row.total}</td>
                              <td className="text-center px-3 py-2.5 text-green-700">{row.completed}</td>
                              <td className="text-center px-3 py-2.5 text-orange-600">{row.inProgress}</td>
                              <td className="text-center px-3 py-2.5 text-gray-500">{row.scheduled}</td>
                              <td className="text-center px-3 py-2.5 text-red-600">{row.cancelled}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-20 bg-gray-100 rounded-full h-1.5">
                                    <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {chartData.length > 0 && (
                        <tfoot>
                          <tr className="bg-gray-50 font-semibold text-gray-700 border-t-2">
                            <td className="px-4 py-2.5">Total</td>
                            <td className="text-center px-3 py-2.5">{actStats.total}</td>
                            <td className="text-center px-3 py-2.5 text-green-700">{actStats.completed}</td>
                            <td className="text-center px-3 py-2.5 text-orange-600">{actStats.inProgress}</td>
                            <td className="text-center px-3 py-2.5 text-gray-500">{actStats.scheduled}</td>
                            <td className="text-center px-3 py-2.5 text-red-600">{actStats.cancelled}</td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-500">
                              {actStats.total > 0 ? Math.round((actStats.completed / actStats.total) * 100) : 0}% overall
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════════════
                OVERVIEW TAB
            ═══════════════════════════════════════════════════════════════════ */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{jobStats.total}</div>
                    <p className="text-xs text-muted-foreground">In selected period</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{jobStats.total > 0 ? Math.round((jobStats.completed / jobStats.total) * 100) : 0}%</div>
                    <p className="text-xs text-muted-foreground">{jobStats.completed} of {jobStats.total} jobs completed</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{activeContracts.length}</div>
                    <p className="text-xs text-muted-foreground">{expiringContracts.length} expiring soon</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalMonthlyRevenue)}</div>
                    <p className="text-xs text-muted-foreground">From rental contracts</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle>Department Performance</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {departmentStats.map(stat => (
                      <div key={stat.department.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: stat.department.colorCode }} />
                          <div>
                            <h4 className="font-medium">{stat.department.name}</h4>
                            <p className="text-sm text-gray-600">{stat.activeWorkers} active workers</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">{stat.jobCount} jobs</p>
                          <Badge variant="secondary">{stat.completionRate}% complete</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════════════
                JOB STATUS TAB
            ═══════════════════════════════════════════════════════════════════ */}
            <TabsContent value="jobs" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card><CardHeader><CardTitle className="text-lg text-green-600">Completed</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{jobStats.completed}</div></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-lg text-orange-600">In Progress</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{jobStats.inProgress}</div></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-lg text-gray-600">Pending</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{jobStats.pending}</div></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-lg text-red-600">Cancelled</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{jobStats.cancelled}</div></CardContent></Card>
              </div>
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════════════
                WORKER PERFORMANCE TAB
            ═══════════════════════════════════════════════════════════════════ */}
            <TabsContent value="workers" className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Worker Performance Rankings</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {workerStats.slice(0, 10).map((stat, index) => (
                      <div key={stat.worker.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-primary-700">#{index + 1}</span>
                          </div>
                          <div>
                            <h4 className="font-medium">{stat.worker.name}</h4>
                            <p className="text-sm text-gray-600">{stat.department?.name || 'Office'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">{stat.jobCount} jobs</p>
                          <Badge variant="secondary">{stat.completionRate}% complete</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════════════
                STAFF ANALYSIS TAB
            ═══════════════════════════════════════════════════════════════════ */}
            <TabsContent value="staff" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Individual Staff Performance</CardTitle>
                  <p className="text-sm text-muted-foreground">Select a staff member and date range to view detailed metrics</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Select Staff Member</label>
                      <Select value={selectedStaffMember} onValueChange={setSelectedStaffMember}>
                        <SelectTrigger><SelectValue placeholder="Choose a staff member" /></SelectTrigger>
                        <SelectContent>
                          {workers.filter(w => w.isActive).sort((a, b) => a.name.localeCompare(b.name)).map(worker => {
                            const dept = departments.find(d => d.id === worker.departmentId);
                            return <SelectItem key={worker.id} value={worker.id}>{worker.name}{dept ? ` (${dept.name})` : ''}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Date Range</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !staffDateRange && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {staffDateRange?.from ? (staffDateRange.to ? <>{formatDate(staffDateRange.from)} – {formatDate(staffDateRange.to)}</> : formatDate(staffDateRange.from)) : <span>Pick date range</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar initialFocus mode="range" defaultMonth={staffDateRange?.from} selected={staffDateRange} onSelect={setStaffDateRange} numberOfMonths={2} /></PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {isLoadingStaffPerformance && selectedStaffMember && (
                    <div className="text-center py-8"><p className="text-muted-foreground">Loading performance data...</p></div>
                  )}

                  {staffPerformance && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Jobs</CardTitle><Target className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{staffPerformance.totalJobs}</div><p className="text-xs text-muted-foreground">{staffPerformance.completedJobs} completed</p></CardContent></Card>
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Sales</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">R {parseFloat(staffPerformance.totalSales).toLocaleString()}</div><p className="text-xs text-muted-foreground">From products & services</p></CardContent></Card>
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Average Sales</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">R {parseFloat(staffPerformance.averageSalesPerJob).toLocaleString()}</div><p className="text-xs text-muted-foreground">Per job</p></CardContent></Card>
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Completion Rate</CardTitle><BarChart3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{staffPerformance.completionRate}%</div><p className="text-xs text-muted-foreground">Job completion</p></CardContent></Card>
                      </div>
                      <Card>
                        <CardHeader><CardTitle>Job Status Breakdown</CardTitle></CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-green-50 rounded-lg"><div className="text-2xl font-bold text-green-700">{staffPerformance.completedJobs}</div><div className="text-sm text-green-600">Completed</div></div>
                            <div className="text-center p-4 bg-blue-50 rounded-lg"><div className="text-2xl font-bold text-blue-700">{staffPerformance.inProgressJobs}</div><div className="text-sm text-blue-600">In Progress</div></div>
                            <div className="text-center p-4 bg-yellow-50 rounded-lg"><div className="text-2xl font-bold text-yellow-700">{staffPerformance.pendingJobs}</div><div className="text-sm text-yellow-600">Pending</div></div>
                            <div className="text-center p-4 bg-red-50 rounded-lg"><div className="text-2xl font-bold text-red-700">{staffPerformance.cancelledJobs}</div><div className="text-sm text-red-600">Cancelled</div></div>
                          </div>
                        </CardContent>
                      </Card>
                      {staffPerformance.jobs?.length > 0 && (
                        <Card>
                          <CardHeader><CardTitle>Recent Jobs in Date Range</CardTitle><p className="text-sm text-muted-foreground">Showing {Math.min(10, staffPerformance.jobs.length)} of {staffPerformance.jobs.length} jobs</p></CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {staffPerformance.jobs.slice(0, 10).map((job: any) => (
                                <div key={job.id} className="flex justify-between items-center p-3 border rounded">
                                  <div><p className="font-medium">{job.title}</p><p className="text-sm text-muted-foreground">{formatDate(job.scheduledDate)} · {job.serviceType}</p></div>
                                  <Badge variant={job.status === 'completed' ? 'default' : job.status === 'in_progress' ? 'secondary' : job.status === 'cancelled' ? 'destructive' : 'outline'}>{job.status.replace('_', ' ')}</Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                  {!selectedStaffMember && <div className="text-center py-8"><p className="text-muted-foreground">Select a staff member to view their performance metrics.</p></div>}
                  {selectedStaffMember && staffDateRange?.from && staffDateRange?.to && !isLoadingStaffPerformance && !staffPerformance && <div className="text-center py-8"><p className="text-muted-foreground">No data found for the selected period.</p></div>}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════════════
                CONTRACTS TAB
            ═══════════════════════════════════════════════════════════════════ */}
            <TabsContent value="contracts" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle>Contract Summary</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between"><span>Total Contracts:</span><span className="font-semibold">{contracts.length}</span></div>
                    <div className="flex justify-between"><span>Active Contracts:</span><span className="font-semibold text-green-600">{activeContracts.length}</span></div>
                    <div className="flex justify-between"><span>Expiring Soon:</span><span className="font-semibold text-orange-600">{expiringContracts.length}</span></div>
                    <div className="flex justify-between border-t pt-4"><span>Monthly Revenue:</span><span className="font-bold text-lg">{formatCurrency(totalMonthlyRevenue)}</span></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Expiring Contracts</CardTitle></CardHeader>
                  <CardContent>
                    {expiringContracts.length === 0 ? <p className="text-gray-600">No contracts expiring in the next 30 days</p> : (
                      <div className="space-y-3">
                        {expiringContracts.slice(0, 5).map(contract => (
                          <div key={contract.id} className="flex justify-between items-center p-3 border rounded">
                            <div><p className="font-medium">Contract #{contract.id.slice(-6)}</p><p className="text-sm text-gray-600">{formatCurrency(Number(contract.monthlyPrice))}/month</p></div>
                            <Badge variant="destructive">{contract.endDate && formatDate(contract.endDate)}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

          </Tabs>
        </main>
      </div>

      <MobileNavigation />
    </div>
  );
}

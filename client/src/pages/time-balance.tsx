import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { ArrowDown, ArrowUp, CalendarDays, Clock3, Download, Minus, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNetTimeDifference, formatOvertimeMinutes } from "@shared/overtime";
import type { Department, Worker } from "@shared/schema";
import { exportTimeBalanceReport } from "@/lib/data-export";
import { apiRequest } from "@/lib/queryClient";

type Period = "this-month" | "this-week" | "previous-month" | "this-year" | "custom";
type SortKey = "employee" | "overtime" | "timeOff" | "positive" | "negative";

type BalanceRow = {
  employeeId: string;
  name: string;
  departmentId: string | null;
  departmentName: string;
  approvedOvertimeMinutes: number;
  approvedTimeOffMinutes: number;
  pendingOvertimeMinutes: number;
  pendingTimeOffMinutes: number;
  transactionCount: number;
  netMinutes: number;
  attendanceDays: number;
  averageStartMinutes: number | null;
  averageStart: string | null;
  lateStarts: number;
  earlyFinishes: number;
  vehicleKmTravelled: number;
};

type Transaction = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  entryType: "OVERTIME" | "AUTHORISED_TIME_OFF";
  typeLabel: string;
  clientName: string;
  jobId: string | null;
  jobLabel: string | null;
  startTime: string;
  finishTime: string;
  minutes: number;
  displayDuration: string;
  status: "approved" | "pending";
  approver: string | null;
  approvalDate: string | null;
  reason: string;
  notes: string;
  balanceImpactMinutes: number;
  runningBalanceMinutes: number;
};

type Report = {
  period: { from: string; to: string };
  rows: BalanceRow[];
  totals: {
    approvedOvertimeMinutes: number;
    approvedTimeOffMinutes: number;
    netMinutes: number;
    pendingOvertimeMinutes: number;
    pendingTimeOffMinutes: number;
    pendingMinutes: number;
    employeesOver: number;
    employeesUnder: number;
    employeesBalanced: number;
    employeeCount: number;
  };
  pending: { overtimeMinutes: number; timeOffMinutes: number; totalMinutes: number };
  selectedEmployee: (BalanceRow & { openingBalanceMinutes: number | null; closingBalanceMinutes: number }) | null;
  transactions: Transaction[];
};

const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const beginningOfWeek = (date: Date) => {
  const result = new Date(date);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
};
const periodDates = (period: Period): { from: string; to: string } => {
  const today = new Date();
  const end = dateValue(today);
  if (period === "this-week") return { from: dateValue(beginningOfWeek(today)), to: end };
  if (period === "previous-month") {
    return {
      from: dateValue(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to: dateValue(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }
  if (period === "this-year") return { from: `${today.getFullYear()}-01-01`, to: end };
  return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`, to: end };
};
const periodLabels: Record<Period, string> = {
  "this-month": "This Month",
  "this-week": "This Week",
  "previous-month": "Previous Month",
  "this-year": "This Year",
  custom: "Custom Date Range",
};
const netClass = (minutes: number) => minutes > 0 ? "text-emerald-700" : minutes < 0 ? "text-red-700" : "text-slate-600";
const netBackground = (minutes: number) => minutes > 0 ? "bg-emerald-50 border-emerald-200" : minutes < 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200";

export default function TimeBalance() {
  const search = useSearch();
  const initialEmployee = new URLSearchParams(search).get("employeeId") || "all";
  const [period, setPeriod] = useState<Period>("this-month");
  const [from, setFrom] = useState(() => periodDates("this-month").from);
  const [to, setTo] = useState(() => periodDates("this-month").to);
  const [employeeId, setEmployeeId] = useState(initialEmployee);
  const [departmentId, setDepartmentId] = useState("all");
  const [sort, setSort] = useState<SortKey>("employee");
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(initialEmployee !== "all" ? initialEmployee : null);
  const [openingBalance, setOpeningBalance] = useState("");

  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const activeWorkers = useMemo(() => workers.filter(worker => worker.isActive !== false), [workers]);

  const reportUrl = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (employeeId !== "all") params.set("employeeId", employeeId);
    if (departmentId !== "all") params.set("departmentId", departmentId);
    return `/api/reports/time-balance?${params.toString()}`;
  }, [departmentId, employeeId, from, to]);
  const { data: report, isLoading, isError } = useQuery<Report>({
    queryKey: ["time-balance", reportUrl],
    queryFn: async () => (await apiRequest("GET", reportUrl)).json(),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const detailUrl = useMemo(() => {
    if (!detailEmployeeId) return "";
    const params = new URLSearchParams({ from, to, employeeId: detailEmployeeId });
    if (departmentId !== "all") params.set("departmentId", departmentId);
    return `/api/reports/time-balance?${params.toString()}`;
  }, [departmentId, detailEmployeeId, from, to]);
  const { data: detailReport, isLoading: detailLoading } = useQuery<Report>({
    queryKey: ["time-balance", detailUrl],
    queryFn: async () => (await apiRequest("GET", detailUrl)).json(),
    enabled: Boolean(detailUrl),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (period !== "custom") {
      const dates = periodDates(period);
      setFrom(dates.from);
      setTo(dates.to);
    }
  }, [period]);
  useEffect(() => setOpeningBalance(""), [detailEmployeeId]);

  const sortedRows = useMemo(() => {
    if (!report) return [];
    return [...report.rows].sort((a, b) => {
      if (sort === "employee") return a.name.localeCompare(b.name);
      if (sort === "overtime") return b.approvedOvertimeMinutes - a.approvedOvertimeMinutes || a.name.localeCompare(b.name);
      if (sort === "timeOff") return b.approvedTimeOffMinutes - a.approvedTimeOffMinutes || a.name.localeCompare(b.name);
      if (sort === "positive") return b.netMinutes - a.netMinutes || a.name.localeCompare(b.name);
      return a.netMinutes - b.netMinutes || a.name.localeCompare(b.name);
    });
  }, [report, sort]);

  const chooseEmployee = (id: string) => {
    setDetailEmployeeId(id);
  };
  const handlePeriodChange = (value: Period) => {
    setPeriod(value);
    if (value !== "custom") {
      const dates = periodDates(value);
      setFrom(dates.from);
      setTo(dates.to);
    }
  };
  const detail = detailReport?.selectedEmployee;
  const detailTransactions = detailReport?.transactions || [];
  const parsedOpeningBalance = Number(openingBalance);
  const openingBalanceMinutes = openingBalance.trim() === "" || !Number.isFinite(parsedOpeningBalance) ? null : Math.round(parsedOpeningBalance);
  const closingBalanceMinutes = (openingBalanceMinutes || 0) + (detail?.netMinutes || 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-red-700"><Clock3 className="h-5 w-5" /> Management report</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Staff Time Balance</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Approved Overtime less approved Authorised Time Off, calculated in whole minutes. Pending records never change the balance.</p>
        </div>
        {report && <Button variant="outline" onClick={() => exportTimeBalanceReport(report)}><Download className="mr-2 h-4 w-4" />Export CSV</Button>}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Period</label>
            <Select value={period} onValueChange={value => handlePeriodChange(value as Period)}>
              <SelectTrigger aria-label="Time balance period"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(periodLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {period === "custom" && <>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">From<input aria-label="Time balance from date" type="date" value={from} onChange={event => setFrom(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">To<input aria-label="Time balance to date" type="date" value={to} min={from} onChange={event => setTo(event.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900" /></label>
          </>}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</label>
            <Select value={employeeId} onValueChange={value => { setEmployeeId(value); setDetailEmployeeId(value === "all" ? null : value); }}>
              <SelectTrigger aria-label="Filter time balance by employee"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All employees</SelectItem>{activeWorkers.map(worker => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Department</label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger aria-label="Filter time balance by department"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All departments</SelectItem>{departments.map(department => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">Loading staff time balances…</div> : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center text-sm text-red-700">Could not load the time balance report. Please try again.</div>
      ) : report && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <SummaryCard label="Approved Overtime" value={formatOvertimeMinutes(report.totals.approvedOvertimeMinutes)} icon={<ArrowUp className="h-4 w-4 text-emerald-600" />} className="border-emerald-200 bg-emerald-50" />
          <SummaryCard label="Approved Time Off" value={formatOvertimeMinutes(report.totals.approvedTimeOffMinutes)} icon={<ArrowDown className="h-4 w-4 text-red-600" />} className="border-red-200 bg-red-50" />
          <SummaryCard label="Net Staff Balance" value={formatNetTimeDifference(report.totals.netMinutes)} icon={<Clock3 className="h-4 w-4 text-slate-600" />} className={netBackground(report.totals.netMinutes)} valueClass={netClass(report.totals.netMinutes)} />
          <SummaryCard label="Employees Over" value={String(report.totals.employeesOver)} icon={<ArrowUp className="h-4 w-4 text-emerald-600" />} className="border-emerald-200 bg-emerald-50" />
          <SummaryCard label="Employees Under" value={String(report.totals.employeesUnder)} icon={<ArrowDown className="h-4 w-4 text-red-600" />} className="border-red-200 bg-red-50" />
          <SummaryCard label="Balanced" value={String(report.totals.employeesBalanced)} icon={<Minus className="h-4 w-4 text-slate-500" />} className="border-slate-200 bg-slate-50" />
        </div>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold text-amber-900">Pending amounts (not included in balance)</p><p className="text-xs text-amber-800">Pending records remain visible for context; rejected records are excluded from this report.</p></div>
            <div className="flex gap-4 text-sm font-semibold text-amber-900"><span>Overtime {formatOvertimeMinutes(report.pending.overtimeMinutes)}</span><span>Time Off {formatOvertimeMinutes(report.pending.timeOffMinutes)}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-slate-500" />Employee summary</CardTitle><p className="mt-1 text-sm text-slate-500">{report.rows.length} employee{report.rows.length === 1 ? "" : "s"} in this period and filter.</p></div>
            <Select value={sort} onValueChange={value => setSort(value as SortKey)}><SelectTrigger className="w-full sm:w-[210px]" aria-label="Sort employee balances"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="employee">Sort by employee</SelectItem><SelectItem value="overtime">Sort by overtime</SelectItem><SelectItem value="timeOff">Sort by Time Off</SelectItem><SelectItem value="positive">Highest positive balance</SelectItem><SelectItem value="negative">Most negative balance</SelectItem></SelectContent></Select>
          </CardHeader>
          <CardContent className="p-0">
            {!sortedRows.length ? <div className="p-10 text-center text-sm text-slate-500"><CalendarDays className="mx-auto mb-2 h-8 w-8 text-slate-300" />No employee time records for the selected filters.</div> : <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead className="text-right">Approved Overtime</TableHead><TableHead className="text-right">Approved Time Off</TableHead><TableHead className="text-right">Pending Overtime</TableHead><TableHead className="text-right">Pending Time Off</TableHead><TableHead className="text-right">Net Balance</TableHead><TableHead className="text-right"> </TableHead></TableRow></TableHeader>
                  <TableBody>{sortedRows.map(row => <TableRow key={row.employeeId} className="cursor-pointer hover:bg-slate-50" onClick={() => chooseEmployee(row.employeeId)}>
                    <TableCell className="font-semibold text-slate-900">{row.name}</TableCell><TableCell className="text-slate-600">{row.departmentName}</TableCell>
                    <TableCell className="text-right font-medium text-emerald-700">{formatOvertimeMinutes(row.approvedOvertimeMinutes)}</TableCell><TableCell className="text-right font-medium text-red-700">{formatOvertimeMinutes(row.approvedTimeOffMinutes)}</TableCell><TableCell className="text-right text-amber-700">{formatOvertimeMinutes(row.pendingOvertimeMinutes)}</TableCell><TableCell className="text-right text-amber-700">{formatOvertimeMinutes(row.pendingTimeOffMinutes)}</TableCell>
                    <TableCell className={`text-right text-base font-bold ${netClass(row.netMinutes)}`}>{formatNetTimeDifference(row.netMinutes)}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={event => { event.stopPropagation(); chooseEmployee(row.employeeId); }}>View Details</Button></TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>
              <div className="divide-y md:hidden">{sortedRows.map(row => <article key={row.employeeId} className="space-y-3 p-4" onClick={() => chooseEmployee(row.employeeId)}>
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{row.name}</p><p className="text-xs text-slate-500">{row.departmentName}</p></div><span className={`rounded-full border px-2.5 py-1 text-sm font-bold ${netBackground(row.netMinutes)} ${netClass(row.netMinutes)}`}>{formatNetTimeDifference(row.netMinutes)}</span></div>
                <div className="grid grid-cols-2 gap-2 text-xs"><Metric label="Approved Overtime" value={formatOvertimeMinutes(row.approvedOvertimeMinutes)} className="text-emerald-700" /><Metric label="Approved Time Off" value={formatOvertimeMinutes(row.approvedTimeOffMinutes)} className="text-red-700" /><Metric label="Pending Overtime" value={formatOvertimeMinutes(row.pendingOvertimeMinutes)} className="text-amber-700" /><Metric label="Pending Time Off" value={formatOvertimeMinutes(row.pendingTimeOffMinutes)} className="text-amber-700" /></div>
                <Button variant="outline" size="sm" className="w-full" onClick={event => { event.stopPropagation(); chooseEmployee(row.employeeId); }}>View Details</Button>
              </article>)}</div>
            </>}
          </CardContent>
        </Card>
      </>}

      <Dialog open={Boolean(detailEmployeeId)} onOpenChange={open => !open && setDetailEmployeeId(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center justify-between gap-3 pr-6"><span>{detail?.name || "Employee"} — Time Details</span><Badge variant="outline">{from} – {to}</Badge></DialogTitle></DialogHeader>
          {detailLoading || !detail ? <p className="py-10 text-center text-sm text-slate-500">Loading employee time details…</p> : <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <DetailMetric label="Approved Overtime" value={formatOvertimeMinutes(detail.approvedOvertimeMinutes)} className="text-emerald-700" />
              <DetailMetric label="Approved Time Off" value={formatOvertimeMinutes(detail.approvedTimeOffMinutes)} className="text-red-700" />
              <DetailMetric label="Pending Overtime" value={formatOvertimeMinutes(detail.pendingOvertimeMinutes)} className="text-amber-700" />
              <DetailMetric label="Pending Time Off" value={formatOvertimeMinutes(detail.pendingTimeOffMinutes)} className="text-amber-700" />
                <DetailMetric label="Attendance Days" value={String(detail.attendanceDays)} />
                <DetailMetric label="Average Start" value={detail.averageStart || "—"} />
                <DetailMetric label="Late Starts" value={String(detail.lateStarts)} />
                <DetailMetric label="Early Finishes" value={String(detail.earlyFinishes)} />
                <DetailMetric label="Vehicle KM" value={`${detail.vehicleKmTravelled.toLocaleString("en-ZA")} km`} />
              <label className="rounded-lg border bg-white p-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Opening balance (minutes)
                <input type="number" step="1" value={openingBalance} onChange={event => setOpeningBalance(event.target.value)} placeholder="Not set" className="mt-1 h-8 w-full rounded border border-slate-300 px-2 text-base font-bold normal-case text-slate-900" />
              </label>
              <DetailMetric label="Closing balance" value={formatNetTimeDifference(closingBalanceMinutes)} className={netClass(closingBalanceMinutes)} />
            </div>
            <p className="text-xs text-slate-500">Attendance, late starts, early finishes and vehicle kilometres are informational only. Net balance remains approved Overtime less approved Authorised Time Off. Opening balance is display-only.</p>
            <div className="rounded-lg border">
              <div className="border-b bg-slate-50 px-4 py-3"><h3 className="font-semibold">Chronological transactions</h3><p className="text-xs text-slate-500">Pending entries are shown but have zero balance impact.</p></div>
              {!detailTransactions.length ? <p className="p-6 text-center text-sm text-slate-500">No approved or pending transactions in this period.</p> : <div className="overflow-x-auto">
                <Table className="min-w-[1050px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type / Client / Job</TableHead><TableHead>Times</TableHead><TableHead>Minutes</TableHead><TableHead>Status</TableHead><TableHead>Approver / Approval date</TableHead><TableHead>Running balance</TableHead><TableHead> </TableHead></TableRow></TableHeader>
                  <TableBody>{detailTransactions.map(transaction => <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap">{transaction.date}</TableCell><TableCell><p className="font-medium">{transaction.typeLabel}</p><p className="text-xs text-slate-500">{transaction.clientName || "Internal"}{transaction.jobLabel ? ` · ${transaction.jobLabel}` : ""}</p><p className="max-w-[220px] truncate text-xs text-slate-500">{transaction.reason}{transaction.notes ? ` · ${transaction.notes}` : ""}</p></TableCell><TableCell className="whitespace-nowrap">{transaction.startTime}–{transaction.finishTime}</TableCell><TableCell><p className={`font-semibold ${transaction.entryType === "AUTHORISED_TIME_OFF" ? "text-red-700" : "text-emerald-700"}`}>{transaction.entryType === "AUTHORISED_TIME_OFF" ? "−" : "+"}{transaction.minutes}</p><p className="text-xs text-slate-500">{transaction.displayDuration}</p></TableCell><TableCell><Badge className={transaction.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>{transaction.status}</Badge></TableCell><TableCell className="text-xs">{transaction.approver || "—"}<br />{transaction.approvalDate ? transaction.approvalDate.slice(0, 10) : "Awaiting approval"}</TableCell><TableCell className={`font-semibold ${netClass((openingBalanceMinutes || 0) + transaction.runningBalanceMinutes)}`}>{formatNetTimeDifference((openingBalanceMinutes || 0) + transaction.runningBalanceMinutes)}</TableCell><TableCell><Link href={`/overtime-approval?entry=${transaction.id}`} className="text-sm font-medium text-red-700 hover:underline">Open record</Link></TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>}
            </div>
          </div>}
          <Button variant="outline" onClick={() => setDetailEmployeeId(null)}><X className="mr-2 h-4 w-4" />Close</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, icon, className, valueClass = "text-slate-900" }: { label: string; value: string; icon: React.ReactNode; className: string; valueClass?: string }) {
  return <div className={`rounded-xl border p-4 ${className}`}><div className="flex items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>{icon}</div><p className={`mt-2 text-xl font-bold ${valueClass}`}>{value}</p></div>;
}
function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div className="rounded-md bg-slate-50 p-2"><p className="text-slate-500">{label}</p><p className={`font-semibold ${className || "text-slate-800"}`}>{value}</p></div>;
}
function DetailMetric({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div className="rounded-lg border bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-lg font-bold ${className || "text-slate-900"}`}>{value}</p></div>;
}
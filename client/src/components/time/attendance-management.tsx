import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, Pencil, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatOvertimeMinutes } from "@shared/overtime";

type AttendanceRecord = {
  id: string;
  employeeName: string;
  employeeNumber: string | null;
  workDate: string;
  startTime: string;
  finishTime: string | null;
  totalMinutes: number | null;
  lateStartMinutes: number;
  earlyFinishMinutes: number;
  status: "WORKING" | "FINISHED";
  isMissingEnd: boolean;
};

type AttendanceResponse = {
  records: AttendanceRecord[];
  summary: { date: string; totalEmployees: number; started: number; working: number; finished: number; notStarted: number };
};

const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Johannesburg",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

export function AttendanceManagement() {
  const { toast } = useToast();
  const [date, setDate] = useState(today());
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [form, setForm] = useState({ startTime: "", finishTime: "", correctionReason: "" });
  const url = `/api/attendance/employee?date=${date}`;
  const { data, isLoading, isError } = useQuery<AttendanceResponse>({ queryKey: [url] });

  const correct = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/attendance/employee/${editing!.id}`, {
      startTime: form.startTime,
      finishTime: form.finishTime || null,
      correctionReason: form.correctionReason,
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [url] });
      setEditing(null);
      toast({ title: "Attendance corrected", description: "The original values, new values and reason were added to the audit trail." });
    },
    onError: (error: Error) => toast({ title: "Could not correct attendance", description: error.message, variant: "destructive" }),
  });

  const openCorrection = (record: AttendanceRecord) => {
    setEditing(record);
    setForm({ startTime: record.startTime, finishTime: record.finishTime || "", correctionReason: "" });
  };

  const summary = data?.summary;
  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <label className="block max-w-xs text-sm font-medium text-slate-700">Attendance date
          <Input className="mt-1" type="date" value={date} onChange={event => setDate(event.target.value)} />
        </label>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Started", summary?.started || 0, Users, "border-blue-200 bg-blue-50"],
          ["Working", summary?.working || 0, Clock3, "border-emerald-200 bg-emerald-50"],
          ["Finished", summary?.finished || 0, CheckCircle2, "border-slate-200 bg-slate-50"],
          ["Not started", summary?.notStarted || 0, AlertTriangle, "border-amber-200 bg-amber-50"],
        ].map(([label, value, Icon, colour]) => (
          <div key={String(label)} className={`rounded-xl border p-4 ${colour}`}>
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p><Icon className="h-4 w-4 text-slate-500" /></div>
            <p className="mt-2 text-2xl font-bold">{String(value)}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-4"><h2 className="font-semibold">Attendance Today</h2><p className="text-sm text-slate-500">Start and finish times are recorded by the server.</p></div>
        {isLoading ? <p className="p-6 text-sm text-slate-500">Loading attendance…</p> :
          isError ? <p className="p-6 text-sm text-red-700">Could not load attendance.</p> :
          data?.records.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Start</TableHead><TableHead>Finish</TableHead><TableHead>Total</TableHead><TableHead>Late</TableHead><TableHead>Early finish</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{data.records.map(record => (
                <TableRow key={record.id}>
                  <TableCell><p className="font-medium">{record.employeeName}</p>{record.employeeNumber && <p className="text-xs text-slate-500">{record.employeeNumber}</p>}</TableCell>
                  <TableCell>{record.startTime}</TableCell>
                  <TableCell>{record.finishTime || <span className="font-medium text-amber-700">Missing end time</span>}</TableCell>
                  <TableCell>{record.totalMinutes === null ? "—" : formatOvertimeMinutes(record.totalMinutes)}</TableCell>
                  <TableCell>{formatOvertimeMinutes(record.lateStartMinutes)}</TableCell>
                  <TableCell>{record.finishTime ? formatOvertimeMinutes(record.earlyFinishMinutes) : "—"}</TableCell>
                  <TableCell><Badge className={record.status === "WORKING" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}>{record.status}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => openCorrection(record)}><Pencil className="mr-1 h-3.5 w-3.5" /> Correct</Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          ) : <p className="p-6 text-sm text-slate-500">No attendance records for this date.</p>}
      </section>

      <Dialog open={Boolean(editing)} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Correct attendance</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">Start time<Input type="time" value={form.startTime} onChange={event => setForm(value => ({ ...value, startTime: event.target.value }))} /></label>
              <label className="text-sm font-medium">Finish time<Input type="time" value={form.finishTime} onChange={event => setForm(value => ({ ...value, finishTime: event.target.value }))} /></label>
            </div>
            <label className="block text-sm font-medium">Reason for correction<Textarea className="mt-1" required value={form.correctionReason} onChange={event => setForm(value => ({ ...value, correctionReason: event.target.value }))} /></label>
            <Button className="w-full bg-red-600 hover:bg-red-700" disabled={!form.startTime || !form.correctionReason.trim() || correct.isPending} onClick={() => correct.mutate()}>{correct.isPending ? "Saving…" : "Save correction"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
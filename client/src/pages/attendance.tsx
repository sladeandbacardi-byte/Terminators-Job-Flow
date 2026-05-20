import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  CheckCircle2, XCircle, Clock, Users, AlertTriangle, ChevronDown,
  CalendarDays, ClipboardCheck,
} from "lucide-react";
import type { Team, AttendanceRecord, AttendanceMemberRecord, Worker } from "@shared/schema";
import Sidebar from "@/components/layout/sidebar";

const TODAY = format(new Date(), "yyyy-MM-dd");
const TODAY_DISPLAY = format(new Date(), "EEEE, d MMMM yyyy");

const ABSENCE_REASONS = [
  { value: "sick",     label: "Sick" },
  { value: "leave",    label: "Leave" },
  { value: "no_show",  label: "No Show" },
  { value: "off_duty", label: "Off Duty" },
  { value: "other",    label: "Other" },
];

type MemberStatus = "present" | "absent" | "not_confirmed";

export default function AttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, { status: MemberStatus; reason: string }>>({});
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // All teams — filter by supervisor or show all (admin)
  const { data: allTeams = [] } = useQuery<Team[]>({ queryKey: ["/api/teams"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });

  const teams = allTeams.filter(t => t.isActive);

  // Open/load the attendance record for selected team + today
  const openAttendanceMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const res = await apiRequest("POST", "/api/attendance/open", { teamId, date: TODAY });
      return res.json() as Promise<AttendanceRecord>;
    },
    onSuccess: (record) => {
      setAttendanceId(record.id);
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", record.id, "members"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    setAttendanceId(null);
    setLocalStatuses({});
    openAttendanceMutation.mutate(teamId);
  };

  // Load attendance record detail
  const { data: attendanceRecord } = useQuery<AttendanceRecord>({
    queryKey: ["/api/attendance", attendanceId],
    enabled: !!attendanceId,
  });

  // Load member records for this attendance
  const { data: memberRecords = [] } = useQuery<AttendanceMemberRecord[]>({
    queryKey: ["/api/attendance", attendanceId, "members"],
    enabled: !!attendanceId,
    select: (data) => data,
  });

  // Update a single member status
  const updateMemberMutation = useMutation({
    mutationFn: async ({ workerId, employeeName, role, status, absenceReason }: {
      workerId: string; employeeName: string; role?: string | null;
      status: MemberStatus; absenceReason?: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/attendance/${attendanceId}/member`, {
        workerId, employeeName, role: role ?? null, status, absenceReason: absenceReason ?? null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", attendanceId, "members"] });
    },
    onError: (err: any) => toast({ title: "Error saving status", description: err.message, variant: "destructive" }),
  });

  // Submit all attendance
  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/attendance/${attendanceId}/submit`, {
        submittedBy: user?.id ?? "unknown",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", attendanceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      setShowConfirmSubmit(false);
      toast({ title: "Attendance submitted!", description: "Team attendance has been recorded for today." });
    },
    onError: (err: any) => toast({ title: "Submit failed", description: err.message, variant: "destructive" }),
  });

  const isSubmitted = attendanceRecord?.status === "submitted";

  const getMemberStatus = (workerId: string): MemberStatus => {
    if (localStatuses[workerId]) return localStatuses[workerId].status;
    return memberRecords.find(r => r.workerId === workerId)?.status as MemberStatus ?? "not_confirmed";
  };

  const getMemberReason = (workerId: string): string => {
    if (localStatuses[workerId]) return localStatuses[workerId].reason;
    return memberRecords.find(r => r.workerId === workerId)?.absenceReason ?? "";
  };

  const handleMark = (workerId: string, employeeName: string, role: string | null | undefined, status: MemberStatus) => {
    if (isSubmitted) return;
    const reason = status === "absent" ? (localStatuses[workerId]?.reason || "") : "";
    setLocalStatuses(prev => ({ ...prev, [workerId]: { status, reason } }));
    updateMemberMutation.mutate({ workerId, employeeName, role, status, absenceReason: reason || undefined });
  };

  const handleReasonChange = (workerId: string, employeeName: string, role: string | null | undefined, reason: string) => {
    setLocalStatuses(prev => ({ ...prev, [workerId]: { status: "absent", reason } }));
    updateMemberMutation.mutate({ workerId, employeeName, role, status: "absent", absenceReason: reason });
  };

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const supervisor = workers.find(w => w.id === selectedTeam?.supervisorId);

  // Team member workers
  const { data: teamMemberLinks = [] } = useQuery<{ id: string; teamId: string; workerId: string }[]>({
    queryKey: ["/api/teams", selectedTeamId, "members"],
    enabled: !!selectedTeamId,
  });

  const teamWorkers = teamMemberLinks
    .map(link => workers.find(w => w.id === link.workerId))
    .filter(Boolean) as Worker[];

  const presentCount = teamWorkers.filter(w => getMemberStatus(w.id) === "present").length;
  const absentCount  = teamWorkers.filter(w => getMemberStatus(w.id) === "absent").length;
  const pendingCount = teamWorkers.filter(w => getMemberStatus(w.id) === "not_confirmed").length;

  const hasUnconfirmed = teamWorkers.some(w => getMemberStatus(w.id) === "not_confirmed");

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* Header */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-bold text-gray-900">Team Attendance</h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CalendarDays className="h-4 w-4" />
              <span>{TODAY_DISPLAY}</span>
            </div>
          </div>

          {/* Team selector */}
          <Card className="mb-5">
            <CardContent className="p-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Select Team</label>
              <Select value={selectedTeamId} onValueChange={handleSelectTeam}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a team to take attendance…" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Team info + attendance sheet */}
          {selectedTeam && attendanceId && (
            <>
              {/* Team summary card */}
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 text-base">{selectedTeam.name}</p>
                      <p className="text-sm text-gray-500">Supervisor: {supervisor?.name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{teamWorkers.length} team members</p>
                    </div>
                    {isSubmitted ? (
                      <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Pending
                      </Badge>
                    )}
                  </div>

                  {/* Summary bar */}
                  {teamWorkers.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="bg-green-50 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-green-600">{presentCount}</p>
                        <p className="text-xs text-gray-500">Present</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-red-600">{absentCount}</p>
                        <p className="text-xs text-gray-500">Absent</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-gray-400">{pendingCount}</p>
                        <p className="text-xs text-gray-500">Unconfirmed</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Member rows */}
              <div className="space-y-3 mb-5">
                {teamWorkers.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-gray-400">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No team members found for this team.</p>
                    </CardContent>
                  </Card>
                ) : (
                  teamWorkers.map(worker => {
                    const status = getMemberStatus(worker.id);
                    const reason = getMemberReason(worker.id);
                    const isPresent = status === "present";
                    const isAbsent  = status === "absent";

                    return (
                      <Card key={worker.id} className={`border-2 transition-colors ${
                        isPresent ? "border-green-200 bg-green-50/30" :
                        isAbsent  ? "border-red-200 bg-red-50/30"    :
                        "border-gray-200"
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 text-base">{worker.name}</p>
                              <p className="text-sm text-gray-500">{worker.role ?? "Team Member"}</p>
                            </div>
                            {isPresent && <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />}
                            {isAbsent  && <XCircle      className="h-6 w-6 text-red-500 flex-shrink-0" />}
                            {status === "not_confirmed" && <Clock className="h-6 w-6 text-gray-300 flex-shrink-0" />}
                          </div>

                          {/* Large tap buttons */}
                          {!isSubmitted && (
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                size="lg"
                                variant={isPresent ? "default" : "outline"}
                                className={`h-12 text-base font-semibold ${
                                  isPresent
                                    ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                                    : "border-green-300 text-green-700 hover:bg-green-50"
                                }`}
                                onClick={() => handleMark(worker.id, worker.name, worker.role, "present")}
                              >
                                <CheckCircle2 className="h-5 w-5 mr-2" /> Present
                              </Button>
                              <Button
                                size="lg"
                                variant={isAbsent ? "default" : "outline"}
                                className={`h-12 text-base font-semibold ${
                                  isAbsent
                                    ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                                    : "border-red-300 text-red-700 hover:bg-red-50"
                                }`}
                                onClick={() => handleMark(worker.id, worker.name, worker.role, "absent")}
                              >
                                <XCircle className="h-5 w-5 mr-2" /> Absent
                              </Button>
                            </div>
                          )}

                          {/* Reason selector when absent */}
                          {isAbsent && !isSubmitted && (
                            <div className="mt-2">
                              <Select
                                value={reason}
                                onValueChange={(v) => handleReasonChange(worker.id, worker.name, worker.role, v)}
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Reason (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  {ABSENCE_REASONS.map(r => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Read-only submitted view */}
                          {isSubmitted && (
                            <div className="flex items-center gap-2">
                              <Badge className={
                                isPresent ? "bg-green-100 text-green-800" :
                                isAbsent  ? "bg-red-100 text-red-800"    :
                                "bg-gray-100 text-gray-600"
                              }>
                                {status === "not_confirmed" ? "Not confirmed" : status.charAt(0).toUpperCase() + status.slice(1)}
                              </Badge>
                              {isAbsent && reason && (
                                <span className="text-xs text-gray-500">
                                  {ABSENCE_REASONS.find(r => r.value === reason)?.label ?? reason}
                                </span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>

              {/* Submit button */}
              {!isSubmitted && teamWorkers.length > 0 && (
                <>
                  {showConfirmSubmit ? (
                    <Card className="border-amber-200 bg-amber-50">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2 mb-3">
                          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-amber-800">Confirm Submission</p>
                            {hasUnconfirmed ? (
                              <p className="text-sm text-amber-700 mt-1">
                                {pendingCount} team member{pendingCount > 1 ? "s" : ""} not yet marked —
                                they will be recorded as <strong>absent</strong>. Continue?
                              </p>
                            ) : (
                              <p className="text-sm text-amber-700 mt-1">
                                Submit attendance for all {teamWorkers.length} team members?
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" onClick={() => setShowConfirmSubmit(false)}>Cancel</Button>
                          <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => submitMutation.mutate()}
                            disabled={submitMutation.isPending}
                          >
                            {submitMutation.isPending ? "Submitting…" : "Yes, Submit"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Button
                      size="lg"
                      className="w-full h-14 text-lg font-semibold bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => setShowConfirmSubmit(true)}
                    >
                      <ClipboardCheck className="h-6 w-6 mr-2" />
                      Submit Attendance
                    </Button>
                  )}
                </>
              )}

              {/* Already submitted confirmation */}
              {isSubmitted && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-7 w-7 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800">Attendance submitted for today</p>
                      {attendanceRecord?.submittedAt && (
                        <p className="text-sm text-green-600">
                          at {format(new Date(attendanceRecord.submittedAt), "HH:mm")}
                          {attendanceRecord.submittedBy ? ` by ${attendanceRecord.submittedBy}` : ""}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Loading state */}
          {selectedTeamId && openAttendanceMutation.isPending && (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2" />
                <p className="text-sm">Loading attendance sheet…</p>
              </CardContent>
            </Card>
          )}

          {/* No team selected prompt */}
          {!selectedTeamId && (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Select a team above to begin taking attendance.</p>
                <p className="text-xs mt-1">Attendance is recorded daily per team.</p>
              </CardContent>
            </Card>
          )}

        </div>
      </main>
    </div>
  );
}

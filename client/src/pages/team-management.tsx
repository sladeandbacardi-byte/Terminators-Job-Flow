import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Pencil, Trash2, UserPlus, UserMinus, Building2 } from "lucide-react";
import type { Team, Worker, Department } from "@shared/schema";
import Sidebar from "@/components/layout/sidebar";

const DEPT_COLORS: Record<string, string> = {
  "div-1": "bg-green-100 text-green-800",
  "div-2": "bg-purple-100 text-purple-800",
  "div-3": "bg-blue-100 text-blue-800",
  "div-4": "bg-orange-100 text-orange-800",
};

export default function TeamManagementPage() {
  const { toast } = useToast();

  const { data: teams = [], isLoading } = useQuery<Team[]>({ queryKey: ["/api/teams"] });
  const { data: workers = [] }           = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: departments = [] }       = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [manageTeam, setManageTeam] = useState<Team | null>(null);
  const [addWorkerId, setAddWorkerId] = useState("");

  // New team form state
  const [form, setForm] = useState({ name: "", departmentId: "", supervisorId: "", notes: "" });

  // Team members for the manage dialog
  const { data: teamMembers = [] } = useQuery<{ id: string; teamId: string; workerId: string }[]>({
    queryKey: ["/api/teams", manageTeam?.id, "members"],
    enabled: !!manageTeam,
  });

  const teamWorkers = teamMembers
    .map(m => workers.find(w => w.id === m.workerId))
    .filter(Boolean) as Worker[];

  // Workers eligible to add (not already in team, filtered by dept)
  const eligibleWorkers = workers.filter(
    w => w.isActive !== false &&
      !teamWorkers.some(tw => tw.id === w.id) &&
      (manageTeam ? w.departmentId === manageTeam.departmentId : true)
  );

  // Create team
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/teams", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setShowCreateDialog(false);
      setForm({ name: "", departmentId: "", supervisorId: "", notes: "" });
      toast({ title: "Team created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Update team
  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/teams/${editTeam!.id}`, form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setEditTeam(null);
      toast({ title: "Team updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Delete team
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/teams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Team deleted" });
    },
  });

  // Add member
  const addMemberMutation = useMutation({
    mutationFn: async (workerId: string) => {
      const res = await apiRequest("POST", `/api/teams/${manageTeam!.id}/members`, { workerId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", manageTeam?.id, "members"] });
      setAddWorkerId("");
      toast({ title: "Member added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: async (workerId: string) => {
      await apiRequest("DELETE", `/api/teams/${manageTeam!.id}/members/${workerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", manageTeam?.id, "members"] });
      toast({ title: "Member removed" });
    },
  });

  const openEdit = (team: Team) => {
    setForm({ name: team.name, departmentId: team.departmentId, supervisorId: team.supervisorId, notes: team.notes ?? "" });
    setEditTeam(team);
  };

  const getDept = (id: string) => departments.find(d => d.id === id);
  const getWorker = (id: string) => workers.find(w => w.id === id);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-indigo-600" />
                <h1 className="text-xl font-bold text-gray-900">Team Management</h1>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Create and manage field service teams and their members</p>
            </div>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => { setForm({ name: "", departmentId: "", supervisorId: "", notes: "" }); setShowCreateDialog(true); }}
            >
              <Plus className="h-4 w-4 mr-1" /> New Team
            </Button>
          </div>

          {/* Teams grid */}
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading teams…</div>
          ) : teams.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-gray-400">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No teams yet</p>
                <p className="text-sm mt-1">Create your first team to start tracking attendance.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map(team => {
                const dept     = getDept(team.departmentId);
                const supervisor = getWorker(team.supervisorId);
                return (
                  <Card key={team.id} className={`${team.isActive ? "" : "opacity-60"}`}>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base">{team.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            {dept && (
                              <Badge className={`text-xs ${DEPT_COLORS[team.departmentId] ?? "bg-gray-100 text-gray-600"}`}>
                                {dept.name}
                              </Badge>
                            )}
                            <Badge className={team.isActive ? "bg-green-100 text-green-800 text-xs" : "bg-gray-100 text-gray-600 text-xs"}>
                              {team.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => openEdit(team)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                            onClick={() => deleteMutation.mutate(team.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-sm text-gray-600 mb-3">
                        <span className="font-medium">Supervisor:</span> {supervisor?.name ?? "—"}
                      </div>
                      {team.notes && <p className="text-xs text-gray-400 mb-3">{team.notes}</p>}
                      <Button variant="outline" size="sm" className="w-full"
                        onClick={() => setManageTeam(team)}>
                        <Users className="h-3.5 w-3.5 mr-1.5" /> Manage Members
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create / Edit dialog */}
      <Dialog open={showCreateDialog || !!editTeam} onOpenChange={(open) => {
        if (!open) { setShowCreateDialog(false); setEditTeam(null); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTeam ? "Edit Team" : "Create New Team"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Team Name</Label>
              <Input
                placeholder="e.g. Pest Control Team 1"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Department</Label>
              <Select value={form.departmentId} onValueChange={v => setForm(f => ({ ...f, departmentId: v, supervisorId: "" }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select department…" />
                </SelectTrigger>
                <SelectContent>
                  {departments.filter(d => ["div-1","div-2","div-3","div-4"].includes(d.id)).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Team Supervisor</Label>
              <Select value={form.supervisorId} onValueChange={v => setForm(f => ({ ...f, supervisorId: v }))}
                disabled={!form.departmentId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select supervisor…" />
                </SelectTrigger>
                <SelectContent>
                  {workers
                    .filter(w => w.isActive !== false && (!form.departmentId || w.departmentId === form.departmentId))
                    .map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name} — {w.role}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Brief description"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditTeam(null); }}>Cancel</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={!form.name || !form.departmentId || !form.supervisorId || createMutation.isPending || updateMutation.isPending}
              onClick={() => editTeam ? updateMutation.mutate() : createMutation.mutate()}
            >
              {editTeam ? "Save Changes" : "Create Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage members dialog */}
      <Dialog open={!!manageTeam} onOpenChange={(open) => { if (!open) setManageTeam(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" /> {manageTeam?.name} — Members
            </DialogTitle>
          </DialogHeader>

          {/* Current members */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {teamWorkers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No members yet. Add workers below.</p>
            ) : (
              teamWorkers.map(worker => (
                <div key={worker.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{worker.name}</p>
                    <p className="text-xs text-gray-400">{worker.role ?? "Team Member"}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => removeMemberMutation.mutate(worker.id)}>
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Add member */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-2 block">Add Team Member</Label>
            <div className="flex gap-2">
              <Select value={addWorkerId} onValueChange={setAddWorkerId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select worker to add…" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleWorkers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-400">No eligible workers in this department</div>
                  ) : (
                    eligibleWorkers.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name} — {w.role}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                disabled={!addWorkerId || addMemberMutation.isPending}
                onClick={() => { if (addWorkerId) addMemberMutation.mutate(addWorkerId); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageTeam(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

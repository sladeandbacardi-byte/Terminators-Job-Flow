import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, AlertTriangle, Clock,
  FileText, Phone, MapPin, User, DollarSign, Calendar, ArrowRight,
  Plus, RefreshCw, Building2, ClipboardList, Truck, Receipt,
  AlertCircle, CheckSquare,
} from "lucide-react";
import type { AcceptedWorkflow, QuoteSubmission, Worker } from "@shared/schema";
import { WORKFLOW_STATUSES } from "@shared/schema";

// ── helpers ─────────────────────────────────────────────────────────────────

function computeWorkflowStatus(w: AcceptedWorkflow): string {
  if (w.afterSalesComplete) return "complete";
  if (w.linkedInvoiceId) return "invoiced";
  if (w.readyToInvoice) return "ready_to_invoice";
  if (w.serviceScheduled) return "scheduled";
  if (w.contractSigned) return "contract_signed";
  if (w.contractSent) return "contract_sent";
  if (w.contractDrafted) return "contract_drafted";
  if (w.regComplete || w.regFormReceived) return "registration_received";
  if (w.regFormSent) return "registration_sent";
  return "pending_registration";
}

function countSteps(w: AcceptedWorkflow): { done: number; total: number } {
  const checks = [
    w.regFormSent, w.regFormReceived, w.regComplete,
    w.contractDrafted, w.contractSent, w.contractSigned,
    w.handoverSent, w.serviceScheduled,
    w.readyToInvoice, w.afterSalesComplete,
  ];
  return { done: checks.filter(Boolean).length, total: checks.length };
}

function getWarnings(w: AcceptedWorkflow): string[] {
  const warns: string[] = [];
  if (w.serviceScheduled && !w.contractSigned) warns.push("Service scheduled before contract signed");
  if (w.regFormSent && !w.regFormReceived) warns.push("Registration outstanding");
  if (!w.contractSigned && ["scheduled","ready_to_invoice","invoiced","after_sales_due"].includes(w.workflowStatus)) warns.push("Contract not signed");
  if (w.afterHoursRequired === "yes") warns.push("After-hours / overtime required");
  if (w.existingCompetitorContract === "yes") warns.push(`Competitor notice: ${w.competitorName || "unknown"}${w.noticePeriod ? ` — ${w.noticePeriod}` : ""}`);
  if (!w.installationCost && !w.monthlyRecurring && !w.quoteAmount) warns.push("Missing cost / pricing info");
  if (!w.frequency) warns.push("Missing service frequency");
  if (w.regFormReceived && !w.accountsEmail && !w.accountsContact) warns.push("Missing client accounts details");
  return warns;
}

function getNextAction(w: AcceptedWorkflow): { label: string; fields: Partial<AcceptedWorkflow> } | null {
  const now = new Date().toISOString();
  if (!w.regFormSent) return { label: "Send Registration Form", fields: { regFormSent: true, regFormSentAt: now } as any };
  if (!w.regFormReceived) return { label: "Mark Form Received", fields: { regFormReceived: true, regFormReceivedAt: now } as any };
  if (!w.regComplete) return { label: "Mark Registration Complete", fields: { regComplete: true } };
  if (!w.contractDrafted) return { label: "Mark Contract Drafted", fields: { contractDrafted: true } };
  if (!w.contractSent) return { label: "Mark Contract Sent", fields: { contractSent: true, contractSentAt: now } as any };
  if (!w.contractSigned) return { label: "Mark Contract Signed", fields: { contractSigned: true, contractSignedAt: now } as any };
  if (!w.handoverSent) return { label: "Send to Service Dept", fields: { handoverSent: true } };
  if (!w.serviceScheduled) return { label: "Mark as Scheduled", fields: { serviceScheduled: true } };
  if (!w.readyToInvoice) return { label: "Mark Ready to Invoice", fields: { readyToInvoice: true, readyToInvoiceAt: now } as any };
  if (!w.afterSalesFollowupDate) {
    const followup = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    return { label: "Create After-sales Follow-up", fields: { afterSalesFollowupDate: followup } };
  }
  if (!w.afterSalesComplete) return { label: "Mark Follow-up Complete", fields: { afterSalesComplete: true } };
  return null;
}

const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  WORKFLOW_STATUSES.map(s => [s.value, s.color])
);
const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  WORKFLOW_STATUSES.map(s => [s.value, s.label])
);
const BORDER_COLORS: Record<string, string> = Object.fromEntries(
  WORKFLOW_STATUSES.map(s => [s.value, s.borderColor])
);

// ── WorkflowCard ─────────────────────────────────────────────────────────────

function WorkflowCard({
  w, workers, onPatch,
}: {
  w: AcceptedWorkflow;
  workers: Worker[];
  onPatch: (id: string, fields: Partial<AcceptedWorkflow>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState(w.notes || "");
  const [editingAccounts, setEditingAccounts] = useState(false);
  const [vatVal, setVatVal] = useState(w.vatNumber || "");
  const [regNumVal, setRegNumVal] = useState(w.companyRegNumber || "");
  const [acctContactVal, setAcctContactVal] = useState(w.accountsContact || "");
  const [acctEmailVal, setAcctEmailVal] = useState(w.accountsEmail || "");
  const [paymentTermsVal, setPaymentTermsVal] = useState(w.paymentTerms || "");

  const warnings = getWarnings(w);
  const { done, total } = countSteps(w);
  const pct = Math.round((done / total) * 100);
  const nextAction = getNextAction(w);
  const salesRep = workers.find(wr => wr.id === w.salesRepId);
  const statusCfg = WORKFLOW_STATUSES.find(s => s.value === w.workflowStatus);

  function toggle(field: keyof AcceptedWorkflow) {
    const newVal = !w[field];
    const update: Partial<AcceptedWorkflow> = { [field]: newVal };
    if (field === "regFormSent" && newVal) (update as any).regFormSentAt = new Date().toISOString();
    if (field === "regFormReceived" && newVal) (update as any).regFormReceivedAt = new Date().toISOString();
    if (field === "contractSent" && newVal) (update as any).contractSentAt = new Date().toISOString();
    if (field === "contractSigned" && newVal) (update as any).contractSignedAt = new Date().toISOString();
    if (field === "readyToInvoice" && newVal) (update as any).readyToInvoiceAt = new Date().toISOString();
    update.workflowStatus = computeWorkflowStatus({ ...w, ...update });
    onPatch(w.id, update);
  }

  function saveNotes() {
    onPatch(w.id, { notes: notesVal });
    setEditingNotes(false);
  }

  function saveAccounts() {
    onPatch(w.id, {
      vatNumber: vatVal, companyRegNumber: regNumVal,
      accountsContact: acctContactVal, accountsEmail: acctEmailVal,
      paymentTerms: paymentTermsVal,
    });
    setEditingAccounts(false);
  }

  return (
    <Card className={`border-l-4 ${BORDER_COLORS[w.workflowStatus] || "border-l-gray-300"} shadow-sm`}>
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-base truncate">{w.companyName}</span>
              {w.quoteNumber && (
                <Badge variant="outline" className="text-xs">{w.quoteNumber}</Badge>
              )}
              {w.serviceType && (
                <Badge className="text-xs capitalize bg-blue-50 text-blue-700 border-blue-200">
                  {w.serviceType.replace(/_/g, " ")}
                </Badge>
              )}
              <Badge className={`text-xs ${statusCfg?.color || "bg-gray-100 text-gray-700"}`}>
                {STATUS_LABELS[w.workflowStatus] || w.workflowStatus}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              {w.contactPerson && (
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{w.contactPerson}</span>
              )}
              {salesRep && (
                <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3" />Rep: {salesRep.name}</span>
              )}
              {w.address && (
                <span className="flex items-center gap-1 truncate max-w-xs"><MapPin className="h-3 w-3 flex-shrink-0" />{w.address}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
              {w.quoteAmount && (
                <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />Quote: R{w.quoteAmount}</span>
              )}
              {w.monthlyRecurring && (
                <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />Monthly: R{w.monthlyRecurring}</span>
              )}
              {w.frequency && (
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{w.frequency}</span>
              )}
            </div>
          </div>

          {/* Progress + expand */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-xs text-gray-500">{done}/{total} steps</div>
            <div className="w-24">
              <Progress value={pct} className="h-2" />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)} className="h-7 px-2">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Warning badges */}
        {warnings.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {warnings.map((w, i) => (
              <Badge key={i} className="text-xs bg-red-50 text-red-700 border-red-200 font-normal">
                <AlertTriangle className="h-3 w-3 mr-1" />{w}
              </Badge>
            ))}
          </div>
        )}

        {/* Next action button */}
        {nextAction && (
          <div className="mt-3">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                const update = { ...nextAction.fields };
                (update as any).workflowStatus = computeWorkflowStatus({ ...w, ...update });
                onPatch(w.id, update);
              }}
            >
              <ArrowRight className="h-3.5 w-3.5 mr-1" />
              {nextAction.label}
            </Button>
          </div>
        )}

        {/* ── Expanded detail ── */}
        {expanded && (
          <div className="mt-4 border-t pt-4 space-y-5">

            {/* Phase 1: Client Registration */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1 mb-2">
                <Building2 className="h-4 w-4 text-blue-500" />Client Registration
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2">
                {([
                  ["regFormSent", "Registration form sent to client"],
                  ["regFormReceived", "Registration form received back"],
                  ["regComplete", "Registration complete (VAT, Reg#, Accounts)"],
                ] as [keyof AcceptedWorkflow, string][]).map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                    <Checkbox
                      checked={!!w[field]}
                      onCheckedChange={() => toggle(field)}
                    />
                    <span className={w[field] ? "line-through text-gray-400" : ""}>{label}</span>
                  </label>
                ))}
              </div>

              {/* Accounts detail sub-form */}
              {!editingAccounts ? (
                <div className="mt-2 pl-2">
                  <div className="text-xs text-gray-500 grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {w.vatNumber && <span>VAT: {w.vatNumber}</span>}
                    {w.companyRegNumber && <span>Reg#: {w.companyRegNumber}</span>}
                    {w.accountsContact && <span>Acct contact: {w.accountsContact}</span>}
                    {w.accountsEmail && <span>Acct email: {w.accountsEmail}</span>}
                    {w.paymentTerms && <span>Payment terms: {w.paymentTerms}</span>}
                  </div>
                  <Button variant="link" size="sm" className="h-6 px-0 text-xs text-blue-600 mt-1"
                    onClick={() => setEditingAccounts(true)}>
                    {w.vatNumber || w.accountsEmail ? "Edit accounts details" : "+ Add accounts details"}
                  </Button>
                </div>
              ) : (
                <div className="mt-2 pl-2 grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded">
                  {[
                    ["VAT Number", vatVal, setVatVal],
                    ["Company Reg #", regNumVal, setRegNumVal],
                    ["Accounts Contact", acctContactVal, setAcctContactVal],
                    ["Accounts Email", acctEmailVal, setAcctEmailVal],
                    ["Payment Terms", paymentTermsVal, setPaymentTermsVal],
                  ].map(([lbl, val, setter]) => (
                    <div key={lbl as string}>
                      <Label className="text-xs">{lbl as string}</Label>
                      <Input className="h-7 text-xs" value={val as string}
                        onChange={e => (setter as any)(e.target.value)} />
                    </div>
                  ))}
                  <div className="col-span-2 flex gap-2 mt-1">
                    <Button size="sm" className="h-7 text-xs" onClick={saveAccounts}>Save</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingAccounts(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Phase 2: Service Contract */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1 mb-2">
                <FileText className="h-4 w-4 text-indigo-500" />Service Contract
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2">
                {([
                  ["contractDrafted", "Contract drafted"],
                  ["contractSent", "Contract sent to client"],
                  ["contractSigned", "Contract signed by client"],
                ] as [keyof AcceptedWorkflow, string][]).map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                    <Checkbox checked={!!w[field]} onCheckedChange={() => toggle(field)} />
                    <span className={w[field] ? "line-through text-gray-400" : ""}>{label}</span>
                  </label>
                ))}
              </div>
              {w.contractSentAt && (
                <p className="text-xs text-gray-400 pl-2 mt-1">
                  Sent: {new Date(w.contractSentAt).toLocaleDateString()}
                  {w.contractSignedAt && ` · Signed: ${new Date(w.contractSignedAt).toLocaleDateString()}`}
                </p>
              )}
            </div>

            {/* Phase 3: Handover & Scheduling */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1 mb-2">
                <Truck className="h-4 w-4 text-cyan-500" />Service Handover & Scheduling
              </h4>

              {/* Handover summary */}
              <div className="pl-2 mb-2 p-3 bg-gray-50 rounded text-xs space-y-0.5 text-gray-600">
                <p><strong>Client:</strong> {w.companyName} · {w.contactPerson}</p>
                {w.address && <p><strong>Site:</strong> {w.address}</p>}
                {w.serviceType && <p><strong>Service:</strong> {w.serviceType.replace(/_/g, " ")}</p>}
                {w.specialInstructions && <p><strong>Special instructions:</strong> {w.specialInstructions}</p>}
                {w.afterHoursRequired === "yes" && (
                  <p className="text-amber-700 font-medium">⚠ After-hours / overtime required</p>
                )}
                {w.existingCompetitorContract === "yes" && (
                  <p className="text-amber-700 font-medium">
                    ⚠ Competitor contract with {w.competitorName || "unknown"}
                    {w.noticePeriod ? ` — notice: ${w.noticePeriod}` : ""}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2">
                {([
                  ["handoverSent", "Handover task sent to Service dept"],
                  ["serviceScheduled", "Service / installation scheduled"],
                ] as [keyof AcceptedWorkflow, string][]).map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                    <Checkbox checked={!!w[field]} onCheckedChange={() => toggle(field)} />
                    <span className={w[field] ? "line-through text-gray-400" : ""}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Phase 4: Invoice */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1 mb-2">
                <Receipt className="h-4 w-4 text-orange-500" />Invoicing
              </h4>
              <div className="pl-2 space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                  <Checkbox checked={!!w.readyToInvoice} onCheckedChange={() => toggle("readyToInvoice")} />
                  <span className={w.readyToInvoice ? "line-through text-gray-400" : ""}>Mark as Ready to Invoice</span>
                </label>
                {w.linkedInvoiceId && (
                  <p className="text-xs text-gray-500 pl-6">
                    Invoice linked: {w.linkedInvoiceId}
                    {w.invoiceStatus && ` · ${w.invoiceStatus}`}
                  </p>
                )}
              </div>
            </div>

            {/* Phase 5: After-sales */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1 mb-2">
                <CheckSquare className="h-4 w-4 text-pink-500" />After-sales Follow-up
              </h4>
              <div className="pl-2 space-y-2">
                {w.afterSalesFollowupDate && (
                  <p className="text-sm text-gray-600">
                    <Calendar className="h-3.5 w-3.5 inline mr-1" />Follow-up date: {w.afterSalesFollowupDate}
                  </p>
                )}
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                  <Checkbox checked={!!w.afterSalesComplete} onCheckedChange={() => toggle("afterSalesComplete")} />
                  <span className={w.afterSalesComplete ? "line-through text-gray-400" : ""}>After-sales follow-up complete</span>
                </label>
                {/* After-sales notes */}
                {w.afterSalesNotes && (
                  <p className="text-xs text-gray-500 pl-6">{w.afterSalesNotes}</p>
                )}
              </div>
            </div>

            {/* Internal notes */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-1">Internal Notes</h4>
              {!editingNotes ? (
                <div className="pl-2">
                  <p className="text-sm text-gray-600">{w.notes || <span className="text-gray-400 italic">No notes</span>}</p>
                  <Button variant="link" size="sm" className="h-6 px-0 text-xs text-blue-600 mt-1"
                    onClick={() => setEditingNotes(true)}>
                    {w.notes ? "Edit notes" : "+ Add notes"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 pl-2">
                  <Textarea rows={3} value={notesVal} onChange={e => setNotesVal(e.target.value)}
                    className="text-sm" placeholder="Internal notes…" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={saveNotes}>Save</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingNotes(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Create-from-quote dialog ─────────────────────────────────────────────────

function CreateWorkflowDialog({
  open, onClose, quotes, existingQuoteIds, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  quotes: QuoteSubmission[];
  existingQuoteIds: Set<string>;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [selectedQuoteId, setSelectedQuoteId] = useState("");

  const eligible = quotes.filter(q =>
    (q.status === "accepted" || q.stage === "accepted" || q.stage === "converted_contract" || q.stage === "converted_job") &&
    !existingQuoteIds.has(q.id)
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const q = quotes.find(x => x.id === selectedQuoteId);
      if (!q) throw new Error("Quote not found");
      return apiRequest("POST", "/api/accepted-workflows", {
        quoteId: q.id,
        quoteNumber: q.quoteNumber,
        companyName: q.companyName,
        contactPerson: q.contactPerson,
        serviceType: q.serviceType,
        quoteAmount: q.quoteAmount,
        monthlyRecurring: q.monthlyRecurring,
        installationCost: q.installationCost,
        frequency: q.frequency,
        address: q.address,
        specialInstructions: q.specialInstructions,
        salesRepId: q.assignedTo,
        afterHoursRequired: q.afterHoursRequired,
        existingCompetitorContract: q.existingCompetitorContract,
        competitorName: q.competitorName,
        cancellationNoticeRequired: q.cancellationNoticeRequired,
        noticePeriod: q.noticePeriod,
        departmentId: q.departmentId,
        workflowStatus: "pending_registration",
      });
    },
    onSuccess: () => {
      toast({ title: "Workflow created" });
      queryClient.invalidateQueries({ queryKey: ["/api/accepted-workflows"] });
      setSelectedQuoteId("");
      onCreated();
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to create workflow.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Workflow from Accepted Quote</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {eligible.length === 0 ? (
            <p className="text-sm text-gray-500">
              No accepted quotes without a workflow found. Move a lead to "Accepted" in the Leads page first.
            </p>
          ) : (
            <div>
              <Label className="text-sm">Select Accepted Quote</Label>
              <Select value={selectedQuoteId} onValueChange={setSelectedQuoteId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a quote…" />
                </SelectTrigger>
                <SelectContent>
                  {eligible.map(q => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.quoteNumber ? `${q.quoteNumber} · ` : ""}{q.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!selectedQuoteId || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Creating…" : "Create Workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AcceptedWork() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: workflows = [], isLoading } = useQuery<AcceptedWorkflow[]>({
    queryKey: ["/api/accepted-workflows"],
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  const { data: quotes = [] } = useQuery<QuoteSubmission[]>({
    queryKey: ["/api/quote-submissions"],
  });

  const patchWorkflow = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Partial<AcceptedWorkflow> }) =>
      apiRequest("PATCH", `/api/accepted-workflows/${id}`, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accepted-workflows"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update workflow.", variant: "destructive" }),
  });

  function handlePatch(id: string, fields: Partial<AcceptedWorkflow>) {
    patchWorkflow.mutate({ id, fields });
  }

  const existingQuoteIds = new Set(workflows.map(w => w.quoteId));

  // Status counts
  const counts: Record<string, number> = { all: workflows.length };
  for (const w of workflows) {
    counts[w.workflowStatus] = (counts[w.workflowStatus] || 0) + 1;
  }

  const filteredWorkflows = selectedStatus === "all"
    ? workflows
    : workflows.filter(w => w.workflowStatus === selectedStatus);

  // Total warnings
  const totalWarnings = workflows.reduce((acc, w) => acc + getWarnings(w).length, 0);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-4 sm:p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                Accepted Work
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {workflows.length} workflow{workflows.length !== 1 ? "s" : ""} in progress
                {totalWarnings > 0 && (
                  <span className="ml-2 text-red-600 font-medium">
                    · {totalWarnings} warning{totalWarnings !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-1" />New Workflow
            </Button>
          </div>

          {/* Warning summary */}
          {totalWarnings > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">
                <strong>{totalWarnings} action{totalWarnings !== 1 ? "s" : ""} needed</strong> across your workflows.
                Items with warnings are highlighted in their cards below.
              </div>
            </div>
          )}

          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            <button
              onClick={() => setSelectedStatus("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedStatus === "all"
                  ? "bg-gray-800 text-white"
                  : "bg-white border text-gray-600 hover:bg-gray-50"
              }`}
            >
              All <span className="ml-1 text-xs opacity-75">({counts.all || 0})</span>
            </button>
            {WORKFLOW_STATUSES.filter(s => counts[s.value]).map(s => (
              <button
                key={s.value}
                onClick={() => setSelectedStatus(s.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedStatus === s.value
                    ? "bg-gray-800 text-white"
                    : `${s.color} border border-transparent hover:opacity-80`
                }`}
              >
                {s.label} <span className="ml-1 text-xs opacity-75">({counts[s.value]})</span>
              </button>
            ))}
          </div>

          {/* Cards */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {selectedStatus === "all"
                  ? "No workflows yet"
                  : `No workflows at "${STATUS_LABELS[selectedStatus]}" stage`}
              </p>
              {selectedStatus === "all" && (
                <p className="text-sm text-gray-400 mt-1">
                  Workflows are created automatically when a lead is moved to "Accepted" in the Leads page,
                  or click "+ New Workflow" above.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWorkflows.map(w => (
                <WorkflowCard
                  key={w.id}
                  w={w}
                  workers={workers}
                  onPatch={handlePatch}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <MobileNavigation />

      <CreateWorkflowDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        quotes={quotes}
        existingQuoteIds={existingQuoteIds}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/accepted-workflows"] })}
      />
    </div>
  );
}

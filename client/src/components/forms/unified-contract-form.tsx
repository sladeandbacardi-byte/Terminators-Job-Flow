import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, ChevronDown, ChevronUp, User, FileText, Package,
  Calendar, DollarSign, Box, StickyNote, Wrench, Check,
} from "lucide-react";
import type { Client, Worker, Team } from "@shared/schema";

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEPARTMENTS = [
  "Pest Control", "Hygiene", "Washroom", "Sanitary Bins",
  "Dustmats", "Deep Cleaning", "Other",
] as const;

const FREQS = [
  "Daily", "2 x a week", "Weekly", "Twice a month", "Monthly",
  "Every 2 months", "Quarterly", "Every 6 months", "Annually",
  "Once-off", "On Demand",
] as const;

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"] as const;

const WEEK_OPTS = [
  { val: 1, label: "Week 1" }, { val: 2, label: "Week 2" },
  { val: 3, label: "Week 3" }, { val: 4, label: "Week 4" },
  { val: 5, label: "Last Week" },
];

const LINE_TYPES = [
  "Service", "Rental Item", "Product / Refill",
  "Combined Service + Item", "Other",
] as const;

const REFILL_RULES = [
  "Including Refills", "Excluding Refills", "Refill Only",
  "On Demand Refills", "Not Applicable",
] as const;

const INVOICE_RULES = [
  "Invoice per completed job", "Invoice monthly contract",
  "Invoice on demand", "Do not invoice automatically",
] as const;

const SERVICE_ITEMS_BY_DEPT: Record<string, string[]> = {
  "Pest Control": [
    "Rodent Service","Cockroach Service","Ant Treatment","Flea Treatment",
    "Fly Control","Bed Bug Treatment","Termite Inspection","Wood Borer Treatment",
    "Other Pest Control",
  ],
  "Sanitary Bins": [
    "Sanitary Bin Placement","Sanitary Bin Service","Sanitary Bin Cleaning",
    "Sanitary Bin Replacement","Sanitary Bin Rental","Sanitary Bin Refill / Consumables",
  ],
  "Hygiene": [
    "Aerosol A/F Unit","Aerosol Refill","Soap Dispenser","Soap Refill",
    "Paper Towel Dispenser","Paper Towel Refill","Toilet Roll Dispenser",
    "Toilet Roll Refill","Urinal Mat","Washroom Service",
  ],
  "Washroom": [
    "Aerosol A/F Unit","Aerosol Refill","Soap Dispenser","Soap Refill",
    "Paper Towel Dispenser","Paper Towel Refill","Toilet Roll Dispenser",
    "Toilet Roll Refill","Urinal Mat","Washroom Service",
  ],
  "Dustmats": [
    "Dustmat Rental","Dustmat Replacement","Dustmat Cleaning",
  ],
  "Deep Cleaning": [
    "Deep Cleaning Service","Once-off Deep Clean","Recurring Deep Clean",
  ],
  "Other": [],
};

// ── Types ─────────────────────────────────────────────────────────────────────

type LineItem = {
  _key: string;
  lineType: string;
  itemServiceName: string;
  serviceCategory: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  refillRule: string;
  stockTrackingRequired: boolean;
  notes: string;
};

type FormData = {
  // Client
  clientId: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  googleMapsLink: string;
  // Contract details
  department: string;
  contractStartDate: string;
  contractEndDate: string;
  lastPriceIncreaseDate: string;
  nextIncreaseDate: string;
  increasePercentage: string;
  activeStatus: boolean;
  specialInstructions: string;
  internalNotes: string;
  // Scheduling
  frequency: string;
  weekOfMonth: string;
  dayOfWeek: string;
  secondDayOfWeek: string;
  startTime: string;
  secondStartTime: string;
  estimatedDuration: string;
  fixedTime: boolean;
  routeSequence: string;
  assignedTeamId: string;
  assignedTeamName: string;
  assignedTechnicianId: string;
  assignedTechnicianName: string;
  confirmWithClientBeforeService: boolean;
  // Pricing
  invoiceRule: string;
  mustBeInvoiced: boolean;
  financeNotes: string;
  // Notes
  notes: string;
};

type Props = {
  contract?: any;
  defaultClientId?: string;
  onSuccess: () => void;
  onCancel: () => void;
};

const EMPTY_LINE = (): LineItem => ({
  _key: Math.random().toString(36).slice(2),
  lineType: "Service",
  itemServiceName: "",
  serviceCategory: "",
  quantity: "1",
  unitPrice: "",
  totalPrice: "",
  refillRule: "Not Applicable",
  stockTrackingRequired: false,
  notes: "",
});

const EMPTY_FORM: FormData = {
  clientId: "", contactPerson: "", contactPhone: "", contactEmail: "",
  address: "", googleMapsLink: "",
  department: "", contractStartDate: "", contractEndDate: "",
  lastPriceIncreaseDate: "", nextIncreaseDate: "", increasePercentage: "",
  activeStatus: true, specialInstructions: "", internalNotes: "",
  frequency: "Monthly", weekOfMonth: "1", dayOfWeek: "", secondDayOfWeek: "",
  startTime: "", secondStartTime: "", estimatedDuration: "",
  fixedTime: false, routeSequence: "",
  assignedTeamId: "", assignedTeamName: "",
  assignedTechnicianId: "", assignedTechnicianName: "",
  confirmWithClientBeforeService: false,
  invoiceRule: "Invoice monthly contract", mustBeInvoiced: true, financeNotes: "",
  notes: "",
};

// ── Schedule Summary ──────────────────────────────────────────────────────────

function scheduleSummary(f: FormData, teamName: string): string {
  if (!f.frequency) return "";
  const t = f.startTime ? ` at ${f.startTime}` : "";
  const ro = f.routeSequence ? ` · Route ${f.routeSequence}` : "";
  const team = teamName || f.assignedTeamName || "";
  const who = team ? ` · ${team}` : "";
  switch (f.frequency) {
    case "On Demand": return "On Demand — create job when requested";
    case "Daily":     return `Daily${t}${who}`;
    case "2 x a week": return `${f.dayOfWeek || "?"} & ${f.secondDayOfWeek || "?"}${t}${who}`;
    case "Weekly":    return `Every ${f.dayOfWeek || "?"}${t}${who}`;
    case "Monthly":   return `${WEEK_OPTS.find(w => w.val === Number(f.weekOfMonth))?.label || "Week 1"} ${f.dayOfWeek || ""}${t}${who}${ro}`;
    case "Twice a month": return `Week ${f.weekOfMonth} ${f.dayOfWeek}${t} and Week ${f.secondDayOfWeek}${t}${who}`;
    default: return `${f.frequency} · ${WEEK_OPTS.find(w => w.val === Number(f.weekOfMonth))?.label || ""} ${f.dayOfWeek || ""}${t}${who}${ro}`;
  }
}

// ── Section Component ─────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children, defaultOpen = true }: {
  icon: any; title: string; children: any; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2 font-semibold text-sm text-gray-800">
          <Icon className="h-4 w-4 text-blue-600" />
          {title}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

function Row({ children, cols = 2 }: { children: any; cols?: number }) {
  return <div className={`grid gap-3 ${cols === 1 ? "" : cols === 3 ? "grid-cols-3" : cols === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"}`}>{children}</div>;
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-gray-600">{label}</Label>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Form Component
// ═════════════════════════════════════════════════════════════════════════════

export default function UnifiedContractForm({ contract, defaultClientId, onSuccess, onCancel }: Props) {
  const { toast } = useToast();

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: teams = [] } = useQuery<Team[]>({ queryKey: ["/api/teams"] });
  const { data: deptDefaults = [] } = useQuery<any[]>({ queryKey: ["/api/department-defaults"] });
  const { data: existingLines = [] } = useQuery<any[]>({
    queryKey: ["/api/unified-contracts", contract?.id, "line-items"],
    queryFn: () => fetch(`/api/unified-contracts/${contract!.id}/line-items`).then(r => r.json()),
    enabled: !!contract?.id,
  });

  const [form, setForm] = useState<FormData>(() => {
    if (contract) {
      return {
        clientId: contract.clientId ?? "",
        contactPerson: contract.contactPerson ?? "",
        contactPhone: contract.contactPhone ?? "",
        contactEmail: contract.contactEmail ?? "",
        address: contract.address ?? "",
        googleMapsLink: contract.googleMapsLink ?? "",
        department: contract.department ?? "",
        contractStartDate: contract.contractStartDate ?? "",
        contractEndDate: contract.contractEndDate ?? "",
        lastPriceIncreaseDate: contract.lastPriceIncreaseDate ?? "",
        nextIncreaseDate: contract.nextIncreaseDate ?? "",
        increasePercentage: contract.increasePercentage ?? "",
        activeStatus: contract.activeStatus ?? true,
        specialInstructions: contract.specialInstructions ?? "",
        internalNotes: contract.internalNotes ?? "",
        frequency: contract.frequency ?? "Monthly",
        weekOfMonth: String(contract.weekOfMonth ?? "1"),
        dayOfWeek: contract.dayOfWeek ?? "",
        secondDayOfWeek: contract.secondDayOfWeek ?? "",
        startTime: contract.startTime ?? "",
        secondStartTime: contract.secondStartTime ?? "",
        estimatedDuration: String(contract.estimatedDuration ?? ""),
        fixedTime: contract.fixedTime ?? false,
        routeSequence: String(contract.routeSequence ?? ""),
        assignedTeamId: contract.assignedTeamId ?? "",
        assignedTeamName: contract.assignedTeamName ?? "",
        assignedTechnicianId: contract.assignedTechnicianId ?? "",
        assignedTechnicianName: contract.assignedTechnicianName ?? "",
        confirmWithClientBeforeService: contract.confirmWithClientBeforeService ?? false,
        invoiceRule: contract.invoiceRule ?? "Invoice monthly contract",
        mustBeInvoiced: contract.mustBeInvoiced ?? true,
        financeNotes: contract.financeNotes ?? "",
        notes: contract.notes ?? "",
      };
    }
    return { ...EMPTY_FORM, clientId: defaultClientId ?? "" };
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([EMPTY_LINE()]);

  useEffect(() => {
    if (existingLines.length > 0) {
      setLineItems(existingLines.map((li: any) => ({
        _key: li.id,
        lineType: li.lineType ?? "Service",
        itemServiceName: li.itemServiceName ?? "",
        serviceCategory: li.serviceCategory ?? "",
        quantity: String(li.quantity ?? "1"),
        unitPrice: String(li.unitPrice ?? ""),
        totalPrice: String(li.totalPrice ?? ""),
        refillRule: li.refillRule ?? "Not Applicable",
        stockTrackingRequired: li.stockTrackingRequired ?? false,
        notes: li.notes ?? "",
      })));
    }
  }, [existingLines.length]);

  // Auto-fill client details when client changes
  useEffect(() => {
    if (!form.clientId) return;
    const client = clients.find(c => c.id === form.clientId);
    if (!client) return;
    setForm(f => ({
      ...f,
      contactPerson: f.contactPerson || client.contactPerson || "",
      contactPhone: f.contactPhone || client.phone || "",
      contactEmail: f.contactEmail || client.email || "",
      address: f.address || client.address || "",
    }));
  }, [form.clientId, clients]);

  // Auto-fill team/technician when department changes
  useEffect(() => {
    if (!form.department) return;
    const def = deptDefaults.find((d: any) => d.department === form.department);
    if (!def) return;
    setForm(f => ({
      ...f,
      assignedTeamId: f.assignedTeamId || def.defaultTeamId || "",
      assignedTeamName: f.assignedTeamName || def.defaultTeamName || "",
      assignedTechnicianId: f.assignedTechnicianId || def.defaultTechnicianId || "",
      assignedTechnicianName: f.assignedTechnicianName || def.defaultTechnicianName || "",
    }));
  }, [form.department, deptDefaults]);

  const set = (key: keyof FormData) => (val: any) =>
    setForm(f => ({ ...f, [key]: val }));

  const setStr = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  // Line item helpers
  const updateLine = (key: string, field: keyof LineItem, val: any) => {
    setLineItems(items => items.map(li => {
      if (li._key !== key) return li;
      const updated = { ...li, [field]: val };
      if (field === "quantity" || field === "unitPrice") {
        const q = parseFloat(field === "quantity" ? val : updated.quantity) || 0;
        const u = parseFloat(field === "unitPrice" ? val : updated.unitPrice) || 0;
        updated.totalPrice = q && u ? (q * u).toFixed(2) : "";
      }
      return updated;
    }));
  };

  const addLine = () => setLineItems(items => [...items, EMPTY_LINE()]);
  const removeLine = (key: string) => setLineItems(items => items.filter(li => li._key !== key));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        weekOfMonth: form.weekOfMonth ? Number(form.weekOfMonth) : null,
        estimatedDuration: form.estimatedDuration ? Number(form.estimatedDuration) : null,
        routeSequence: form.routeSequence ? Number(form.routeSequence) : null,
        lineItems: lineItems.map(({ _key, ...li }) => ({
          ...li,
          quantity: li.quantity || "1",
          unitPrice: li.unitPrice || null,
          totalPrice: li.totalPrice || null,
        })),
      };
      if (contract?.id) {
        return apiRequest("PUT", `/api/unified-contracts/${contract.id}`, payload);
      }
      return apiRequest("POST", "/api/unified-contracts", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-contracts"] });
      toast({ title: contract ? "Contract updated" : "Contract created", description: "Saved successfully." });
      onSuccess();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { toast({ title: "Client required", description: "Please select a client.", variant: "destructive" }); return; }
    if (!form.department) { toast({ title: "Department required", description: "Please select a department.", variant: "destructive" }); return; }
    if (lineItems.some(li => !li.itemServiceName.trim())) {
      toast({ title: "Line item name required", description: "Please fill in all item/service names.", variant: "destructive" }); return;
    }
    saveMutation.mutate();
  };

  const suggestedItems = SERVICE_ITEMS_BY_DEPT[form.department] ?? [];
  const selectedClient = clients.find(c => c.id === form.clientId);
  const teamOptions = teams.filter((t: any) => t.isActive !== false);
  const techOptions = workers.filter(w => w.isActive !== false);
  const summary = scheduleSummary(form, teams.find((t: any) => t.id === form.assignedTeamId)?.name ?? "");
  const showSecondDay = ["2 x a week", "Twice a month"].includes(form.frequency);
  const showWeek = ["Monthly","Every 2 months","Quarterly","Every 6 months","Annually","Twice a month"].includes(form.frequency);
  const showDay = !["Daily","On Demand","Once-off"].includes(form.frequency);
  const showOnceOffDate = ["Once-off","On Demand"].includes(form.frequency);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* ── 1. Client Details ── */}
      <Section icon={User} title="1. Client Details">
        <Field label="Client *">
          <Select value={form.clientId} onValueChange={val => { set("clientId")(val); }}>
            <SelectTrigger><SelectValue placeholder="Select client…" /></SelectTrigger>
            <SelectContent>
              {clients.filter(c => c.status !== "inactive").sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Row>
          <Field label="Contact Person">
            <Input value={form.contactPerson} onChange={setStr("contactPerson")} placeholder="Contact name" />
          </Field>
          <Field label="Phone">
            <Input value={form.contactPhone} onChange={setStr("contactPhone")} placeholder="+27…" />
          </Field>
          <Field label="Email">
            <Input value={form.contactEmail} onChange={setStr("contactEmail")} placeholder="email@example.com" />
          </Field>
          <Field label="Address">
            <Input value={form.address} onChange={setStr("address")} placeholder="Service address" />
          </Field>
        </Row>
        <Field label="Google Maps Link">
          <Input value={form.googleMapsLink} onChange={setStr("googleMapsLink")} placeholder="https://maps.google.com/…" />
        </Field>
      </Section>

      {/* ── 2. Contract Details ── */}
      <Section icon={FileText} title="2. Contract Details">
        <Row>
          <Field label="Department *">
            <Select value={form.department} onValueChange={val => { set("department")(val); set("assignedTeamId")(""); set("assignedTeamName")(""); set("assignedTechnicianId")(""); set("assignedTechnicianName")(""); }}>
              <SelectTrigger><SelectValue placeholder="Select department…" /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <div className="flex items-center gap-3 h-10">
              <Switch checked={form.activeStatus} onCheckedChange={set("activeStatus")} />
              <span className="text-sm">{form.activeStatus ? "Active" : "Inactive"}</span>
            </div>
          </Field>
        </Row>
        <Row>
          <Field label="Start Date">
            <Input type="date" value={form.contractStartDate} onChange={setStr("contractStartDate")} />
          </Field>
          <Field label="End Date">
            <Input type="date" value={form.contractEndDate} onChange={setStr("contractEndDate")} />
          </Field>
          <Field label="Last Price Increase">
            <Input type="date" value={form.lastPriceIncreaseDate} onChange={setStr("lastPriceIncreaseDate")} />
          </Field>
          <Field label="Next Increase Date">
            <Input type="date" value={form.nextIncreaseDate} onChange={setStr("nextIncreaseDate")} />
          </Field>
        </Row>
        <Field label="Increase Percentage (%)">
          <Input
            type="number"
            className="max-w-[180px]"
            value={form.increasePercentage}
            onChange={setStr("increasePercentage")}
            placeholder="e.g. 10"
          />
        </Field>
        <Field label="Special Instructions">
          <Textarea value={form.specialInstructions} onChange={setStr("specialInstructions")} rows={2} placeholder="Instructions visible to technician…" />
        </Field>
        <Field label="Internal Notes">
          <Textarea value={form.internalNotes} onChange={setStr("internalNotes")} rows={2} placeholder="Internal admin notes…" />
        </Field>
      </Section>

      {/* ── 3. Contract Items / Services ── */}
      <Section icon={Package} title="3. Contract Items / Services">
        {suggestedItems.length > 0 && (
          <div className="mb-1">
            <p className="text-xs text-gray-500 mb-1.5">Quick add:</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedItems.map(name => (
                <button
                  key={name} type="button"
                  onClick={() => setLineItems(items => [...items, { ...EMPTY_LINE(), itemServiceName: name }])}
                  className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors"
                >
                  + {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {lineItems.map((li, idx) => (
            <div key={li._key} className="border border-gray-200 rounded-lg p-3 bg-gray-50 relative">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-gray-500 w-5 shrink-0">{idx + 1}</span>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Field label="Line Type">
                    <Select value={li.lineType} onValueChange={v => updateLine(li._key, "lineType", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{LINE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Item / Service Name *">
                    {suggestedItems.length > 0 ? (
                      <Select value={li.itemServiceName} onValueChange={v => updateLine(li._key, "itemServiceName", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select or type…" /></SelectTrigger>
                        <SelectContent>
                          {suggestedItems.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                          <SelectItem value="__custom__">Other (type below)</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        className="h-8 text-xs"
                        value={li.itemServiceName}
                        onChange={e => updateLine(li._key, "itemServiceName", e.target.value)}
                        placeholder="Item or service name"
                      />
                    )}
                  </Field>
                </div>
                {lineItems.length > 1 && (
                  <button type="button" onClick={() => removeLine(li._key)} className="shrink-0 text-red-400 hover:text-red-600 p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {li.itemServiceName === "__custom__" && (
                <Input
                  className="h-8 text-xs mb-2"
                  placeholder="Type item/service name…"
                  value={li.serviceCategory}
                  onChange={e => updateLine(li._key, "serviceCategory", e.target.value)}
                />
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Field label="Qty">
                  <Input className="h-8 text-xs" type="number" value={li.quantity} onChange={e => updateLine(li._key, "quantity", e.target.value)} min="0" step="0.5" />
                </Field>
                <Field label="Unit Price (R)">
                  <Input className="h-8 text-xs" type="number" value={li.unitPrice} onChange={e => updateLine(li._key, "unitPrice", e.target.value)} placeholder="0.00" step="0.01" />
                </Field>
                <Field label="Total (R)">
                  <Input className="h-8 text-xs" value={li.totalPrice} readOnly placeholder="Auto" tabIndex={-1} />
                </Field>
                <Field label="Refill Rule">
                  <Select value={li.refillRule} onValueChange={v => updateLine(li._key, "refillRule", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{REFILL_RULES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={li.stockTrackingRequired}
                    onCheckedChange={v => updateLine(li._key, "stockTrackingRequired", v)}
                    className="scale-75"
                  />
                  <span className="text-xs text-gray-500">Track stock</span>
                </div>
                <Input
                  className="h-7 text-xs flex-1"
                  value={li.notes}
                  onChange={e => updateLine(li._key, "notes", e.target.value)}
                  placeholder="Line notes…"
                />
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addLine} className="mt-1">
          <Plus className="h-3.5 w-3.5 mr-1" />Add Line
        </Button>
      </Section>

      {/* ── 4. Scheduling ── */}
      <Section icon={Calendar} title="4. Scheduling">
        <Row>
          <Field label="Frequency">
            <Select value={form.frequency} onValueChange={set("frequency")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FREQS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {showOnceOffDate && (
            <Field label="Service Date">
              <Input type="date" value={form.contractStartDate} onChange={setStr("contractStartDate")} />
            </Field>
          )}
          {showWeek && (
            <Field label="Week of Month">
              <Select value={form.weekOfMonth} onValueChange={set("weekOfMonth")}>
                <SelectTrigger><SelectValue placeholder="Select week…" /></SelectTrigger>
                <SelectContent>{WEEK_OPTS.map(w => <SelectItem key={w.val} value={String(w.val)}>{w.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          {showDay && (
            <Field label="Day of Week">
              <Select value={form.dayOfWeek} onValueChange={set("dayOfWeek")}>
                <SelectTrigger><SelectValue placeholder="Select day…" /></SelectTrigger>
                <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          {showSecondDay && (
            <Field label="Second Day">
              <Select value={form.secondDayOfWeek} onValueChange={set("secondDayOfWeek")}>
                <SelectTrigger><SelectValue placeholder="Second day…" /></SelectTrigger>
                <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Start Time">
            <Input type="time" value={form.startTime} onChange={setStr("startTime")} />
          </Field>
          {showSecondDay && (
            <Field label="Second Time">
              <Input type="time" value={form.secondStartTime} onChange={setStr("secondStartTime")} />
            </Field>
          )}
          <Field label="Duration (min)">
            <Input type="number" value={form.estimatedDuration} onChange={setStr("estimatedDuration")} placeholder="e.g. 60" />
          </Field>
          <Field label="Route Sequence">
            <Input type="number" value={form.routeSequence} onChange={setStr("routeSequence")} placeholder="e.g. 1" />
          </Field>
        </Row>
        <Row>
          <Field label="Assigned Team">
            <Select value={form.assignedTeamId || "__none__"} onValueChange={val => {
              const t = val === "__none__" ? null : teamOptions.find((t: any) => t.id === val);
              setForm(f => ({
                ...f,
                assignedTeamId: t ? t.id : "",
                assignedTeamName: t ? (t as any).name : "",
              }));
            }}>
              <SelectTrigger><SelectValue placeholder="Select team…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No team assigned</SelectItem>
                {teamOptions.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Assigned Technician">
            <Select value={form.assignedTechnicianId || "__none__"} onValueChange={val => {
              const w = val === "__none__" ? null : techOptions.find(w => w.id === val);
              setForm(f => ({
                ...f,
                assignedTechnicianId: w ? w.id : "",
                assignedTechnicianName: w ? w.name : "",
              }));
            }}>
              <SelectTrigger><SelectValue placeholder="Select technician…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No technician assigned</SelectItem>
                {techOptions.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </Row>
        <div className="flex items-center gap-3">
          <Switch checked={form.fixedTime} onCheckedChange={set("fixedTime")} />
          <span className="text-sm text-gray-700">Fixed time (must start at exact time)</span>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.confirmWithClientBeforeService} onCheckedChange={set("confirmWithClientBeforeService")} />
          <span className="text-sm text-gray-700">Confirm with client before service</span>
        </div>
        {summary && (
          <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <span className="font-medium">Schedule: </span>{summary}
          </div>
        )}
      </Section>

      {/* ── 5. Pricing / Invoicing ── */}
      <Section icon={DollarSign} title="5. Pricing / Invoicing" defaultOpen={false}>
        <Field label="Invoice Rule">
          <Select value={form.invoiceRule} onValueChange={set("invoiceRule")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{INVOICE_RULES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <div className="flex items-center gap-3">
          <Switch checked={form.mustBeInvoiced} onCheckedChange={set("mustBeInvoiced")} />
          <span className="text-sm text-gray-700">Must be invoiced</span>
        </div>
        <Field label="Finance Notes">
          <Textarea value={form.financeNotes} onChange={setStr("financeNotes")} rows={2} placeholder="Finance / billing notes…" />
        </Field>
      </Section>

      {/* ── 6. Notes / Documents ── */}
      <Section icon={StickyNote} title="6. Notes / Documents" defaultOpen={false}>
        <Field label="General Notes">
          <Textarea value={form.notes} onChange={setStr("notes")} rows={3} placeholder="General notes about this contract…" />
        </Field>
      </Section>

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-2 justify-end border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saveMutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : contract ? "Update Contract" : "Create Contract"}
        </Button>
      </div>
    </form>
  );
}

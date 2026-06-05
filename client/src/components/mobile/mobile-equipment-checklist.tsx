import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, CheckCircle, AlertTriangle, ClipboardList,
  ChevronDown, ChevronRight, Camera, Plus, Loader2,
  Shield, Package, Beaker, Wrench, AlertCircle,
} from "lucide-react";
import type { Worker } from "@shared/schema";

// ── Item definitions ─────────────────────────────────────────────────────────

interface TemplateItem {
  name: string;
  critical: boolean;
  hasQty?: boolean;
  serviceType?: string;
}

const GENERAL_ITEMS: TemplateItem[] = [
  { name: "Spray pump (backpack)", critical: true },
  { name: "Spray pump (handheld)", critical: false },
  { name: "Extension wand / lance", critical: false },
  { name: "Torch / flashlight", critical: false },
  { name: "Tool bag / kit", critical: false },
  { name: "First aid kit", critical: true },
  { name: "Warning / hazard tape", critical: false },
  { name: "Material Safety Data Sheets (MSDS)", critical: true },
  { name: "Job sheets / work orders", critical: false },
];

const CHEMICAL_ITEMS: TemplateItem[] = [
  { name: "Insecticide (general use)", critical: false, hasQty: true },
  { name: "Rodenticide (bait blocks)", critical: false, hasQty: true },
  { name: "Termiticide", critical: false, hasQty: true },
  { name: "Sanitiser / Disinfectant", critical: false, hasQty: true },
  { name: "Air freshener / deodoriser", critical: false, hasQty: true },
  { name: "Toilet blocks", critical: false, hasQty: true },
  { name: "Bin liners (sanitary)", critical: false, hasQty: true },
  { name: "Dispensing cups / measuring jug", critical: false },
];

const PPE_ITEMS: TemplateItem[] = [
  { name: "Chemical resistant gloves", critical: true },
  { name: "Safety goggles / glasses", critical: true },
  { name: "Dust mask / respirator (N95)", critical: true },
  { name: "Overalls / coveralls", critical: false },
  { name: "Safety boots (steel toe)", critical: true },
  { name: "Safety vest / hi-vis", critical: false },
  { name: "Ear protection", critical: false },
];

const JOB_SPECIFIC: Record<string, TemplateItem[]> = {
  pest_control: [
    { name: "Bait stations", critical: false, hasQty: true, serviceType: "pest_control" },
    { name: "Tracking powder", critical: false, hasQty: true, serviceType: "pest_control" },
    { name: "Glue boards / traps", critical: false, hasQty: true, serviceType: "pest_control" },
    { name: "Rodent snap traps", critical: false, hasQty: true, serviceType: "pest_control" },
    { name: "Insect light traps (ILT)", critical: false, hasQty: true, serviceType: "pest_control" },
    { name: "Inspection mirror / probe", critical: false, serviceType: "pest_control" },
  ],
  sanitary_bins: [
    { name: "Sanitary bins (empty)", critical: true, hasQty: true, serviceType: "sanitary_bins" },
    { name: "Liner bags", critical: true, hasQty: true, serviceType: "sanitary_bins" },
    { name: "Deodoriser blocks", critical: false, hasQty: true, serviceType: "sanitary_bins" },
    { name: "Disposal / collection bags", critical: true, hasQty: true, serviceType: "sanitary_bins" },
    { name: "Gloves (sanitary handling)", critical: true, serviceType: "sanitary_bins" },
  ],
  washroom: [
    { name: "Soap / liquid hand soap refills", critical: false, hasQty: true, serviceType: "washroom" },
    { name: "Paper towel rolls", critical: false, hasQty: true, serviceType: "washroom" },
    { name: "Toilet rolls", critical: false, hasQty: true, serviceType: "washroom" },
    { name: "Hand sanitiser refills", critical: false, hasQty: true, serviceType: "washroom" },
    { name: "Air freshener refills", critical: false, hasQty: true, serviceType: "washroom" },
    { name: "Replacement dispensers", critical: false, hasQty: true, serviceType: "washroom" },
  ],
  deep_cleaning: [
    { name: "Scrubbing / cleaning machine", critical: true, serviceType: "deep_cleaning" },
    { name: "Wet / dry vacuum", critical: false, serviceType: "deep_cleaning" },
    { name: "Mop and bucket set", critical: false, serviceType: "deep_cleaning" },
    { name: "Degreasers / cleaning agents", critical: false, hasQty: true, serviceType: "deep_cleaning" },
    { name: "Microfibre cloths / sponges", critical: false, hasQty: true, serviceType: "deep_cleaning" },
    { name: "Floor polisher / buffer", critical: false, serviceType: "deep_cleaning" },
    { name: "Steam cleaner", critical: false, serviceType: "deep_cleaning" },
  ],
  dustmats: [
    { name: "Dust mats (clean)", critical: true, hasQty: true, serviceType: "dustmats" },
    { name: "Mat bags / covers", critical: false, hasQty: true, serviceType: "dustmats" },
  ],
  urinal_mats: [
    { name: "Urinal mats (new)", critical: true, hasQty: true, serviceType: "urinal_mats" },
    { name: "Urinal mat disposal bags", critical: false, hasQty: true, serviceType: "urinal_mats" },
  ],
};

// ── Local types ───────────────────────────────────────────────────────────────

type Present = "yes" | "no" | "na";
type Condition = "good" | "damaged" | "needs_replacement" | "missing";

interface ItemState {
  name: string;
  category: string;
  isCritical: boolean;
  hasQty: boolean;
  serviceType?: string;
  present: Present;
  condition: Condition;
  quantityTaken: string;
  notes: string;
}

interface HeaderState {
  checklistType: "daily" | "job_specific";
  teamName: string;
  vehicleRegistration: string;
  technicianName: string;
  notes: string;
  serviceTypes: string[];
}

type Screen = "home" | "form" | "done";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(t: TemplateItem, category: string): ItemState {
  return {
    name: t.name,
    category,
    isCritical: t.critical,
    hasQty: t.hasQty ?? false,
    serviceType: t.serviceType,
    present: "yes",
    condition: "good",
    quantityTaken: "",
    notes: "",
  };
}

function buildItems(type: "daily" | "job_specific", serviceTypes: string[]): ItemState[] {
  const items: ItemState[] = [
    ...GENERAL_ITEMS.map(t => makeItem(t, "general")),
    ...CHEMICAL_ITEMS.map(t => makeItem(t, "chemicals")),
    ...PPE_ITEMS.map(t => makeItem(t, "ppe")),
  ];
  const stKeys = type === "daily"
    ? Object.keys(JOB_SPECIFIC)
    : serviceTypes.map(s => {
        if (s.startsWith("washroom")) return "washroom";
        return s;
      });
  const seen = new Set<string>();
  for (const key of stKeys) {
    if (JOB_SPECIFIC[key] && !seen.has(key)) {
      seen.add(key);
      items.push(...JOB_SPECIFIC[key].map(t => makeItem(t, "job_specific")));
    }
  }
  return items;
}

const SECTION_LABELS: Record<string, string> = {
  general: "General Equipment",
  chemicals: "Chemicals / Consumables",
  ppe: "PPE / Safety Equipment",
  job_specific: "Job-Specific Equipment",
};

const SECTION_ICONS: Record<string, any> = {
  general: Wrench,
  chemicals: Beaker,
  ppe: Shield,
  job_specific: Package,
};

// ── Item row component ────────────────────────────────────────────────────────

function ItemRow({
  item,
  onChange,
}: {
  item: ItemState;
  onChange: (updated: Partial<ItemState>) => void;
}) {
  const isBad = item.present === "no" || item.condition === "damaged" || item.condition === "needs_replacement" || item.condition === "missing";
  const isCriticalIssue = item.isCritical && item.present === "no";

  return (
    <div className={`border rounded-lg p-3 mb-2 ${isCriticalIssue ? "border-red-400 bg-red-50" : isBad ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start gap-2 mb-2">
        {item.isCritical && (
          <span className="shrink-0 mt-0.5">
            <AlertCircle className="h-4 w-4 text-red-500" />
          </span>
        )}
        <p className="text-sm font-medium text-gray-900 flex-1">{item.name}</p>
        {item.isCritical && <Badge className="shrink-0 bg-red-100 text-red-700 text-xs">Critical</Badge>}
      </div>

      {/* Present */}
      <div className="mb-2">
        <p className="text-xs text-gray-500 mb-1">Present</p>
        <div className="flex gap-1">
          {(["yes", "no", "na"] as Present[]).map(v => (
            <button
              key={v}
              onClick={() => onChange({ present: v })}
              className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${
                item.present === v
                  ? v === "yes" ? "bg-green-500 text-white border-green-500"
                    : v === "no" ? "bg-red-500 text-white border-red-500"
                    : "bg-gray-400 text-white border-gray-400"
                  : "bg-white text-gray-600 border-gray-300"
              }`}
            >
              {v === "na" ? "N/A" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Condition (show only if present) */}
      {item.present === "yes" && (
        <div className="mb-2">
          <p className="text-xs text-gray-500 mb-1">Condition</p>
          <div className="grid grid-cols-2 gap-1">
            {(["good", "damaged", "needs_replacement", "missing"] as Condition[]).map(v => (
              <button
                key={v}
                onClick={() => onChange({ condition: v })}
                className={`py-1.5 rounded text-xs font-medium border transition-colors ${
                  item.condition === v
                    ? v === "good" ? "bg-green-500 text-white border-green-500"
                      : v === "damaged" ? "bg-amber-500 text-white border-amber-500"
                      : v === "needs_replacement" ? "bg-orange-500 text-white border-orange-500"
                      : "bg-red-500 text-white border-red-500"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
              >
                {v === "needs_replacement" ? "Needs Repl." : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity */}
      {item.hasQty && item.present === "yes" && (
        <div className="mb-2">
          <p className="text-xs text-gray-500 mb-1">Qty taken</p>
          <input
            type="number"
            min="0"
            value={item.quantityTaken}
            onChange={e => onChange({ quantityTaken: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            placeholder="0"
          />
        </div>
      )}

      {/* Notes (show if bad or notes already entered) */}
      {(isBad || item.notes) && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Notes {isCriticalIssue && <span className="text-red-500">*</span>}</p>
          <textarea
            value={item.notes}
            onChange={e => onChange({ notes: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-none"
            rows={2}
            placeholder={isCriticalIssue ? "Describe why this critical item is missing..." : "Optional note..."}
          />
        </div>
      )}
    </div>
  );
}

// ── Section component ─────────────────────────────────────────────────────────

function Section({
  category,
  items,
  onUpdate,
}: {
  category: string;
  items: ItemState[];
  onUpdate: (idx: number, updated: Partial<ItemState>) => void;
}) {
  const [open, setOpen] = useState(true);
  const Icon = SECTION_ICONS[category] ?? Package;
  const issues = items.filter(i => i.present === "no" || i.condition !== "good").length;
  const criticalIssues = items.filter(i => i.isCritical && i.present === "no").length;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-gray-800 text-white rounded-lg px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="font-semibold text-sm">{SECTION_LABELS[category]}</span>
          {criticalIssues > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{criticalIssues} critical</span>
          )}
          {issues > 0 && criticalIssues === 0 && (
            <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{issues} issue{issues > 1 ? "s" : ""}</span>
          )}
        </div>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="mt-2 px-1">
          {items.map((item, i) => (
            <ItemRow key={item.name} item={item} onChange={upd => onUpdate(i, upd)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  worker: Worker;
  onBack: () => void;
}

export function MobileEquipmentChecklist({ worker, onBack }: Props) {
  const [screen, setScreen] = useState<Screen>("home");
  const [header, setHeader] = useState<HeaderState>({
    checklistType: "daily",
    teamName: "",
    vehicleRegistration: "",
    technicianName: worker.name,
    notes: "",
    serviceTypes: [],
  });
  const [items, setItems] = useState<ItemState[]>([]);
  const [saving, setSaving] = useState(false);
  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [todayChecklists, setTodayChecklists] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showCriticalBlock, setShowCriticalBlock] = useState(false);
  const [supervisorPin, setSupervisorPin] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [submittedChecklist, setSubmittedChecklist] = useState<any>(null);

  const today = new Date().toISOString().slice(0, 10);

  const token = localStorage.getItem("mobile_session_token");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`/api/equipment-checklists?date=${today}&workerId=${worker.id}`, { headers })
      .then(r => r.json())
      .then(d => { setTodayChecklists(Array.isArray(d) ? d : []); setLoadingHistory(false); })
      .catch(() => setLoadingHistory(false));
  }, []);

  function startChecklist(type: "daily" | "job_specific") {
    const built = buildItems(type, header.serviceTypes);
    setItems(built);
    setHeader(h => ({ ...h, checklistType: type }));
    setScreen("form");
    setShowCriticalBlock(false);
  }

  function updateItem(globalIdx: number, updated: Partial<ItemState>) {
    setItems(prev => prev.map((it, i) => i === globalIdx ? { ...it, ...updated } : it));
  }

  const criticalMissing = items.filter(i => i.isCritical && i.present === "no");

  async function handleSubmit(status: "passed" | "passed_with_notes" | "failed", supervisorOverride = false) {
    setSaving(true);
    try {
      const payload = {
        checklistType: header.checklistType,
        date: today,
        technicianId: worker.id,
        technicianName: header.technicianName || worker.name,
        teamName: header.teamName || null,
        vehicleRegistration: header.vehicleRegistration || null,
        notes: header.notes || null,
        serviceTypes: header.serviceTypes.length ? header.serviceTypes : null,
        status,
        submittedAt: new Date().toISOString(),
        hasCriticalMissing: criticalMissing.length > 0,
        supervisorOverride,
        supervisorName: supervisorOverride ? supervisorName : null,
      };

      const createRes = await fetch("/api/equipment-checklists", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const created = await createRes.json();
      setChecklistId(created.id);

      await fetch(`/api/equipment-checklists/${created.id}/items`, {
        method: "POST",
        headers,
        body: JSON.stringify(items.map(it => ({
          itemName: it.name,
          category: it.category,
          isCritical: it.isCritical,
          present: it.present,
          condition: it.condition,
          quantityTaken: it.quantityTaken ? parseInt(it.quantityTaken) : null,
          notes: it.notes || null,
          serviceType: it.serviceType || null,
        }))),
      });

      setSubmittedChecklist({ ...created, status });
      setTodayChecklists(prev => [created, ...prev]);
      setScreen("done");
    } catch (e) {
      console.error("Submit error", e);
    } finally {
      setSaving(false);
    }
  }

  function computeStatus(): "passed" | "passed_with_notes" | "failed" {
    const hasIssues = items.some(i => i.present === "no" || i.condition !== "good");
    const hasCritical = criticalMissing.length > 0;
    const hasNotes = items.some(i => i.notes);
    if (hasCritical) return "failed";
    if (hasIssues) return "passed_with_notes";
    if (hasNotes) return "passed_with_notes";
    return "passed";
  }

  function onSubmitPress() {
    if (criticalMissing.length > 0) {
      setShowCriticalBlock(true);
      return;
    }
    handleSubmit(computeStatus());
  }

  // Group items by category
  const categories = ["general", "chemicals", "ppe", "job_specific"];
  const itemsByCategory = categories.reduce((acc, cat) => {
    const catItems = items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.category === cat);
    if (catItems.length) acc[cat] = catItems;
    return acc;
  }, {} as Record<string, { item: ItemState; idx: number }[]>);

  const STATUS_COLORS: Record<string, string> = {
    passed: "bg-green-100 text-green-800",
    passed_with_notes: "bg-orange-100 text-orange-800",
    failed: "bg-red-100 text-red-800",
    pending: "bg-gray-100 text-gray-700",
  };

  // ── HOME ─────────────────────────────────────────────────────────────────────
  if (screen === "home") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-green-700 text-white p-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-white hover:bg-green-800 p-1 rounded">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold">Equipment Checklist</h1>
              <p className="text-green-100 text-sm">{worker.name}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Today's submissions */}
          {!loadingHistory && todayChecklists.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Today's Submissions</h3>
              <div className="space-y-2">
                {todayChecklists.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{c.checklistType.replace("_", " ")} checklist</p>
                      <p className="text-xs text-gray-500">{c.submittedAt ? new Date(c.submittedAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : "Draft"}</p>
                    </div>
                    <Badge className={STATUS_COLORS[c.status] ?? STATUS_COLORS.pending}>
                      {c.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New checklist options */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-1">Start New Checklist</h3>
            <p className="text-xs text-gray-500 mb-4">Complete before leaving the depot or starting a job.</p>

            <button
              onClick={() => startChecklist("daily")}
              className="w-full mb-3 flex items-center gap-4 bg-green-50 border border-green-200 rounded-xl p-4 text-left hover:bg-green-100 transition-colors"
            >
              <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Daily Equipment Checklist</p>
                <p className="text-xs text-gray-500 mt-0.5">General equipment, chemicals, PPE + all job types</p>
              </div>
            </button>

            <div className="mb-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Job-Specific Checklist — select service types:</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { key: "pest_control", label: "Pest Control" },
                  { key: "sanitary_bins", label: "Sanitary Bins" },
                  { key: "washroom", label: "Washroom" },
                  { key: "deep_cleaning", label: "Deep Cleaning" },
                  { key: "dustmats", label: "Dust Mats" },
                  { key: "urinal_mats", label: "Urinal Mats" },
                ].map(({ key, label }) => {
                  const sel = header.serviceTypes.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => setHeader(h => ({
                        ...h,
                        serviceTypes: sel ? h.serviceTypes.filter(s => s !== key) : [...h.serviceTypes, key],
                      }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        sel ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  if (header.serviceTypes.length === 0) return;
                  startChecklist("job_specific");
                }}
                disabled={header.serviceTypes.length === 0}
                className="w-full flex items-center gap-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-left hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Job-Specific Checklist</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {header.serviceTypes.length === 0
                      ? "Select service types above first"
                      : `${header.serviceTypes.length} type${header.serviceTypes.length > 1 ? "s" : ""} selected`}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE ─────────────────────────────────────────────────────────────────────
  if (screen === "done") {
    const status = submittedChecklist?.status ?? "passed";
    const colors = { passed: "text-green-600", passed_with_notes: "text-orange-500", failed: "text-red-600" };
    const icons = { passed: CheckCircle, passed_with_notes: AlertTriangle, failed: AlertTriangle };
    const Icon = icons[status as keyof typeof icons] ?? CheckCircle;
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <Icon className={`h-20 w-20 mb-4 ${colors[status as keyof typeof colors] ?? "text-green-600"}`} />
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Checklist Submitted</h2>
        <Badge className={`mb-4 ${STATUS_COLORS[status] ?? ""}`}>{status.replace(/_/g, " ")}</Badge>
        <p className="text-gray-500 text-sm mb-8">
          Submitted at {new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <Button onClick={onBack} className="w-full max-w-xs">Back to Menu</Button>
        <Button variant="outline" className="w-full max-w-xs mt-2" onClick={() => { setScreen("home"); setItems([]); setShowCriticalBlock(false); }}>
          New Checklist
        </Button>
      </div>
    );
  }

  // ── FORM ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 text-white p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen("home")} className="text-white hover:bg-green-800 p-1 rounded">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold">
              {header.checklistType === "daily" ? "Daily Equipment Checklist" : "Job-Specific Checklist"}
            </h1>
            <p className="text-green-100 text-xs">{new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Header fields */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">Checklist Details</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Technician / Team Leader</label>
              <input
                type="text"
                value={header.technicianName}
                onChange={e => setHeader(h => ({ ...h, technicianName: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Team</label>
                <input
                  type="text"
                  value={header.teamName}
                  onChange={e => setHeader(h => ({ ...h, teamName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Team A"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Vehicle Reg.</label>
                <input
                  type="text"
                  value={header.vehicleRegistration}
                  onChange={e => setHeader(h => ({ ...h, vehicleRegistration: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. CA 123 GP"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">General Notes</label>
              <textarea
                value={header.notes}
                onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                rows={2}
                placeholder="Optional notes for this checklist..."
              />
            </div>
          </div>
        </div>

        {/* Critical missing warning */}
        {criticalMissing.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Critical items not present</p>
              <ul className="mt-1 space-y-0.5">
                {criticalMissing.map(i => (
                  <li key={i.name} className="text-xs text-red-700">• {i.name}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Checklist sections */}
        {Object.entries(itemsByCategory).map(([cat, catItems]) => (
          <Section
            key={cat}
            category={cat}
            items={catItems.map(({ item }) => item)}
            onUpdate={(localIdx, updated) => {
              const globalIdx = catItems[localIdx].idx;
              updateItem(globalIdx, updated);
            }}
          />
        ))}

        {/* Submit area */}
        <div className="mt-4 pb-8">
          {showCriticalBlock && criticalMissing.length > 0 ? (
            <div className="bg-red-50 border border-red-300 rounded-xl p-4">
              <div className="flex gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-sm font-semibold text-red-800">Supervisor override required</p>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                {criticalMissing.length} critical item{criticalMissing.length > 1 ? "s are" : " is"} not present.
                A supervisor must authorise submission.
              </p>
              <input
                type="text"
                placeholder="Supervisor name"
                value={supervisorName}
                onChange={e => setSupervisorName(e.target.value)}
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm mb-2"
              />
              <input
                type="password"
                placeholder="Supervisor PIN (1234)"
                value={supervisorPin}
                onChange={e => setSupervisorPin(e.target.value)}
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm mb-3"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCriticalBlock(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={!supervisorName || supervisorPin !== "1234" || saving}
                  onClick={() => handleSubmit("failed", true)}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Override & Submit"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 text-base"
              onClick={onSubmitPress}
              disabled={saving}
            >
              {saving ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Submitting...</>
              ) : (
                <><CheckCircle className="h-5 w-5 mr-2" /> Submit Checklist</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

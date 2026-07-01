import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, ChevronDown, ChevronUp, User, FileText, Package,
  Calendar, DollarSign, Box, StickyNote, Wrench, Search,
} from "lucide-react";
import type { Client, Worker, Team, InventoryItem } from "@shared/schema";

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEPARTMENTS = [
  "Pest Control", "Hygiene", "Washroom", "Sanitary Bins",
  "Dustmats", "Deep Cleaning", "Other",
] as const;

const DEPT_TO_DIV_ID: Record<string, string> = {
  "Pest Control":  "div-1",
  "Sanitary Bins": "div-2",
  "Hygiene":       "div-2",
  "Washroom":      "div-3",
  "Dustmats":      "div-3",
  "Deep Cleaning": "div-4",
};

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
  "Inventory Item", "Service", "Refill / Consumable", "Rental Equipment", "Other",
] as const;

const REFILL_RULES = [
  "Including Refills", "Excluding Refills", "Refill Only",
  "On Demand Refills", "Not Applicable",
] as const;

const REFILL_ARRANGEMENTS = [
  "Not Applicable",
  "Refills Included in Rental",
  "Refills Charged Separately",
  "Client Supplies Own Refills",
  "On Demand Refills",
  "Refill Only",
] as const;

const WASHROOM_HYGIENE_DEPTS = new Set(["Washroom", "Hygiene"]);

function showRefillSection(dept: string, lineType: string): boolean {
  return WASHROOM_HYGIENE_DEPTS.has(dept) && lineType !== "Service";
}

function arrangementToBooleans(a: string) {
  return {
    refillIncludedInPrice:    a === "Refills Included in Rental",
    refillBillableSeparately: ["Refills Charged Separately", "On Demand Refills", "Refill Only"].includes(a),
    clientSuppliesOwnRefills: a === "Client Supplies Own Refills",
  };
}

const INVOICE_RULES = [
  "Invoice per completed job", "Invoice monthly contract",
  "Invoice on demand", "Do not invoice automatically",
] as const;

// Predefined service items (not physical inventory — no stockItemId)
const PREDEFINED_SERVICES: Array<{
  name: string; depts: string[]; lineType: string; category: string;
}> = [
  // Sanitary Bins
  { name: "Sanitary Bin Service / Exchange",    depts: ["Sanitary Bins"],           lineType: "Service",             category: "Sanitary Bins" },
  { name: "Sanitary Bin Cleaning",              depts: ["Sanitary Bins"],           lineType: "Service",             category: "Sanitary Bins" },
  { name: "Sanitary Bin Placement",             depts: ["Sanitary Bins"],           lineType: "Service",             category: "Sanitary Bins" },
  { name: "Sanitary Bin Replacement if needed", depts: ["Sanitary Bins"],           lineType: "Service",             category: "Sanitary Bins" },
  // Washroom / Hygiene
  { name: "Washroom Service",                   depts: ["Washroom", "Hygiene"],     lineType: "Service",             category: "Washroom" },
  { name: "On-demand Refills",                  depts: ["Washroom", "Hygiene"],     lineType: "Refill / Consumable", category: "Washroom" },
  // Pest Control
  { name: "Pest Control Service",               depts: ["Pest Control"],            lineType: "Service",             category: "Pest Control" },
  { name: "Rodent Service",                     depts: ["Pest Control"],            lineType: "Service",             category: "Pest Control" },
  { name: "Cockroach Service",                  depts: ["Pest Control"],            lineType: "Service",             category: "Pest Control" },
  { name: "Inspection",                         depts: ["Pest Control"],            lineType: "Service",             category: "Pest Control" },
  { name: "Treatment",                          depts: ["Pest Control"],            lineType: "Service",             category: "Pest Control" },
  { name: "Monitoring",                         depts: ["Pest Control"],            lineType: "Service",             category: "Pest Control" },
  { name: "Baiting",                            depts: ["Pest Control"],            lineType: "Service",             category: "Pest Control" },
  { name: "COC Inspection",                     depts: ["Pest Control"],            lineType: "Service",             category: "Pest Control" },
  // Dustmats
  { name: "Dustmat Rental",                     depts: ["Dustmats"],                lineType: "Rental Equipment",    category: "Dustmats" },
  { name: "Dustmat Replacement",                depts: ["Dustmats"],                lineType: "Service",             category: "Dustmats" },
  { name: "Dustmat Cleaning",                   depts: ["Dustmats"],                lineType: "Service",             category: "Dustmats" },
  // Deep Cleaning
  { name: "Deep Cleaning Service",              depts: ["Deep Cleaning"],           lineType: "Service",             category: "Deep Cleaning" },
  { name: "Recurring Deep Clean",               depts: ["Deep Cleaning"],           lineType: "Service",             category: "Deep Cleaning" },
  { name: "Once-off Deep Clean",                depts: ["Deep Cleaning"],           lineType: "Service",             category: "Deep Cleaning" },
  { name: "Hygiene Deep Clean",                 depts: ["Deep Cleaning"],           lineType: "Service",             category: "Deep Cleaning" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type CatalogItem = {
  stockItemId: string;
  name: string;
  lineType: string;
  serviceCategory: string;
  stockTrackingDefault: boolean;
  unitPrice: string;
  divId: string;     // div-1/2/3/4 for inventory items, "" for services
  depts: string[];   // dept names for service items
  source: "inventory" | "service";
};

type SimpleInclude = {
  _key: string;
  stockItemId: string;
  itemServiceName: string;
  lineType: string;
  serviceCategory: string;
  quantity: string;
  unitPrice: string;
  refillRule: string;
  stockTrackingRequired: boolean;
  notes: string;
  refillArrangement: string;
  refillIncludedInPrice: boolean;
  refillBillableSeparately: boolean;
  clientSuppliesOwnRefills: boolean;
  linkedRefillStockItemId: string;
  linkedRefillItemName: string;
  separateRefillPrice: string;
};

type LineItem = {
  _key: string;
  stockItemId: string;
  lineType: string;
  itemServiceName: string;
  serviceCategory: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  refillRule: string;
  stockTrackingRequired: boolean;
  notes: string;
  refillArrangement: string;
  refillIncludedInPrice: boolean;
  refillBillableSeparately: boolean;
  clientSuppliesOwnRefills: boolean;
  linkedRefillStockItemId: string;
  linkedRefillItemName: string;
  separateRefillPrice: string;
};

type FormData = {
  clientId: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  googleMapsLink: string;
  department: string;
  contractStartDate: string;
  contractEndDate: string;
  lastPriceIncreaseDate: string;
  nextIncreaseDate: string;
  increasePercentage: string;
  activeStatus: boolean;
  specialInstructions: string;
  internalNotes: string;
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
  invoiceRule: string;
  mustBeInvoiced: boolean;
  financeNotes: string;
  notes: string;
};

type Props = {
  contract?: any;
  defaultClientId?: string;
  onSuccess: () => void;
  onCancel: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function inventoryItemToLineType(item: InventoryItem): string {
  const cat = (item.category || "").toLowerCase();
  if (item.type === "rental_equipment") return "Rental Equipment";
  if (cat.includes("refill") || cat.includes("consumable")) return "Refill / Consumable";
  return "Inventory Item";
}

function buildCatalog(inventoryItems: InventoryItem[], selectedDept: string): CatalogItem[] {
  const selectedDivId = DEPT_TO_DIV_ID[selectedDept] ?? "";

  const invItems: CatalogItem[] = inventoryItems
    .filter(i => i.activeStatus !== false && (i as any).name !== "test")
    .map(i => ({
      stockItemId: i.id,
      name: i.name,
      lineType: inventoryItemToLineType(i),
      serviceCategory: i.category || "",
      stockTrackingDefault: true,
      unitPrice: String((i as any).sellingPrice || i.unitPrice || ""),
      divId: (i as any).departmentId || "",
      depts: [],
      source: "inventory" as const,
    }));

  const svcItems: CatalogItem[] = PREDEFINED_SERVICES.map(s => ({
    stockItemId: "",
    name: s.name,
    lineType: s.lineType,
    serviceCategory: s.category,
    stockTrackingDefault: false,
    unitPrice: "",
    divId: "",
    depts: s.depts,
    source: "service" as const,
  }));

  const all = [...invItems, ...svcItems];

  return all.sort((a, b) => {
    const aMatch = a.source === "inventory"
      ? a.divId === selectedDivId
      : a.depts.includes(selectedDept);
    const bMatch = b.source === "inventory"
      ? b.divId === selectedDivId
      : b.depts.includes(selectedDept);
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    if (a.source !== b.source) return a.source === "inventory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

const EMPTY_LINE = (): LineItem => ({
  _key: Math.random().toString(36).slice(2),
  stockItemId: "",
  lineType: "Service",
  itemServiceName: "",
  serviceCategory: "",
  quantity: "1",
  unitPrice: "",
  totalPrice: "",
  refillRule: "Not Applicable",
  stockTrackingRequired: false,
  notes: "",
  refillArrangement: "Not Applicable",
  refillIncludedInPrice: false,
  refillBillableSeparately: false,
  clientSuppliesOwnRefills: false,
  linkedRefillStockItemId: "",
  linkedRefillItemName: "",
  separateRefillPrice: "",
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

  const { data: clients = [] }       = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: workers = [] }       = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: teams = [] }         = useQuery<Team[]>({ queryKey: ["/api/teams"] });
  const { data: deptDefaults = [] }  = useQuery<any[]>({ queryKey: ["/api/department-defaults"] });
  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({ queryKey: ["/api/inventory"] });
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

  // ── Line item state ────────────────────────────────────────────────────────
  const [lineItems, setLineItems]     = useState<LineItem[]>([EMPTY_LINE()]);
  const [simpleItems, setSimpleItems] = useState<SimpleInclude[]>([]);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [hasLoadedExisting, setHasLoadedExisting] = useState(false);

  // ── Search state ───────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen]   = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Catalog ────────────────────────────────────────────────────────────────
  const catalog = useMemo(
    () => buildCatalog(inventoryItems, form.department),
    [inventoryItems, form.department],
  );

  const filteredCatalog = useMemo(() => {
    const addedNames = new Set(simpleItems.map(i => i.itemServiceName));
    const q = searchQuery.trim().toLowerCase();
    const base = q
      ? catalog.filter(i => i.name.toLowerCase().includes(q))
      : catalog;
    return base.filter(i => !addedNames.has(i.name)).slice(0, 12);
  }, [searchQuery, catalog, simpleItems]);

  // ── Restore existing lines when editing ───────────────────────────────────
  useEffect(() => {
    if (existingLines.length === 0) return;
    setHasLoadedExisting(true);
    setSimpleItems(existingLines.map((li: any) => ({
      _key: li.id,
      stockItemId: li.stockItemId || "",
      itemServiceName: li.itemServiceName || "",
      lineType: li.lineType || "Service",
      serviceCategory: li.serviceCategory || "",
      quantity: String(li.quantity ?? "1"),
      unitPrice: String(li.unitPrice ?? ""),
      refillRule: li.refillRule || "Not Applicable",
      stockTrackingRequired: li.stockTrackingRequired ?? false,
      notes: li.notes || "",
      refillArrangement: li.refillArrangement || "Not Applicable",
      refillIncludedInPrice: li.refillIncludedInPrice ?? false,
      refillBillableSeparately: li.refillBillableSeparately ?? false,
      clientSuppliesOwnRefills: li.clientSuppliesOwnRefills ?? false,
      linkedRefillStockItemId: li.linkedRefillStockItemId || "",
      linkedRefillItemName: li.linkedRefillItemName || "",
      separateRefillPrice: String(li.separateRefillPrice ?? ""),
    })));
    setAdvancedMode(false);
  }, [existingLines.length]);

  // ── Reset items when department changes (new contracts only) ───────────────
  useEffect(() => {
    if (!form.department || hasLoadedExisting) return;
    setSimpleItems([]);
    setSearchQuery("");
  }, [form.department]); // eslint-disable-line

  // ── Auto-fill client details ───────────────────────────────────────────────
  useEffect(() => {
    if (!form.clientId) return;
    const client = clients.find(c => c.id === form.clientId);
    if (!client) return;
    setForm(f => ({
      ...f,
      contactPerson: f.contactPerson || client.contactPerson || "",
      contactPhone:  f.contactPhone  || client.phone         || "",
      contactEmail:  f.contactEmail  || client.email         || "",
      address:       f.address       || client.address       || "",
    }));
  }, [form.clientId, clients]);

  // ── Auto-fill team/technician when department changes ─────────────────────
  useEffect(() => {
    if (!form.department) return;
    const divId = DEPT_TO_DIV_ID[form.department];
    const deptWorkers = divId
      ? workers.filter(w => (w as any).departmentId === divId && w.isActive !== false)
      : workers.filter(w => w.isActive !== false);
    const def = deptDefaults.find((d: any) => d.department === form.department);
    setForm(f => {
      const teamId   = def?.defaultTeamId       || f.assignedTeamId       || "";
      const teamName = def?.defaultTeamName      || f.assignedTeamName     || "";
      const singleTech = !def && deptWorkers.length === 1 ? deptWorkers[0] : null;
      const techId   = def?.defaultTechnicianId  || (singleTech?.id    ?? f.assignedTechnicianId   ?? "");
      const techName = def?.defaultTechnicianName || (singleTech?.name  ?? f.assignedTechnicianName ?? "");
      return { ...f, assignedTeamId: teamId, assignedTeamName: teamName, assignedTechnicianId: techId, assignedTechnicianName: techName };
    });
  }, [form.department, deptDefaults, workers]);

  const set    = (key: keyof FormData) => (val: any) => setForm(f => ({ ...f, [key]: val }));
  const setStr = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  // ── Simple mode helpers ────────────────────────────────────────────────────
  const addSimpleItem = (cat: CatalogItem) => {
    if (simpleItems.some(i => i.itemServiceName === cat.name)) {
      toast({ title: "Already added", description: `${cat.name} is already in the list.` });
      return;
    }
    setSimpleItems(items => [...items, {
      _key: Math.random().toString(36).slice(2),
      stockItemId: cat.stockItemId,
      itemServiceName: cat.name,
      lineType: cat.lineType,
      serviceCategory: cat.serviceCategory,
      quantity: "1",
      unitPrice: cat.unitPrice,
      refillRule: "Not Applicable",
      stockTrackingRequired: cat.stockTrackingDefault,
      notes: "",
      refillArrangement: "Not Applicable",
      refillIncludedInPrice: false,
      refillBillableSeparately: false,
      clientSuppliesOwnRefills: false,
      linkedRefillStockItemId: "",
      linkedRefillItemName: "",
      separateRefillPrice: "",
    }]);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const removeSimpleItem = (key: string) =>
    setSimpleItems(items => items.filter(i => i._key !== key));

  const updateSimpleItem = (key: string, field: keyof SimpleInclude, val: any) =>
    setSimpleItems(items => items.map(i => {
      if (i._key !== key) return i;
      const updated: SimpleInclude = { ...i, [field]: val };
      if (field === "refillArrangement") {
        Object.assign(updated, arrangementToBooleans(val));
        if (val === "Client Supplies Own Refills") updated.stockTrackingRequired = false;
        else if (val !== "Not Applicable")         updated.stockTrackingRequired = true;
        if (!["Refills Included in Rental", "Refills Charged Separately", "On Demand Refills"].includes(val)) {
          updated.linkedRefillStockItemId = "";
          updated.linkedRefillItemName    = "";
        }
      }
      return updated;
    }));

  const setLinkedRefillItem = (key: string, id: string, name: string) =>
    setSimpleItems(items => items.map(i =>
      i._key === key ? { ...i, linkedRefillStockItemId: id, linkedRefillItemName: name } : i
    ));

  // ── Mode switching ─────────────────────────────────────────────────────────
  const goToAdvanced = () => {
    setLineItems(simpleItems.length > 0
      ? simpleItems.map(i => {
          const q = parseFloat(i.quantity) || 1;
          const u = parseFloat(i.unitPrice) || 0;
          return {
            _key: i._key,
            stockItemId: i.stockItemId,
            lineType: i.lineType,
            itemServiceName: i.itemServiceName,
            serviceCategory: i.serviceCategory,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: q && u ? (q * u).toFixed(2) : "",
            refillRule: i.refillRule,
            stockTrackingRequired: i.stockTrackingRequired,
            notes: i.notes,
            refillArrangement: i.refillArrangement,
            refillIncludedInPrice: i.refillIncludedInPrice,
            refillBillableSeparately: i.refillBillableSeparately,
            clientSuppliesOwnRefills: i.clientSuppliesOwnRefills,
            linkedRefillStockItemId: i.linkedRefillStockItemId,
            linkedRefillItemName: i.linkedRefillItemName,
            separateRefillPrice: i.separateRefillPrice,
          };
        })
      : [EMPTY_LINE()]
    );
    setAdvancedMode(true);
  };

  const goToSimple = () => {
    setSimpleItems(lineItems
      .filter(li => li.itemServiceName.trim())
      .map(li => ({
        _key: li._key,
        stockItemId: li.stockItemId,
        itemServiceName: li.itemServiceName,
        lineType: li.lineType,
        serviceCategory: li.serviceCategory,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        refillRule: li.refillRule,
        stockTrackingRequired: li.stockTrackingRequired,
        notes: li.notes,
        refillArrangement: li.refillArrangement,
        refillIncludedInPrice: li.refillIncludedInPrice,
        refillBillableSeparately: li.refillBillableSeparately,
        clientSuppliesOwnRefills: li.clientSuppliesOwnRefills,
        linkedRefillStockItemId: li.linkedRefillStockItemId,
        linkedRefillItemName: li.linkedRefillItemName,
        separateRefillPrice: li.separateRefillPrice,
      }))
    );
    setAdvancedMode(false);
  };

  // ── Advanced line helpers ──────────────────────────────────────────────────
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
  const addLine    = () => setLineItems(items => [...items, EMPTY_LINE()]);
  const removeLine = (key: string) => setLineItems(items => items.filter(li => li._key !== key));

  // ── Build line items for save ──────────────────────────────────────────────
  const getActiveLineItems = () => {
    if (advancedMode) return lineItems;
    return simpleItems.map(i => {
      const q = parseFloat(i.quantity) || 1;
      const u = parseFloat(i.unitPrice) || 0;
      return {
        _key: i._key,
        stockItemId: i.stockItemId,
        lineType: i.lineType,
        itemServiceName: i.itemServiceName,
        serviceCategory: i.serviceCategory,
        quantity: String(q),
        unitPrice: i.unitPrice || "0",
        totalPrice: u ? (q * u).toFixed(2) : "0",
        refillRule: i.refillRule,
        stockTrackingRequired: i.stockTrackingRequired,
        notes: i.notes,
        refillArrangement: i.refillArrangement,
        refillIncludedInPrice: i.refillIncludedInPrice,
        refillBillableSeparately: i.refillBillableSeparately,
        clientSuppliesOwnRefills: i.clientSuppliesOwnRefills,
        linkedRefillStockItemId: i.linkedRefillStockItemId || null,
        linkedRefillItemName: i.linkedRefillItemName || null,
        separateRefillPrice: i.separateRefillPrice || null,
      };
    });
  };

  // ── Save mutation ──────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const activeLineItems = getActiveLineItems();
      const payload = {
        ...form,
        weekOfMonth:       form.weekOfMonth       ? Number(form.weekOfMonth)       : null,
        estimatedDuration: form.estimatedDuration ? Number(form.estimatedDuration) : null,
        routeSequence:     form.routeSequence     ? Number(form.routeSequence)     : null,
        lineItems: activeLineItems.map(({ _key, ...li }) => ({
          ...li,
          stockItemId: li.stockItemId || null,
          quantity:    li.quantity    || "1",
          unitPrice:   li.unitPrice   || null,
          totalPrice:  li.totalPrice  || null,
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
    onError: (e: any) => toast({ title: "Contract could not be saved", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId)   { toast({ title: "Client required",     description: "Please select a client.",     variant: "destructive" }); return; }
    if (!form.department) { toast({ title: "Department required", description: "Please select a department.", variant: "destructive" }); return; }
    if (advancedMode) {
      if (lineItems.some(li => !li.itemServiceName.trim())) {
        toast({ title: "Item name required", description: "Please fill in all item / service names.", variant: "destructive" }); return;
      }
    } else {
      if (simpleItems.length === 0) {
        toast({ title: "Nothing added", description: "Please add at least one item to include in this contract.", variant: "destructive" }); return;
      }
    }
    saveMutation.mutate();
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const selectedClient = clients.find(c => c.id === form.clientId);
  const teamOptions = teams.filter((t: any) => t.isActive !== false);
  const divId = form.department ? DEPT_TO_DIV_ID[form.department] : undefined;
  const techOptions = workers.filter(w =>
    w.isActive !== false && (!divId || (w as any).departmentId === divId)
  );
  const summary = scheduleSummary(form, teams.find((t: any) => t.id === form.assignedTeamId)?.name ?? "");
  const showSecondDay   = ["2 x a week", "Twice a month"].includes(form.frequency);
  const showWeek        = ["Monthly","Every 2 months","Quarterly","Every 6 months","Annually","Twice a month"].includes(form.frequency);
  const showDay         = !["Daily","On Demand","Once-off"].includes(form.frequency);
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
            <Select value={form.department} onValueChange={val => {
              set("department")(val);
              set("assignedTeamId")(""); set("assignedTeamName")("");
              set("assignedTechnicianId")(""); set("assignedTechnicianName")("");
            }}>
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
          <Input type="number" className="max-w-[180px]" value={form.increasePercentage}
            onChange={setStr("increasePercentage")} placeholder="e.g. 10" />
        </Field>
        <Field label="Special Instructions">
          <Textarea value={form.specialInstructions} onChange={setStr("specialInstructions")} rows={2} placeholder="Instructions visible to technician…" />
        </Field>
        <Field label="Internal Notes">
          <Textarea value={form.internalNotes} onChange={setStr("internalNotes")} rows={2} placeholder="Internal admin notes…" />
        </Field>
      </Section>

      {/* ── 3. Contract Includes ── */}
      <Section icon={Package} title="3. Contract Includes">
        {!advancedMode ? (
          /* ── Simple mode ── */
          <div className="space-y-3">

            {/* Search / add */}
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  className="pl-8 text-sm"
                  placeholder={form.department
                    ? `Search ${form.department} items or type any item name…`
                    : "Select a department first, then search items…"}
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                />
              </div>

              {/* Dropdown */}
              {searchOpen && filteredCatalog.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {!searchQuery && form.department && (
                    <div className="px-3 py-1.5 text-xs text-gray-400 font-medium border-b border-gray-100">
                      Suggested for {form.department}
                    </div>
                  )}
                  {filteredCatalog.map(item => (
                    <button
                      key={item.source === "inventory" ? item.stockItemId : `svc-${item.name}`}
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 transition-colors text-sm border-b border-gray-50 last:border-0"
                      onMouseDown={e => { e.preventDefault(); addSimpleItem(item); }}
                    >
                      {item.source === "inventory"
                        ? <Box className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        : <Wrench className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      }
                      <span className="flex-1 text-gray-800">{item.name}</span>
                      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        item.source === "inventory"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {item.source === "inventory" ? "Inventory" : "Service"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchOpen && searchQuery.trim() && filteredCatalog.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-3 text-sm text-gray-400">
                  No items found for "{searchQuery}" — switch to Advanced to add a custom item.
                </div>
              )}
            </div>

            {/* Added items list */}
            {simpleItems.length === 0 ? (
              <p className="text-xs text-gray-400 py-3 text-center">
                {form.department
                  ? "Search and select items above to build the contract includes list."
                  : "Select a department in Section 2, then add items here."}
              </p>
            ) : (
              <div className="space-y-2">
                {simpleItems.map(item => {
                  const qty = parseFloat(item.quantity) || 0;
                  const price = parseFloat(item.unitPrice) || 0;
                  const total = qty && price ? (qty * price).toFixed(2) : "";
                  return (
                    <div key={item._key} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {item.stockItemId
                            ? <Box className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            : <Wrench className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          }
                          <span className="text-sm font-medium text-gray-900 truncate">{item.itemServiceName}</span>
                          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            item.stockItemId ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                          }`}>
                            {item.stockItemId ? "Inventory" : "Service"}
                          </span>
                        </div>
                        <button type="button" onClick={() => removeSimpleItem(item._key)}
                          className="shrink-0 text-red-400 hover:text-red-600 p-0.5 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Qty / Price / Total */}
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Quantity">
                          <Input className="h-8 text-xs" type="number" min="0" step="0.5"
                            value={item.quantity}
                            onChange={e => updateSimpleItem(item._key, "quantity", e.target.value)} />
                        </Field>
                        <Field label="Unit Price (R)">
                          <Input className="h-8 text-xs" type="number" min="0" step="0.01"
                            value={item.unitPrice} placeholder="0.00"
                            onChange={e => updateSimpleItem(item._key, "unitPrice", e.target.value)} />
                        </Field>
                        <Field label="Total (R)">
                          <Input className="h-8 text-xs bg-white" readOnly tabIndex={-1}
                            value={total} placeholder="—" />
                        </Field>
                      </div>

                      {/* Notes */}
                      <Input className="h-7 text-xs mt-2" value={item.notes}
                        onChange={e => updateSimpleItem(item._key, "notes", e.target.value)}
                        placeholder="Notes for this item…" />

                      {/* ── Refill Arrangement (Washroom / Hygiene only, non-service items) ── */}
                      {showRefillSection(form.department, item.lineType) && (
                        <div className="mt-2 pt-2 border-t border-blue-100 space-y-2 bg-blue-50/40 rounded p-2">
                          <p className="text-xs font-semibold text-blue-700 mb-1">Refill Arrangement</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Arrangement">
                              <Select
                                value={item.refillArrangement || "Not Applicable"}
                                onValueChange={v => updateSimpleItem(item._key, "refillArrangement", v)}
                              >
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {REFILL_ARRANGEMENTS.map(r => (
                                    <SelectItem key={r} value={r}>{r}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>

                            {/* Refill Price — shown for billable arrangements */}
                            {(item.refillArrangement === "Refills Charged Separately" ||
                              item.refillArrangement === "On Demand Refills" ||
                              item.refillArrangement === "Refill Only") && (
                              <Field label="Refill Price (R)">
                                <Input
                                  className="h-8 text-xs" type="number" min="0" step="0.01"
                                  value={item.separateRefillPrice} placeholder="0.00"
                                  onChange={e => updateSimpleItem(item._key, "separateRefillPrice", e.target.value)}
                                />
                              </Field>
                            )}
                          </div>

                          {/* Linked Refill Item — shown when we supply the refill */}
                          {(item.refillArrangement === "Refills Included in Rental" ||
                            item.refillArrangement === "Refills Charged Separately" ||
                            item.refillArrangement === "On Demand Refills") && (
                            <Field label="Linked Refill Item">
                              <Select
                                value={item.linkedRefillStockItemId || "__none__"}
                                onValueChange={v => {
                                  if (v === "__none__") { setLinkedRefillItem(item._key, "", ""); return; }
                                  const inv = (inventoryItems as any[]).find(i => i.id === v);
                                  setLinkedRefillItem(item._key, inv?.id ?? "", inv?.name ?? v);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select refill item from inventory…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— None —</SelectItem>
                                  {(inventoryItems as any[])
                                    .filter(i => i.activeStatus !== false)
                                    .sort((a: any, b: any) => {
                                      const aR = (a.category || "").toLowerCase().includes("refill") || (a.category || "").toLowerCase().includes("consumable");
                                      const bR = (b.category || "").toLowerCase().includes("refill") || (b.category || "").toLowerCase().includes("consumable");
                                      if (aR && !bR) return -1;
                                      if (!aR && bR) return  1;
                                      return a.name.localeCompare(b.name);
                                    })
                                    .map((i: any) => (
                                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                                    ))
                                  }
                                </SelectContent>
                              </Select>
                            </Field>
                          )}

                          {/* Contextual notice */}
                          {item.refillArrangement === "Client Supplies Own Refills" && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                              Client supplies own refills — no stock deduction or billing required.
                            </p>
                          )}
                          {item.refillArrangement === "Refills Included in Rental" && (
                            <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded px-2 py-1">
                              Refills included in monthly rental — stock will be tracked when jobs are completed.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Grand total */}
                {simpleItems.length > 1 && (
                  <div className="flex justify-end pt-1">
                    <span className="text-xs text-gray-500 font-medium pr-1">Total:</span>
                    <span className="text-xs font-bold text-gray-800">
                      R {simpleItems.reduce((sum, i) => {
                        const q = parseFloat(i.quantity) || 0;
                        const u = parseFloat(i.unitPrice) || 0;
                        return sum + (q * u);
                      }, 0).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={goToAdvanced}
              className="text-xs text-blue-600 hover:underline mt-1"
            >
              Advanced: edit line items →
            </button>
          </div>
        ) : (
          /* ── Advanced mode ── */
          <div>
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
                        <div className="relative">
                          <Input className="h-8 text-xs" value={li.itemServiceName}
                            onChange={e => updateLine(li._key, "itemServiceName", e.target.value)}
                            placeholder="Item or service name" />
                          {li.stockItemId && (
                            <span className="absolute right-2 top-1.5 text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-medium pointer-events-none">
                              Inv
                            </span>
                          )}
                        </div>
                      </Field>
                    </div>
                    {lineItems.length > 1 && (
                      <button type="button" onClick={() => removeLine(li._key)} className="shrink-0 text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                    <Field label="Qty">
                      <Input className="h-8 text-xs" type="number" value={li.quantity}
                        onChange={e => updateLine(li._key, "quantity", e.target.value)} min="0" step="0.5" />
                    </Field>
                    <Field label="Unit Price (R)">
                      <Input className="h-8 text-xs" type="number" value={li.unitPrice}
                        onChange={e => updateLine(li._key, "unitPrice", e.target.value)} placeholder="0.00" step="0.01" />
                    </Field>
                    <Field label="Total (R)">
                      <Input className="h-8 text-xs bg-white" value={li.totalPrice} readOnly placeholder="Auto" tabIndex={-1} />
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
                      <Switch checked={li.stockTrackingRequired}
                        onCheckedChange={v => updateLine(li._key, "stockTrackingRequired", v)} className="scale-75" />
                      <span className="text-xs text-gray-500">Track stock</span>
                    </div>
                    <Input className="h-7 text-xs flex-1" value={li.notes}
                      onChange={e => updateLine(li._key, "notes", e.target.value)} placeholder="Line notes…" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Line
              </Button>
              <button type="button" onClick={goToSimple}
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                ← Back to simple mode
              </button>
            </div>
          </div>
        )}
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
              setForm(f => ({ ...f, assignedTeamId: t ? t.id : "", assignedTeamName: t ? (t as any).name : "" }));
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
              setForm(f => ({ ...f, assignedTechnicianId: w ? w.id : "", assignedTechnicianName: w ? w.name : "" }));
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

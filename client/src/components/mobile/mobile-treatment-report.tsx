import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, ChevronLeft, ClipboardCheck, Eraser, Plus, Save, Send, ShieldAlert } from "lucide-react";
import { mobileFetch } from "@/lib/mobile-auth";

type Product = { id: string; name: string; formulation: string; registrationNumber?: string | null; defaultUnit: string };
type Area = { area: string; otherDescription?: string | null };
type Pest = { pestType: string; infestationLevel?: string; otherDescription?: string | null };
type Equipment = { equipmentType: string; quantity: number; productType?: string; notes?: string };
type ProductUse = { productId: string; quantityUsed: string; mixtureDilution?: string };
type Photo = { fileUrl: string; fileName?: string };

type ReportForm = {
  treatmentType?: string;
  areas: Area[];
  pests: Pest[];
  cleanlinessAssessment?: string;
  cleanlinessComments?: string;
  equipment: Equipment[];
  products: ProductUse[];
  noProductUsed: boolean;
  recommendationChoices: string[];
  otherRecommendationDetails?: string;
  treatmentNotes?: string;
  customerName?: string;
  customerSignature?: string;
  signatureUnavailable: boolean;
  signatureUnavailableReason?: string;
  photos: Photo[];
};

type TreatmentJob = {
  id: string; status: string; jobNumber?: string | null; clientName?: string | null; tradingName?: string | null;
  siteAddress?: string | null; contractNumber?: string | null; serviceType?: string | null; treatmentType?: string | null;
  startTime?: string | null; technicianName?: string | null; pcoRegistrationNumber?: string | null; salespersonName?: string | null;
};

const blankForm = (): ReportForm => ({
  areas: [], pests: [], equipment: [], products: [], photos: [],
  noProductUsed: false, recommendationChoices: [], signatureUnavailable: false,
});

const headers = () => ({
  "Content-Type": "application/json",
});

const AREA_OPTIONS = [
  ["total_area", "Total Area"], ["offices", "Offices"], ["warehouse", "Warehouse"], ["perimeter", "Perimeter"], ["other", "Other"],
];
const PEST_OPTIONS = [
  ["cockroaches", "Cockroaches"], ["rodents", "Rodents"], ["ants", "Ants"], ["fleas", "Fleas"], ["bird_lice", "Bird Lice"],
  ["thatch_beetle", "Thatch Beetle"], ["borer_beetle", "Borer Beetle"], ["fishmoths", "Fishmoths"], ["flies", "Flies"], ["other", "Other"],
];
const RECOMMENDATIONS = [
  ["no_further_action", "No further action required"], ["follow_up_treatment", "Follow-up treatment required"], ["proofing", "Proofing required"],
  ["hygiene_cleaning", "Hygiene/cleaning improvements required"], ["remove_food_source", "Remove food source"], ["remove_standing_water", "Remove standing water"],
  ["repair_structural_opening", "Repair structural opening"], ["additional_bait_stations", "Additional bait stations required"],
  ["additional_treatment", "Additional treatment recommended"], ["customer_quotation", "Customer quotation required"],
  ["sales_follow_up", "Sales representative follow-up required"], ["other", "Other"],
];
const EQUIPMENT_OPTIONS = [
  "Fly Machine", "Sleeved Globes LUV015-002UVA/BL368", "Interior Rodent Bait Station", "Exterior Rodent Bait Station",
  "Insect Monitoring Station", "Aerosol Dispenser", "Cardboard Box", "Liquid Bait Dispenser", "Other",
];

function ToggleCard({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${checked ? "border-red-600 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-600"}`}>
    {checked && <Check className="mr-1 inline h-3.5 w-3.5" />}{label}
  </button>;
}

export function MobileTreatmentReport({
  jobId, onBack, onCompleted,
}: { jobId: string; onBack: () => void; onCompleted: () => Promise<void> | void }) {
  const [job, setJob] = useState<TreatmentJob | null>(null);
  const [form, setForm] = useState<ReportForm>(blankForm);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hydrated = useRef(false);
  const storageKey = `jobflow-treatment-report-${jobId}`;

  const setField = <K extends keyof ReportForm>(key: K, value: ReportForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const toggle = (key: "recommendationChoices", value: string) => setForm(current => ({
    ...current, [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value],
  }));

  const load = async () => {
    setLoading(true);
    try {
      const [contextResponse, productResponse] = await Promise.all([
        mobileFetch(`/api/mobile/treatment-reports/${jobId}`, { headers: headers() }),
        mobileFetch("/api/mobile/pest-control-products", { headers: headers() }),
      ]);
      const context = await contextResponse.json();
      if (!contextResponse.ok) throw new Error(context.message || "Unable to load the treatment report.");
      if (!productResponse.ok) throw new Error("Unable to load the Pest Control product library.");
      setJob(context.job);
      setProducts(await productResponse.json());
      const existing = context.report;
      const local = localStorage.getItem(storageKey);
      if (existing && existing.status !== "completed") {
        setForm({
          treatmentType: existing.treatmentType || context.job.treatmentType || undefined,
          areas: existing.areas || [], pests: existing.pests || [], equipment: existing.equipment || [],
          products: (existing.products || []).map((item: any) => ({ productId: item.productId, quantityUsed: item.quantityUsed, mixtureDilution: item.mixtureDilution || "" })),
          photos: existing.photos || [], cleanlinessAssessment: existing.cleanlinessAssessment || undefined,
          cleanlinessComments: existing.cleanlinessComments || "", noProductUsed: Boolean(existing.noProductUsed),
          recommendationChoices: (() => { try { return JSON.parse(existing.recommendationChoices || "[]"); } catch { return []; } })(),
          otherRecommendationDetails: existing.otherRecommendationDetails || "", treatmentNotes: existing.treatmentNotes || "",
          customerName: existing.customerName || "", customerSignature: existing.customerSignature || "",
          signatureUnavailable: Boolean(existing.signatureUnavailable), signatureUnavailableReason: existing.signatureUnavailableReason || "",
        });
      } else if (local) {
        try { setForm({ ...blankForm(), ...JSON.parse(local) }); } catch { localStorage.removeItem(storageKey); }
      } else {
        setForm(current => ({ ...current, treatmentType: context.job.treatmentType || current.treatmentType }));
      }
      if (existing?.customerSignature) setSignatureSaved(true);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the treatment report.");
    } finally {
      hydrated.current = true;
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [jobId]);

  useEffect(() => {
    if (!hydrated.current || loading || job?.status === "completed") return;
    localStorage.setItem(storageKey, JSON.stringify(form));
    const timer = window.setTimeout(() => { saveDraft(true); }, 1200);
    return () => window.clearTimeout(timer);
  }, [form]);

  const saveDraft = async (quiet = false) => {
    if (!hydrated.current || job?.status === "completed") return;
    try {
      if (!quiet) setSaving(true);
      const response = await mobileFetch(`/api/mobile/treatment-reports/${jobId}/draft`, {
        method: "PATCH", headers: headers(), body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to save your draft.");
      if (!quiet) setNotice("Draft saved safely.");
      return result;
    } catch (err) {
      if (!quiet) setError(err instanceof Error ? err.message : "Unable to save your draft.");
    } finally {
      if (!quiet) setSaving(false);
    }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    try {
      const selection = Array.from(files).slice(0, 6 - form.photos.length);
      const values = await Promise.all(selection.map(file => new Promise<Photo>((resolve, reject) => {
        if (!file.type.startsWith("image/") || file.size > 2_000_000) return reject(new Error("Use photos smaller than 2 MB."));
        const reader = new FileReader();
        reader.onload = () => resolve({ fileUrl: String(reader.result), fileName: file.name });
        reader.onerror = () => reject(new Error("Unable to read photo."));
        reader.readAsDataURL(file);
      })));
      setField("photos", [...form.photos, ...values]);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to add photo."); }
  };

  const position = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * (canvas.width / bounds.width), y: (event.clientY - bounds.top) * (canvas.height / bounds.height) };
  };
  const drawStart = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (form.signatureUnavailable) return;
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.setPointerCapture(event.pointerId); drawing.current = true;
    const point = position(event); const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(point.x, point.y);
  };
  const drawMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !canvasRef.current) return;
    const point = position(event); const ctx = canvasRef.current.getContext("2d")!;
    ctx.lineTo(point.x, point.y); ctx.stroke();
  };
  const drawEnd = () => {
    if (!drawing.current || !canvasRef.current) return;
    drawing.current = false;
    setField("customerSignature", canvasRef.current.toDataURL("image/png"));
    setSignatureSaved(true);
  };
  const clearSignature = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setField("customerSignature", undefined); setSignatureSaved(false);
  };

  const complete = async () => {
    setValidationErrors([]); setError(""); setSaving(true);
    try {
      const response = await mobileFetch(`/api/mobile/treatment-reports/${jobId}/complete`, {
        method: "POST", headers: headers(), body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) {
        setValidationErrors(result.errors || []);
        throw new Error(result.message || "Unable to complete the job.");
      }
      localStorage.removeItem(storageKey);
      setNotice("Treatment report completed and job marked complete.");
      await onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete the job.");
    } finally { setSaving(false); }
  };

  const selectedProducts = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading treatment report…</div>;
  if (!job) return <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || "Treatment report unavailable."}</div>;
  if (job.status === "completed") return <div className="space-y-4">
    <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-red-700"><ChevronLeft className="h-4 w-4" />Back to My Jobs</button>
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><Check className="mb-2 h-6 w-6" /><h2 className="font-bold">Treatment report complete</h2><p className="mt-1 text-sm">This completed record is view-only for technicians.</p></div>
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-bold text-slate-900">Completed treatment summary</h3>
      <div className="space-y-2 text-sm text-slate-700">
        <p><strong>Treatment type:</strong> {(form.treatmentType || "—").replaceAll("_", " ")}</p>
        <p><strong>Areas treated:</strong> {form.areas.map(area => area.otherDescription || area.area.replaceAll("_", " ")).join(", ") || "—"}</p>
        <p><strong>Pests:</strong> {form.pests.map(pest => `${pest.otherDescription || pest.pestType.replaceAll("_", " ")} (${pest.infestationLevel || "—"})`).join(", ") || "—"}</p>
        <p><strong>Products:</strong> {form.noProductUsed ? "No product used" : form.products.map(item => { const product = selectedProducts.get(item.productId); return `${product?.name || "Product"} (${item.quantityUsed} ${product?.defaultUnit || ""})`; }).join(", ") || "—"}</p>
        <p><strong>Recommendations:</strong> {form.recommendationChoices.map(item => item.replaceAll("_", " ")).join(", ") || "None"}</p>
      </div>
    </section>
  </div>;

  return <div className="space-y-4 pb-8">
    <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-red-700"><ChevronLeft className="h-4 w-4" />Back to My Jobs</button>
    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {notice && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
    {validationErrors.length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><div className="mb-2 flex items-center gap-2 font-bold"><ShieldAlert className="h-4 w-4" />Please complete the report</div><ul className="list-disc space-y-1 pl-5">{validationErrors.map(item => <li key={item}>{item}</li>)}</ul></div>}

    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3"><ClipboardCheck className="mt-0.5 h-5 w-5 text-red-600" /><div><h2 className="font-bold text-slate-900">Treatment Report</h2><p className="text-xs text-slate-500">{job.jobNumber || "Job"} · {job.clientName}</p></div></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600"><span>Technician: {job.technicianName}</span><span>PCO: {job.pcoRegistrationNumber || "Not recorded"}</span><span className="col-span-2">Site: {job.siteAddress || "Not recorded"}</span><span>Contract: {job.contractNumber || "Once-off"}</span><span>Started: {job.startTime ? new Date(job.startTime).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : "Start job first"}</span></div>
    </section>

    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-bold text-slate-900">1. Treatment</h3>
      <label className="text-xs font-semibold text-slate-600">Treatment type<select value={form.treatmentType || ""} onChange={event => setField("treatmentType", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"><option value="">Select treatment type</option><option value="once_off">Once-off Treatment</option><option value="contract">Contract Treatment</option><option value="service">Service Treatment</option><option value="follow_up">Follow-up</option></select></label>
      <div><p className="mb-2 text-xs font-semibold text-slate-600">Areas treated</p><div className="grid grid-cols-2 gap-2">{AREA_OPTIONS.map(([value, label]) => <ToggleCard key={value} label={label} checked={form.areas.some(area => area.area === value)} onClick={() => setField("areas", form.areas.some(area => area.area === value) ? form.areas.filter(area => area.area !== value) : [...form.areas, { area: value }])} />)}</div>{form.areas.some(area => area.area === "other") && <input value={form.areas.find(area => area.area === "other")?.otherDescription || ""} onChange={event => setField("areas", form.areas.map(area => area.area === "other" ? { ...area, otherDescription: event.target.value } : area))} placeholder="Describe other area" className="mt-2 w-full rounded-lg border border-slate-300 p-2.5 text-sm" />}</div>
      <div><p className="mb-2 text-xs font-semibold text-slate-600">Pest types and infestation</p><div className="grid grid-cols-2 gap-2">{PEST_OPTIONS.map(([value, label]) => <ToggleCard key={value} label={label} checked={form.pests.some(pest => pest.pestType === value)} onClick={() => setField("pests", form.pests.some(pest => pest.pestType === value) ? form.pests.filter(pest => pest.pestType !== value) : [...form.pests, { pestType: value }])} />)}</div>
        {form.pests.map(pest => <div key={pest.pestType} className="mt-3 rounded-lg bg-slate-50 p-3"><p className="mb-2 text-sm font-semibold capitalize">{pest.pestType.replaceAll("_", " ")}</p>{pest.pestType === "other" && <input value={pest.otherDescription || ""} onChange={event => setField("pests", form.pests.map(item => item.pestType === pest.pestType ? { ...item, otherDescription: event.target.value } : item))} placeholder="Other pest type" className="mb-2 w-full rounded-lg border border-slate-300 p-2 text-sm" />}<div className="grid grid-cols-4 gap-1">{[["none", "None"], ["light", "Light"], ["medium", "Medium"], ["heavy", "Heavy"]].map(([value, label]) => <ToggleCard key={value} label={label} checked={pest.infestationLevel === value} onClick={() => setField("pests", form.pests.map(item => item.pestType === pest.pestType ? { ...item, infestationLevel: value } : item))} />)}</div></div>)}
      </div>
    </section>

    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-bold text-slate-900">2. Site Assessment</h3><select value={form.cleanlinessAssessment || ""} onChange={event => setField("cleanlinessAssessment", event.target.value)} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"><option value="">Client premises cleanliness</option><option value="all_ok">All OK</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_attention">Needs Attention</option><option value="major_problem">Major Problem</option></select>{["fair", "needs_attention", "major_problem"].includes(form.cleanlinessAssessment || "") && <textarea value={form.cleanlinessComments || ""} onChange={event => setField("cleanlinessComments", event.target.value)} placeholder="Details / comments (required)" className="min-h-24 w-full rounded-lg border border-slate-300 p-2.5 text-sm" />}{["needs_attention", "major_problem"].includes(form.cleanlinessAssessment || "") && <><label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-emerald-400 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><Camera className="h-4 w-4" />Add assessment photos<input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={event => addPhotos(event.target.files)} /></label>{form.photos.length > 0 && <div className="grid grid-cols-3 gap-2">{form.photos.map((photo, index) => <div key={photo.fileUrl} className="relative"><img src={photo.fileUrl} alt="" className="h-20 w-full rounded object-cover" /><button type="button" onClick={() => setField("photos", form.photos.filter((_, i) => i !== index))} className="absolute -right-1 -top-1 rounded-full bg-slate-900 px-1.5 text-xs text-white">×</button></div>)}</div>}</>}</section>

    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">3. Equipment Serviced</h3><button type="button" onClick={() => setField("equipment", [...form.equipment, { equipmentType: "", quantity: 1 }])} className="flex items-center gap-1 text-xs font-bold text-emerald-700"><Plus className="h-3.5 w-3.5" />Add equipment</button></div>{form.equipment.length === 0 ? <p className="text-sm text-slate-500">No equipment serviced.</p> : form.equipment.map((item, index) => <div key={index} className="space-y-2 rounded-lg bg-slate-50 p-3"><div className="flex gap-2"><select value={item.equipmentType} onChange={event => setField("equipment", form.equipment.map((entry, i) => i === index ? { ...entry, equipmentType: event.target.value } : entry))} className="min-w-0 flex-1 rounded border border-slate-300 p-2 text-sm"><option value="">Equipment type</option>{EQUIPMENT_OPTIONS.map(option => <option key={option}>{option}</option>)}</select><input type="number" min="1" value={item.quantity} onChange={event => setField("equipment", form.equipment.map((entry, i) => i === index ? { ...entry, quantity: Number(event.target.value) || 1 } : entry))} className="w-16 rounded border border-slate-300 p-2 text-sm" /></div><input value={item.productType || ""} onChange={event => setField("equipment", form.equipment.map((entry, i) => i === index ? { ...entry, productType: event.target.value } : entry))} placeholder="Bait / product type" className="w-full rounded border border-slate-300 p-2 text-sm" /><input value={item.notes || ""} onChange={event => setField("equipment", form.equipment.map((entry, i) => i === index ? { ...entry, notes: event.target.value } : entry))} placeholder="Notes" className="w-full rounded border border-slate-300 p-2 text-sm" /><button type="button" onClick={() => setField("equipment", form.equipment.filter((_, i) => i !== index))} className="text-xs font-semibold text-red-600">Remove</button></div>)}</section>

    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">4. Products Used</h3><button type="button" disabled={form.noProductUsed} onClick={() => setField("products", [...form.products, { productId: "", quantityUsed: "" }])} className="flex items-center gap-1 text-xs font-bold text-emerald-700 disabled:text-slate-400"><Plus className="h-3.5 w-3.5" />Add product</button></div><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.noProductUsed} onChange={event => { setField("noProductUsed", event.target.checked); if (event.target.checked) setField("products", []); }} />No pesticide/product used</label>{form.products.map((item, index) => { const product = selectedProducts.get(item.productId); return <div key={index} className="space-y-2 rounded-lg bg-slate-50 p-3"><select value={item.productId} onChange={event => setField("products", form.products.map((entry, i) => i === index ? { ...entry, productId: event.target.value } : entry))} className="w-full rounded border border-slate-300 p-2 text-sm"><option value="">Search/select product</option>{products.map(option => <option key={option.id} value={option.id}>{option.name} · {option.formulation}</option>)}</select>{product && <p className="text-xs text-slate-500">{product.formulation} · {product.registrationNumber || "Registration pending"} · {product.defaultUnit}</p>}<div className="grid grid-cols-2 gap-2"><input value={item.quantityUsed} onChange={event => setField("products", form.products.map((entry, i) => i === index ? { ...entry, quantityUsed: event.target.value } : entry))} placeholder={`Quantity (${product?.defaultUnit || "unit"})`} className="rounded border border-slate-300 p-2 text-sm" /><input value={item.mixtureDilution || ""} onChange={event => setField("products", form.products.map((entry, i) => i === index ? { ...entry, mixtureDilution: event.target.value } : entry))} placeholder="Mixture / dilution" className="rounded border border-slate-300 p-2 text-sm" /></div><button type="button" onClick={() => setField("products", form.products.filter((_, i) => i !== index))} className="text-xs font-semibold text-red-600">Remove</button></div>; })}</section>

    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-bold text-slate-900">5. Recommendations</h3><div className="grid grid-cols-1 gap-2">{RECOMMENDATIONS.map(([value, label]) => <ToggleCard key={value} label={label} checked={form.recommendationChoices.includes(value)} onClick={() => toggle("recommendationChoices", value)} />)}</div>{form.recommendationChoices.includes("other") && <input value={form.otherRecommendationDetails || ""} onChange={event => setField("otherRecommendationDetails", event.target.value)} placeholder="Other recommendation details" className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" />}<textarea value={form.treatmentNotes || ""} onChange={event => setField("treatmentNotes", event.target.value)} placeholder="Recommendations or additional information" className="min-h-24 w-full rounded-lg border border-slate-300 p-2.5 text-sm" /></section>

    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-bold text-slate-900">6. Client Confirmation</h3><input value={form.customerName || ""} onChange={event => setField("customerName", event.target.value)} placeholder="Client / representative name" className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" /><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.signatureUnavailable} onChange={event => { setField("signatureUnavailable", event.target.checked); if (event.target.checked) { clearSignature(); } }} />Unable to obtain client signature</label>{form.signatureUnavailable ? <select value={form.signatureUnavailableReason || ""} onChange={event => setField("signatureUnavailableReason", event.target.value)} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"><option value="">Why was a signature unavailable?</option><option value="Client representative unavailable">Client representative unavailable</option><option value="Site unattended">Site unattended</option><option value="Client declined to sign">Client declined to sign</option><option value="Other">Other</option></select> : <><p className="text-xs text-slate-500">Ask the client to sign below using their finger.</p><canvas ref={canvasRef} width={640} height={200} onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={drawEnd} onPointerLeave={drawEnd} className="h-32 w-full touch-none rounded-lg border border-dashed border-slate-400 bg-white" /><div className="flex gap-2"><button type="button" onClick={clearSignature} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"><Eraser className="h-3.5 w-3.5" />Clear signature</button><span className={`flex flex-1 items-center justify-center rounded-lg text-xs font-semibold ${signatureSaved ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{signatureSaved ? "Signature saved" : "Sign above"}</span></div></>}</section>

    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950"><strong>Customer precautions on the final report:</strong> keep children and pets out of treated areas, ventilate well, cover food, avoid cleaning treated surfaces for 5 days, and do not tamper with bait. Increased pest activity after initial treatment can be normal; allow about 7 days for treatment to take effect.</section>
    <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => saveDraft()} disabled={saving} className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 font-bold text-gray-700 hover:bg-gray-50"><Save className="h-4 w-4" />Save draft</button><button type="button" onClick={complete} disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-60"><Send className="h-4 w-4" />{saving ? "Saving…" : "Complete job"}</button></div>
  </div>;
}
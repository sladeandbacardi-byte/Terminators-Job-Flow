import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, ExternalLink, Mail, PackagePlus, Pencil, Printer, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Product = { id: string; name: string; formulation: string; registrationNumber?: string | null; defaultUnit: string; isActive: boolean };
type Report = {
  id: string; reportNumber?: string | null; clientId: string; jobId?: string | null; reportDate: string;
  tradingName?: string | null; technicianName?: string | null; treatmentType?: string | null; status?: string | null;
  actionRequired?: boolean; actionReason?: string | null; timeOnSiteMinutes?: number | null; pdfUrl?: string | null;
  followUps?: Array<{ id: string; reason: string; status: string; assignedWorkerId?: string | null }>;
  products?: Array<{ productName: string; quantityUsed: string; unit: string }>;
  pests?: Array<{ pestType: string; infestationLevel: string }>;
  areas?: Array<{ area: string; otherDescription?: string | null }>;
  audits?: Array<{ id: string; action: string; actorName: string; fieldName?: string | null; createdAt: string }>;
};

export default function TreatmentReports() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Report | null>(null);
  const [showProducts, setShowProducts] = useState(false);
  const [productDraft, setProductDraft] = useState({ name: "", formulation: "", registrationNumber: "", defaultUnit: "ml" });
  const { data: reports = [], isLoading, refetch } = useQuery<Report[]>({ queryKey: ["/api/treatment-reports"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/pest-control-products"], enabled: showProducts });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/treatment-reports"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pest-control-products"] });
    refetch();
  };
  const updateFollowUp = useMutation({
    mutationFn: async ({ reportId, followUpId, status }: { reportId: string; followUpId: string; status: string }) =>
      (await apiRequest("PATCH", `/api/treatment-reports/${reportId}/follow-ups/${followUpId}`, { status })).json(),
    onSuccess: refresh, onError: () => toast({ title: "Could not update follow-up", variant: "destructive" }),
  });
  const addProduct = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/pest-control-products", { ...productDraft, registrationNumber: productDraft.registrationNumber || null })).json(),
    onSuccess: () => { setProductDraft({ name: "", formulation: "", registrationNumber: "", defaultUnit: "ml" }); refresh(); toast({ title: "Product added to library" }); },
    onError: (error: Error) => toast({ title: error.message || "Could not add product", variant: "destructive" }),
  });
  const toggleProduct = useMutation({
    mutationFn: async (product: Product) => (await apiRequest("PATCH", `/api/pest-control-products/${product.id}`, { isActive: !product.isActive })).json(),
    onSuccess: refresh, onError: () => toast({ title: "Could not update product", variant: "destructive" }),
  });
  const actionCount = useMemo(() => reports.filter(report => report.actionRequired).length, [reports]);

  return <div className="space-y-6 p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Pest Control Treatment Reports</h1><p className="mt-1 text-sm text-slate-500">Completed field evidence, corrective actions, and formal printable reports.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setShowProducts(!showProducts)}><PackagePlus className="mr-2 h-4 w-4" />Product library</Button><Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div></div>
    {actionCount > 0 && <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="h-5 w-5" /><strong>{actionCount} report{actionCount === 1 ? "" : "s"} require action.</strong> Review open follow-ups below.</div>}

    {showProducts && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Pest Control Product Library</h2><button onClick={() => setShowProducts(false)}><X className="h-4 w-4 text-slate-500" /></button></div><div className="mb-4 grid gap-2 md:grid-cols-5"><Input value={productDraft.name} onChange={e => setProductDraft({ ...productDraft, name: e.target.value })} placeholder="Product name" /><Input value={productDraft.formulation} onChange={e => setProductDraft({ ...productDraft, formulation: e.target.value })} placeholder="Formulation" /><Input value={productDraft.registrationNumber} onChange={e => setProductDraft({ ...productDraft, registrationNumber: e.target.value })} placeholder="Registration number" /><select value={productDraft.defaultUnit} onChange={e => setProductDraft({ ...productDraft, defaultUnit: e.target.value })} className="rounded-md border border-input bg-background px-3 text-sm"><option>ml</option><option>g</option><option>blocks</option></select><Button disabled={!productDraft.name || !productDraft.formulation || addProduct.isPending} onClick={() => addProduct.mutate()}><PackagePlus className="mr-2 h-4 w-4" />Add product</Button></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left text-slate-500"><tr><th className="p-2">Product</th><th className="p-2">Formulation</th><th className="p-2">Registration</th><th className="p-2">Unit</th><th className="p-2">Status</th></tr></thead><tbody>{products.map(product => <tr key={product.id} className="border-b"><td className="p-2 font-medium">{product.name}</td><td className="p-2">{product.formulation}</td><td className="p-2">{product.registrationNumber || "—"}</td><td className="p-2">{product.defaultUnit}</td><td className="p-2"><button onClick={() => toggleProduct.mutate(product)} className={`rounded-full px-2 py-1 text-xs font-semibold ${product.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{product.isActive ? "Active" : "Inactive"}</button></td></tr>)}</tbody></table></div></section>}

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{isLoading ? <div className="p-10 text-center text-sm text-slate-500">Loading treatment reports…</div> : reports.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No digital treatment reports have been completed yet.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Report</th><th className="p-3">Client / date</th><th className="p-3">Technician</th><th className="p-3">Treatment</th><th className="p-3">Follow-up</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{reports.map(report => <tr key={report.id} className="border-b last:border-0 hover:bg-slate-50"><td className="p-3 font-semibold">{report.reportNumber || "Draft"}</td><td className="p-3"><div>{report.tradingName || "Client"}</div><div className="text-xs text-slate-500">{report.reportDate}</div></td><td className="p-3">{report.technicianName || "—"}</td><td className="p-3 capitalize">{(report.treatmentType || "—").replaceAll("_", " ")}</td><td className="p-3">{report.actionRequired ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800"><AlertTriangle className="h-3 w-3" />Action required</span> : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-3 w-3" />Clear</span>}</td><td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => setSelected(report)}><Pencil className="mr-1 h-3.5 w-3.5" />Review</Button><Link href={`/treatment-reports/${report.id}/print`} target="_blank"><Button size="sm" variant="ghost"><Printer className="h-3.5 w-3.5" /></Button></Link></td></tr>)}</tbody></table></div>}</section>

    {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4"><div className="mx-auto my-8 max-w-3xl rounded-xl bg-white p-6 shadow-xl"><div className="mb-5 flex justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Treatment report</p><h2 className="text-xl font-bold">{selected.reportNumber || "Draft"} · {selected.tradingName || "Client"}</h2><p className="text-sm text-slate-500">{selected.reportDate} · {selected.technicianName || "Technician"} · {selected.timeOnSiteMinutes ?? "—"} min on site</p></div><button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button></div><div className="grid gap-4 md:grid-cols-2"><Detail label="Areas treated" value={(selected.areas || []).map(area => area.otherDescription || area.area).join(", ")} /><Detail label="Pests / infestation" value={(selected.pests || []).map(pest => `${pest.pestType}: ${pest.infestationLevel}`).join(", ")} /><Detail label="Products used" value={(selected.products || []).map(product => `${product.productName} (${product.quantityUsed} ${product.unit})`).join(", ")} /><Detail label="Action reason" value={selected.actionReason || "No action required"} /></div>{(selected.followUps || []).length > 0 && <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4"><h3 className="mb-3 font-bold text-amber-900">Action Required Follow-ups</h3>{selected.followUps?.map(followUp => <div key={followUp.id} className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded bg-white p-2 text-sm"><span>{followUp.reason}</span><select value={followUp.status} onChange={event => updateFollowUp.mutate({ reportId: selected.id, followUpId: followUp.id, status: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-xs"><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></div>)}</div>}{(selected.audits || []).length > 0 && <div className="mt-5"><h3 className="mb-2 font-bold">Audit history</h3><div className="space-y-1 text-xs text-slate-600">{selected.audits?.map(audit => <p key={audit.id}>{new Date(audit.createdAt).toLocaleString("en-ZA")} · <strong>{audit.actorName}</strong> · {audit.action.replaceAll("_", " ")}{audit.fieldName ? ` (${audit.fieldName})` : ""}</p>)}</div></div>}<div className="mt-6 flex justify-end gap-2"><Link href={`/treatment-reports/${selected.id}/print`} target="_blank"><Button variant="outline"><Printer className="mr-2 h-4 w-4" />Print / save PDF</Button></Link><Button variant="outline" onClick={async () => { const value = window.prompt("Recipient email addresses (separate multiple addresses with commas):"); if (!value) return; const recipients = value.split(",").map(item => item.trim()).filter(Boolean); try { const response = await apiRequest("POST", `/api/treatment-reports/${selected.id}/email`, { recipients }); const result = await response.json(); const sent = result.outcomes.filter((item: any) => item.sent).length; toast({ title: `Report emailed to ${sent} recipient${sent === 1 ? "" : "s"}` }); } catch { toast({ title: "Could not email report", variant: "destructive" }); } }}><Mail className="mr-2 h-4 w-4" />Email report</Button><Button onClick={() => setSelected(null)}>Close</Button></div></div></div>}
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm text-slate-800">{value || "—"}</p></div>;
}
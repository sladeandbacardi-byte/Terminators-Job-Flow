import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, CreditCard, SlidersHorizontal, Save, Loader2, Plus, Pencil, CheckCircle, XCircle, Landmark } from "lucide-react";
import type { CompanySettings, LegalEntity } from "@shared/schema";

type Tab = "company" | "banking" | "preferences" | "legal_entities";

const TABS: { key: Tab; label: string; icon: typeof Building2 }[] = [
  { key: "company",        label: "Company Info",    icon: Building2 },
  { key: "banking",        label: "Banking",          icon: CreditCard },
  { key: "preferences",    label: "Preferences",      icon: SlidersHorizontal },
  { key: "legal_entities", label: "Legal Entities",   icon: Landmark },
];

// ── Legal Entity Form ─────────────────────────────────────────────────────────

const BLANK_ENTITY: Partial<LegalEntity> = {
  name: "", tradingName: "", registrationNumber: "", vatNumber: "",
  physicalAddress: "", postalAddress: "", phone: "", email: "",
  bankName: "", bankAccount: "", bankBranch: "", bankAccountType: "",
  defaultPaymentTerms: "", invoiceFooter: "", quoteFooter: "",
  isActive: true, isDefault: false,
};

function LegalEntityDialog({
  open, entity, onClose,
}: { open: boolean; entity: LegalEntity | null; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<LegalEntity>>({ ...BLANK_ENTITY });

  useEffect(() => {
    if (entity) setForm({ ...entity });
    else setForm({ ...BLANK_ENTITY });
  }, [entity, open]);

  const set = (f: keyof LegalEntity) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }));

  const saveMutation = useMutation({
    mutationFn: () => entity
      ? apiRequest("PUT", `/api/legal-entities/${entity.id}`, form)
      : apiRequest("POST", "/api/legal-entities", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/legal-entities"] });
      toast({ title: entity ? "Entity updated" : "Entity created" });
      onClose();
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  return (
  <>
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entity ? "Edit" : "Add"} Legal Entity</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Row label="Entity Name *" className="col-span-2">
              <Input value={form.name ?? ""} onChange={set("name")} placeholder="e.g. Terminators CC" />
            </Row>
            <Row label="Trading Name">
              <Input value={form.tradingName ?? ""} onChange={set("tradingName")} placeholder="Optional" />
            </Row>
            <Row label="Registration Number">
              <Input value={form.registrationNumber ?? ""} onChange={set("registrationNumber")} placeholder="XXXX/XXXXXX/XX" />
            </Row>
            <Row label="VAT Number">
              <Input value={form.vatNumber ?? ""} onChange={set("vatNumber")} placeholder="4XXXXXXXXX" />
            </Row>
            <Row label="Phone">
              <Input value={form.phone ?? ""} onChange={set("phone")} placeholder="+27 41 000 0000" />
            </Row>
            <Row label="Email" className="col-span-2">
              <Input value={form.email ?? ""} onChange={set("email")} type="email" placeholder="accounts@company.co.za" />
            </Row>
          </div>

          <Separator />
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Address</p>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Physical Address" className="col-span-2">
              <Input value={form.physicalAddress ?? ""} onChange={set("physicalAddress")} placeholder="123 Main Road, Gqeberha" />
            </Row>
            <Row label="Postal Address" className="col-span-2">
              <Input value={form.postalAddress ?? ""} onChange={set("postalAddress")} placeholder="PO Box 1, Gqeberha, 6000" />
            </Row>
          </div>

          <Separator />
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Banking Details</p>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Bank Name">
              <Input value={form.bankName ?? ""} onChange={set("bankName")} placeholder="FNB / ABSA / Nedbank" />
            </Row>
            <Row label="Account Number">
              <Input value={form.bankAccount ?? ""} onChange={set("bankAccount")} placeholder="XXXXXXXXXXXXXXX" />
            </Row>
            <Row label="Branch Code">
              <Input value={form.bankBranch ?? ""} onChange={set("bankBranch")} placeholder="250655" />
            </Row>
            <Row label="Account Type">
              <Input value={form.bankAccountType ?? ""} onChange={set("bankAccountType")} placeholder="Cheque / Savings" />
            </Row>
          </div>

          <Separator />
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Document Settings</p>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Default Payment Terms" className="col-span-2">
              <Input value={form.defaultPaymentTerms ?? ""} onChange={set("defaultPaymentTerms")} placeholder="Payment due within 30 days." />
            </Row>
            <Row label="Invoice Footer" className="col-span-2">
              <Textarea value={form.invoiceFooter ?? ""} onChange={set("invoiceFooter")} placeholder="Footer text shown on all invoices for this entity" rows={2} />
            </Row>
            <Row label="Quote Footer" className="col-span-2">
              <Textarea value={form.quoteFooter ?? ""} onChange={set("quoteFooter")} placeholder="Footer text shown on all quotes for this entity" rows={2} />
            </Row>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.name?.trim()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Entity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────

export default function Settings() {
  const [tab, setTab] = useState<Tab>("company");
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ["/api/settings/company"],
  });

  const { data: legalEntities = [], isLoading: entitiesLoading } = useQuery<LegalEntity[]>({
    queryKey: ["/api/legal-entities"],
  });

  const [form, setForm] = useState<Partial<CompanySettings>>({});
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<LegalEntity | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const set = (field: keyof CompanySettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/settings/company", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/company"] });
      toast({ title: "Settings saved", description: "Company settings updated successfully." });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PUT", `/api/legal-entities/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/legal-entities"] }),
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  return (
    <>
        <div className="p-6 pb-20 lg:pb-6">
          <div className="max-w-2xl mx-auto space-y-6">

            <div>
              <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
              <p className="text-muted-foreground text-sm mt-1">Configure company information, banking details and system preferences.</p>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 border-b flex-wrap">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                    ${tab === t.key
                      ? "border-green-600 text-green-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                  {t.key === "legal_entities" && legalEntities.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">{legalEntities.length}</Badge>
                  )}
                </button>
              ))}
            </div>

            {isLoading && tab !== "legal_entities" ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {tab === "company" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Company Information</CardTitle>
                      <CardDescription>Used on invoices, quotes and reports.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Row label="Company Name">
                        <Input value={form.companyName ?? ""} onChange={set("companyName")} placeholder="The Terminators" />
                      </Row>
                      <Row label="Trading Name">
                        <Input value={form.tradingName ?? ""} onChange={set("tradingName")} placeholder="Optional trading name" />
                      </Row>
                      <Separator />
                      <Row label="VAT Number">
                        <Input value={form.vatNumber ?? ""} onChange={set("vatNumber")} placeholder="4XXXXXXXXX" />
                      </Row>
                      <Row label="Registration No.">
                        <Input value={form.registrationNumber ?? ""} onChange={set("registrationNumber")} placeholder="XXXX/XXXXXX/XX" />
                      </Row>
                      <Separator />
                      <Row label="Phone">
                        <Input value={form.phone ?? ""} onChange={set("phone")} placeholder="+27 41 000 0000" />
                      </Row>
                      <Row label="Email">
                        <Input value={form.email ?? ""} onChange={set("email")} placeholder="info@terminators.co.za" type="email" />
                      </Row>
                      <Separator />
                      <Row label="Street Address">
                        <Input value={form.address ?? ""} onChange={set("address")} placeholder="123 Main Road" />
                      </Row>
                      <div className="grid grid-cols-2 gap-3">
                        <Row label="City">
                          <Input value={form.city ?? ""} onChange={set("city")} placeholder="Gqeberha" />
                        </Row>
                        <Row label="Postal Code">
                          <Input value={form.postalCode ?? ""} onChange={set("postalCode")} placeholder="6001" />
                        </Row>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {tab === "banking" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Banking Details</CardTitle>
                      <CardDescription>Printed on invoices for EFT payments.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Row label="Bank Name">
                        <Input value={form.bankName ?? ""} onChange={set("bankName")} placeholder="FNB / ABSA / Nedbank / Standard" />
                      </Row>
                      <Row label="Account Number">
                        <Input value={form.bankAccount ?? ""} onChange={set("bankAccount")} placeholder="XXXXXXXXXXXXXXX" />
                      </Row>
                      <Row label="Branch Code">
                        <Input value={form.bankBranch ?? ""} onChange={set("bankBranch")} placeholder="250655" />
                      </Row>
                      <Row label="Payment Reference">
                        <Input value={form.bankReference ?? ""} onChange={set("bankReference")} placeholder="Use invoice number" />
                      </Row>
                    </CardContent>
                  </Card>
                )}

                {tab === "preferences" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">System Preferences</CardTitle>
                      <CardDescription>Default values used when creating documents.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Row label="Default VAT Rate (%)">
                        <Input
                          value={form.defaultVatRate ?? "15"}
                          onChange={set("defaultVatRate")}
                          placeholder="15"
                          type="number"
                          min={0}
                          max={100}
                          className="w-32"
                        />
                        <p className="text-xs text-muted-foreground mt-1">South Africa standard VAT rate is 15%.</p>
                      </Row>
                    </CardContent>
                  </Card>
                )}

                {tab === "legal_entities" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold">Legal Entities</h2>
                        <p className="text-sm text-muted-foreground">Manage the legal entities that issue quotes and invoices.</p>
                      </div>
                      <Button
                        onClick={() => { setEditingEntity(null); setEntityDialogOpen(true); }}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Entity
                      </Button>
                    </div>

                    {entitiesLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      </div>
                    ) : legalEntities.length === 0 ? (
                      <Card>
                        <CardContent className="py-10 text-center text-muted-foreground text-sm">
                          No legal entities yet. Click "Add Entity" to create one.
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {legalEntities.map(entity => (
                          <Card key={entity.id} className={!entity.isActive ? "opacity-60" : ""}>
                            <CardContent className="py-4 px-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm">{entity.name}</span>
                                    {entity.tradingName && (
                                      <span className="text-xs text-muted-foreground">t/a {entity.tradingName}</span>
                                    )}
                                    {entity.isDefault && (
                                      <Badge className="bg-green-100 text-green-700 text-xs">Default</Badge>
                                    )}
                                    <Badge variant={entity.isActive ? "default" : "secondary"} className="text-xs">
                                      {entity.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                  </div>
                                  <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
                                    {entity.registrationNumber && <p>Reg: {entity.registrationNumber}</p>}
                                    {entity.vatNumber && <p>VAT: {entity.vatNumber}</p>}
                                    {entity.email && <p>{entity.email}</p>}
                                    {entity.bankName && entity.bankAccount && (
                                      <p>{entity.bankName} · {entity.bankAccount}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleActiveMutation.mutate({ id: entity.id, isActive: !entity.isActive })}
                                    title={entity.isActive ? "Deactivate" : "Activate"}
                                  >
                                    {entity.isActive
                                      ? <XCircle className="h-4 w-4 text-gray-400" />
                                      : <CheckCircle className="h-4 w-4 text-green-500" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setEditingEntity(entity); setEntityDialogOpen(true); }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab !== "legal_entities" && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Save Settings
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

    <LegalEntityDialog
      open={entityDialogOpen}
      entity={editingEntity}
      onClose={() => setEntityDialogOpen(false)}
    />
    </>
  );
}

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {children}
    </div>
  );
}

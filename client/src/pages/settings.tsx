import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Building2, CreditCard, SlidersHorizontal, Save, Loader2 } from "lucide-react";
import type { CompanySettings } from "@shared/schema";

type Tab = "company" | "banking" | "preferences";

const TABS: { key: Tab; label: string; icon: typeof Building2 }[] = [
  { key: "company",     label: "Company Info",  icon: Building2 },
  { key: "banking",     label: "Banking",        icon: CreditCard },
  { key: "preferences", label: "Preferences",    icon: SlidersHorizontal },
];

export default function Settings() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("company");
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ["/api/settings/company"],
  });

  const [form, setForm] = useState<Partial<CompanySettings>>({});

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

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Settings" onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <MobileNavigation isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="max-w-2xl mx-auto space-y-6">

            <div>
              <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
              <p className="text-muted-foreground text-sm mt-1">Configure company information, banking details and system preferences.</p>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 border-b">
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
                </button>
              ))}
            </div>

            {isLoading ? (
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
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {children}
    </div>
  );
}

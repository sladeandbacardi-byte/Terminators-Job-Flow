import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Building,
  Phone,
  Mail,
  MapPin,
  Edit,
  User,
  FileText,
  Briefcase,
  CreditCard,
  Calendar,
  ExternalLink,
  ClipboardList,
  Receipt,
} from "lucide-react";
import { ClientForm } from "@/components/forms/client-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatClientAddress, hasStructuredAddress, type Client, type Job, type Invoice, type Department } from "@shared/schema";

type ServiceContract = {
  id: string;
  clientId: string;
  contractNumber?: string;
  serviceType: string;
  departmentId: string;
  frequency?: string;
  assignedTeamId?: string;
  startTime?: string;
  estimatedDuration?: number;
  contractStartDate?: string;
  contractEndDate?: string;
  isActive: boolean;
  price?: string;
  notes?: string;
};

type QuoteSubmission = {
  id: string;
  clientId?: string;
  companyName: string;
  status: string;
  stage?: string;
  serviceType?: string;
  quoteAmount?: string;
  quoteNumber?: string;
  createdAt?: string;
  notes?: string;
};

function statusColor(status: string) {
  switch (status) {
    case "active": return "bg-green-100 text-green-800";
    case "inactive": return "bg-gray-100 text-gray-700";
    case "suspended": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

function jobStatusColor(status: string) {
  switch (status) {
    case "completed": return "bg-green-100 text-green-800";
    case "in_progress": return "bg-blue-100 text-blue-800";
    case "scheduled": return "bg-purple-100 text-purple-800";
    case "cancelled": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

function invoiceStatusColor(status: string) {
  switch (status) {
    case "paid": return "bg-green-100 text-green-800";
    case "sent": return "bg-blue-100 text-blue-800";
    case "overdue": return "bg-red-100 text-red-800";
    case "draft": return "bg-gray-100 text-gray-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["/api/clients", id],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error("Client not found");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: allJobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: allInvoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: allContracts = [] } = useQuery<ServiceContract[]>({ queryKey: ["/api/service-contracts"] });
  const { data: allQuotes = [] } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: allClients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const clientJobs = allJobs.filter((j) => j.clientId === id);
  const clientInvoices = allInvoices.filter((i) => i.clientId === id);
  const clientContracts = allContracts.filter((c) => c.clientId === id);
  const clientQuotes = allQuotes.filter((q) => q.clientId === id || (q.companyName && client && q.companyName.toLowerCase() === client.name.toLowerCase()));

  // Job groupings
  const upcomingJobs = clientJobs.filter((j) => j.status === "scheduled" && new Date(j.scheduledDate) >= new Date());
  const inProgressJobs = clientJobs.filter((j) => j.status === "in_progress");
  const completedJobs = clientJobs.filter((j) => j.status === "completed");
  const otherJobs = clientJobs.filter((j) => !["scheduled", "in_progress", "completed"].includes(j.status));

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/clients/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsEditOpen(false);
      toast({ description: "Client updated successfully" });
    },
    onError: () => toast({ description: "Failed to update client", variant: "destructive" }),
  });

  const getDeptName = (deptId?: string) => departments.find((d) => d.id === deptId)?.name ?? "—";

  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading client profile…</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Client not found.</p>
            <Link href="/clients">
              <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Clients</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const c = client as any;

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Client Profile" />
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Back + Header */}
            <div className="flex items-center gap-3">
              <Link href="/clients">
                <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Clients</Button>
              </Link>
            </div>

            {/* Client Header Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl font-bold">{client.name}</h1>
                      {c.tradingName && <span className="text-muted-foreground text-sm">T/A {c.tradingName}</span>}
                      <Badge className={statusColor(client.status)}>{client.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {client.businessType && <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5" />{client.businessType}</span>}
                      {client.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
                      {client.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
                      {(client.suburb || client.city) && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[client.suburb, client.city].filter(Boolean).join(", ")}</span>}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                      <span>{getDeptName(client.departmentId)}</span>
                      {client.contactPerson && <span>· Contact: {client.contactPerson}</span>}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Button onClick={() => setIsEditOpen(true)} size="sm">
                      <Edit className="mr-2 h-4 w-4" /> Edit Client
                    </Button>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{clientJobs.length}</div>
                    <div className="text-xs text-muted-foreground">Total Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{clientContracts.filter(c => c.isActive).length}</div>
                    <div className="text-xs text-muted-foreground">Active Contracts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{clientInvoices.filter(i => i.status !== "paid").length}</div>
                    <div className="text-xs text-muted-foreground">Open Invoices</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{clientQuotes.length}</div>
                    <div className="text-xs text-muted-foreground">Quotes / Leads</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabbed Content */}
            <Tabs defaultValue="details">
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="details"><User className="mr-1 h-3.5 w-3.5" />Details</TabsTrigger>
                <TabsTrigger value="jobs">
                  <Briefcase className="mr-1 h-3.5 w-3.5" />Jobs
                  {clientJobs.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{clientJobs.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="contracts">
                  <ClipboardList className="mr-1 h-3.5 w-3.5" />Contracts
                  {clientContracts.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{clientContracts.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="invoices">
                  <Receipt className="mr-1 h-3.5 w-3.5" />Invoices
                  {clientInvoices.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{clientInvoices.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="quotes">
                  <FileText className="mr-1 h-3.5 w-3.5" />Quotes / Leads
                  {clientQuotes.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{clientQuotes.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              {/* ── DETAILS TAB ────────────────────────────────────── */}
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Business */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Building className="h-4 w-4" />Business Details</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      <Row label="Business Name" value={client.name} />
                      {c.tradingName && <Row label="Trading Name" value={c.tradingName} />}
                      <Row label="Business Type" value={client.businessType} />
                      <Row label="Department" value={getDeptName(client.departmentId)} />
                      <Row label="Status" value={<Badge className={statusColor(client.status)}>{client.status}</Badge>} />
                      <Row label="Created" value={format(new Date(client.createdAt), "dd MMM yyyy")} />
                    </CardContent>
                  </Card>

                  {/* Contact */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" />Contact Details</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      <Row label="Contact Person" value={client.contactPerson} />
                      <Row label="Phone" value={client.phone} />
                      {c.alternatePhoneNumber && <Row label="Alt. Phone" value={c.alternatePhoneNumber} />}
                      <Row label="Email" value={client.email} />
                      {c.alternateEmailAddress && <Row label="Alt. Email" value={c.alternateEmailAddress} />}
                    </CardContent>
                  </Card>

                  {/* Address */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" />Physical Address</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      {hasStructuredAddress(client) ? (
                        <>
                          <Row label="Street" value={[client.streetNumber, client.streetName].filter(Boolean).join(" ") || undefined} />
                          <Row label="Suburb" value={client.suburb} />
                          <Row label="City" value={client.city} />
                          <Row label="Province" value={client.province} />
                          <Row label="Postal Code" value={client.postalCode} />
                        </>
                      ) : client.address ? (
                        <p className="whitespace-pre-line text-muted-foreground">{client.address}</p>
                      ) : (
                        <p className="text-muted-foreground italic">No address on file</p>
                      )}
                      {client.googleMapsLink && (
                        <a href={client.googleMapsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 underline text-xs mt-1">
                          <ExternalLink className="h-3 w-3" /> Open in Google Maps
                        </a>
                      )}
                    </CardContent>
                  </Card>

                  {/* Billing */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" />Billing & Financial</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      {(c.billingName || c.billingEmail || c.billingPhone) && (
                        <>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Contact</p>
                          {c.billingName && <Row label="Name" value={c.billingName} />}
                          {c.billingEmail && <Row label="Email" value={c.billingEmail} />}
                          {c.billingPhone && <Row label="Phone" value={c.billingPhone} />}
                          <div className="border-t pt-1.5 mt-1.5" />
                        </>
                      )}
                      <Row label="VAT Number" value={client.taxNumber} />
                      {c.companyRegistrationNumber && <Row label="Reg. Number" value={c.companyRegistrationNumber} />}
                      <Row label="Payment Terms" value={client.paymentTerms} />
                      <Row label="Credit Limit" value={client.creditLimit ? `R${Number(client.creditLimit).toFixed(2)}` : undefined} />
                      {c.sageCustomerCode && <Row label="Sage Code" value={c.sageCustomerCode} />}
                    </CardContent>
                  </Card>
                </div>

                {/* Rental Contract */}
                {c.hasRentalContract && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Rental Contract</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1.5">
                      <Row label="Status" value={<Badge className="bg-blue-100 text-blue-800">{c.rentalContractStatus || "Active"}</Badge>} />
                      {c.rentalContractType && <Row label="Type" value={c.rentalContractType} />}
                      {c.rentalNotes && <Row label="Notes" value={c.rentalNotes} />}
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                {client.notes && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Internal Notes</CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-muted-foreground whitespace-pre-line">{client.notes}</p></CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ── JOBS TAB ───────────────────────────────────────── */}
              <TabsContent value="jobs" className="space-y-4 mt-4">
                {clientJobs.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No jobs found for this client.</CardContent></Card>
                ) : (
                  <>
                    {inProgressJobs.length > 0 && (
                      <JobGroup title="In Progress" jobs={inProgressJobs} getDeptName={getDeptName} />
                    )}
                    {upcomingJobs.length > 0 && (
                      <JobGroup title="Upcoming / Scheduled" jobs={upcomingJobs} getDeptName={getDeptName} />
                    )}
                    {completedJobs.length > 0 && (
                      <JobGroup title="Completed" jobs={completedJobs} getDeptName={getDeptName} />
                    )}
                    {otherJobs.length > 0 && (
                      <JobGroup title="Other" jobs={otherJobs} getDeptName={getDeptName} />
                    )}
                  </>
                )}
              </TabsContent>

              {/* ── CONTRACTS TAB ─────────────────────────────────── */}
              <TabsContent value="contracts" className="mt-4">
                {clientContracts.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No service contracts for this client.</CardContent></Card>
                ) : (
                  <div className="space-y-3">
                    {clientContracts.map((contract) => (
                      <Card key={contract.id}>
                        <CardContent className="pt-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {contract.contractNumber && (
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{contract.contractNumber}</span>
                                )}
                                <span className="font-medium text-sm">{contract.serviceType}</span>
                                <Badge className={contract.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}>
                                  {contract.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                                <span>{getDeptName(contract.departmentId)}</span>
                                {contract.frequency && <span>Frequency: {contract.frequency}</span>}
                                {contract.startTime && <span>Time: {contract.startTime}</span>}
                                {contract.price && <span>Price: R{Number(contract.price).toFixed(2)}</span>}
                                {contract.contractStartDate && <span>Start: {contract.contractStartDate}</span>}
                                {contract.contractEndDate && <span>End: {contract.contractEndDate}</span>}
                              </div>
                            </div>
                            <Link href="/service-contracts">
                              <Button variant="outline" size="sm" className="text-xs"><ExternalLink className="mr-1 h-3 w-3" />View</Button>
                            </Link>
                          </div>
                          {contract.notes && <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{contract.notes}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── INVOICES TAB ──────────────────────────────────── */}
              <TabsContent value="invoices" className="mt-4">
                {clientInvoices.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No invoices for this client.</CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b bg-gray-50 text-xs text-muted-foreground">
                            <th className="text-left p-2">Invoice #</th>
                            <th className="text-left p-2">Date</th>
                            <th className="text-left p-2">Due</th>
                            <th className="text-right p-2">Total</th>
                            <th className="text-left p-2">Status</th>
                            <th className="p-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientInvoices.map((inv) => (
                            <tr key={inv.id} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-mono text-xs">{inv.invoiceNumber}</td>
                              <td className="p-2">{format(new Date(inv.issueDate), "dd MMM yyyy")}</td>
                              <td className="p-2">{format(new Date(inv.dueDate), "dd MMM yyyy")}</td>
                              <td className="p-2 text-right font-medium">R{Number(inv.total).toFixed(2)}</td>
                              <td className="p-2"><Badge className={`text-xs ${invoiceStatusColor(inv.status)}`}>{inv.status}</Badge></td>
                              <td className="p-2">
                                <Link href="/invoices">
                                  <Button variant="ghost" size="sm" className="h-6 text-xs"><ExternalLink className="h-3 w-3" /></Button>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── QUOTES / LEADS TAB ────────────────────────────── */}
              <TabsContent value="quotes" className="mt-4">
                {clientQuotes.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No quotes or leads for this client.</CardContent></Card>
                ) : (
                  <div className="space-y-3">
                    {clientQuotes.map((q) => (
                      <Card key={q.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {q.quoteNumber && <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{q.quoteNumber}</span>}
                                {q.serviceType && <span className="text-sm font-medium">{q.serviceType}</span>}
                                <Badge variant="outline" className="text-xs">{q.status}</Badge>
                                {q.stage && <Badge variant="secondary" className="text-xs">{q.stage.replace(/_/g, " ")}</Badge>}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                                {q.quoteAmount && <span>Amount: R{Number(q.quoteAmount).toFixed(2)}</span>}
                                {q.createdAt && <span>Created: {format(new Date(q.createdAt), "dd MMM yyyy")}</span>}
                              </div>
                              {q.notes && <p className="text-xs text-muted-foreground">{q.notes}</p>}
                            </div>
                            <Link href="/leads">
                              <Button variant="outline" size="sm" className="text-xs shrink-0"><ExternalLink className="mr-1 h-3 w-3" />View</Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <MobileNavigation />
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client information.</DialogDescription>
          </DialogHeader>
          <ClientForm
            client={client}
            allClients={allClients}
            onSubmit={(data) => updateMutation.mutate(data)}
            onCancel={() => setIsEditOpen(false)}
            isSubmitting={updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0 w-32">{label}:</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  );
}

function JobGroup({ title, jobs, getDeptName }: { title: string; jobs: Job[]; getDeptName: (id: string) => string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title} ({jobs.length})</h3>
      <div className="space-y-2">
        {jobs.map((job) => (
          <Card key={job.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {job.jobNumber && <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{job.jobNumber}</span>}
                    <span className="font-medium text-sm truncate">{job.title}</span>
                    <Badge className={`text-xs ${jobStatusColor(job.status)}`}>{job.status.replace("_", " ")}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(job.scheduledDate), "dd MMM yyyy")}</span>
                    {job.scheduledTime && <span>{job.scheduledTime}</span>}
                    <span>{getDeptName(job.departmentId)}</span>
                    <span>{job.serviceType}</span>
                    {job.priority && <span>Priority: {job.priority}</span>}
                  </div>
                  {job.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</p>}
                </div>
                <Link href="/jobs">
                  <Button variant="ghost" size="sm" className="text-xs shrink-0"><ExternalLink className="h-3 w-3" /></Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

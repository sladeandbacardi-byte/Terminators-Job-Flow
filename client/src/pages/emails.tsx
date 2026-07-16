import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mail, Send, Plus, MessageCircle, Phone, LayoutTemplate, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CustomerEmailForm from "@/components/forms/customer-email-form";
import { formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EmailLog, Client } from "@shared/schema";

// Template definitions — names must match exactly what you create in Meta Business Manager
const WA_TEMPLATES = [
  {
    name: "hello_world",
    label: "Hello World (Test)",
    description: "Meta's default test template — always approved.",
    paramLabels: [],
    preview: "Hello World! This is a test message from The Terminators.",
  },
  {
    name: "job_assigned",
    label: "Job Assigned (Worker)",
    description: "Notify a worker they have been assigned a new job.",
    paramLabels: ["Worker name", "Date", "Time", "Client name"],
    preview: "Hi {{1}}, you have a new job assigned for {{2}} at {{3}}. Client: {{4}}. Please confirm.",
  },
  {
    name: "appointment_reminder",
    label: "Appointment Reminder (Client)",
    description: "Remind a client about their upcoming service appointment.",
    paramLabels: ["Client name", "Date & time", "Address"],
    preview: "Hi {{1}}, your service appointment with The Terminators is confirmed for {{2}}. Our team will arrive at {{3}}. Call us on +27 41 123 4567 if you need to reschedule.",
  },
  {
    name: "invoice_ready",
    label: "Invoice Ready (Client)",
    description: "Let a client know their invoice is ready for payment.",
    paramLabels: ["Client name", "Invoice number", "Amount (R)"],
    preview: "Dear {{1}}, your invoice {{2}} for R{{3}} is now ready. Please contact us to arrange payment. Thank you for choosing The Terminators.",
  },
];

export default function Emails() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showEmailForm, setShowEmailForm] = useState(false);

  // WhatsApp free-form state
  const [waMode, setWaMode] = useState<"freeform" | "template">("template");
  const [waTo, setWaTo] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [waClientId, setWaClientId] = useState("");

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState(WA_TEMPLATES[0].name);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [templateTo, setTemplateTo] = useState("");
  const [templateClientId, setTemplateClientId] = useState("");

  const { toast } = useToast();
  const { data: emailLogs = [], isLoading } = useQuery<EmailLog[]>({ queryKey: ["/api/email-logs"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const currentTemplate = WA_TEMPLATES.find(t => t.name === selectedTemplate) ?? WA_TEMPLATES[0];

  const sendFreeFormMutation = useMutation({
    mutationFn: (payload: { to: string; message: string }) =>
      apiRequest("POST", "/api/whatsapp/send", payload),
    onSuccess: () => {
      toast({ title: "WhatsApp message sent!", description: `Message delivered to ${waTo}` });
      setWaTo(""); setWaMessage(""); setWaClientId("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to send", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  const sendTemplateMutation = useMutation({
    mutationFn: (payload: { to: string; templateName: string; parameters: string[] }) =>
      apiRequest("POST", "/api/whatsapp/send-template", payload),
    onSuccess: () => {
      toast({ title: "Template message sent!", description: `Sent "${currentTemplate.label}" to ${templateTo}` });
      setTemplateTo(""); setTemplateParams([]); setTemplateClientId("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to send template", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  const handleClientSelect = (clientId: string) => {
    setWaClientId(clientId);
    const c = clients.find(cl => cl.id === clientId);
    if (c?.phone) setWaTo(c.phone);
  };

  const handleTemplateClientSelect = (clientId: string) => {
    setTemplateClientId(clientId);
    const c = clients.find(cl => cl.id === clientId);
    if (c?.phone) setTemplateTo(c.phone);
  };

  const handleTemplateChange = (name: string) => {
    setSelectedTemplate(name);
    setTemplateParams([]);
  };

  const handleParamChange = (idx: number, value: string) => {
    const updated = [...templateParams];
    updated[idx] = value;
    setTemplateParams(updated);
  };

  const previewWithParams = () => {
    let preview = currentTemplate.preview;
    templateParams.forEach((p, i) => {
      preview = preview.replace(`{{${i + 1}}}`, p || `{{${i + 1}}}`);
    });
    return preview;
  };

  const filteredLogs = emailLogs.filter(log => {
    const matchSearch = log.toEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "all" || log.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusColor = (s: string) =>
    s === "sent" ? "bg-green-100 text-green-800" :
    s === "failed" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800";

  const getStatusIcon = (s: string) =>
    s === "sent" ? <Send className="h-4 w-4 text-green-600" /> :
    s === "failed" ? <Mail className="h-4 w-4 text-red-600" /> :
    <MessageCircle className="h-4 w-4 text-yellow-600" />;

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
        <div className="p-6 pb-20 lg:pb-6">
          <div className="space-y-6">

            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Communication Center</h1>
                <p className="text-gray-500 mt-1">Send emails and WhatsApp messages to clients and staff</p>
              </div>
              <Button onClick={() => setShowEmailForm(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create Email
              </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Emails", value: filteredLogs.length, icon: Mail, color: "text-blue-600" },
                { label: "Sent", value: filteredLogs.filter(l => l.status === "sent").length, icon: Send, color: "text-green-600" },
                { label: "Pending", value: filteredLogs.filter(l => l.status === "pending").length, icon: MessageCircle, color: "text-yellow-600" },
                { label: "Failed", value: filteredLogs.filter(l => l.status === "failed").length, icon: Mail, color: "text-red-600" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-lg border p-5">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-7 w-7 ${color}`} />
                    <div>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-xl font-bold text-gray-900">{value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Main tabs */}
            <Tabs defaultValue="whatsapp" className="space-y-4">
              <TabsList>
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" /> WhatsApp
                </TabsTrigger>
              </TabsList>

              {/* EMAIL TAB */}
              <TabsContent value="email" className="space-y-4">
                <div className="bg-white rounded-lg border p-4 flex flex-col md:flex-row gap-4">
                  <Input placeholder="Search emails..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  <select className="w-44 px-3 py-2 border border-gray-300 rounded-md text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="all">All Statuses</option>
                    <option value="sent">Sent</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="bg-white rounded-lg border divide-y">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <Mail className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No emails yet. Compose your first email.</p>
                    </div>
                  ) : filteredLogs.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(log.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{log.subject}</p>
                            <Badge className={getStatusColor(log.status)}>{log.status}</Badge>
                          </div>
                          <p className="text-xs text-gray-500">To: {log.toEmail}</p>
                          <p className="text-xs text-gray-400">{formatDate(new Date(log.createdAt))}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* WHATSAPP TAB */}
              <TabsContent value="whatsapp" className="space-y-4">
                {/* Mode toggle */}
                <div className="flex gap-2">
                  <Button size="sm" variant={waMode === "template" ? "default" : "outline"}
                    onClick={() => setWaMode("template")} className="flex items-center gap-2">
                    <LayoutTemplate className="h-4 w-4" /> Use Template
                  </Button>
                  <Button size="sm" variant={waMode === "freeform" ? "default" : "outline"}
                    onClick={() => setWaMode("freeform")} className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" /> Free Message
                  </Button>
                </div>

                {/* TEMPLATE MODE */}
                {waMode === "template" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <LayoutTemplate className="h-4 w-4 text-green-500" /> Send Template Message
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Template selector */}
                        <div className="space-y-1.5">
                          <Label>Select Template</Label>
                          <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WA_TEMPLATES.map(t => (
                                <SelectItem key={t.name} value={t.name}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-400">{currentTemplate.description}</p>
                        </div>

                        {/* Client picker */}
                        <div className="space-y-1.5">
                          <Label>Pick Client / Worker (auto-fills phone)</Label>
                          <Select value={templateClientId} onValueChange={handleTemplateClientSelect}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {clients.map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}{c.phone ? ` · ${c.phone}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Phone */}
                        <div className="space-y-1.5">
                          <Label>WhatsApp Number <span className="text-red-500">*</span></Label>
                          <Input placeholder="+27 82 123 4567" value={templateTo} onChange={e => setTemplateTo(e.target.value)} />
                        </div>

                        {/* Dynamic parameter fields */}
                        {currentTemplate.paramLabels.length > 0 && (
                          <div className="space-y-3">
                            <Label>Fill in Template Variables</Label>
                            {currentTemplate.paramLabels.map((label, idx) => (
                              <div key={idx} className="space-y-1">
                                <Label className="text-xs text-gray-500">{`{{${idx + 1}}} — ${label}`}</Label>
                                <Input
                                  placeholder={label}
                                  value={templateParams[idx] ?? ""}
                                  onChange={e => handleParamChange(idx, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        <Button
                          onClick={() => sendTemplateMutation.mutate({
                            to: templateTo,
                            templateName: selectedTemplate,
                            parameters: templateParams,
                          })}
                          disabled={sendTemplateMutation.isPending || !templateTo}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          {sendTemplateMutation.isPending ? "Sending..." : (
                            <><Phone className="h-4 w-4 mr-2" /> Send Template Message</>
                          )}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Live preview */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Message Preview</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-[#dcf8c6] rounded-2xl rounded-tl-none p-4 shadow-sm max-w-xs">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{previewWithParams()}</p>
                          <p className="text-xs text-gray-400 text-right mt-2">12:00 ✓✓</p>
                        </div>
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
                          <strong>Template name:</strong> <code>{currentTemplate.name}</code><br />
                          Make sure this exact name is approved in Meta Business Manager before sending.
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* FREE-FORM MODE */}
                {waMode === "freeform" && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-blue-500" /> Free-form Message
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                        Free-form messages only work if the recipient has messaged your WhatsApp Business number within the last 24 hours. For outbound messages, use a <strong>Template</strong> instead.
                      </div>

                      <div className="space-y-1.5">
                        <Label>Pick a Client (optional)</Label>
                        <Select value={waClientId} onValueChange={handleClientSelect}>
                          <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
                          <SelectContent>
                            {clients.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Phone Number <span className="text-red-500">*</span></Label>
                        <Input placeholder="+27 82 123 4567" value={waTo} onChange={e => setWaTo(e.target.value)} />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Message <span className="text-red-500">*</span></Label>
                        <Textarea placeholder="Type your message..." value={waMessage} onChange={e => setWaMessage(e.target.value)} rows={5} />
                        <p className="text-xs text-gray-400">{waMessage.length} characters</p>
                      </div>

                      <Button
                        onClick={() => sendFreeFormMutation.mutate({ to: waTo, message: waMessage })}
                        disabled={sendFreeFormMutation.isPending || !waTo || !waMessage}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {sendFreeFormMutation.isPending ? "Sending..." : <><Phone className="h-4 w-4 mr-2" /> Send Message</>}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            {/* Compose Email Dialog */}
            <Dialog open={showEmailForm} onOpenChange={setShowEmailForm}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Email</DialogTitle>
                  <DialogDescription>Choose a template, fill in the details, then open in your email app to review and send.</DialogDescription>
                </DialogHeader>
                <CustomerEmailForm onSuccess={() => setShowEmailForm(false)} onCancel={() => setShowEmailForm(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
  );
}

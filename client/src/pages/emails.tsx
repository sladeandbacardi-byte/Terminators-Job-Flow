import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Mail, Send, Plus, MessageCircle, FileText, Phone } from "lucide-react";
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

export default function Emails() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // WhatsApp form state
  const [waTo, setWaTo] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [waClientId, setWaClientId] = useState("");

  const { toast } = useToast();

  const { data: emailLogs = [], isLoading } = useQuery<EmailLog[]>({ queryKey: ["/api/email-logs"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const sendWhatsAppMutation = useMutation({
    mutationFn: async (payload: { to: string; message: string }) => {
      return apiRequest("POST", "/api/whatsapp/send", payload);
    },
    onSuccess: () => {
      toast({ title: "WhatsApp message sent!", description: `Message delivered to ${waTo}` });
      setWaTo("");
      setWaMessage("");
      setWaClientId("");
    },
    onError: (err: any) => {
      const msg = err?.message ?? "Failed to send WhatsApp message";
      toast({ title: "Failed to send", description: msg, variant: "destructive" });
    },
  });

  const handleClientSelect = (clientId: string) => {
    setWaClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client?.phone) setWaTo(client.phone);
  };

  const handleSendWhatsApp = () => {
    if (!waTo || !waMessage) {
      toast({ title: "Missing fields", description: "Please enter a phone number and message.", variant: "destructive" });
      return;
    }
    sendWhatsAppMutation.mutate({ to: waTo, message: waMessage });
  };

  const filteredLogs = emailLogs.filter(log => {
    const matchesSearch =
      log.toEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent": return "bg-green-100 text-green-800";
      case "failed": return "bg-red-100 text-red-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent": return <Send className="h-4 w-4 text-green-600" />;
      case "failed": return <Mail className="h-4 w-4 text-red-600" />;
      case "pending": return <MessageCircle className="h-4 w-4 text-yellow-600" />;
      default: return <Mail className="h-4 w-4 text-gray-600" />;
    }
  };

  const sentEmails = filteredLogs.filter(l => l.status === "sent").length;
  const failedEmails = filteredLogs.filter(l => l.status === "failed").length;
  const pendingEmails = filteredLogs.filter(l => l.status === "pending").length;

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="emails-page">
      <Sidebar />

      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative bg-white w-64 shadow-lg"><Sidebar /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Communication Center" onMobileMenuToggle={() => setIsMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="space-y-6">

            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Communication Center</h1>
                <p className="text-gray-600 mt-1">Send emails & WhatsApp messages to clients</p>
              </div>
              <Button onClick={() => setShowEmailForm(true)} className="bg-primary-600 hover:bg-primary-700">
                <Plus className="h-4 w-4 mr-2" /> Compose Email
              </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Emails", value: filteredLogs.length, icon: Mail, color: "text-blue-600" },
                { label: "Sent", value: sentEmails, icon: Send, color: "text-green-600" },
                { label: "Pending", value: pendingEmails, icon: MessageCircle, color: "text-yellow-600" },
                { label: "Failed", value: failedEmails, icon: Mail, color: "text-red-600" },
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

            {/* Tabs: Email | WhatsApp */}
            <Tabs defaultValue="email" className="space-y-4">
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
                {/* Filters */}
                <div className="bg-white rounded-lg border p-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <Input
                        placeholder="Search emails or subjects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="w-44">
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="all">All Statuses</option>
                        <option value="sent">Sent</option>
                        <option value="failed">Failed</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border divide-y">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No emails found. Compose your first email.</p>
                    </div>
                  ) : (
                    filteredLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(log.status)}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 text-sm">{log.subject}</p>
                              <Badge className={getStatusColor(log.status)}>
                                {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500">To: {log.toEmail}</p>
                            <p className="text-xs text-gray-400">{formatDate(new Date(log.createdAt))}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* WHATSAPP TAB */}
              <TabsContent value="whatsapp">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Phone className="h-4 w-4 text-green-500" /> Send WhatsApp Message
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Pick a client (optional) */}
                    <div className="space-y-1.5">
                      <Label>Pick a Client (optional — auto-fills phone)</Label>
                      <Select value={waClientId} onValueChange={handleClientSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a client..." />
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

                    {/* Phone number */}
                    <div className="space-y-1.5">
                      <Label>WhatsApp Phone Number <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="+27 82 123 4567"
                        value={waTo}
                        onChange={e => setWaTo(e.target.value)}
                      />
                      <p className="text-xs text-gray-400">Include country code, e.g. +27 for South Africa</p>
                    </div>

                    {/* Message */}
                    <div className="space-y-1.5">
                      <Label>Message <span className="text-red-500">*</span></Label>
                      <Textarea
                        placeholder="Type your message here..."
                        value={waMessage}
                        onChange={e => setWaMessage(e.target.value)}
                        rows={5}
                      />
                      <p className="text-xs text-gray-400">{waMessage.length} characters</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        onClick={handleSendWhatsApp}
                        disabled={sendWhatsAppMutation.isPending || !waTo || !waMessage}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {sendWhatsAppMutation.isPending ? "Sending..." : (
                          <><Phone className="h-4 w-4 mr-2" /> Send WhatsApp</>
                        )}
                      </Button>
                      {sendWhatsAppMutation.isPending && (
                        <span className="text-sm text-gray-500">Sending via WhatsApp Business API...</span>
                      )}
                    </div>

                    <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
                      <p className="font-medium mb-1">About WhatsApp Business API</p>
                      <p>Messages are sent through your registered WhatsApp Business number. The recipient must have contacted your business number within the last 24 hours, or you need to use an approved message template for outbound messages.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Compose Email Dialog */}
            <Dialog open={showEmailForm} onOpenChange={setShowEmailForm}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Compose Email</DialogTitle>
                  <DialogDescription>Send a custom email to one of your customers.</DialogDescription>
                </DialogHeader>
                <CustomerEmailForm
                  onSuccess={() => setShowEmailForm(false)}
                  onCancel={() => setShowEmailForm(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </main>

        <MobileNavigation />
      </div>
    </div>
  );
}

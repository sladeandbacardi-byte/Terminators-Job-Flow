import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, ExternalLink, Info } from "lucide-react";
import type { Client, Job, QuoteSubmission, RentalContract } from "@shared/schema";

const EMAIL_TEMPLATES = [
  {
    id: "quote_followup",
    label: "Quote Follow-Up",
    subject: "Follow-Up on Your Quote – The Terminators",
    body: (clientName: string) =>
      `Dear ${clientName},\n\nThank you for your interest in The Terminators. We wanted to follow up on the quote we recently sent you.\n\nWe would love the opportunity to serve you and are happy to answer any questions or discuss your requirements further.\n\nPlease don't hesitate to call us or reply to this email.\n\nKind regards,\nThe Terminators Team`,
  },
  {
    id: "appointment_confirmation",
    label: "Appointment Confirmation",
    subject: "Your Service Appointment is Confirmed – The Terminators",
    body: (clientName: string) =>
      `Dear ${clientName},\n\nThis is to confirm that your service appointment with The Terminators has been scheduled.\n\nOur team will be in contact to confirm the exact date and time. Please ensure that access to the premises is available on the day of the appointment.\n\nIf you need to reschedule or have any questions, please contact us.\n\nKind regards,\nThe Terminators Team`,
  },
  {
    id: "invoice_reminder",
    label: "Invoice Payment Reminder",
    subject: "Invoice Payment Reminder – The Terminators",
    body: (clientName: string) =>
      `Dear ${clientName},\n\nThis is a friendly reminder that an invoice from The Terminators is outstanding and due for payment.\n\nPlease arrange payment at your earliest convenience. If you have already made payment, please disregard this notice.\n\nFor any queries regarding the invoice, please contact us.\n\nKind regards,\nThe Terminators Team`,
  },
  {
    id: "service_complete",
    label: "Service Completion",
    subject: "Service Completed – Thank You",
    body: (clientName: string) =>
      `Dear ${clientName},\n\nThank you for choosing The Terminators. We are pleased to confirm that the service at your premises has been completed.\n\nWe trust you are satisfied with the work carried out. If you have any concerns or require any follow-up, please do not hesitate to contact us.\n\nThank you for your business.\n\nKind regards,\nThe Terminators Team`,
  },
  {
    id: "new_contract",
    label: "New Contract Welcome",
    subject: "Welcome to The Terminators – Your Service Contract",
    body: (clientName: string) =>
      `Dear ${clientName},\n\nWelcome to The Terminators! We are delighted to have you as a client.\n\nYour service contract is now active and our team will be in touch to schedule your first service visit. We look forward to a long and productive partnership.\n\nShould you have any questions, please feel free to contact us at any time.\n\nKind regards,\nThe Terminators Team`,
  },
  {
    id: "custom",
    label: "Custom (Blank)",
    subject: "",
    body: () => "",
  },
];

type RelatedType = "none" | "quote" | "job" | "contract";

interface CustomerEmailFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  preselectedClientId?: string;
}

export default function CustomerEmailForm({ onSuccess, onCancel, preselectedClientId }: CustomerEmailFormProps) {
  const [templateId, setTemplateId] = useState(EMAIL_TEMPLATES[0].id);
  const [clientId, setClientId] = useState(preselectedClientId ?? "");
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState(EMAIL_TEMPLATES[0].subject);
  const [body, setBody] = useState("");
  const [relatedType, setRelatedType] = useState<RelatedType>("none");
  const [relatedId, setRelatedId] = useState("");

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: jobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: quotes = [] } = useQuery<QuoteSubmission[]>({ queryKey: ["/api/quote-submissions"] });
  const { data: contracts = [] } = useQuery<RentalContract[]>({ queryKey: ["/api/contracts"] });

  const selectedClient = clients.find(c => c.id === clientId);
  const currentTemplate = EMAIL_TEMPLATES.find(t => t.id === templateId) ?? EMAIL_TEMPLATES[0];

  useEffect(() => {
    const clientName = selectedClient?.name ?? "Valued Client";
    setSubject(currentTemplate.subject);
    setBody(currentTemplate.body(clientName));
  }, [templateId, clientId]);

  useEffect(() => {
    if (selectedClient?.email) setToEmail(selectedClient.email);
  }, [clientId]);

  const relatedLabel = (() => {
    if (relatedType === "none" || !relatedId) return null;
    if (relatedType === "quote") {
      const q = quotes.find(q => q.id === relatedId);
      return q ? `Quote: ${q.companyName}` : null;
    }
    if (relatedType === "job") {
      const j = jobs.find(j => j.id === relatedId);
      return j ? `Job: ${j.title}${j.jobNumber ? ` (#${j.jobNumber})` : ""}` : null;
    }
    if (relatedType === "contract") {
      const c = contracts.find(c => c.id === relatedId);
      return c ? `Contract: ${(c as any).contractNumber ?? c.id}` : null;
    }
    return null;
  })();

  const buildFullBody = () => {
    let fullBody = body;
    if (relatedLabel) {
      fullBody = `${fullBody}\n\n---\nReference: ${relatedLabel}`;
    }
    return fullBody;
  };

  const handleOpenEmailApp = () => {
    if (!toEmail) return;
    const mailtoLink = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildFullBody())}`;
    window.location.href = mailtoLink;
    onSuccess?.();
  };

  const relatedItems = (() => {
    if (relatedType === "quote") return quotes.map(q => ({ id: q.id, label: `${q.companyName} – ${q.contactName ?? ""}` }));
    if (relatedType === "job") return jobs.map(j => ({ id: j.id, label: `${j.title}${j.jobNumber ? ` (#${j.jobNumber})` : ""}` }));
    if (relatedType === "contract") return contracts.map(c => ({ id: c.id, label: `${(c as any).contractNumber ?? c.id}` }));
    return [];
  })();

  return (
    <div className="space-y-5">
      {/* Outlook note */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
        <span>
          Emails open in your default email app. To use Outlook, make sure Outlook is set as your default mail app in Windows.
        </span>
      </div>

      {/* Template */}
      <div className="space-y-1.5">
        <Label>Email Template</Label>
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a template..." />
          </SelectTrigger>
          <SelectContent>
            {EMAIL_TEMPLATES.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Client */}
      <div className="space-y-1.5">
        <Label>Related Client</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a client..." />
          </SelectTrigger>
          <SelectContent>
            {clients.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}{c.email ? ` — ${c.email}` : " — no email"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedClient && !selectedClient.email && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            This client has no email address on file. Enter one manually below.
          </p>
        )}
      </div>

      {/* Related entity */}
      <div className="space-y-1.5">
        <Label>Related To <span className="text-gray-400 font-normal">(optional)</span></Label>
        <div className="flex gap-2">
          <Select value={relatedType} onValueChange={v => { setRelatedType(v as RelatedType); setRelatedId(""); }}>
            <SelectTrigger className="w-40 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="quote">Lead / Quote</SelectItem>
              <SelectItem value="job">Job</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
            </SelectContent>
          </Select>
          {relatedType !== "none" && (
            <Select value={relatedId} onValueChange={setRelatedId}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${relatedType}...`} />
              </SelectTrigger>
              <SelectContent>
                {relatedItems.map(item => (
                  <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {relatedLabel && (
          <p className="text-xs text-gray-500">Will append reference line to email body: <em>{relatedLabel}</em></p>
        )}
      </div>

      {/* To */}
      <div className="space-y-1.5">
        <Label>To <span className="text-red-500">*</span></Label>
        <Input
          type="email"
          placeholder="client@example.com"
          value={toEmail}
          onChange={e => setToEmail(e.target.value)}
        />
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label>Subject <span className="text-red-500">*</span></Label>
        <Input
          placeholder="Email subject"
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <Label>Body</Label>
        <Textarea
          placeholder="Email body..."
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={8}
          className="font-mono text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleOpenEmailApp}
          disabled={!toEmail}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Open in Email App
        </Button>
      </div>
    </div>
  );
}

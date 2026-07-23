import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import DocumentForm from "@/components/forms/document-form";
import { type DocumentFormValues } from "@/components/forms/document-form-schema";
import type { Invoice, Client, InvoiceItem, Job, QuoteSubmission } from "@shared/schema";

interface InvoiceFormProps {
  invoice?: Invoice | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function InvoiceForm({ invoice, onSuccess, onCancel }: InvoiceFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: invoiceItems = [] } = useQuery<InvoiceItem[]>({
    queryKey: ["/api/invoices", invoice?.id, "items"],
    enabled: !!invoice?.id,
  });

  // Fetch source job and quote to detect legal-entity mismatches when editing
  const linkedJobId = invoice ? (invoice as any).linkedJobId : null;
  const linkedQuoteId = invoice ? (invoice as any).linkedQuoteId : null;
  const { data: linkedJob } = useQuery<Job>({
    queryKey: ["/api/jobs", linkedJobId],
    enabled: !!linkedJobId,
  });
  const { data: allQuotes = [] } = useQuery<QuoteSubmission[]>({
    queryKey: ["/api/quote-submissions"],
    enabled: !!linkedQuoteId,
  });
  const linkedQuote = linkedQuoteId ? allQuotes.find((q: any) => q.id === linkedQuoteId) : null;

  // Mismatch: invoice entity ≠ source entity from job or quote
  const invoiceEntityId = invoice ? (invoice as any).legalEntityId : null;
  const sourceEntityId =
    (linkedJob as any)?.legalEntityId ||
    (linkedQuote as any)?.legalEntityId ||
    null;
  const entityMismatch =
    !!invoice &&
    !!invoiceEntityId &&
    !!sourceEntityId &&
    invoiceEntityId !== sourceEntityId;
  const invoiceEntityName = invoice ? (invoice as any).legalEntityName : null;

  // Build defaultValues from existing invoice + items when editing
  const editDefaults: Partial<DocumentFormValues> | undefined = invoice
    ? {
        clientId: invoice.clientId,
        status: invoice.status,
        issueDate: invoice.issueDate ? new Date(invoice.issueDate) : new Date(),
        dueDate: invoice.dueDate ? new Date(invoice.dueDate) : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })(),
        notes: invoice.notes ?? "",
        terms: invoice.terms ?? "Payment due within 30 days.",
        subtotal: invoice.subtotal ?? "0.00",
        vatAmount: invoice.taxAmount ?? "0.00",
        totalAmount: invoice.total ?? "0.00",
        legalEntityId: (invoice as any).legalEntityId ?? "",
        legalEntityName: (invoice as any).legalEntityName ?? "",
        lineItems: invoiceItems.length > 0
          ? invoiceItems.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total }))
          : [{ description: "", quantity: "1", unitPrice: "0.00", total: "0.00" }],
      }
    : undefined;

  const createMutation = useMutation({
    mutationFn: async (data: DocumentFormValues) => {
      const invoiceData = {
        clientId: data.clientId,
        status: data.status || "draft",
        issueDate: data.issueDate?.toISOString() ?? new Date().toISOString(),
        dueDate: data.dueDate?.toISOString() ?? new Date(Date.now() + 30 * 86400000).toISOString(),
        subtotal: data.subtotal,
        taxAmount: data.vatAmount,
        total: data.totalAmount,
        paidAmount: "0.00",
        notes: data.notes ?? "",
        terms: data.terms ?? "Payment due within 30 days.",
        legalEntityId: data.legalEntityId || undefined,
        legalEntityName: data.legalEntityName || undefined,
      };
      const res = await apiRequest("POST", "/api/invoices", invoiceData);
      const created = await res.json();
      for (const item of data.lineItems) {
        await apiRequest("POST", `/api/invoices/${created.id}/items`, {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice created successfully" });
      onSuccess();
    },
    onError: () => toast({ title: "Failed to create invoice", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: DocumentFormValues) => {
      const invoiceData = {
        clientId: data.clientId,
        status: data.status || "draft",
        issueDate: data.issueDate?.toISOString() ?? new Date().toISOString(),
        dueDate: data.dueDate?.toISOString() ?? new Date(Date.now() + 30 * 86400000).toISOString(),
        subtotal: data.subtotal,
        taxAmount: data.vatAmount,
        total: data.totalAmount,
        notes: data.notes ?? "",
        legalEntityId: data.legalEntityId || undefined,
        legalEntityName: data.legalEntityName || undefined,
        terms: data.terms ?? "Payment due within 30 days.",
      };
      return apiRequest("PUT", `/api/invoices/${invoice!.id}`, invoiceData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice updated successfully" });
      onSuccess();
    },
    onError: () => toast({ title: "Failed to update invoice", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      {entityMismatch && (
        <div className="flex items-start gap-3 rounded-md bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
          <span>
            <strong>Legal entity mismatch:</strong> This invoice is billed under{" "}
            <strong>{invoiceEntityName}</strong>, but the source job or quote is linked to a
            different legal entity. Update the Legal Entity field below if this is incorrect.
          </span>
        </div>
      )}
      <DocumentForm
        docType="invoice"
        clients={clients}
        defaultValues={editDefaults}
        isPending={isPending}
        submitLabel={invoice ? "Update Invoice" : "Create Invoice"}
        onSubmit={data => invoice ? updateMutation.mutate(data) : createMutation.mutate(data)}
        onCancel={onCancel}
      />
    </div>
  );
}

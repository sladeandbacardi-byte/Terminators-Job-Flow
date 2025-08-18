import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, FileText, Eye, Edit, Trash2, DollarSign, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InvoiceForm from "@/components/forms/invoice-form";
import type { Invoice, Client } from "@shared/schema";
import { formatDate } from "@/lib/utils";

export default function Invoices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const clientMap = new Map(clients.map(client => [client.id, client]));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'sent':
        return <FileText className="h-4 w-4 text-blue-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (invoice: Invoice) => {
    return invoice.status !== 'paid' && invoice.status !== 'cancelled' && new Date(invoice.dueDate) < new Date();
  };

  const filteredInvoices = invoices.filter(invoice => {
    const client = clientMap.get(invoice.clientId);
    const matchesSearch = 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (activeTab === 'overdue') {
      matchesStatus = isOverdue(invoice);
    } else if (activeTab !== 'all') {
      matchesStatus = invoice.status === activeTab;
    }
    
    return matchesSearch && matchesStatus;
  });

  const totalAmount = filteredInvoices.reduce((sum, invoice) => sum + parseFloat(invoice.total), 0);
  const paidAmount = filteredInvoices
    .filter(i => i.status === 'paid')
    .reduce((sum, invoice) => sum + parseFloat(invoice.total), 0);
  const outstandingAmount = totalAmount - paidAmount;

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceForm(true);
  };

  const handleCreateInvoice = () => {
    setSelectedInvoice(null);
    setShowInvoiceForm(true);
  };

  const handleFormSuccess = () => {
    setShowInvoiceForm(false);
    setSelectedInvoice(null);
  };

  const handleFormCancel = () => {
    setShowInvoiceForm(false);
    setSelectedInvoice(null);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="invoices-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="page-title">Invoice Management</h1>
          <p className="text-gray-600 mt-2">Create and manage customer invoices</p>
        </div>
        <Button onClick={handleCreateInvoice} className="bg-primary-600 hover:bg-primary-700" data-testid="create-invoice-button">
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Invoiced</p>
              <p className="text-2xl font-bold text-gray-900">R{totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Paid Amount</p>
              <p className="text-2xl font-bold text-gray-900">R{paidAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">R{outstandingAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search invoices or clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-input"
            />
          </div>
        </div>
      </div>

      {/* Invoice Tabs */}
      <div className="bg-white rounded-lg border">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All Invoices</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="p-6">
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
                <p className="text-gray-600 mb-4">
                  {activeTab === 'all' ? 'Get started by creating your first invoice.' : `No ${activeTab} invoices match your search.`}
                </p>
                {activeTab === 'all' && (
                  <Button onClick={handleCreateInvoice}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredInvoices.map((invoice) => {
                  const client = clientMap.get(invoice.clientId);
                  const overdueStatus = isOverdue(invoice);
                  
                  return (
                    <div key={invoice.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors" data-testid={`invoice-card-${invoice.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {getStatusIcon(overdueStatus ? 'overdue' : invoice.status)}
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold text-gray-900" data-testid={`invoice-number-${invoice.id}`}>
                                {invoice.invoiceNumber}
                              </h3>
                              <Badge className={getStatusColor(overdueStatus ? 'overdue' : invoice.status)}>
                                {overdueStatus ? 'Overdue' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600" data-testid={`client-name-${invoice.id}`}>
                              {client?.name || 'Unknown Client'}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                              <span>Issued: {formatDate(new Date(invoice.issueDate))}</span>
                              <span>Due: {formatDate(new Date(invoice.dueDate))}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-lg font-semibold text-gray-900" data-testid={`invoice-total-${invoice.id}`}>
                              R{parseFloat(invoice.total).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                            </p>
                            {parseFloat(invoice.paidAmount) > 0 && (
                              <p className="text-sm text-green-600">
                                R{parseFloat(invoice.paidAmount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} paid
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditInvoice(invoice)}
                              data-testid={`edit-invoice-${invoice.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Invoice Form Dialog */}
      <Dialog open={showInvoiceForm} onOpenChange={setShowInvoiceForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedInvoice ? "Edit Invoice" : "Create New Invoice"}
            </DialogTitle>
            <DialogDescription>
              {selectedInvoice ? "Update the invoice details below." : "Fill in the details to create a new invoice."}
            </DialogDescription>
          </DialogHeader>
          <InvoiceForm
            invoice={selectedInvoice}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
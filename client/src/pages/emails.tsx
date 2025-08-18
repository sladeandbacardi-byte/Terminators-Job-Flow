import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Send, Plus, MessageCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import CustomerEmailForm from "@/components/forms/customer-email-form";
import { formatDate } from "@/lib/utils";
import type { EmailLog } from "@shared/schema";

export default function Emails() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showEmailForm, setShowEmailForm] = useState(false);

  const { data: emailLogs = [], isLoading } = useQuery<EmailLog[]>({
    queryKey: ['/api/email-logs'],
  });

  const filteredLogs = emailLogs.filter(log => {
    const matchesSearch = 
      log.toEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Send className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <Mail className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <MessageCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Mail className="h-4 w-4 text-gray-600" />;
    }
  };

  const handleEmailSuccess = () => {
    setShowEmailForm(false);
  };

  const handleEmailCancel = () => {
    setShowEmailForm(false);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  const sentEmails = filteredLogs.filter(log => log.status === 'sent').length;
  const failedEmails = filteredLogs.filter(log => log.status === 'failed').length;
  const pendingEmails = filteredLogs.filter(log => log.status === 'pending').length;

  return (
    <div className="p-6 space-y-6" data-testid="emails-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="page-title">Email Management</h1>
          <p className="text-gray-600 mt-2">Send emails to customers and track email history</p>
        </div>
        <Button 
          onClick={() => setShowEmailForm(true)} 
          className="bg-primary-600 hover:bg-primary-700" 
          data-testid="compose-email-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          Compose Email
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <Mail className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Emails</p>
              <p className="text-2xl font-bold text-gray-900">{filteredLogs.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <Send className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Sent</p>
              <p className="text-2xl font-bold text-green-900">{sentEmails}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <MessageCircle className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-900">{pendingEmails}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <Mail className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-900">{failedEmails}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search emails or subjects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-input"
            />
          </div>
          <div className="w-48">
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="status-filter"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Email History */}
      <div className="bg-white rounded-lg border">
        <Tabs value="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Emails</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="p-6">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No emails found</h3>
                <p className="text-gray-600 mb-4">
                  {emailLogs.length === 0 
                    ? "No emails have been sent yet. Start by composing your first email."
                    : "No emails match your search criteria."
                  }
                </p>
                {emailLogs.length === 0 && (
                  <Button onClick={() => setShowEmailForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Compose Email
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors" data-testid={`email-log-${log.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(log.status)}
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-gray-900" data-testid={`email-subject-${log.id}`}>
                              {log.subject}
                            </h3>
                            <Badge className={getStatusColor(log.status)}>
                              {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600" data-testid={`email-recipient-${log.id}`}>
                            To: {log.toEmail}
                          </p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                            <span>Sent: {formatDate(new Date(log.createdAt))}</span>
                            {log.relatedEntityType && (
                              <span className="capitalize">
                                Related to: {log.relatedEntityType}
                              </span>
                            )}
                          </div>
                          {log.errorMessage && (
                            <p className="text-sm text-red-600 mt-1">
                              Error: {log.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Compose Email Dialog */}
      <Dialog open={showEmailForm} onOpenChange={setShowEmailForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compose Email</DialogTitle>
            <DialogDescription>
              Send a custom email to one of your customers.
            </DialogDescription>
          </DialogHeader>
          <CustomerEmailForm
            onSuccess={handleEmailSuccess}
            onCancel={handleEmailCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
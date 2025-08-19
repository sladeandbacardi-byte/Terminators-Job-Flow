import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ExternalLink, Send, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import type { Invoice } from "@shared/schema";

interface SageIntegrationProps {
  invoice: Invoice;
  onSuccess?: () => void;
}

interface SageConnectionTest {
  success: boolean;
  message: string;
}

interface SageSendResult {
  success: boolean;
  message: string;
  sageInvoiceId?: string;
  sageInvoiceNumber?: string;
}

export function SageIntegration({ invoice, onSuccess }: SageIntegrationProps) {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<SageConnectionTest | null>(null);
  const [sendResult, setSendResult] = useState<SageSendResult | null>(null);

  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      const result = await apiRequest<SageConnectionTest>('/api/sage/test-connection', {
        method: 'POST',
      });
      setConnectionStatus(result);
      
      if (result.success) {
        toast({
          title: "Connection Successful",
          description: result.message,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setConnectionStatus({ success: false, message });
      toast({
        title: "Connection Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const sendToSage = async () => {
    setIsSendingInvoice(true);
    try {
      const result = await apiRequest<SageSendResult>(`/api/sage/send-invoice/${invoice.id}`, {
        method: 'POST',
      });
      setSendResult(result);
      
      if (result.success) {
        toast({
          title: "Invoice Sent to Sage",
          description: result.message,
        });
        onSuccess?.();
      } else {
        toast({
          title: "Failed to Send Invoice",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSendResult({ success: false, message });
      toast({
        title: "Send Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  return (
    <Card className="w-full max-w-2xl" data-testid="sage-integration-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Sage Accounting Integration
        </CardTitle>
        <CardDescription>
          Send invoice {invoice.invoiceNumber} to Sage Accounting for centralized financial management
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Invoice Information */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Invoice Number</p>
            <p className="text-sm text-muted-foreground">{invoice.invoiceNumber}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Total Amount</p>
            <p className="text-sm text-muted-foreground">R {parseFloat(invoice.total).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Issue Date</p>
            <p className="text-sm text-muted-foreground">
              {new Date(invoice.issueDate).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Status</p>
            <Badge variant="outline" className="capitalize">
              {invoice.status}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Connection Test */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Sage Connection</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={isTestingConnection}
              data-testid="button-test-connection"
            >
              {isTestingConnection ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>
          </div>

          {connectionStatus && (
            <div className="flex items-center gap-2 p-3 rounded-md border">
              {getStatusIcon(connectionStatus.success)}
              <span className="text-sm">{connectionStatus.message}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Send Invoice */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Send to Sage</h4>
            <Button
              onClick={sendToSage}
              disabled={isSendingInvoice || !connectionStatus?.success}
              data-testid="button-send-to-sage"
            >
              {isSendingInvoice ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Invoice
                </>
              )}
            </Button>
          </div>

          {!connectionStatus?.success && (
            <p className="text-sm text-muted-foreground">
              Please test the connection first before sending invoices.
            </p>
          )}

          {sendResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 rounded-md border">
                {getStatusIcon(sendResult.success)}
                <span className="text-sm">{sendResult.message}</span>
              </div>
              
              {sendResult.success && sendResult.sageInvoiceId && (
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <strong>Sage Invoice ID:</strong> {sendResult.sageInvoiceId}
                  </p>
                  {sendResult.sageInvoiceNumber && (
                    <p className="text-sm text-green-800 dark:text-green-200">
                      <strong>Sage Invoice Number:</strong> {sendResult.sageInvoiceNumber}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sage Status Display */}
        {invoice.sageInvoiceId && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Sage Integration Status</h4>
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Sage Invoice ID:</strong> {invoice.sageInvoiceId}
                </p>
                {invoice.sageStatus && (
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Status:</strong> {invoice.sageStatus}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Help Information */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <h5 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
            Setup Required
          </h5>
          <p className="text-xs text-blue-800 dark:text-blue-200">
            To use Sage integration, ensure you have configured the following environment variables:
          </p>
          <ul className="text-xs text-blue-800 dark:text-blue-200 mt-1 space-y-1">
            <li>• SAGE_CLIENT_ID</li>
            <li>• SAGE_CLIENT_SECRET</li>
            <li>• SAGE_ACCESS_TOKEN</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// Bulk send component for multiple invoices
interface BulkSageIntegrationProps {
  invoiceIds: string[];
  onSuccess?: () => void;
}

export function BulkSageIntegration({ invoiceIds, onSuccess }: BulkSageIntegrationProps) {
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const sendBulkInvoices = async () => {
    setIsSending(true);
    try {
      const result = await apiRequest('/api/sage/send-invoices-bulk', {
        method: 'POST',
        body: JSON.stringify({ invoiceIds }),
      });
      
      setResults(result.results);
      
      toast({
        title: "Bulk Send Complete",
        description: result.message,
      });
      
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Bulk Send Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="w-full" data-testid="bulk-sage-integration">
      <CardHeader>
        <CardTitle>Bulk Send to Sage</CardTitle>
        <CardDescription>
          Send {invoiceIds.length} selected invoices to Sage Accounting
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <Button
            onClick={sendBulkInvoices}
            disabled={isSending}
            className="w-full"
            data-testid="button-bulk-send"
          >
            {isSending ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Sending {invoiceIds.length} invoices...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send All to Sage
              </>
            )}
          </Button>

          {results && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium">Results:</h5>
              {results.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded border text-sm"
                >
                  {getStatusIcon(result.success)}
                  <span className="font-medium">{result.invoiceNumber}:</span>
                  <span className={result.success ? "text-green-600" : "text-red-600"}>
                    {result.success ? "Sent successfully" : result.error}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  function getStatusIcon(success: boolean) {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  }
}
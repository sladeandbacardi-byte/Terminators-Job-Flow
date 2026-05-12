import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";
import type { Client } from "@shared/schema";

export function SuspendedServices() {
  const { user } = useAuth();
  const role = getDashboardRole(user ?? {});
  const canReinstate = role === "accounts" || role === "admin" || role === "manager";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const suspended = clients.filter(c => c.status === "suspended");

  const reinstaMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/clients/${id}/status`, { status: "active" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Service reinstated", description: "Client service has been reactivated." });
    },
    onError: () => toast({ title: "Failed to reinstate", variant: "destructive" }),
  });

  if (suspended.length === 0) return null;

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-base flex items-center gap-2 text-red-700">
          <XCircle className="h-5 w-5 text-red-500" />
          Suspended Services
          <Badge className="bg-red-100 text-red-700 border-red-200 ml-1">{suspended.length}</Badge>
        </CardTitle>
        <p className="text-xs text-red-600 mt-0.5">
          These clients have had their services suspended due to non-payment. All team members should be aware.
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div className="space-y-2">
          {suspended.map(client => (
            <div
              key={client.id}
              className="flex items-center justify-between bg-white border border-red-200 rounded-lg px-4 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{client.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {client.phone || client.email || "No contact info"} 
                    {client.businessType ? ` · ${client.businessType}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <Badge className="bg-red-100 text-red-700 text-xs">Suspended</Badge>
                {canReinstate && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => reinstaMutation.mutate(client.id)}
                    disabled={reinstaMutation.isPending}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Reinstate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

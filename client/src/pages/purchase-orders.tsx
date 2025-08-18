import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Check,
  X,
  Mail,
  Calendar,
  DollarSign,
  Package,
  User,
  Building2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PurchaseOrderForm } from "@/components/forms/purchase-order-form";
import { apiRequest } from "@/lib/queryClient";
import type { PurchaseOrder, Supplier, InventoryItem, PurchaseOrderItem } from "@shared/schema";

export default function PurchaseOrdersPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [deletingPO, setDeletingPO] = useState<PurchaseOrder | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [approvingPO, setApprovingPO] = useState<PurchaseOrder | null>(null);
  const [rejectingPO, setRejectingPO] = useState<PurchaseOrder | null>(null);
  const [sendingPO, setSendingPO] = useState<PurchaseOrder | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  const { data: poItems = [] } = useQuery<PurchaseOrderItem[]>({
    queryKey: ["/api/purchase-orders", viewingPO?.id, "items"],
    enabled: !!viewingPO?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Create the purchase order first
      const po = await apiRequest("/api/purchase-orders", "POST", {
        ...data,
        items: undefined, // Don't send items in the main request
      });

      // Then create each item
      for (const item of data.items) {
        await apiRequest(`/api/purchase-orders/${po.id}/items`, "POST", {
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: (item.quantity * parseFloat(item.unitPrice)).toString(),
          notes: item.notes,
        });
      }

      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setIsCreateDialogOpen(false);
      toast({ description: "Purchase order created successfully" });
    },
    onError: () => {
      toast({ 
        description: "Failed to create purchase order", 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/purchase-orders/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setEditingPO(null);
      toast({ description: "Purchase order updated successfully" });
    },
    onError: () => {
      toast({ 
        description: "Failed to update purchase order", 
        variant: "destructive" 
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/purchase-orders/${id}/approve`, "POST", { approvedById: "user-2" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setApprovingPO(null);
      toast({ description: "Purchase order approved successfully" });
    },
    onError: () => {
      toast({ 
        description: "Failed to approve purchase order", 
        variant: "destructive" 
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest(`/api/purchase-orders/${id}/reject`, "POST", { rejectionReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setRejectingPO(null);
      setRejectionReason("");
      toast({ description: "Purchase order rejected" });
    },
    onError: () => {
      toast({ 
        description: "Failed to reject purchase order", 
        variant: "destructive" 
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/purchase-orders/${id}/send`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setSendingPO(null);
      toast({ description: "Purchase order sent to supplier successfully" });
    },
    onError: () => {
      toast({ 
        description: "Failed to send purchase order to supplier", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/purchase-orders/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setDeletingPO(null);
      toast({ description: "Purchase order deleted successfully" });
    },
    onError: () => {
      toast({ 
        description: "Failed to delete purchase order", 
        variant: "destructive" 
      });
    },
  });

  const filteredPOs = purchaseOrders.filter((po: PurchaseOrder) => {
    const supplier = suppliers.find(s => s.id === po.supplierId);
    const matchesSearch = po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const statusStats = purchaseOrders.reduce((acc: any, po: PurchaseOrder) => {
    acc[po.status] = (acc[po.status] || 0) + 1;
    return acc;
  }, {});

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      case "sent":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800"><Mail className="mr-1 h-3 w-3" />Sent</Badge>;
      case "received":
        return <Badge variant="default" className="bg-purple-100 text-purple-800"><Package className="mr-1 h-3 w-3" />Received</Badge>;
      case "cancelled":
        return <Badge variant="secondary"><X className="mr-1 h-3 w-3" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || "Unknown Supplier";
  };

  const getInventoryItemName = (itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    return item ? `${item.name} (${item.sku})` : "Unknown Item";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">Purchase Orders</h1>
          <p className="text-muted-foreground">
            Create and manage purchase orders with approval workflow
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-purchase-order">
              <Plus className="mr-2 h-4 w-4" />
              Create Purchase Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Purchase Order</DialogTitle>
              <DialogDescription>
                Create a new purchase order for inventory items from suppliers.
              </DialogDescription>
            </DialogHeader>
            <PurchaseOrderForm
              onSubmit={(data) => createMutation.mutate(data)}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-orders">{purchaseOrders.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="stat-pending">{statusStats.pending || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-approved">{statusStats.approved || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-rejected">{statusStats.rejected || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-value">
              R{purchaseOrders.reduce((sum, po) => sum + parseFloat(po.totalAmount || "0"), 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search purchase orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              data-testid="input-search-orders"
            />
          </div>
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Purchase Orders Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Request Date</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading purchase orders...
                </TableCell>
              </TableRow>
            ) : filteredPOs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No purchase orders found
                </TableCell>
              </TableRow>
            ) : (
              filteredPOs.map((po: PurchaseOrder) => (
                <TableRow key={po.id} data-testid={`row-purchase-order-${po.id}`}>
                  <TableCell>
                    <div className="font-medium">{po.poNumber}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                      {getSupplierName(po.supplierId)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(po.status)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">R{parseFloat(po.totalAmount || "0").toFixed(2)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      User {po.requestedById}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                      {new Date(po.requestDate).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${po.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setViewingPO(po)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {po.status === "pending" && (
                          <>
                            <DropdownMenuItem onClick={() => setEditingPO(po)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setApprovingPO(po)}>
                              <Check className="mr-2 h-4 w-4" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setRejectingPO(po)}>
                              <X className="mr-2 h-4 w-4" />
                              Reject
                            </DropdownMenuItem>
                          </>
                        )}
                        {po.status === "approved" && (
                          <DropdownMenuItem onClick={() => setSendingPO(po)}>
                            <Mail className="mr-2 h-4 w-4" />
                            Send to Supplier
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setDeletingPO(po)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={!!viewingPO} onOpenChange={() => setViewingPO(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Order Details - {viewingPO?.poNumber}</DialogTitle>
            <DialogDescription>
              Complete details and items for this purchase order.
            </DialogDescription>
          </DialogHeader>
          {viewingPO && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Order Information</h3>
                  <div className="space-y-2 text-sm">
                    <div>Status: {getStatusBadge(viewingPO.status)}</div>
                    <div>Supplier: {getSupplierName(viewingPO.supplierId)}</div>
                    <div>Total Amount: R{parseFloat(viewingPO.totalAmount || "0").toFixed(2)}</div>
                    <div>Request Date: {new Date(viewingPO.requestDate).toLocaleDateString()}</div>
                    {viewingPO.expectedDeliveryDate && (
                      <div>Expected Delivery: {new Date(viewingPO.expectedDeliveryDate).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Approval Information</h3>
                  <div className="space-y-2 text-sm">
                    <div>Requested By: User {viewingPO.requestedById}</div>
                    {viewingPO.approvedById && (
                      <>
                        <div>Approved By: User {viewingPO.approvedById}</div>
                        <div>Approval Date: {new Date(viewingPO.approvalDate!).toLocaleDateString()}</div>
                      </>
                    )}
                    {viewingPO.rejectionReason && (
                      <div>Rejection Reason: {viewingPO.rejectionReason}</div>
                    )}
                  </div>
                </div>
              </div>

              {viewingPO.notes && (
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground">{viewingPO.notes}</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Order Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poItems.map((item: PurchaseOrderItem) => (
                      <TableRow key={item.id}>
                        <TableCell>{getInventoryItemName(item.inventoryItemId)}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>R{parseFloat(item.unitPrice || "0").toFixed(2)}</TableCell>
                        <TableCell>R{parseFloat(item.totalPrice || "0").toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingPO} onOpenChange={() => setEditingPO(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Purchase Order</DialogTitle>
            <DialogDescription>
              Update purchase order information.
            </DialogDescription>
          </DialogHeader>
          {editingPO && (
            <PurchaseOrderForm
              purchaseOrder={editingPO}
              onSubmit={(data) => updateMutation.mutate({ id: editingPO.id, data })}
              onCancel={() => setEditingPO(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <AlertDialog open={!!approvingPO} onOpenChange={() => setApprovingPO(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve purchase order "{approvingPO?.poNumber}"? 
              This will allow it to be sent to the supplier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approvingPO && approveMutation.mutate(approvingPO.id)}
              className="bg-green-600 hover:bg-green-700"
            >
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectingPO} onOpenChange={() => setRejectingPO(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting purchase order "{rejectingPO?.poNumber}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              data-testid="textarea-rejection-reason"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setRejectingPO(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => rejectingPO && rejectMutation.mutate({ id: rejectingPO.id, reason: rejectionReason })}
                disabled={!rejectionReason.trim()}
              >
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send to Supplier Confirmation */}
      <AlertDialog open={!!sendingPO} onOpenChange={() => setSendingPO(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Purchase Order to Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send purchase order "{sendingPO?.poNumber}" to {sendingPO ? getSupplierName(sendingPO.supplierId) : ""}? 
              This will email the complete purchase order details to the supplier and mark it as sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sendingPO && sendMutation.mutate(sendingPO.id)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Send to Supplier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPO} onOpenChange={() => setDeletingPO(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the purchase order
              "{deletingPO?.poNumber}" and all associated items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPO && deleteMutation.mutate(deletingPO.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
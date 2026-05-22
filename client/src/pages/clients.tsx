import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardRole } from "@/lib/dashboardRole";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  MapPin,
  Phone,
  Mail,
  Building,
  User,
  CreditCard,
  Calendar,
  XCircle,
  CheckCircle,
  Circle,
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
import { useToast } from "@/hooks/use-toast";
import { ClientForm } from "@/components/forms/client-form";
import { ExportButton } from "@/components/export-button";
import { apiRequest } from "@/lib/queryClient";
import { exportClients } from "@/lib/data-export";
import { formatClientAddress, hasStructuredAddress, type Client, type Department } from "@shared/schema";

export default function ClientsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [rentalFilter, setRentalFilter] = useState<string>("all"); // all | with | without | active | inactive
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { user } = useAuth();
  const role = getDashboardRole(user ?? {});
  const isSales = role === "sales";
  const isAccounts = role === "accounts";

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsCreateDialogOpen(false);
      toast({ description: "Client created successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        description: `Failed to create client: ${error.message}`, 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/clients/${id}`, data);
      // Parse the saved record from the server so we can verify the write
      const saved: Client = await res.json();
      return saved;
    },
    // Only confirm after the cache has been refetched with the new data.
    onSuccess: async (saved: Client) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      await queryClient.refetchQueries({ queryKey: ["/api/clients"] });
      setEditingClient(null);
      // If the just-updated client is currently being viewed, refresh that view too
      setViewingClient((prev) => (prev && prev.id === saved.id ? saved : prev));
      toast({ description: "Customer updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        description: `Failed to update client: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setDeletingClient(null);
      toast({ description: "Client deleted successfully" });
    },
    onError: () => {
      toast({ 
        description: "Failed to delete client", 
        variant: "destructive" 
      });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/clients/${id}/status`, { status }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      const msg = status === "suspended" ? "Client suspended." : status === "inactive" ? "Client set to inactive." : "Client set to active.";
      toast({ description: msg });
    },
    onError: () => toast({ description: "Failed to update client status", variant: "destructive" }),
  });

  const filteredClients = clients.filter((client: Client) => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.businessType?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || client.status === statusFilter;
    const matchesDepartment = departmentFilter === "all" || client.departmentId === departmentFilter;

    const hasRental = !!(client as any).hasRentalContract;
    const rentalStatus = (client as any).rentalContractStatus as string | undefined;
    let matchesRental = true;
    switch (rentalFilter) {
      case "with": matchesRental = hasRental; break;
      case "without": matchesRental = !hasRental; break;
      case "active": matchesRental = hasRental && rentalStatus === "Active"; break;
      case "inactive": matchesRental = hasRental && rentalStatus === "Inactive"; break;
      default: matchesRental = true;
    }

    return matchesSearch && matchesStatus && matchesDepartment && matchesRental;
  });

  const statusStats = clients.reduce((acc: any, client: Client) => {
    acc[client.status] = (acc[client.status] || 0) + 1;
    return acc;
  }, {});

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDepartmentName = (departmentId: string) => {
    const department = departments.find(d => d.id === departmentId);
    return department?.name || "Unknown Department";
  };

  const handleExportCSV = () => {
    exportClients(clients);
  };

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="clients-page">
      <Sidebar />
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative bg-white w-64 shadow-lg">
            <Sidebar />
          </div>
        </div>
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Client Management" 
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        />
        
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">Clients</h1>
          <p className="text-muted-foreground">
            Manage client information and business relationships
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton 
            onExportCSV={handleExportCSV}
            entityName="Clients"
          />
          {!isAccounts && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-client">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Client</DialogTitle>
                  <DialogDescription>
                    Create a new client record with contact and business information.
                  </DialogDescription>
                </DialogHeader>
                <ClientForm
                  onSubmit={(data) => createMutation.mutate(data)}
                  onCancel={() => setIsCreateDialogOpen(false)}
                  isSubmitting={createMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-clients">{clients.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <User className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-active">{statusStats.active || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <User className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600" data-testid="stat-inactive">{statusStats.inactive || 0}</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-red-100 hover:border-red-300"
          onClick={() => setStatusFilter(statusFilter === "suspended" ? "all" : "suspended")}
          title="Click to filter suspended clients"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Suspended</CardTitle>
            <User className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-suspended">{statusStats.suspended || 0}</div>
            <p className="text-xs text-red-400 mt-1">
              {statusFilter === "suspended" ? "Showing suspended ↑ click to clear" : "Click to view"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              data-testid="input-search-clients"
            />
          </div>
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>

        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-department-filter">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.filter(d => ["div-1","div-2","div-3","div-4"].includes(d.id)).map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={rentalFilter} onValueChange={setRentalFilter}>
          <SelectTrigger className="w-[220px]" data-testid="select-rental-filter">
            <SelectValue placeholder="Rental Contract" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            <SelectItem value="with">With Rental Contracts</SelectItem>
            <SelectItem value="without">Without Rental Contracts</SelectItem>
            <SelectItem value="active">Active Rental Contracts</SelectItem>
            <SelectItem value="inactive">Inactive Rental Contracts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clients Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Suburb / Area</TableHead>
              <TableHead>City / Town</TableHead>
              <TableHead>Rental Contract</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Loading clients...
                </TableCell>
              </TableRow>
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  No clients found
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client: Client) => (
                <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{client.name}</div>
                      <div className="text-sm text-muted-foreground">{client.businessType}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      {client.contactPerson || "Not specified"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                      {client.phone || "Not provided"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                      {client.email || "Not provided"}
                    </div>
                  </TableCell>
                  <TableCell>{client.suburb || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{client.city || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {(client as any).hasRentalContract ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Rental</Badge>
                        {(client as any).rentalContractStatus === "Inactive" && (
                          <span className="text-xs text-muted-foreground">Inactive</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No Rental</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(client.status)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${client.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setViewingClient(client)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {!isSales && !isAccounts && (
                          <DropdownMenuItem onClick={() => setEditingClient(client)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {isSales && (
                          <DropdownMenuItem onClick={() => setEditingClient(client)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {!isSales && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1">
                              Change Status
                            </DropdownMenuLabel>
                            {client.status !== "active" && (
                              <DropdownMenuItem
                                onClick={() => suspendMutation.mutate({ id: client.id, status: "active" })}
                                className="text-green-600"
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Set Active
                              </DropdownMenuItem>
                            )}
                            {client.status !== "inactive" && (
                              <DropdownMenuItem
                                onClick={() => suspendMutation.mutate({ id: client.id, status: "inactive" })}
                                className="text-gray-600"
                              >
                                <Circle className="mr-2 h-4 w-4" />
                                Set Inactive
                              </DropdownMenuItem>
                            )}
                            {client.status !== "suspended" && (
                              <DropdownMenuItem
                                onClick={() => suspendMutation.mutate({ id: client.id, status: "suspended" })}
                                className="text-red-600"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Suspend Service
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                        {!isSales && !isAccounts && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => setDeletingClient(client)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
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
      <Dialog open={!!viewingClient} onOpenChange={() => setViewingClient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Client Details - {viewingClient?.name}</DialogTitle>
            <DialogDescription>
              Complete information for this client.
            </DialogDescription>
          </DialogHeader>
          {viewingClient && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Company Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Name:</strong> {viewingClient.name}</div>
                    <div><strong>Business Type:</strong> {viewingClient.businessType || "Not specified"}</div>
                    <div><strong>Status:</strong> {getStatusBadge(viewingClient.status)}</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Contact Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Contact Person:</strong> {viewingClient.contactPerson || "Not specified"}</div>
                    <div><strong>Email:</strong> {viewingClient.email || "Not provided"}</div>
                    <div><strong>Phone:</strong> {viewingClient.phone || "Not provided"}</div>
                  </div>
                </div>
              </div>

              {/* Address block */}
              <div>
                <h3 className="font-semibold mb-2">Address</h3>
                <div className="space-y-2 text-sm">
                  {hasStructuredAddress(viewingClient) ? (
                    <>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div><span className="text-muted-foreground">Street Number:</span> {viewingClient.streetNumber || "—"}</div>
                        <div><span className="text-muted-foreground">Street Name:</span> {viewingClient.streetName || "—"}</div>
                        <div><span className="text-muted-foreground">Suburb / Area:</span> {viewingClient.suburb || "—"}</div>
                        <div><span className="text-muted-foreground">City / Town:</span> {viewingClient.city || "—"}</div>
                        <div><span className="text-muted-foreground">Province:</span> {viewingClient.province || "—"}</div>
                        <div><span className="text-muted-foreground">Postal Code:</span> {viewingClient.postalCode || "—"}</div>
                      </div>
                      <div className="pt-2 border-t mt-2">
                        <span className="text-muted-foreground text-xs uppercase tracking-wide">Full Address</span>
                        <p className="whitespace-pre-line mt-1">{formatClientAddress(viewingClient)}</p>
                      </div>
                    </>
                  ) : viewingClient.address ? (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-800">
                      <div className="font-semibold text-xs uppercase tracking-wide mb-1">Old Address (legacy)</div>
                      <p className="whitespace-pre-line">{viewingClient.address}</p>
                      <p className="text-xs text-amber-600 mt-2 italic">Edit this customer to fill in the structured address fields.</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">No address on file</p>
                  )}
                  {viewingClient.googleMapsLink && (
                    <div>
                      <a
                        href={viewingClient.googleMapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 underline"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Financial Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Tax Number:</strong> {viewingClient.taxNumber || "Not provided"}</div>
                    <div><strong>Credit Limit:</strong> {viewingClient.creditLimit ? `R${viewingClient.creditLimit}` : "Not set"}</div>
                    <div><strong>Payment Terms:</strong> {viewingClient.paymentTerms || "Not specified"}</div>
                    <div><strong>Sage Customer Code:</strong> {(viewingClient as any).sageCustomerCode || <span className="text-gray-400 italic">Not set</span>}</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Account Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Created:</strong> {new Date(viewingClient.createdAt).toLocaleDateString()}</div>
                    <div><strong>Updated:</strong> {new Date(viewingClient.updatedAt).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>

              {/* Rental Contract section */}
              <div>
                <h3 className="font-semibold mb-2">Rental Contract</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Has Rental Contract:</strong>{" "}
                    {(viewingClient as any).hasRentalContract ? (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 ml-1">Yes</Badge>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </div>
                  {(viewingClient as any).hasRentalContract && (
                    <>
                      <div><strong>Status:</strong> {(viewingClient as any).rentalContractStatus || "Active"}</div>
                      <div><strong>Type:</strong> {(viewingClient as any).rentalContractType || <span className="text-muted-foreground">Not specified</span>}</div>
                      {(viewingClient as any).rentalNotes && (
                        <div><strong>Notes:</strong> <span className="text-muted-foreground">{(viewingClient as any).rentalNotes}</span></div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {viewingClient.notes && (
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground">{viewingClient.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client information and settings.
            </DialogDescription>
          </DialogHeader>
          {editingClient && (
            <ClientForm
              client={editingClient}
              onSubmit={(data) => updateMutation.mutate({ id: editingClient.id, data })}
              onCancel={() => setEditingClient(null)}
              isSubmitting={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingClient} onOpenChange={() => setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the client
              "{deletingClient?.name}" and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingClient && deleteMutation.mutate(deletingClient.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
          </div>
        </main>
        
        <MobileNavigation />
      </div>
    </div>
  );
}
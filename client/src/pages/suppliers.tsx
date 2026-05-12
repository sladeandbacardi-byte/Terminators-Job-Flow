import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
  CheckCircle,
  XCircle,
  DollarSign,
  Upload,
  Download,
  AlertCircle,
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { SupplierForm } from "@/components/forms/supplier-form";
import { ExportButton } from "@/components/export-button";
import { exportSuppliers } from "@/lib/data-export";
import { apiRequest } from "@/lib/queryClient";
import type { Supplier, Department } from "@shared/schema";

export default function SuppliersPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const headers = ["name", "contactPerson", "email", "phone", "address", "website", "category", "paymentTerms", "notes"];
    const example = ["Acme Supplies", "John Smith", "john@acme.com", "+27 41 123 4567", "123 Main St, Port Elizabeth", "www.acme.com", "pest_control", "30 days", "Preferred supplier"];
    const csv = [headers.join(","), example.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "supplier_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportResults(null);
    const text = await file.text();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setImportResults({ success: 0, failed: 1, errors: ["File is empty or has no data rows."] });
      setIsImporting(false);
      return;
    }
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1);
    let success = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const values = rows[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
      if (!row.name) { errors.push(`Row ${i + 2}: Missing supplier name`); continue; }
      try {
        await apiRequest("POST", "/api/suppliers", {
          name: row.name,
          contactPerson: row.contactPerson || null,
          email: row.email || null,
          phone: row.phone || null,
          address: row.address || null,
          website: row.website || null,
          category: row.category || "general",
          paymentTerms: row.paymentTerms || null,
          notes: row.notes || null,
          isActive: true,
        });
        success++;
      } catch {
        errors.push(`Row ${i + 2}: Failed to import "${row.name}"`);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
    setImportResults({ success, failed: errors.length, errors });
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/suppliers", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setIsCreateDialogOpen(false);
      toast({ description: "Supplier created successfully" });
    },
    onError: () => {
      toast({ 
        description: "Failed to create supplier", 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/suppliers/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setEditingSupplier(null);
      toast({ description: "Supplier updated successfully" });
    },
    onError: () => {
      toast({ 
        description: "Failed to update supplier", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/suppliers/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setDeletingSupplier(null);
      toast({ description: "Supplier deleted successfully" });
    },
    onError: () => {
      toast({ 
        description: "Failed to delete supplier", 
        variant: "destructive" 
      });
    },
  });

  const filteredSuppliers = suppliers.filter((supplier: Supplier) => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || supplier.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && supplier.isActive) ||
                         (statusFilter === "inactive" && !supplier.isActive);
    const matchesDepartment = departmentFilter === "all" || supplier.departmentId === departmentFilter;
    
    return matchesSearch && matchesCategory && matchesStatus && matchesDepartment;
  });

  const categoryStats = suppliers.reduce((acc: any, supplier: Supplier) => {
    if (!acc[supplier.category]) {
      acc[supplier.category] = { total: 0, active: 0 };
    }
    acc[supplier.category].total++;
    if (supplier.isActive) {
      acc[supplier.category].active++;
    }
    return acc;
  }, {});

  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter((s: Supplier) => s.isActive).length;

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "pest_control": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "sanitary": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "washroom": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "cleaning": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "equipment": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
      case "chemicals": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "consumables": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "maintenance": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getCategoryDisplayName = (category: string) => {
    switch (category) {
      case "hygiene": return "Hygiene Products";
      case "pest_control": return "Pest Control";
      case "equipment": return "Equipment";
      case "chemicals": return "Chemicals";
      case "consumables": return "Consumables";
      case "maintenance": return "Maintenance";
      default: return category;
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="suppliers-page">
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
          title="Supplier Management" 
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        />
        
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">Suppliers</h1>
          <p className="text-muted-foreground">
            Manage your supplier relationships and vendor information
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton 
            onExportCSV={() => exportSuppliers(suppliers)}
            entityName="Suppliers"
            variant="outline"
          />
          {/* Import CSV */}
          <Dialog open={isImportOpen} onOpenChange={(o) => { setIsImportOpen(o); if (!o) setImportResults(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Supplier List</DialogTitle>
                <DialogDescription>
                  Upload a CSV file to bulk-import suppliers. Download the template to see the required format.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV Template
                </Button>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-3">Select your CSV file to import</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSV}
                    className="hidden"
                    id="csv-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                  >
                    {isImporting ? "Importing..." : "Choose File"}
                  </Button>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-3 space-y-1">
                  <p className="font-medium">Required columns:</p>
                  <p><span className="font-medium">name</span> — supplier name (required)</p>
                  <p><span className="font-medium">category</span> — e.g. pest_control, hygiene, equipment, general</p>
                  <p className="font-medium mt-1">Optional: contactPerson, email, phone, address, website, paymentTerms, notes</p>
                </div>
                {importResults && (
                  <div className={`rounded-lg p-4 space-y-2 ${importResults.failed === 0 ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                    <div className="flex items-center gap-2 font-medium text-sm">
                      {importResults.failed === 0
                        ? <CheckCircle className="h-4 w-4 text-green-600" />
                        : <AlertCircle className="h-4 w-4 text-amber-600" />}
                      <span>{importResults.success} imported successfully{importResults.failed > 0 ? `, ${importResults.failed} failed` : ""}</span>
                    </div>
                    {importResults.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-supplier">
                <Plus className="mr-2 h-4 w-4" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Supplier</DialogTitle>
                <DialogDescription>
                  Add a new supplier to your vendor database.
                </DialogDescription>
              </DialogHeader>
              <SupplierForm
                onSubmit={(data) => createMutation.mutate(data)}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-suppliers">{totalSuppliers}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-active-suppliers">{activeSuppliers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-categories">{Object.keys(categoryStats).length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-inactive-suppliers">{totalSuppliers - activeSuppliers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              data-testid="input-search-suppliers"
            />
          </div>
        </div>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="hygiene">Hygiene Products</SelectItem>
            <SelectItem value="pest_control">Pest Control</SelectItem>
            <SelectItem value="equipment">Equipment</SelectItem>
            <SelectItem value="chemicals">Chemicals</SelectItem>
            <SelectItem value="consumables">Consumables</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
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
      </div>

      {/* Suppliers Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading suppliers...
                </TableCell>
              </TableRow>
            ) : filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No suppliers found
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((supplier: Supplier) => (
                <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{supplier.name}</div>
                      {supplier.contactPerson && (
                        <div className="text-sm text-muted-foreground">
                          {supplier.contactPerson}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getCategoryBadgeColor(supplier.category)}>
                      {getCategoryDisplayName(supplier.category)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {supplier.departmentId ? (
                      <Badge 
                        variant="outline"
                        className={
                          supplier.departmentId === "div-1" ? "border-green-500 text-green-700 bg-green-50" :
                          supplier.departmentId === "div-2" ? "border-purple-500 text-purple-700 bg-purple-50" :
                          supplier.departmentId === "div-3" ? "border-blue-500 text-blue-700 bg-blue-50" :
                          "border-gray-500 text-gray-700 bg-gray-50"
                        }
                      >
                        {departments.find(d => d.id === supplier.departmentId)?.name || "Unassigned"}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {supplier.email && (
                        <div className="flex items-center text-sm">
                          <Mail className="mr-1 h-3 w-3" />
                          {supplier.email}
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center text-sm">
                          <Phone className="mr-1 h-3 w-3" />
                          {supplier.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {supplier.paymentTerms && (
                      <div className="flex items-center text-sm">
                        <DollarSign className="mr-1 h-3 w-3" />
                        {supplier.paymentTerms}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={supplier.isActive ? "default" : "secondary"}
                      className={supplier.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                    >
                      {supplier.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${supplier.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setEditingSupplier(supplier)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {supplier.website && (
                          <DropdownMenuItem onClick={() => window.open(supplier.website!, '_blank')}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Visit Website
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setDeletingSupplier(supplier)}
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

      {/* Edit Dialog */}
      <Dialog open={!!editingSupplier} onOpenChange={() => setEditingSupplier(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>
              Update supplier information and settings.
            </DialogDescription>
          </DialogHeader>
          {editingSupplier && (
            <SupplierForm
              supplier={editingSupplier}
              onSubmit={(data) => updateMutation.mutate({ id: editingSupplier.id, data })}
              onCancel={() => setEditingSupplier(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingSupplier} onOpenChange={() => setDeletingSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the supplier
              "{deletingSupplier?.name}" and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSupplier && deleteMutation.mutate(deletingSupplier.id)}
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
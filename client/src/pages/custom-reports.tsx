import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Calendar, DollarSign, FileText, Plus, Play, Settings, TrendingDown, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DepartmentFilter } from "@/components/filters/department-filter";
import { useDepartmentFilter } from "@/hooks/useDepartmentFilter";
import type { CustomReport, Division } from "@shared/schema";

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  icon: any;
  color: string;
  fields: string[];
  defaultFilters: any;
}

const reportTemplates: ReportTemplate[] = [
  {
    id: "sales_summary",
    name: "Sales Summary Report",
    description: "Total sales revenue, number of invoices, and revenue by department",
    type: "sales",
    icon: TrendingUp,
    color: "bg-green-500",
    fields: ["total_revenue", "invoice_count", "revenue_by_department", "top_clients"],
    defaultFilters: {
      dateRange: "last_30_days",
      departments: [],
      includeInvoiceStatus: ["paid", "sent"]
    }
  },
  {
    id: "expense_breakdown",
    name: "Expense Breakdown Report", 
    description: "Total expenses, cost categories, and spending by department",
    type: "expenses",
    icon: TrendingDown,
    color: "bg-red-500",
    fields: ["total_expenses", "expense_categories", "expenses_by_department", "top_suppliers"],
    defaultFilters: {
      dateRange: "last_30_days",
      departments: [],
      includeExpenseTypes: ["inventory", "equipment", "supplies"]
    }
  },
  {
    id: "financial_overview",
    name: "Financial Overview Report",
    description: "Combined sales and expenses with profit analysis by department",
    type: "financial",
    icon: DollarSign,
    color: "bg-blue-500",
    fields: ["total_revenue", "total_expenses", "profit_margin", "department_profitability", "monthly_trends"],
    defaultFilters: {
      dateRange: "last_90_days",
      departments: [],
      compareWithPrevious: true
    }
  }
];

export default function CustomReports() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [dateRange, setDateRange] = useState("last_30_days");
  const [isRunningReport, setIsRunningReport] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const departmentFilter = useDepartmentFilter();

  const { data: reports = [], isLoading } = useQuery<CustomReport[]>({
    queryKey: ["/api/custom-reports"],
  });

  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ["/api/divisions"],
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/custom-reports", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-reports"] });
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: "Success",
        description: "Custom report created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create custom report",
        variant: "destructive",
      });
    },
  });

  const runReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return apiRequest(`/api/custom-reports/${reportId}/run`, "POST");
    },
    onSuccess: (data: any, reportId) => {
      setIsRunningReport(null);
      queryClient.invalidateQueries({ queryKey: ["/api/custom-reports"] });
      // Open or download the report results
      if (data?.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
      toast({
        title: "Success",
        description: "Report generated successfully",
      });
    },
    onError: (error) => {
      setIsRunningReport(null);
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setReportName("");
    setReportDescription("");
    setSelectedTemplate(null);
    setDateRange("last_30_days");
  };

  const handleCreateFromTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setReportName(`${template.name} - ${new Date().toLocaleDateString()}`);
    setReportDescription(template.description);
    setShowCreateDialog(true);
  };

  const handleCreateReport = () => {
    if (!selectedTemplate || !reportName) return;

    const reportData = {
      name: reportName,
      description: reportDescription,
      reportType: selectedTemplate.type,
      template: selectedTemplate.id,
      configuration: JSON.stringify({
        fields: selectedTemplate.fields,
        template: selectedTemplate.id
      }),
      filters: JSON.stringify({
        dateRange,
        departments: departmentFilter.selectedDepartments,
        ...selectedTemplate.defaultFilters
      }),
      createdBy: "admin", // Replace with actual user ID
      isTemplate: false
    };

    createReportMutation.mutate(reportData);
  };

  const handleRunReport = (reportId: string) => {
    setIsRunningReport(reportId);
    runReportMutation.mutate(reportId);
  };

  const getDepartmentNames = (departmentIds: string[]) => {
    if (!departmentIds || departmentIds.length === 0) return "All Departments";
    return departmentIds
      .map(id => divisions.find(d => d.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case "sales": return "bg-green-100 text-green-800";
      case "expenses": return "bg-red-100 text-red-800";
      case "financial": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900" data-testid="page-title">Custom Reports</h1>
              <p className="mt-2 text-gray-600">Create and run custom reports with department filtering</p>
            </div>

            {/* Report Templates Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Report Templates
                </CardTitle>
                <CardDescription>
                  Quick start with pre-built report templates for common business needs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reportTemplates.map((template) => {
                    const IconComponent = template.icon;
                    return (
                      <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`${template.color} p-2 rounded-lg`}>
                              <IconComponent className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm mb-1">{template.name}</h3>
                              <p className="text-xs text-gray-600 mb-3">{template.description}</p>
                              <Button 
                                size="sm" 
                                onClick={() => handleCreateFromTemplate(template)}
                                data-testid={`button-create-${template.id}`}
                              >
                                Create Report
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Existing Reports Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Custom Reports</CardTitle>
                    <CardDescription>Manage and run your saved custom reports</CardDescription>
                  </div>
                  <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-create-custom">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Custom
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create Custom Report</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="report-name">Report Name</Label>
                          <Input
                            id="report-name"
                            value={reportName}
                            onChange={(e) => setReportName(e.target.value)}
                            placeholder="Enter report name"
                            data-testid="input-report-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="report-description">Description</Label>
                          <Textarea
                            id="report-description"
                            value={reportDescription}
                            onChange={(e) => setReportDescription(e.target.value)}
                            placeholder="Enter report description"
                            data-testid="input-report-description"
                          />
                        </div>
                        <div>
                          <Label>Date Range</Label>
                          <Select value={dateRange} onValueChange={setDateRange}>
                            <SelectTrigger data-testid="select-date-range">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                              <SelectItem value="last_year">Last Year</SelectItem>
                              <SelectItem value="custom">Custom Range</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Departments</Label>
                          <DepartmentFilter
                            selectedDepartments={departmentFilter.selectedDepartments}
                            onSelectionChange={departmentFilter.setSelectedDepartments}
                          />
                        </div>
                        <div className="flex gap-2 pt-4">
                          <Button 
                            onClick={handleCreateReport}
                            disabled={!selectedTemplate || !reportName || createReportMutation.isPending}
                            data-testid="button-save-report"
                          >
                            {createReportMutation.isPending ? "Creating..." : "Create Report"}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setShowCreateDialog(false)}
                            data-testid="button-cancel-report"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading reports...</div>
                ) : reports.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No custom reports yet. Create your first report using the templates above.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reports.map((report) => {
                      const filters = report.filters ? JSON.parse(report.filters) : {};
                      const config = report.configuration ? JSON.parse(report.configuration) : {};
                      
                      return (
                        <Card key={report.id} className="border-l-4 border-l-blue-500">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold">{report.name}</h3>
                                  <Badge variant="secondary" className={getReportTypeColor(report.reportType)}>
                                    {report.reportType}
                                  </Badge>
                                  {report.template && (
                                    <Badge variant="outline">
                                      {report.template.replace("_", " ")}
                                    </Badge>
                                  )}
                                </div>
                                {report.description && (
                                  <p className="text-sm text-gray-600 mb-2">{report.description}</p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span>📅 {filters.dateRange || "No date filter"}</span>
                                  <span>🏢 {getDepartmentNames(filters.departments)}</span>
                                  {report.lastRun && (
                                    <span>🕒 Last run: {new Date(report.lastRun).toLocaleDateString()}</span>
                                  )}
                                  <span>▶️ Runs: {report.runCount || 0}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleRunReport(report.id)}
                                  disabled={isRunningReport === report.id}
                                  data-testid={`button-run-${report.id}`}
                                >
                                  {isRunningReport === report.id ? (
                                    <>Loading...</>
                                  ) : (
                                    <>
                                      <Play className="h-4 w-4 mr-1" />
                                      Run Report
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  data-testid={`button-settings-${report.id}`}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      <MobileNavigation />
    </div>
  );
}
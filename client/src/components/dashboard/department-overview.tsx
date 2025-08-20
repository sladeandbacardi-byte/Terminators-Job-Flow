import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DepartmentFilter } from "@/components/filters/department-filter";
import { useDepartmentFilter } from "@/hooks/useDepartmentFilter";
import { useQuery } from "@tanstack/react-query";
import { Users, Briefcase, Package, TrendingUp } from "lucide-react";
import type { Worker, Job, InventoryItem, Client, Division } from "@shared/schema";

interface DepartmentOverviewProps {
  className?: string;
}

interface DepartmentStats {
  id: string;
  name: string;
  colorCode: string;
  totalWorkers: number;
  activeJobs: number;
  totalClients: number;
  inventoryItems: number;
  monthlyRevenue: number;
}

export function DepartmentOverview({ className = "" }: DepartmentOverviewProps) {
  const departmentFilter = useDepartmentFilter();

  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ["/api/divisions"],
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  // Calculate department statistics
  const getDepartmentStats = (): DepartmentStats[] => {
    if (departmentFilter.isAllSelected) {
      // Show all departments
      return divisions.map(division => ({
        id: division.id,
        name: division.name,
        colorCode: division.colorCode,
        totalWorkers: workers.filter(w => w.divisionId === division.id).length,
        activeJobs: jobs.filter(j => j.divisionId === division.id && j.status !== 'completed').length,
        totalClients: clients.filter(c => c.divisionId === division.id).length,
        inventoryItems: inventory.filter(i => i.divisionId === division.id).length,
        monthlyRevenue: 0, // This would come from actual revenue calculations
      }));
    } else {
      // Show only selected departments
      return divisions
        .filter(division => departmentFilter.selectedDepartments.includes(division.id))
        .map(division => ({
          id: division.id,
          name: division.name,
          colorCode: division.colorCode,
          totalWorkers: workers.filter(w => w.divisionId === division.id).length,
          activeJobs: jobs.filter(j => j.divisionId === division.id && j.status !== 'completed').length,
          totalClients: clients.filter(c => c.divisionId === division.id).length,
          inventoryItems: inventory.filter(i => i.divisionId === division.id).length,
          monthlyRevenue: 0,
        }));
    }
  };

  const departmentStats = getDepartmentStats();

  return (
    <Card className={className} data-testid="department-overview">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Department Overview</CardTitle>
          <div className="w-64">
            <DepartmentFilter
              selectedDepartments={departmentFilter.selectedDepartments}
              onSelectionChange={departmentFilter.setSelectedDepartments}
              showAllOption={true}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {departmentStats.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No departments selected</p>
          </div>
        ) : (
          <div className="space-y-4">
            {departmentStats.map((dept) => (
              <div 
                key={dept.id} 
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                data-testid={`department-card-${dept.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: dept.colorCode }}
                    />
                    <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                  </div>
                  <Badge variant="outline" style={{ borderColor: dept.colorCode }}>
                    {departmentFilter.isAllSelected ? 'All Departments' : 'Selected'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center" data-testid={`dept-workers-${dept.id}`}>
                    <div className="flex items-center justify-center mb-1">
                      <Users className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-2xl font-bold text-gray-900">{dept.totalWorkers}</span>
                    </div>
                    <p className="text-xs text-gray-600">Workers</p>
                  </div>
                  
                  <div className="text-center" data-testid={`dept-jobs-${dept.id}`}>
                    <div className="flex items-center justify-center mb-1">
                      <Briefcase className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-2xl font-bold text-gray-900">{dept.activeJobs}</span>
                    </div>
                    <p className="text-xs text-gray-600">Active Jobs</p>
                  </div>
                  
                  <div className="text-center" data-testid={`dept-clients-${dept.id}`}>
                    <div className="flex items-center justify-center mb-1">
                      <TrendingUp className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-2xl font-bold text-gray-900">{dept.totalClients}</span>
                    </div>
                    <p className="text-xs text-gray-600">Clients</p>
                  </div>
                  
                  <div className="text-center" data-testid={`dept-inventory-${dept.id}`}>
                    <div className="flex items-center justify-center mb-1">
                      <Package className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-2xl font-bold text-gray-900">{dept.inventoryItems}</span>
                    </div>
                    <p className="text-xs text-gray-600">Items</p>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Summary totals */}
            {departmentStats.length > 1 && (
              <div className="border-t pt-4 mt-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    {departmentFilter.isAllSelected ? 'Total Across All Departments' : 'Total for Selected Departments'}
                  </h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center">
                      <span className="text-xl font-bold text-gray-900">
                        {departmentStats.reduce((sum, dept) => sum + dept.totalWorkers, 0)}
                      </span>
                      <p className="text-xs text-gray-600">Total Workers</p>
                    </div>
                    <div className="text-center">
                      <span className="text-xl font-bold text-gray-900">
                        {departmentStats.reduce((sum, dept) => sum + dept.activeJobs, 0)}
                      </span>
                      <p className="text-xs text-gray-600">Total Jobs</p>
                    </div>
                    <div className="text-center">
                      <span className="text-xl font-bold text-gray-900">
                        {departmentStats.reduce((sum, dept) => sum + dept.totalClients, 0)}
                      </span>
                      <p className="text-xs text-gray-600">Total Clients</p>
                    </div>
                    <div className="text-center">
                      <span className="text-xl font-bold text-gray-900">
                        {departmentStats.reduce((sum, dept) => sum + dept.inventoryItems, 0)}
                      </span>
                      <p className="text-xs text-gray-600">Total Items</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
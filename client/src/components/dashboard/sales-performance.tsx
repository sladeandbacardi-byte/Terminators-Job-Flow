import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TrendingUp, DollarSign, Users, Target, Award, Calendar } from "lucide-react";
import type { Worker, Invoice, Client, RentalContract, Job } from "@shared/schema";

interface SalesPerformanceProps {
  className?: string;
}

interface SalesStats {
  totalRevenue: number;
  newClients: number;
  activeContracts: number;
  averageDealSize: number;
  conversionRate: number;
  monthlyGrowth: number;
}

interface SalesRepPerformance {
  worker: Worker;
  revenue: number;
  clientsAcquired: number;
  contractsSigned: number;
  jobsCompleted: number;
  averageDealSize: number;
  ranking: number;
}

export default function SalesPerformance({ className }: SalesPerformanceProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedRep, setSelectedRep] = useState<string>("all");

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: contracts = [] } = useQuery<RentalContract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  // Calculate date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    const start = new Date();
    
    switch (selectedPeriod) {
      case "week":
        start.setDate(now.getDate() - 7);
        break;
      case "month":
        start.setMonth(now.getMonth() - 1);
        break;
      case "quarter":
        start.setMonth(now.getMonth() - 3);
        break;
      case "year":
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setMonth(now.getMonth() - 1);
    }
    
    return { start, end: now };
  };

  const { start, end } = getDateRange();

  // Calculate overall sales statistics
  const calculateSalesStats = (): SalesStats => {
    const periodInvoices = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.issueDate);
      return invoiceDate >= start && invoiceDate <= end;
    });

    const periodClients = clients.filter(client => {
      const clientDate = new Date(client.createdAt || client.updatedAt || new Date());
      return clientDate >= start && clientDate <= end;
    });

    const periodContracts = contracts.filter(contract => {
      const contractDate = new Date(contract.startDate);
      return contractDate >= start && contractDate <= end;
    });

    const totalRevenue = periodInvoices
      .filter(invoice => invoice.status === "paid")
      .reduce((sum, invoice) => sum + Number(invoice.total), 0);

    const previousPeriodStart = new Date(start);
    const previousPeriodEnd = new Date(start);
    const periodLength = end.getTime() - start.getTime();
    previousPeriodStart.setTime(start.getTime() - periodLength);

    const previousPeriodInvoices = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.issueDate);
      return invoiceDate >= previousPeriodStart && invoiceDate <= previousPeriodEnd;
    });

    const previousRevenue = previousPeriodInvoices
      .filter(invoice => invoice.status === "paid")
      .reduce((sum, invoice) => sum + Number(invoice.total), 0);

    const monthlyGrowth = previousRevenue > 0 
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;

    const averageDealSize = periodInvoices.length > 0 
      ? totalRevenue / periodInvoices.length 
      : 0;

    // Simple conversion rate calculation (contracts vs clients)
    const conversionRate = periodClients.length > 0 
      ? (periodContracts.length / periodClients.length) * 100 
      : 0;

    return {
      totalRevenue,
      newClients: periodClients.length,
      activeContracts: periodContracts.length,
      averageDealSize,
      conversionRate,
      monthlyGrowth,
    };
  };

  // Calculate individual sales rep performance
  const calculateRepPerformance = (): SalesRepPerformance[] => {
    // Filter to sales-related workers (managers, sales reps, etc.)
    const salesWorkers = workers.filter(worker => 
      worker.role?.toLowerCase().includes('sales') ||
      worker.role?.toLowerCase().includes('manager') ||
      worker.role?.toLowerCase().includes('admin')
    );

    const repPerformance = salesWorkers.map(worker => {
      // Get jobs assigned to this worker in the period
      const workerJobs = jobs.filter(job => {
        const jobDate = new Date(job.scheduledDate);
        return job.workerId === worker.id && jobDate >= start && jobDate <= end;
      });

      // Get clients in their division
      const divisionClients = clients.filter(client => 
        client.divisionId === worker.divisionId &&
        new Date(client.createdAt || client.updatedAt || new Date()) >= start &&
        new Date(client.createdAt || client.updatedAt || new Date()) <= end
      );

      // Get contracts for their division
      const divisionContracts = contracts.filter(contract => {
        const client = clients.find(c => c.id === contract.clientId);
        return client?.divisionId === worker.divisionId &&
               new Date(contract.startDate) >= start &&
               new Date(contract.startDate) <= end;
      });

      // Calculate revenue from invoices related to their clients
      const revenue = invoices
        .filter(invoice => {
          const client = clients.find(c => c.id === invoice.clientId);
          return client?.divisionId === worker.divisionId &&
                 new Date(invoice.issueDate) >= start &&
                 new Date(invoice.issueDate) <= end &&
                 invoice.status === "paid";
        })
        .reduce((sum, invoice) => sum + Number(invoice.total), 0);

      const averageDealSize = divisionContracts.length > 0 
        ? revenue / divisionContracts.length 
        : 0;

      return {
        worker,
        revenue,
        clientsAcquired: divisionClients.length,
        contractsSigned: divisionContracts.length,
        jobsCompleted: workerJobs.filter(job => job.status === "completed").length,
        averageDealSize,
        ranking: 0, // Will be calculated after sorting
      };
    });

    // Sort by revenue and assign rankings
    const sortedPerformance = repPerformance
      .sort((a, b) => b.revenue - a.revenue)
      .map((rep, index) => ({ ...rep, ranking: index + 1 }));

    return sortedPerformance;
  };

  const salesStats = calculateSalesStats();
  const repPerformance = calculateRepPerformance();
  
  const filteredRepPerformance = selectedRep === "all" 
    ? repPerformance 
    : repPerformance.filter(rep => rep.worker.id === selectedRep);

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Sales Performance Dashboard
            </CardTitle>
            <div className="flex gap-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Last Week</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                  <SelectItem value="quarter">Last Quarter</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedRep} onValueChange={setSelectedRep}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Reps" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales Reps</SelectItem>
                  {repPerformance.map(rep => (
                    <SelectItem key={rep.worker.id} value={rep.worker.id}>
                      {rep.worker.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Sales Metrics */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Overall Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-900">{formatCurrency(salesStats.totalRevenue)}</p>
                    <div className="flex items-center mt-1">
                      {salesStats.monthlyGrowth >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                      ) : (
                        <TrendingUp className="h-3 w-3 text-red-600 mr-1 rotate-180" />
                      )}
                      <span className={`text-xs ${salesStats.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(salesStats.monthlyGrowth).toFixed(1)}% vs previous period
                      </span>
                    </div>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">New Clients</p>
                    <p className="text-2xl font-bold text-blue-900">{salesStats.newClients}</p>
                    <p className="text-xs text-blue-600 mt-1">
                      {formatCurrency(salesStats.averageDealSize)} avg deal size
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Conversion Rate</p>
                    <p className="text-2xl font-bold text-purple-900">{salesStats.conversionRate.toFixed(1)}%</p>
                    <p className="text-xs text-purple-600 mt-1">
                      {salesStats.activeContracts} new contracts
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Sales Rep Performance */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Sales Rep Performance</h3>
            <div className="space-y-3">
              {filteredRepPerformance.map(rep => (
                <div key={rep.worker.id} className="p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
                        {rep.ranking <= 3 ? (
                          <Award className={`h-5 w-5 ${
                            rep.ranking === 1 ? 'text-yellow-500' :
                            rep.ranking === 2 ? 'text-gray-400' :
                            'text-amber-600'
                          }`} />
                        ) : (
                          <span className="text-sm font-medium text-gray-600">#{rep.ranking}</span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{rep.worker.name}</h4>
                        <p className="text-sm text-gray-600">{rep.worker.role}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: 
                              rep.worker.divisionId === 'div-1' ? '#22c55e' :
                              rep.worker.divisionId === 'div-2' ? '#8b5cf6' :
                              rep.worker.divisionId === 'div-3' ? '#3b82f6' :
                              rep.worker.divisionId === 'div-4' ? '#f59e0b' : '#6b7280'
                            }}
                          />
                          <span className="text-xs text-gray-500">
                            {rep.worker.divisionId === 'div-1' ? 'Pest Control' :
                             rep.worker.divisionId === 'div-2' ? 'Sanitary Bins' :
                             rep.worker.divisionId === 'div-3' ? 'Washroom' :
                             rep.worker.divisionId === 'div-4' ? 'Deep Cleaning' : 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">{formatCurrency(rep.revenue)}</div>
                      <div className="flex gap-4 text-xs text-gray-600 mt-1">
                        <span>{rep.clientsAcquired} clients</span>
                        <span>{rep.contractsSigned} contracts</span>
                        <span>{rep.jobsCompleted} jobs</span>
                      </div>
                      <Badge variant="secondary" className="mt-1">
                        {formatCurrency(rep.averageDealSize)} avg
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
              {filteredRepPerformance.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sales data available for the selected period</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { Link } from "wouter";
import { CalendarDays, ExternalLink, Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Department } from "@shared/schema";

type ContractOccurrence = {
  id: string;
  contractId: string;
  clientId: string;
  customerName: string;
  departmentId: string;
  serviceType: string;
  assignedTechnicianName: string | null;
  assignedTeamName: string | null;
  scheduledDate: string;
  estimatedDuration: number | null;
  startTime: string | null;
  status?: string | null;
};

type ServiceContractSummary = {
  id: string;
  contractNumber?: string | null;
  routeOrder?: number | null;
  invoiceRule?: string | null;
};

const dateInputValue = (date: Date) => format(date, "yyyy-MM-dd");

function statusClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-50 text-green-700 border-green-200";
    case "in_progress":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "cancelled":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

export default function ContractJobs() {
  const [dateFrom, setDateFrom] = useState(() => dateInputValue(new Date()));
  const [dateTo, setDateTo] = useState(() => dateInputValue(addDays(new Date(), 60)));
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: occurrences = [], isLoading, isError } = useQuery<ContractOccurrence[]>({
    queryKey: ["/api/service-contracts/occurrences", dateFrom, dateTo],
    queryFn: async () => {
      const response = await fetch(
        `/api/service-contracts/occurrences?start=${encodeURIComponent(dateFrom)}&end=${encodeURIComponent(dateTo)}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Could not load contract jobs");
      return response.json();
    },
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: contracts = [] } = useQuery<ServiceContractSummary[]>({
    queryKey: ["/api/service-contracts"],
  });

  const departmentMap = useMemo(
    () => new Map(departments.map(department => [department.id, department.name])),
    [departments],
  );
  const contractMap = useMemo(
    () => new Map(contracts.map(contract => [contract.id, contract])),
    [contracts],
  );

  const filteredOccurrences = useMemo(() => {
    const term = search.trim().toLowerCase();
    return occurrences.filter(occurrence => {
      if (departmentFilter !== "all" && occurrence.departmentId !== departmentFilter) return false;
      if (statusFilter !== "all" && (occurrence.status ?? "scheduled") !== statusFilter) return false;
      if (!term) return true;
      const contract = contractMap.get(occurrence.contractId);
      return [
        occurrence.customerName,
        occurrence.serviceType,
        occurrence.assignedTechnicianName,
        occurrence.assignedTeamName,
        contract?.contractNumber,
      ].some(value => value?.toLowerCase().includes(term));
    });
  }, [occurrences, search, departmentFilter, statusFilter, contractMap]);

  const availableDepartments = useMemo(() => {
    const ids = new Set(occurrences.map(occurrence => occurrence.departmentId));
    return departments.filter(department => ids.has(department.id));
  }, [departments, occurrences]);

  return (
    <div className="p-6 pb-20 lg:pb-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Contract Jobs</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upcoming occurrences generated from active service contracts.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="contract-jobs-from">From</label>
            <Input id="contract-jobs-from" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="contract-jobs-to">To</label>
            <Input id="contract-jobs-to" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger aria-label="Filter contract jobs by department"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {availableDepartments.map(department => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filter contract jobs by status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Client, contract or service" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">Generated contract jobs</h2>
            <p className="mt-0.5 text-sm text-gray-600">{filteredOccurrences.length} occurrence{filteredOccurrences.length === 1 ? "" : "s"} in the selected period</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/calendar"><CalendarDays className="mr-2 h-4 w-4" />Open Calendar</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-gray-500">Loading contract jobs…</div>
        ) : isError ? (
          <div className="p-10 text-center text-sm text-red-600">Contract jobs could not be loaded. Adjust the date range and try again.</div>
        ) : filteredOccurrences.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarDays className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <h3 className="font-medium text-gray-900">No contract jobs found</h3>
            <p className="mt-1 text-sm text-gray-600">There are no active contract occurrences matching these filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Client / contract</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Route / assignment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Invoice status</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOccurrences.map(occurrence => {
                  const contract = contractMap.get(occurrence.contractId);
                  const scheduled = new Date(occurrence.scheduledDate);
                  const occurrenceStatus = occurrence.status ?? "scheduled";
                  return (
                    <tr key={occurrence.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/clients/${occurrence.clientId}`} className="font-medium text-blue-700 hover:underline">
                          {occurrence.customerName}
                        </Link>
                        <div className="mt-0.5 font-mono text-xs text-teal-700">{contract?.contractNumber ?? "Service contract"}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{occurrence.serviceType || "Service"}</td>
                      <td className="px-4 py-3 text-gray-700">{departmentMap.get(occurrence.departmentId) ?? "Unassigned"}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>{Number.isNaN(scheduled.getTime()) ? "Unscheduled" : format(scheduled, "d MMM yyyy")}</div>
                        <div className="text-xs text-gray-500">{occurrence.startTime ?? "Time not set"}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>{contract?.routeOrder ? `Route ${contract.routeOrder}` : "No route sequence"}</div>
                        <div className="text-xs text-gray-500">{occurrence.assignedTechnicianName ?? occurrence.assignedTeamName ?? "Unassigned"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusClass(occurrenceStatus)}>
                          {occurrenceStatus.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600" title="Generated occurrences do not have an invoice until a completed job is invoiced.">
                          Not invoiced
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href="/calendar"><CalendarDays className="mr-1 h-3.5 w-3.5" />Job</Link>
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href="/service-contracts"><ExternalLink className="mr-1 h-3.5 w-3.5" />Contract</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
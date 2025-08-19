import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNavigation from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Plus, Phone, Mail } from "lucide-react";
import { getInitials, getDivisionColor } from "@/lib/utils";
import WorkerForm from "@/components/forms/worker-form";
import { ExportButton } from "@/components/export-button";
import { exportWorkers } from "@/lib/data-export";
import type { Worker, Division } from "@shared/schema";

export default function Workers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const { data: workers = [], isLoading } = useQuery<Worker[]>({
    queryKey: ['/api/workers'],
  });

  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ['/api/divisions'],
  });

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = searchTerm === "" || 
      worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDivision = divisionFilter === "all" || worker.divisionId === divisionFilter;
    
    return matchesSearch && matchesDivision;
  });

  const getDivisionName = (divisionId: string) => {
    const division = divisions.find(d => d.id === divisionId);
    return division?.name || 'Unknown Division';
  };

  const getDivisionBadgeColor = (divisionId: string) => {
    const division = divisions.find(d => d.id === divisionId);
    if (!division) return 'bg-gray-100 text-gray-800';
    
    if (division.name.toLowerCase().includes('pest')) {
      return 'bg-pest-control-100 text-pest-control-800';
    }
    if (division.name.toLowerCase().includes('hygiene')) {
      return 'bg-hygiene-100 text-hygiene-800';
    }
    return 'bg-primary-100 text-primary-800';
  };

  const handleAddWorker = () => {
    setSelectedWorker(null);
    setShowWorkerForm(true);
  };

  const handleEditWorker = (worker: Worker) => {
    setSelectedWorker(worker);
    setShowWorkerForm(true);
  };

  const handleFormSuccess = () => {
    setShowWorkerForm(false);
    setSelectedWorker(null);
  };

  const handleFormCancel = () => {
    setShowWorkerForm(false);
    setSelectedWorker(null);
  };

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="workers-page">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Field Workers" />
        
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search workers by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-workers"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                data-testid="filter-division"
              >
                <option value="all">All Divisions</option>
                {divisions.map(division => (
                  <option key={division.id} value={division.id}>{division.name}</option>
                ))}
              </select>
              <ExportButton 
                onExportCSV={() => exportWorkers(workers)}
                entityName="Workers"
                variant="outline"
                size="sm"
              />
              <Button onClick={handleAddWorker} data-testid="button-add-worker">
                <Plus className="h-4 w-4 mr-2" />
                Add Worker
              </Button>
            </div>
          </div>

          {/* Workers Grid */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Field Workers</h3>
              <p className="text-sm text-gray-600 mt-1">
                {filteredWorkers.length} worker{filteredWorkers.length !== 1 ? 's' : ''} found
              </p>
            </div>
            
            {isLoading ? (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-6 animate-pulse">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-24"></div>
                          <div className="h-3 bg-gray-200 rounded w-20"></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-32"></div>
                        <div className="h-3 bg-gray-200 rounded w-28"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : filteredWorkers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No workers found</h3>
                <p className="text-gray-600">
                  {searchTerm || divisionFilter !== "all" 
                    ? "Try adjusting your search or filter criteria."
                    : "Get started by adding your first field worker."
                  }
                </p>
                {(!searchTerm && divisionFilter === "all") && (
                  <Button onClick={handleAddWorker} className="mt-4" data-testid="button-add-first-worker">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Worker
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredWorkers.map((worker) => (
                    <div key={worker.id} className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors" data-testid={`worker-card-${worker.id}`}>
                      <div className="flex items-center space-x-4 mb-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary-100 text-primary-700 font-semibold">
                            {getInitials(worker.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate" data-testid={`worker-name-${worker.id}`}>
                            {worker.name}
                          </h4>
                          <Badge 
                            className={getDivisionBadgeColor(worker.divisionId)}
                            data-testid={`worker-division-${worker.id}`}
                          >
                            {getDivisionName(worker.divisionId)}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4" />
                          <span className="truncate" data-testid={`worker-email-${worker.id}`}>{worker.email}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4" />
                          <span data-testid={`worker-phone-${worker.id}`}>{worker.phone}</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            worker.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`} data-testid={`worker-status-${worker.id}`}>
                            {worker.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditWorker(worker)}
                            data-testid={`button-edit-worker-${worker.id}`}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      
      <MobileNavigation />

      {/* Worker Form Dialog */}
      <Dialog open={showWorkerForm} onOpenChange={setShowWorkerForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedWorker ? "Edit Worker" : "Add New Worker"}
            </DialogTitle>
            <DialogDescription>
              {selectedWorker 
                ? "Update the worker's information below." 
                : "Enter the details for the new field worker."}
            </DialogDescription>
          </DialogHeader>
          <WorkerForm
            worker={selectedWorker}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

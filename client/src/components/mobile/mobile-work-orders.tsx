import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  User, 
  CheckCircle, 
  AlertCircle,
  Navigation,
  LogOut,
  RefreshCw,
  Menu,
  X
} from "lucide-react";
import type { Job, Client, Worker } from '@shared/schema';

interface MobileWorkOrdersProps {
  worker: Worker;
  onLogout: () => void;
}

export function MobileWorkOrders({ worker, onLogout }: MobileWorkOrdersProps) {
  const [jobs, setJobs] = useState<(Job & { client: Client })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const fetchWorkOrders = async () => {
    try {
      const token = localStorage.getItem('mobile_session_token');
      const response = await fetch(`/api/mobile/work-orders/${worker.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch work orders');
      }

      const data = await response.json();
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, [worker.id]);

  const updateJobStatus = async (jobId: string, status: string) => {
    try {
      const token = localStorage.getItem('mobile_session_token');
      const response = await fetch(`/api/mobile/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update job status: ${errorText}`);
      }

      // Refresh the list
      await fetchWorkOrders();
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error('Job status update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update job status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':   return 'bg-orange-100 text-orange-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed':   return 'bg-green-100 text-green-800';
      case 'cancelled':   return 'bg-red-100 text-red-800';
      case 'pending':     return 'bg-yellow-100 text-yellow-800';
      default:            return 'bg-gray-100 text-gray-700';
    }
  };

  const openMaps = (address: string) => {
    try {
      const encodedAddress = encodeURIComponent(address);
      // Try Google Maps first, fallback to default maps
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      window.open(googleMapsUrl, '_blank');
    } catch (err) {
      console.error('Error opening maps:', err);
      setError('Unable to open maps application');
    }
  };

  const callClient = (phone: string) => {
    try {
      window.open(`tel:${phone}`, '_self');
    } catch (err) {
      console.error('Error making call:', err);
      setError('Unable to make phone call');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading work orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-600 text-white p-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMenu(true)}
              className="text-white hover:bg-green-700 p-2"
              data-testid="button-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">My Work Orders</h1>
              <p className="text-green-100 text-sm">{worker.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchWorkOrders}
              className="text-white hover:bg-green-700"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Side Menu Overlay */}
      {showMenu && (
        <div className="fixed inset-0 z-30">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu Content */}
          <div className="absolute left-0 top-0 h-full w-80 bg-white shadow-xl">
            {/* Menu Header */}
            <div className="bg-green-600 text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Menu</h2>
                  <p className="text-green-100 text-sm">{worker.name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMenu(false)}
                  className="text-white hover:bg-green-700"
                  data-testid="button-close-menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-4 space-y-4">
              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-900 mb-2">Worker Information</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>ID:</strong> {worker.employeeId}</p>
                  <p><strong>Role:</strong> {worker.role}</p>
                  <p><strong>Email:</strong> {worker.email}</p>
                  <p><strong>Phone:</strong> {worker.phone}</p>
                </div>
              </div>

              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-900 mb-2">Quick Stats</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>Today's Jobs:</strong> {jobs.length}</p>
                  <p><strong>Completed:</strong> {jobs.filter(j => j.status === 'completed').length}</p>
                  <p><strong>In Progress:</strong> {jobs.filter(j => j.status === 'in_progress').length}</p>
                  <p><strong>Scheduled:</strong> {jobs.filter(j => j.status === 'scheduled').length}</p>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={onLogout}
                  variant="outline"
                  className="w-full flex items-center space-x-2 text-red-600 border-red-200 hover:bg-red-50"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-4">
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {jobs.length === 0 && !error ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">All caught up!</h3>
              <p className="text-gray-600 mt-2">No work orders assigned for today.</p>
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id} className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{job.client.name}</CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge className={getStatusColor(job.status)} variant="secondary">
                        {job.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {job.serviceType || 'Service'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Job Details */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(job.scheduledDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>{job.scheduledTime || 'Time TBD'}</span>
                  </div>
                  <div className="flex items-start space-x-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mt-0.5" />
                    <span className="flex-1">{job.location || job.client.address}</span>
                  </div>

                  {job.googleMapsLink ? (
                    <a
                      href={job.googleMapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg shadow-sm flex items-center justify-center space-x-2"
                      data-testid={`button-open-google-maps-${job.id}`}
                    >
                      <Navigation className="h-5 w-5" />
                      <span>Open in Google Maps</span>
                    </a>
                  ) : (
                    <div className="text-sm text-gray-500 italic bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-center">
                      No Google Maps link added for this job.
                    </div>
                  )}
                  {job.client.phone && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{job.client.phone}</span>
                    </div>
                  )}
                </div>

                {job.description && (
                  <div>
                    <p className="text-sm font-medium text-gray-900">Job Description:</p>
                    <p className="text-sm text-gray-600 mt-1">{job.description}</p>
                  </div>
                )}

                <Separator />

                {/* Primary actions — ordered by importance for technicians */}
                <div className="space-y-2">
                  {/* 1. Start Job (only when scheduled) */}
                  {job.status === 'scheduled' && (
                    <Button
                      size="lg"
                      onClick={() => updateJobStatus(job.id, 'in_progress')}
                      className="w-full bg-blue-600 hover:bg-blue-700 font-semibold"
                      data-testid={`button-start-${job.id}`}
                    >
                      Start Job
                    </Button>
                  )}

                  {/* 5. Complete Job (only when in progress) */}
                  {job.status === 'in_progress' && (
                    <Button
                      size="lg"
                      onClick={() => updateJobStatus(job.id, 'completed')}
                      className="w-full bg-green-600 hover:bg-green-700 font-semibold"
                      data-testid={`button-complete-${job.id}`}
                    >
                      Complete Job
                    </Button>
                  )}

                  {/* Secondary actions */}
                  <div className="grid grid-cols-2 gap-2">
                    {job.client.phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => callClient(job.client.phone!)}
                        className="flex items-center justify-center space-x-1"
                        data-testid={`button-call-${job.id}`}
                      >
                        <Phone className="h-4 w-4" />
                        <span>Call</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMaps(job.location || job.client.address || '')}
                      className="flex items-center justify-center space-x-1"
                      data-testid={`button-navigate-${job.id}`}
                    >
                      <Navigation className="h-4 w-4" />
                      <span>Address Search</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
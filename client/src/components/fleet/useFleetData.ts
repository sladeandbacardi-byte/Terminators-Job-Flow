import { useQuery } from "@tanstack/react-query";

export const fleetJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Fleet request failed (${response.status})`);
  }
  return response.json();
};

const list = (url: string) => fleetJson<any[]>(url);

export function useFleetData(canManage: boolean) {
  const vehicles = useQuery({ queryKey: ["/api/fleet/vehicles"], queryFn: () => list("/api/fleet/vehicles") });
  const assignments = useQuery({ queryKey: ["/api/fleet/assignments"], queryFn: () => list("/api/fleet/assignments") });
  const workers = useQuery({ queryKey: ["/api/workers"], queryFn: () => list("/api/workers") });
  const settings = useQuery({ queryKey: ["/api/fleet/settings"], queryFn: () => list("/api/fleet/settings"), enabled: canManage });
  const templates = useQuery({ queryKey: ["/api/fleet/inspection-templates"], queryFn: () => list("/api/fleet/inspection-templates?includeArchived=true"), enabled: canManage });
  return {
    vehicles, assignments, workers, settings, templates,
    loading: vehicles.isLoading || assignments.isLoading || workers.isLoading,
    error: vehicles.error || assignments.error || workers.error,
  };
}

export function useFleetActivity(filters: Record<string, string | boolean>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== false) params.set(key, String(value));
  });
  return useQuery({
    queryKey: ["/api/fleet/activity", filters],
    queryFn: () => fleetJson<any>(`/api/fleet/activity?${params.toString()}`),
  });
}
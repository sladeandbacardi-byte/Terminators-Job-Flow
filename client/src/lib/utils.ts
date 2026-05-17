import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    ...options,
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getDepartmentColor(departmentName: string): string {
  if (departmentName.toLowerCase().includes('pest')) {
    return 'pest-control';
  }
  if (departmentName.toLowerCase().includes('hygiene')) {
    return 'hygiene';
  }
  return 'primary';
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':   return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'scheduled':   return 'bg-orange-100 text-orange-800';
    case 'pending':     return 'bg-yellow-100 text-yellow-800';
    case 'cancelled':   return 'bg-red-100 text-red-800';
    case 'overdue':     return 'bg-red-200 text-red-900';
    case 'unassigned':  return 'bg-gray-100 text-gray-700';
    default:            return 'bg-gray-100 text-gray-700';
  }
}

export function getJobStatusEventColor(
  status: string,
  workerId?: string | null,
  scheduledDate?: Date | string | null
): string {
  if (scheduledDate && status !== 'completed' && status !== 'cancelled') {
    const date = scheduledDate instanceof Date ? scheduledDate : new Date(scheduledDate as string);
    if (!isNaN(date.getTime()) && date < new Date()) {
      return '#dc2626';
    }
  }
  if (!workerId) return '#9ca3af';
  switch (status.toLowerCase()) {
    case 'scheduled':   return '#f97316';
    case 'in_progress': return '#3b82f6';
    case 'completed':   return '#22c55e';
    case 'cancelled':   return '#ef4444';
    case 'pending':     return '#eab308';
    default:            return '#9ca3af';
  }
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

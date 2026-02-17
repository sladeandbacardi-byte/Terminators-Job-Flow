export const DIVISIONS = {
  PEST_CONTROL: 'Pest Control',
  SANITARY_BINS: 'Sanitary Bins',
  WASHROOM: 'Washroom',
  DEEP_CLEANING: 'Deep Cleaning',
} as const;

export const JOB_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const JOB_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export const INVENTORY_TYPES = {
  PRODUCT: 'product',
  RENTAL_EQUIPMENT: 'rental_equipment',
} as const;

export const NOTIFICATION_TYPES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
} as const;

export const SERVICE_TYPES = [
  'Pest Control Inspection',
  'Rodent Control',
  'Insect Control',
  'Fumigation',
  'Hand Sanitizer Service',
  'Hygiene Equipment Maintenance',
  'Restroom Hygiene Service',
  'Deep Cleaning',
  'Equipment Installation',
  'Monthly Maintenance',
  'Emergency Service',
] as const;

export const RECURRING_PATTERNS = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

export const RECURRENCE_PERIODS = [
  { value: 'W', label: 'Week(s)' },
  { value: '2W', label: '2 Weeks' },
  { value: 'M', label: 'Month(s)' },
  { value: '2M', label: '2 Months' },
  { value: '3M', label: '3 Months (Quarterly)' },
  { value: '6M', label: '6 Months' },
  { value: 'Y', label: 'Year(s)' },
  { value: '2M/S', label: '2 Month Sanitary' },
] as const;

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const DIARY_OPTIONS = [
  'Pest Control',
  'Sanitary Bins - Leon',
  'Sanitary Bins - Team A',
  'Sanitary Bins - Team B',
  'Washroom',
  'Deep Cleaning',
] as const;

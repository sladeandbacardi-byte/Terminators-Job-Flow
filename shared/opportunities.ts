export const OPPORTUNITY_TYPES = [
  "pest_control", "washroom_hygiene", "sanitary_bins", "deep_cleaning",
  "contract_cleaning", "plumbing", "electrical", "hand_dryer", "fly_machine",
  "general_maintenance", "water_pumps_tanks", "waste", "access_control",
  "cctv_security", "solar_energy", "other",
] as const;

export type OpportunityType = typeof OPPORTUNITY_TYPES[number];

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  pest_control: "Pest Control",
  washroom_hygiene: "Washroom Hygiene",
  sanitary_bins: "Sanitary Bins",
  deep_cleaning: "Deep Cleaning",
  contract_cleaning: "Contract Cleaning",
  plumbing: "Plumbing",
  electrical: "Electrical",
  hand_dryer: "Hand Dryer",
  fly_machine: "Fly Machine",
  general_maintenance: "General Maintenance",
  water_pumps_tanks: "Water / Pumps / Tanks",
  waste: "Waste",
  access_control: "Access Control",
  cctv_security: "CCTV / Security",
  solar_energy: "Solar / Energy",
  other: "Other",
};

export const OPPORTUNITY_STATUSES = [
  "new", "reviewing", "contact_client", "site_inspection_required",
  "quote_required", "quote_sent", "accepted", "job_created", "won",
  "lost", "not_applicable",
] as const;

export type OpportunityStatus = typeof OPPORTUNITY_STATUSES[number];

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  contact_client: "Contact Client",
  site_inspection_required: "Site Inspection Required",
  quote_required: "Quote Required",
  quote_sent: "Quote Sent",
  accepted: "Accepted",
  job_created: "Job Created",
  won: "Won",
  lost: "Lost",
  not_applicable: "Not Applicable",
};

export const OPPORTUNITY_URGENCIES = ["normal", "important", "urgent"] as const;
export type OpportunityUrgency = typeof OPPORTUNITY_URGENCIES[number];

export const SERVICE_WALLET_STATES = ["active", "previously_used", "never_used"] as const;
export type ServiceWalletState = typeof SERVICE_WALLET_STATES[number];
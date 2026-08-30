export type OfficeOrganogramPerson = {
  id: string;
  name: string;
  role: string;
  department: string;
};

export const OFFICE_ORGANOGRAM_BRANCHES = [
  "Administration Team",
  "Finance / HR",
  "Marketing & Sales",
] as const;

export type OfficeOrganogramBranch = typeof OFFICE_ORGANOGRAM_BRANCHES[number];

const includes = (value: string, pattern: RegExp) => pattern.test(value.toLowerCase());

export function getOfficeOrganogramBranch(person: OfficeOrganogramPerson): OfficeOrganogramBranch {
  if (includes(`${person.role} ${person.department}`, /\bfinance\b|\baccounts?\b|\bhr\b/)) return "Finance / HR";
  if (includes(`${person.role} ${person.department}`, /\bsales\b|\bmarketing\b/)) return "Marketing & Sales";
  return "Administration Team";
}
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Division } from "@shared/schema";

export interface DepartmentFilterState {
  selectedDepartments: string[];
  setSelectedDepartments: (departments: string[]) => void;
  isAllSelected: boolean;
  filteredData: <T extends { divisionId?: string | null }>(data: T[]) => T[];
  divisions: Division[];
  isLoading: boolean;
}

/**
 * Custom hook to manage department filtering state and logic
 * @param initialSelection - Initial selected departments (empty array means "all")
 * @returns DepartmentFilterState object with filtering utilities
 */
export function useDepartmentFilter(initialSelection: string[] = []): DepartmentFilterState {
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(initialSelection);

  const { data: divisions = [], isLoading } = useQuery<Division[]>({
    queryKey: ["/api/divisions"],
  });

  const isAllSelected = selectedDepartments.length === 0;

  /**
   * Filter data based on selected departments
   * @param data - Array of objects with optional divisionId property
   * @returns Filtered array based on department selection
   */
  const filteredData = useMemo(() => {
    return function <T extends { divisionId?: string | null }>(data: T[]): T[] {
      if (isAllSelected) {
        return data;
      }
      return data.filter(item => 
        item.divisionId && selectedDepartments.includes(item.divisionId)
      );
    };
  }, [selectedDepartments, isAllSelected]);

  return {
    selectedDepartments,
    setSelectedDepartments,
    isAllSelected,
    filteredData,
    divisions,
    isLoading,
  };
}
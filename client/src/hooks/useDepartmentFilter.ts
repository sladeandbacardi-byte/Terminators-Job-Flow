import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Department } from "@shared/schema";

export interface DepartmentFilterState {
  selectedDepartments: string[];
  setSelectedDepartments: (departments: string[]) => void;
  isAllSelected: boolean;
  filteredData: <T extends { departmentId?: string | null }>(data: T[]) => T[];
  departments: Department[];
  isLoading: boolean;
}

/**
 * Custom hook to manage department filtering state and logic
 * @param initialSelection - Initial selected departments (empty array means "all")
 * @returns DepartmentFilterState object with filtering utilities
 */
export function useDepartmentFilter(initialSelection: string[] = []): DepartmentFilterState {
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(initialSelection);

  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const isAllSelected = selectedDepartments.length === 0;

  /**
   * Filter data based on selected departments
   * @param data - Array of objects with optional departmentId property
   * @returns Filtered array based on department selection
   */
  const filteredData = useMemo(() => {
    return function <T extends { departmentId?: string | null }>(data: T[]): T[] {
      if (isAllSelected) {
        return data;
      }
      return data.filter(item => 
        item.departmentId && selectedDepartments.includes(item.departmentId)
      );
    };
  }, [selectedDepartments, isAllSelected]);

  return {
    selectedDepartments,
    setSelectedDepartments,
    isAllSelected,
    filteredData,
    departments,
    isLoading,
  };
}
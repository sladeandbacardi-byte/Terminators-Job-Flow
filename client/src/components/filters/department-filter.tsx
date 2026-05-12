import { useState, useEffect } from "react";
import { Check, ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { Department } from "@shared/schema";

interface DepartmentFilterProps {
  selectedDepartments: string[];
  onSelectionChange: (departments: string[]) => void;
  showAllOption?: boolean;
  className?: string;
}

export function DepartmentFilter({ 
  selectedDepartments, 
  onSelectionChange, 
  showAllOption = true,
  className = "" 
}: DepartmentFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Handle "All Departments" selection
  const handleAllToggle = (checked: boolean) => {
    if (checked) {
      onSelectionChange([]);
    }
  };

  // Handle individual department selection
  const handleDepartmentToggle = (departmentId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedDepartments, departmentId]);
    } else {
      onSelectionChange(selectedDepartments.filter(id => id !== departmentId));
    }
  };

  // Determine display text
  const getDisplayText = () => {
    if (selectedDepartments.length === 0) {
      return "All Departments";
    } else if (selectedDepartments.length === 1) {
      const department = departments.find(d => d.id === selectedDepartments[0]);
      return department?.name || "1 Department";
    } else {
      return `${selectedDepartments.length} Departments`;
    }
  };

  // Get selected department names for badges
  const getSelectedDepartmentNames = () => {
    return departments
      .filter(d => selectedDepartments.includes(d.id))
      .map(d => ({ id: d.id, name: d.name, colorCode: d.colorCode }));
  };

  return (
    <div className={`space-y-2 ${className}`} data-testid="department-filter">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-between"
            data-testid="button-department-filter"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>{getDisplayText()}</span>
            </div>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent className="w-64 p-2" data-testid="dropdown-department-options">
          <div className="space-y-2">
            {/* All Departments Option */}
            {showAllOption && (
              <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                <Checkbox
                  id="all-departments"
                  checked={selectedDepartments.length === 0}
                  onCheckedChange={handleAllToggle}
                  data-testid="checkbox-all-departments"
                />
                <label htmlFor="all-departments" className="flex-1 cursor-pointer font-medium">
                  All Departments
                </label>
                {selectedDepartments.length === 0 && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
              </div>
            )}

            {/* Individual Department Options */}
            {departments.filter(d => ["div-1","div-2","div-3","div-4"].includes(d.id)).map((department) => (
              <div 
                key={department.id} 
                className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                data-testid={`department-option-${department.id}`}
              >
                <Checkbox
                  id={`dept-${department.id}`}
                  checked={selectedDepartments.includes(department.id)}
                  onCheckedChange={(checked) => handleDepartmentToggle(department.id, checked as boolean)}
                  data-testid={`checkbox-department-${department.id}`}
                />
                <div className="flex items-center gap-2 flex-1">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: department.colorCode }}
                  />
                  <label htmlFor={`dept-${department.id}`} className="cursor-pointer">
                    {department.name}
                  </label>
                </div>
                {selectedDepartments.includes(department.id) && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
              </div>
            ))}
          </div>

          {/* Clear Selection Button */}
          {selectedDepartments.length > 0 && (
            <div className="border-t mt-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => onSelectionChange([])}
                data-testid="button-clear-department-filter"
              >
                Clear Selection
              </Button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selected Department Badges */}
      {selectedDepartments.length > 0 && (
        <div className="flex flex-wrap gap-1" data-testid="selected-departments-badges">
          {getSelectedDepartmentNames().map((department) => (
            <Badge 
              key={department.id} 
              variant="secondary" 
              className="text-xs"
              style={{ 
                backgroundColor: `${department.colorCode}20`, 
                borderColor: department.colorCode 
              }}
              data-testid={`badge-department-${department.id}`}
            >
              {department.name}
              <button
                className="ml-1 hover:bg-gray-200 rounded-full"
                onClick={() => handleDepartmentToggle(department.id, false)}
                data-testid={`button-remove-department-${department.id}`}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Printer, ArrowLeft, CalendarIcon } from "lucide-react";
import { Link } from "wouter";
import { PrintableDailyDepartmentCard } from "@/components/daily-department-card";
import { cn } from "@/lib/utils";
import type { Division } from "@shared/schema";

export default function DailyDepartmentCardPage() {
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Fetch divisions for selection
  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ['/api/divisions'],
  });

  const handlePrint = () => {
    if (selectedDivision) {
      window.print();
    }
  };

  const isReadyToPrint = selectedDivision && selectedDate;

  return (
    <div className="min-h-screen bg-gray-50" data-testid="daily-department-card-page">
      {/* Controls - Hidden when printing */}
      <div className="print:hidden bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <Link href="/calendar">
            <Button variant="outline" data-testid="button-back-calendar">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Calendar
            </Button>
          </Link>
          
          <div className="flex items-center gap-4">
            {/* Division Selection */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Department:</label>
              <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                <SelectTrigger className="w-48" data-testid="division-select">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map(division => (
                    <SelectItem key={division.id} value={division.id}>
                      {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Selection */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Date:</label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-48 justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                    data-testid="date-select"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        setCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button 
              onClick={handlePrint} 
              disabled={!isReadyToPrint}
              data-testid="button-print-daily-card"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Schedule
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 print:p-0">
        {!isReadyToPrint ? (
          <div className="max-w-2xl mx-auto mt-12 text-center">
            <div className="bg-white p-8 rounded-lg shadow-sm border">
              <CalendarIcon className="h-16 w-16 mx-auto mb-6 text-gray-400" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Daily Department Schedule
              </h2>
              <p className="text-gray-600 mb-6">
                Select a department and date to view the daily job schedule in landscape format.
                Perfect for printing and distributing to field teams.
              </p>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  1. Choose a department from the dropdown above
                </p>
                <p className="text-sm text-gray-500">
                  2. Select the date you want to view
                </p>
                <p className="text-sm text-gray-500">
                  3. Click "Print Schedule" to generate the landscape view
                </p>
              </div>
            </div>
          </div>
        ) : (
          <PrintableDailyDepartmentCard 
            divisionId={selectedDivision} 
            date={selectedDate} 
          />
        )}
      </div>
    </div>
  );
}
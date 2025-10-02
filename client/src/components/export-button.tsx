import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportAllData } from "@/lib/data-export";

interface ExportButtonProps {
  onExportCSV: () => void;
  entityName: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
}

export function ExportButton({ 
  onExportCSV, 
  entityName, 
  size = "default",
  variant = "outline" 
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      await exportAllData();
      toast({
        description: "Complete data export downloaded successfully",
      });
    } catch (error) {
      toast({
        description: "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    try {
      onExportCSV();
      toast({
        description: `${entityName} exported to CSV successfully`,
      });
    } catch (error) {
      toast({
        description: `Failed to export ${entityName.toLowerCase()}`,
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size} 
          disabled={isExporting}
          data-testid="export-button"
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV} data-testid="export-csv">
          <FileText className="mr-2 h-4 w-4" />
          Export {entityName} to CSV
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportAll} data-testid="export-all">
          <Database className="mr-2 h-4 w-4" />
          Export Complete Database (ZIP)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
import { Plus, UserPlus, Box, FileText } from "lucide-react";

interface QuickActionsProps {
  onCreateJob?: () => void;
  onAssignWorker?: () => void;
  onManageInventory?: () => void;
  onGenerateReport?: () => void;
}

export default function QuickActions({
  onCreateJob,
  onAssignWorker,
  onManageInventory,
  onGenerateReport,
}: QuickActionsProps) {
  const actions = [
    {
      title: "Create Job",
      icon: Plus,
      color: "primary",
      onClick: onCreateJob,
      testId: "create-job",
    },
    {
      title: "Assign Worker", 
      icon: UserPlus,
      color: "green",
      onClick: onAssignWorker,
      testId: "assign-worker",
    },
    {
      title: "Manage Inventory",
      icon: Box,
      color: "orange", 
      onClick: onManageInventory,
      testId: "manage-inventory",
    },
    {
      title: "Generate Report",
      icon: FileText,
      color: "purple",
      onClick: onGenerateReport,
      testId: "generate-report",
    },
  ];

  const colorClasses = {
    primary: "bg-primary-100 text-primary-600",
    green: "bg-green-100 text-green-600",
    orange: "bg-orange-100 text-orange-600", 
    purple: "bg-purple-100 text-purple-600",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-testid="quick-actions">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          
          return (
            <button
              key={action.title}
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={action.onClick}
              data-testid={`button-${action.testId}`}
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-2 ${colorClasses[action.color as keyof typeof colorClasses]}`}>
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium text-gray-900">{action.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

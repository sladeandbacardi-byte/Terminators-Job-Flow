import { TrendingUp, Users, AlertTriangle, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface MetricsData {
  activeJobs: number;
  activeWorkers: number;
  expiringContracts: number;
  monthlyRevenue: number;
}

interface MetricsCardsProps {
  data: MetricsData;
  isLoading?: boolean;
}

export default function MetricsCards({ data, isLoading }: MetricsCardsProps) {
  const metrics = [
    {
      title: "Active Jobs",
      value: data.activeJobs,
      change: "+12% from last week",
      changeType: "positive",
      icon: TrendingUp,
      color: "primary",
    },
    {
      title: "Staff Active",
      value: data.activeWorkers,
      change: "All on duty",
      changeType: "neutral",
      icon: Users,
      color: "green",
    },
    {
      title: "Contracts Expiring",
      value: data.expiringContracts,
      change: "Next 30 days",
      changeType: "warning",
      icon: AlertTriangle,
      color: "orange",
    },
    {
      title: "Monthly Revenue",
      value: formatCurrency(data.monthlyRevenue),
      change: "+R 3,200 vs last month",
      changeType: "positive",
      icon: DollarSign,
      color: "green",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" data-testid="metrics-cards">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        const colorClasses = {
          primary: "bg-primary-100 text-primary-600",
          green: "bg-green-100 text-green-600", 
          orange: "bg-orange-100 text-orange-600",
        };

        return (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-testid={`metric-card-${index}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600" data-testid={`metric-title-${index}`}>{metric.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1" data-testid={`metric-value-${index}`}>{metric.value}</p>
                <p className={`text-sm mt-2 ${
                  metric.changeType === 'positive' ? 'text-green-600' :
                  metric.changeType === 'warning' ? 'text-orange-600' :
                  'text-gray-500'
                }`} data-testid={`metric-change-${index}`}>
                  {metric.changeType === 'positive' && <TrendingUp className="inline h-4 w-4 mr-1" />}
                  {metric.changeType === 'warning' && <AlertTriangle className="inline h-4 w-4 mr-1" />}
                  {metric.change}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[metric.color as keyof typeof colorClasses]}`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface DepartmentData {
  department: {
    id: string;
    name: string;
    colorCode: string;
  };
  activeWorkers: number;
  jobsToday: number;
  completed: number;
  inProgress: number;
  pending: number;
}

interface DepartmentPerformanceProps {
  departments: DepartmentData[];
  isLoading?: boolean;
}

export default function DepartmentPerformance({ departments, isLoading }: DepartmentPerformanceProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-48 mb-6 animate-pulse"></div>
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-64 mb-3"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="space-y-1">
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                    <div className="h-5 bg-gray-200 rounded w-8"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-testid="department-performance">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Department Performance</h3>
      
      <div className="space-y-6">
        {departments.map((departmentData) => {
          const getDepartmentStyles = (departmentId: string) => {
            switch (departmentId) {
              case 'div-1': // Pest Control
                return {
                  borderColor: 'border-green-600',
                  bgColor: 'bg-green-50',
                  textColor: 'text-green-700',
                  dotColor: 'bg-green-600'
                };
              case 'div-2': // Sanitary Bins
                return {
                  borderColor: 'border-purple-600',
                  bgColor: 'bg-purple-50',
                  textColor: 'text-purple-700',
                  dotColor: 'bg-purple-600'
                };
              case 'div-3': // Washroom
                return {
                  borderColor: 'border-blue-600',
                  bgColor: 'bg-blue-50',
                  textColor: 'text-blue-700',
                  dotColor: 'bg-blue-600'
                };
              case 'div-4': // Deep Cleaning
                return {
                  borderColor: 'border-orange-600',
                  bgColor: 'bg-orange-50',
                  textColor: 'text-orange-700',
                  dotColor: 'bg-orange-600'
                };
              default:
                return {
                  borderColor: 'border-gray-600',
                  bgColor: 'bg-gray-50',
                  textColor: 'text-gray-700',
                  dotColor: 'bg-gray-600'
                };
            }
          };
          
          const styles = getDepartmentStyles(departmentData.department.id);
          const { borderColor, bgColor, textColor, dotColor } = styles;
          
          return (
            <div 
              key={departmentData.department.id} 
              className={`border-l-4 ${borderColor} ${bgColor} rounded-r-lg p-4`}
              data-testid={`department-${departmentData.department.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 ${dotColor} rounded-full`}></div>
                  <h4 className="font-medium text-gray-900" data-testid={`department-name-${departmentData.department.id}`}>
                    {departmentData.department.name}
                  </h4>
                </div>
                <span className={`text-sm ${textColor} font-medium`} data-testid={`department-workers-${departmentData.department.id}`}>
                  {departmentData.activeWorkers} Workers Active
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Jobs Today</p>
                  <p className="font-semibold text-gray-900" data-testid={`jobs-today-${departmentData.department.id}`}>
                    {departmentData.jobsToday}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Completed</p>
                  <p className={`font-semibold ${textColor}`} data-testid={`completed-${departmentData.department.id}`}>
                    {departmentData.completed}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">In Progress</p>
                  <p className="font-semibold text-orange-600" data-testid={`in-progress-${departmentData.department.id}`}>
                    {departmentData.inProgress}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Pending</p>
                  <p className="font-semibold text-gray-600" data-testid={`pending-${departmentData.department.id}`}>
                    {departmentData.pending}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

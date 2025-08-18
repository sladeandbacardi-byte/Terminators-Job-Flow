interface DivisionData {
  division: {
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

interface DivisionPerformanceProps {
  divisions: DivisionData[];
  isLoading?: boolean;
}

export default function DivisionPerformance({ divisions, isLoading }: DivisionPerformanceProps) {
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-testid="division-performance">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Division Performance</h3>
      
      <div className="space-y-6">
        {divisions.map((divisionData) => {
          const isPestControl = divisionData.division.name.toLowerCase().includes('pest');
          const borderColor = isPestControl ? 'border-pest-control-600' : 'border-hygiene-600';
          const bgColor = isPestControl ? 'bg-pest-control-50' : 'bg-hygiene-50';
          const textColor = isPestControl ? 'text-pest-control-700' : 'text-hygiene-700';
          const dotColor = isPestControl ? 'bg-pest-control-600' : 'bg-hygiene-600';
          
          return (
            <div 
              key={divisionData.division.id} 
              className={`border-l-4 ${borderColor} ${bgColor} rounded-r-lg p-4`}
              data-testid={`division-${divisionData.division.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 ${dotColor} rounded-full`}></div>
                  <h4 className="font-medium text-gray-900" data-testid={`division-name-${divisionData.division.id}`}>
                    {divisionData.division.name}
                  </h4>
                </div>
                <span className={`text-sm ${textColor} font-medium`} data-testid={`division-workers-${divisionData.division.id}`}>
                  {divisionData.activeWorkers} Workers Active
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Jobs Today</p>
                  <p className="font-semibold text-gray-900" data-testid={`jobs-today-${divisionData.division.id}`}>
                    {divisionData.jobsToday}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Completed</p>
                  <p className={`font-semibold ${textColor}`} data-testid={`completed-${divisionData.division.id}`}>
                    {divisionData.completed}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">In Progress</p>
                  <p className="font-semibold text-orange-600" data-testid={`in-progress-${divisionData.division.id}`}>
                    {divisionData.inProgress}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Pending</p>
                  <p className="font-semibold text-gray-600" data-testid={`pending-${divisionData.division.id}`}>
                    {divisionData.pending}
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

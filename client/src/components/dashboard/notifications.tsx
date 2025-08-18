import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock, AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { Notification } from "@shared/schema";

export default function NotificationsPanel() {
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mock notifications for demo
  const mockNotifications = [
    {
      id: "1",
      title: "Contract Expiry Alert",
      message: "Shoprite Checkers contract expires in 15 days",
      type: "warning" as const,
      priority: "high" as const,
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      id: "2", 
      title: "Equipment Maintenance Due",
      message: "Hand sanitizer dispenser #HD-004 requires service",
      type: "warning" as const,
      priority: "medium" as const,
      isRead: false,
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    },
    {
      id: "3",
      title: "Worker Check-in Overdue", 
      message: "Mike Johnson hasn't checked in since 12:30",
      type: "error" as const,
      priority: "urgent" as const,
      isRead: false,
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    },
  ];

  const displayNotifications = notifications.length > 0 ? notifications : mockNotifications;

  const getNotificationStyle = (type: string, priority: string) => {
    if (priority === 'urgent' || type === 'error') {
      return {
        bg: 'bg-red-50',
        border: 'border-red-200', 
        dot: 'bg-red-500',
      };
    }
    if (type === 'warning') {
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        dot: 'bg-orange-500',
      };
    }
    return {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200', 
      dot: 'bg-yellow-500',
    };
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse"></div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-testid="notifications-panel">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Urgent Notifications</h3>
      
      <div className="space-y-4">
        {displayNotifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No notifications at this time</p>
          </div>
        ) : (
          displayNotifications.slice(0, 5).map((notification) => {
            const style = getNotificationStyle(notification.type, notification.priority);
            
            return (
              <div 
                key={notification.id} 
                className={`flex items-start space-x-3 p-3 ${style.bg} border ${style.border} rounded-lg`}
                data-testid={`notification-${notification.id}`}
              >
                <div className={`flex-shrink-0 w-2 h-2 ${style.dot} rounded-full mt-2`}></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900" data-testid={`notification-title-${notification.id}`}>
                    {notification.title}
                  </p>
                  <p className="text-sm text-gray-600 mt-1" data-testid={`notification-message-${notification.id}`}>
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-2" data-testid={`notification-time-${notification.id}`}>
                    {formatDateTime(notification.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {displayNotifications.length > 5 && (
        <button className="w-full mt-4 text-sm text-primary-600 font-medium hover:text-primary-700" data-testid="view-all-notifications">
          View All Notifications
        </button>
      )}
    </div>
  );
}

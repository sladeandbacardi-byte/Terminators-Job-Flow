import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { formatDateTime, getInitials } from "@/lib/utils";

interface HeaderProps {
  title: string;
  onMobileMenuToggle?: () => void;
}

export default function Header({ title, onMobileMenuToggle }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4" data-testid="header">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
            onClick={onMobileMenuToggle}
            data-testid="mobile-menu-toggle"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900" data-testid="page-title">{title}</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600" data-testid="current-time">
            <span>{formatDateTime(currentTime)} SAST</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center" data-testid="user-avatar">
              <span className="text-white text-sm font-medium">
                {getInitials("Admin Manager")}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900" data-testid="user-name">Admin Manager</p>
              <p className="text-xs text-gray-500" data-testid="user-location">Port Elizabeth</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

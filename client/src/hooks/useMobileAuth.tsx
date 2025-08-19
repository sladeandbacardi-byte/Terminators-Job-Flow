import { useState, useEffect, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Worker } from '@shared/schema';

interface MobileAuthContextType {
  worker: Worker | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (worker: Worker) => void;
  logout: () => void;
}

const MobileAuthContext = createContext<MobileAuthContextType | undefined>(undefined);

export function useMobileAuth() {
  const context = useContext(MobileAuthContext);
  if (!context) {
    throw new Error('useMobileAuth must be used within a MobileAuthProvider');
  }
  return context;
}

interface MobileAuthProviderProps {
  children: ReactNode;
}

export function MobileAuthProvider({ children }: MobileAuthProviderProps) {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedWorkerId = localStorage.getItem('mobile_worker_id');
    const storedToken = localStorage.getItem('mobile_session_token');
    const storedWorkerData = localStorage.getItem('mobile_worker_data');

    if (storedWorkerId && storedToken && storedWorkerData) {
      try {
        const workerData = JSON.parse(storedWorkerData);
        setWorker(workerData);
      } catch (error) {
        console.error('Error parsing stored worker data:', error);
        // Clear invalid data
        localStorage.removeItem('mobile_worker_id');
        localStorage.removeItem('mobile_session_token');
        localStorage.removeItem('mobile_worker_data');
      }
    }
    
    setIsLoading(false);
  }, []);

  const login = (workerData: Worker) => {
    setWorker(workerData);
  };

  const logout = () => {
    setWorker(null);
    localStorage.removeItem('mobile_worker_id');
    localStorage.removeItem('mobile_session_token');
    localStorage.removeItem('mobile_worker_data');
  };

  const value: MobileAuthContextType = {
    worker,
    isAuthenticated: !!worker,
    isLoading,
    login,
    logout,
  };

  return (
    <MobileAuthContext.Provider value={value}>
      {children}
    </MobileAuthContext.Provider>
  );
}
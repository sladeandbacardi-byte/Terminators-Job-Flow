import { useState, useEffect, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Worker } from '@shared/schema';
import { clearAllAuth, readMobileSession, validateMobileSession } from '@/lib/mobile-auth';

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
    let active = true;
    const hydrate = async () => {
      try {
        const session = readMobileSession();
        if (session && await validateMobileSession(session) && active) setWorker(session.worker as Worker);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void hydrate();
    return () => { active = false; };
  }, []);

  const login = (workerData: Worker) => {
    setWorker(workerData);
  };

  const logout = () => {
    const session = readMobileSession();
    setWorker(null);
    void (async () => {
      try {
        if (session) {
          await fetch("/api/auth/mobile-logout", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.token}` },
          });
        }
      } finally {
        clearAllAuth();
        window.location.replace('/');
      }
    })();
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
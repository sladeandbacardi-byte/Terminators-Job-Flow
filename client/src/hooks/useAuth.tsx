import { useState, useEffect, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { AdminUser } from '@shared/schema';
import type { DemoProfile } from '@/lib/demoProfiles';

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  login: (token: string, user: AdminUser) => void;
  loginDemo: (profile: DemoProfile) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    const demoFlag = localStorage.getItem('demo_mode') === 'true';

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
        setIsDemoMode(demoFlag);
        setIsLoading(false);
        return;
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('demo_mode');
      }
    }

    setIsLoading(false);
  }, []);

  const login = (newToken: string, userData: AdminUser) => {
    setToken(newToken);
    setUser(userData);
    setIsDemoMode(false);
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(userData));
    localStorage.setItem('auth_user_role', userData.role || 'User');
    localStorage.setItem('auth_user_type', (userData as AdminUser & { userType?: string }).userType || 'admin');
    localStorage.removeItem('demo_mode');
    localStorage.removeItem('mobile_worker_id');
    localStorage.removeItem('mobile_session_token');
    localStorage.removeItem('mobile_worker_data');
    localStorage.removeItem('mobile_user_role');
    localStorage.removeItem('mobile_user_type');
  };

  const loginDemo = (profile: DemoProfile) => {
    const fakeToken = `demo-token-${profile.key}-${Date.now()}`;
    const fakeUser = profile.user as unknown as AdminUser;
    setToken(fakeToken);
    setUser(fakeUser);
    setIsDemoMode(true);
    localStorage.setItem('auth_token', fakeToken);
    localStorage.setItem('auth_user', JSON.stringify(fakeUser));
    localStorage.setItem('demo_mode', 'true');
  };

  const logout = async () => {
    if (token && !isDemoMode) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    setToken(null);
    setUser(null);
    setIsDemoMode(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_user_role');
    localStorage.removeItem('auth_user_type');
    localStorage.removeItem('demo_mode');
    localStorage.removeItem('mobile_worker_id');
    localStorage.removeItem('mobile_session_token');
    localStorage.removeItem('mobile_worker_data');
    localStorage.removeItem('mobile_user_role');
    localStorage.removeItem('mobile_user_type');
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    isDemoMode,
    login,
    loginDemo,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

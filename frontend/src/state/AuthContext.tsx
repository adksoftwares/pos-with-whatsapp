import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { LoadingOverlay } from '../components/ui/LoadingState';

interface User {
  id: string;
  name: string;
  email: string;
  status: string;
  memberships: Array<{
    businessId: string;
    role: string;
    business: {
      id: string;
      name: string;
      currency?: string;
    }
  }>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeBusiness: User['memberships'][0]['business'] | null;
  activeRole: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setActiveBusiness: (businessId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(localStorage.getItem('activeBusinessId'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await apiClient.get('/auth/me');
        const fetchedUser = response.data.user;
        setUser(fetchedUser);
        
        // Auto-select first business if none selected
        if (!activeBusinessId && fetchedUser.memberships.length > 0) {
          const firstBusinessId = fetchedUser.memberships[0].businessId;
          setActiveBusinessId(firstBusinessId);
          localStorage.setItem('activeBusinessId', firstBusinessId);
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    
    if (newUser.memberships.length > 0) {
      const bId = newUser.memberships[0].businessId;
      localStorage.setItem('activeBusinessId', bId);
      setActiveBusinessId(bId);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeBusinessId');
    setToken(null);
    setUser(null);
    setActiveBusinessId(null);
  };

  const handleSetActiveBusiness = (businessId: string) => {
    localStorage.setItem('activeBusinessId', businessId);
    setActiveBusinessId(businessId);
  };

  const activeMembership = user?.memberships.find(m => m.businessId === activeBusinessId);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      activeBusiness: activeMembership?.business || null,
      activeRole: activeMembership?.role || null,
      isLoading,
      login,
      logout,
      setActiveBusiness: handleSetActiveBusiness
    }}>
      {isLoading ? <LoadingOverlay /> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import { createContext, useContext, useState, type ReactNode } from 'react';

export type UserRole = 'analis' | 'admin' | 'auditor';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  token: string;
}

const DEMO_USERS: Record<UserRole, UserProfile> = {
  analis: {
    id: 'user-analis-01',
    email: 'analis@pln.co.id',
    name: 'Budi (Analis)',
    role: 'analis',
    token: 'mock-jwt-analis',
  },
  admin: {
    id: 'user-admin-01',
    email: 'admin@pln.co.id',
    name: 'Siti (Admin)',
    role: 'admin',
    token: 'mock-jwt-admin',
  },
  auditor: {
    id: 'user-auditor-01',
    email: 'auditor@pln.co.id',
    name: 'Rudi (Auditor)',
    role: 'auditor',
    token: 'mock-jwt-auditor',
  },
};

interface AuthContextType {
  user: UserProfile;
  setRole: (role: UserRole) => void;
  canAccess: (permission: 'upload' | 'match' | 'validate' | 'audit' | 'config') => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  login: (role?: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>('analis');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  const user = DEMO_USERS[currentRole];

  const canAccess = (permission: 'upload' | 'match' | 'validate' | 'audit' | 'config'): boolean => {
    if (!isAuthenticated) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'analis') {
      return permission === 'upload' || permission === 'match' || permission === 'validate';
    }
    if (user.role === 'auditor') {
      return permission === 'audit';
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const login = (role: UserRole = 'analis') => {
    setCurrentRole(role);
    setIsAuthenticated(true);
  };

  return (
    <AuthContext.Provider value={{ user, setRole: setCurrentRole, canAccess, logout, isAuthenticated, login }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return context;
}

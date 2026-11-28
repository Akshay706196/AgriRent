import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, KYCStatus, AuthSession } from '../api/types';
import { authApi } from '../api/auth.api';
import { setApiToken, getApiToken } from '../api/client';

export type UserMode = 'RENTER' | 'OWNER' | 'ADMIN';

interface DecodedToken {
  sub?: string;
  id?: string;
  userId?: string;
  roles?: string[];
  role?: string;
  exp?: number;
  kycStatus?: KYCStatus;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  mode: UserMode;
  kycStatus: KYCStatus;
  isKycVerified: boolean;
  setMode: (mode: UserMode) => void;
  login: (identifier: string, password: string) => Promise<AuthSession>;
  register: (payload: { name: string; email: string; phone: string; password: string; role?: string }) => Promise<AuthSession>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  decodedToken: DecodedToken | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseJwt(token: string): DecodedToken | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => getApiToken());
  const [user, setUser] = useState<User | null>(null);
  const [mode, setModeState] = useState<UserMode>('RENTER');
  const [decodedToken, setDecodedToken] = useState<DecodedToken | null>(null);

  useEffect(() => {
    const savedMode = localStorage.getItem('agrirent_user_mode') as UserMode;
    if (savedMode && (savedMode === 'RENTER' || savedMode === 'OWNER' || savedMode === 'ADMIN')) {
      setModeState(savedMode);
    }
  }, []);

  const handleSetToken = (newToken: string | null) => {
    setTokenState(newToken);
    setApiToken(newToken);
    if (newToken) {
      const decoded = parseJwt(newToken);
      setDecodedToken(decoded);
    } else {
      setDecodedToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const currentToken = getApiToken();
    if (!currentToken) return;

    const decoded = parseJwt(currentToken);
    if (decoded && decoded.exp && decoded.exp * 1000 < Date.now()) {
      handleSetToken(null);
      return;
    }

    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      setDecodedToken(decoded);
    } catch {
      // Token might be invalid or network error
    }
  };

  useEffect(() => {
    if (token) {
      refreshUser();
    }
  }, [token]);

  const login = async (identifier: string, password: string): Promise<AuthSession> => {
    const session = await authApi.login({ identifier, password });
    handleSetToken(session.accessToken);
    setUser(session.user);
    return session;
  };

  const register = async (payload: { name: string; email: string; phone: string; password: string; role?: string }): Promise<AuthSession> => {
    const session = await authApi.register(payload);
    handleSetToken(session.accessToken);
    setUser(session.user);
    return session;
  };

  const logout = () => {
    handleSetToken(null);
    setUser(null);
    localStorage.removeItem('agrirent_user_mode');
    setModeState('RENTER');
  };

  const setMode = (newMode: UserMode) => {
    setModeState(newMode);
    localStorage.setItem('agrirent_user_mode', newMode);
  };

  const isAuthenticated = Boolean(token && user);
  const isAdmin = Boolean(user?.roles?.includes('ADMIN') || decodedToken?.roles?.includes('ADMIN'));
  const kycStatus: KYCStatus = user?.kycStatus || decodedToken?.kycStatus || 'NOT_SUBMITTED';
  const isKycVerified = kycStatus === 'VERIFIED';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
        mode,
        kycStatus,
        isKycVerified,
        setMode,
        login,
        register,
        logout,
        refreshUser,
        decodedToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

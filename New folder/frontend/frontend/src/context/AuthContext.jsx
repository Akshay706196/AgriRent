import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(authService.getUser());
  const [token, setToken] = useState(authService.getToken());
  const [loading, setLoading] = useState(true);

  // Sync / verify current session on startup
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = authService.getToken();
      if (storedToken) {
        try {
          const freshUser = await authService.getCurrentUser();
          setUser(freshUser);
        } catch {
          // Token expired or invalid
          authService.clearAuth();
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (identifier, password) => {
    const data = await authService.login({ identifier, password });
    setToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  const register = async (payload) => {
    return await authService.register(payload);
  };

  const logout = () => {
    authService.clearAuth();
    setUser(null);
    setToken(null);
  };

  const refreshUser = async () => {
    if (!token) return null;
    try {
      const freshUser = await authService.getCurrentUser();
      setUser(freshUser);
      return freshUser;
    } catch {
      return null;
    }
  };

  const isAuthenticated = Boolean(token && user);
  const isAdmin = Boolean(user?.roles && user.roles.includes('ADMIN'));
  const isKycVerified = user?.kycStatus === 'VERIFIED';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        isAdmin,
        isKycVerified,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

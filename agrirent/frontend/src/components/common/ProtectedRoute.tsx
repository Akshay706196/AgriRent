import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KycGate } from './KycGate';

export interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requiredRole?: string;
  requireKyc?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requiredRole,
  requireKyc = false,
}) => {
  const { isAuthenticated, isAdmin, isKycVerified } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const needsAdmin = requireAdmin || requiredRole === 'ADMIN';
  if (needsAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireKyc && !isKycVerified) {
    return <KycGate />;
  }

  return <>{children}</>;
};

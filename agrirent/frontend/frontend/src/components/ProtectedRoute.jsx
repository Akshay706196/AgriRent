import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export const ProtectedRoute = ({ children, requireAdmin = false, requireKyc = false }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner fullScreen message="Checking authentication state..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && (!user?.roles || !user.roles.includes('ADMIN'))) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireKyc && user?.kycStatus !== 'VERIFIED') {
    return <Navigate to="/kyc" state={{ requireKycMessage: true }} replace />;
  }

  return children;
};

export default ProtectedRoute;

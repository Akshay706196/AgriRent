import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Public pages
import { LandingPage } from './features/public/LandingPage';
import { SearchPage } from './features/public/SearchPage';
import { EquipmentDetailPage } from './features/public/EquipmentDetailPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { KycPage } from './features/auth/KycPage';
import { ProfilePage } from './features/auth/ProfilePage';
import { NotFoundPage } from './features/public/NotFoundPage';

// Shared dashboard
import { DashboardPage } from './features/dashboard/DashboardPage';

// Renter pages
import { RenterBookingsPage } from './features/booking/RenterBookingsPage';
import { BookingDetailPage } from './features/booking/BookingDetailPage';
import { RequestBookingPage } from './features/booking/RequestBookingPage';
import { CheckoutPage } from './features/payment/CheckoutPage';

// Owner pages
import { MyEquipmentPage } from './features/equipment/MyEquipmentPage';
import { AddEquipmentPage } from './features/equipment/AddEquipmentPage';
import { EditEquipmentPage } from './features/equipment/EditEquipmentPage';
import { OwnerRequestsPage } from './features/booking/OwnerRequestsPage';

// Overview & Admin pages
import { BookingOverviewPage } from './features/overview/BookingOverviewPage';
import { AdminKycQueuePage } from './features/admin/AdminKycQueuePage';
import { AdminClaimsPage } from './features/admin/AdminClaimsPage';
import { AdminUsersPage } from './features/admin/AdminUsersPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Retry GETs up to 3 times on network errors or 502/503/504
        if (failureCount >= 3) return false;
        if (error?.status >= 500 && error?.status <= 504) return true;
        if (error?.message?.includes('Network') || error?.message?.includes('Failed to fetch')) return true;
        return false;
      },
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NotificationProvider>
            <AuthProvider>
              <MainLayout>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/equipment/:equipmentId" element={<EquipmentDetailPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  {/* Authenticated user routes */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <DashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/kyc"
                    element={
                      <ProtectedRoute>
                        <KycPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Renter routes */}
                  <Route
                    path="/renter/bookings"
                    element={
                      <ProtectedRoute>
                        <RenterBookingsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/renter/bookings/:bookingId"
                    element={
                      <ProtectedRoute>
                        <BookingDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/renter/request-booking"
                    element={
                      <ProtectedRoute>
                        <RequestBookingPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/payments/checkout"
                    element={
                      <ProtectedRoute>
                        <CheckoutPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Owner routes */}
                  <Route
                    path="/owner/equipment"
                    element={
                      <ProtectedRoute>
                        <MyEquipmentPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/equipment/new"
                    element={
                      <ProtectedRoute>
                        <AddEquipmentPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/equipment/:equipmentId/edit"
                    element={
                      <ProtectedRoute>
                        <EditEquipmentPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/owner/requests"
                    element={
                      <ProtectedRoute>
                        <OwnerRequestsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Shared Overview */}
                  <Route
                    path="/bookings/:bookingId/overview"
                    element={
                      <ProtectedRoute>
                        <BookingOverviewPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin routes */}
                  <Route
                    path="/admin/kyc"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <AdminKycQueuePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/claims"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <AdminClaimsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/users"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <AdminUsersPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* 404 Catch-All */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </MainLayout>
            </AuthProvider>
          </NotificationProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;

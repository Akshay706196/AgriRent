import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Layouts
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Components
import ProtectedRoute from './components/ProtectedRoute';

// Public Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import EquipmentList from './pages/EquipmentList';
import EquipmentDetails from './pages/EquipmentDetails';
import SearchEquipment from './pages/SearchEquipment';
import PlaceholderPage from './pages/PlaceholderPage';

// Protected Pages
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import KYC from './pages/KYC';
import AddEquipment from './pages/AddEquipment';
import EditEquipment from './pages/EditEquipment';
import MyEquipment from './pages/MyEquipment';
import CreateBooking from './pages/CreateBooking';
import MyBookings from './pages/MyBookings';
import BookingDetails from './pages/BookingDetails';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Main Public & General Layout */}
          <Route element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />

            {/* Public Equipment Browsing */}
            <Route path="equipment" element={<EquipmentList />} />
            <Route path="search" element={<SearchEquipment />} />

            {/* Protected Equipment Creation & Editing (Matched before equipment/:id) */}
            <Route
              path="equipment/new"
              element={
                <ProtectedRoute>
                  <AddEquipment />
                </ProtectedRoute>
              }
            />
            <Route
              path="equipment/add"
              element={
                <ProtectedRoute>
                  <AddEquipment />
                </ProtectedRoute>
              }
            />
            <Route
              path="equipment/:id/edit"
              element={
                <ProtectedRoute>
                  <EditEquipment />
                </ProtectedRoute>
              }
            />

            {/* Public Equipment Details by ID */}
            <Route path="equipment/:id" element={<EquipmentDetails />} />

            {/* Future Services Roadmap Placeholders */}
            <Route path="placeholders/:serviceId" element={<PlaceholderPage />} />

            {/* Protected Booking Actions */}
            <Route
              path="bookings/new"
              element={
                <ProtectedRoute>
                  <CreateBooking />
                </ProtectedRoute>
              }
            />
            <Route
              path="bookings/:id"
              element={
                <ProtectedRoute>
                  <BookingDetails />
                </ProtectedRoute>
              }
            />

            {/* Protected Farmer Control Center Sub-Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="my-equipment" element={<MyEquipment />} />
              <Route path="my-bookings" element={<MyBookings />} />
              <Route path="kyc" element={<KYC />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Catch-all Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

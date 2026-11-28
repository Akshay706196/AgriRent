import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Tractor,
  Search,
  ShieldCheck,
  Calendar,
  Layers,
  PlusCircle,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Globe,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { useAuth, UserMode } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { useTranslation } from 'react-i18next';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, isAdmin, mode, setMode, logout, kycStatus, isKycVerified } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
    setLangOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-soft group-hover:bg-brand-700 transition-colors">
                <Tractor className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-extrabold text-slate-900 font-display tracking-tight flex items-center gap-1">
                  Agri<span className="text-brand-600">Rent</span>
                </span>
                <span className="hidden sm:block text-[10px] text-slate-500 font-medium tracking-wider uppercase">
                  Farm Equipment Marketplace
                </span>
              </div>
            </Link>

            {/* Mode Selector Pill (Renter / Owner / Admin) */}
            {isAuthenticated && (
              <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/60 text-xs font-semibold">
                <button
                  onClick={() => setMode('RENTER')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    mode === 'RENTER'
                      ? 'bg-white text-slate-900 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🌾 Renter Mode
                </button>
                <button
                  onClick={() => setMode('OWNER')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    mode === 'OWNER'
                      ? 'bg-earth-600 text-white shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🚜 Owner Mode
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setMode('ADMIN')}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      mode === 'ADMIN'
                        ? 'bg-purple-600 text-white shadow-sm font-bold'
                        : 'text-purple-700 hover:text-purple-900'
                    }`}
                  >
                    🛡️ Admin
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-slate-600">
            {mode === 'RENTER' && (
              <>
                <Link
                  to="/search"
                  className={`px-3.5 py-2 rounded-xl transition-colors ${
                    isActive('/search')
                      ? 'text-brand-700 bg-brand-50/70 font-semibold'
                      : 'hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Find Machinery
                </Link>
                {isAuthenticated && (
                  <>
                    <Link
                      to="/renter/bookings"
                      className={`px-3.5 py-2 rounded-xl transition-colors ${
                        isActive('/renter/bookings')
                          ? 'text-brand-700 bg-brand-50/70 font-semibold'
                          : 'hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      My Rentals
                    </Link>
                    <Link
                      to="/kyc"
                      className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors ${
                        isActive('/kyc')
                          ? 'text-brand-700 bg-brand-50/70 font-semibold'
                          : 'hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <span>KYC</span>
                      {isKycVerified ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      )}
                    </Link>
                  </>
                )}
              </>
            )}

            {mode === 'OWNER' && isAuthenticated && (
              <>
                <Link
                  to="/owner/equipment"
                  className={`px-3.5 py-2 rounded-xl transition-colors ${
                    isActive('/owner/equipment')
                      ? 'text-earth-700 bg-earth-50/70 font-semibold'
                      : 'hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  My Machinery
                </Link>
                <Link
                  to="/owner/requests"
                  className={`px-3.5 py-2 rounded-xl transition-colors ${
                    isActive('/owner/requests')
                      ? 'text-earth-700 bg-earth-50/70 font-semibold'
                      : 'hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Rental Requests
                </Link>
                <Link
                  to="/owner/equipment/new"
                  className="px-3.5 py-2 rounded-xl text-brand-700 bg-brand-50 font-semibold hover:bg-brand-100 flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  List Equipment
                </Link>
              </>
            )}

            {mode === 'ADMIN' && isAdmin && (
              <>
                <Link
                  to="/admin/kyc"
                  className={`px-3.5 py-2 rounded-xl transition-colors ${
                    isActive('/admin/kyc')
                      ? 'text-purple-700 bg-purple-50 font-semibold'
                      : 'hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  KYC Queue
                </Link>
                <Link
                  to="/admin/claims"
                  className={`px-3.5 py-2 rounded-xl transition-colors ${
                    isActive('/admin/claims')
                      ? 'text-purple-700 bg-purple-50 font-semibold'
                      : 'hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Claims Review
                </Link>
                <Link
                  to="/admin/users"
                  className={`px-3.5 py-2 rounded-xl transition-colors ${
                    isActive('/admin/users')
                      ? 'text-purple-700 bg-purple-50 font-semibold'
                      : 'hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Users
                </Link>
              </>
            )}

            <Link
              to="/dashboard"
              className={`px-3.5 py-2 rounded-xl transition-colors ${
                isActive('/dashboard')
                  ? 'text-brand-700 bg-brand-50/70 font-semibold'
                  : 'hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Dashboard
            </Link>
          </nav>

          {/* Right Actions: Language, User Profile / Auth */}
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl flex items-center gap-1 text-xs font-medium"
                title="Change language"
              >
                <Globe className="w-4 h-4" />
                <span className="uppercase">{i18n.language?.slice(0, 2) || 'en'}</span>
              </button>

              {langOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-white rounded-2xl shadow-elevated border border-slate-100 py-2 z-50 animate-in zoom-in-95">
                  <button
                    onClick={() => handleLanguageChange('en')}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>English</span>
                    {i18n.language === 'en' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />}
                  </button>
                  <button
                    onClick={() => handleLanguageChange('hi')}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>हिन्दी (Hindi)</span>
                    {i18n.language === 'hi' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />}
                  </button>
                  <button
                    onClick={() => handleLanguageChange('gu')}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>ગુજરાતી (Gujarati)</span>
                    {i18n.language === 'gu' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />}
                  </button>
                </div>
              )}
            </div>

            {/* Auth Buttons or Profile Menu */}
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-2xl hover:bg-slate-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 font-bold text-xs flex items-center justify-center">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                      {user.name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {user.phone || user.email}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-elevated border border-slate-100 py-2 z-50 animate-in zoom-in-95">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{user.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Badge status={kycStatus} size="sm" />
                      </div>
                    </div>

                    <div className="py-1">
                      <Link
                        to="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <UserIcon className="w-4 h-4 text-slate-400" />
                        Account Profile
                      </Link>
                      <Link
                        to="/kyc"
                        onClick={() => setProfileOpen(false)}
                        className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                        KYC Status
                      </Link>
                    </div>

                    <div className="pt-1 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          logout();
                          navigate('/login');
                        }}
                        className="w-full px-4 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-soft transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

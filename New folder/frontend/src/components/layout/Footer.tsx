import React from 'react';
import { Tractor, Shield, KeyRound, Banknote, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Trust Badges Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-12 border-b border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-brand-900/60 text-brand-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Verified Farmers & KYC</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Every machinery owner and renter is verified via Aadhaar/Government ID before any booking.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-earth-900/60 text-earth-400 flex items-center justify-center shrink-0">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Escrow Security Deposit</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Security deposits are held in cryptographic escrow and only settled once return is verified.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-900/60 text-amber-400 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Cryptographic 6-Digit PINs</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Machinery handovers and returns are secured by dynamic one-time verification PINs.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center">
                <Tractor className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-white font-display">AgriRent</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              India's premier peer-to-peer agricultural machinery rental network empowering farming communities.
            </p>
          </div>

          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Renting</h5>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><a href="/search?category=TRACTOR" className="hover:text-white transition-colors">Rent Tractors</a></li>
              <li><a href="/search?category=HARVESTER" className="hover:text-white transition-colors">Rent Harvesters</a></li>
              <li><a href="/search?category=ROTAVATOR" className="hover:text-white transition-colors">Rent Rotavators</a></li>
              <li><a href="/search?category=SEEDER" className="hover:text-white transition-colors">Rent Seeders</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Machinery Owners</h5>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><a href="/owner/equipment/new" className="hover:text-white transition-colors">List Your Machinery</a></li>
              <li><a href="/kyc" className="hover:text-white transition-colors">KYC Verification</a></li>
              <li><a href="/dashboard" className="hover:text-white transition-colors">Rental Management</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Microservices Architecture</h5>
            <ul className="space-y-2 text-xs text-slate-400 font-mono">
              <li>Identity & KYC (:4003)</li>
              <li>Equipment Service (:4001)</li>
              <li>Booking Service (:4002)</li>
              <li>Payment & Deposit (:4004)</li>
              <li>Handover & Return (:4005)</li>
              <li>Claims & Reviews (:4006)</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} AgriRent India. Built for agricultural prosperity.</p>
          <p className="flex items-center gap-1">
            Empowering Indian Agriculture with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          </p>
        </div>
      </div>
    </footer>
  );
};

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Plus, Image as ImageIcon, ShieldAlert, Check } from 'lucide-react';
import { equipmentApi } from '../../api/equipment.api';
import { Button } from '../../components/ui/Button';
import { KycGate } from '../../components/common/KycGate';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey';
import { ApiError } from '../../api/errors';

// Preset agricultural equipment images for Indian farms
const PRESET_PHOTOS = [
  { label: 'Mahindra 575 DI Tractor', url: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80' },
  { label: 'John Deere Green Tractor', url: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=600&q=80' },
  { label: 'Combine Harvester Field', url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80' },
  { label: 'Rotary Tiller Cultivator', url: 'https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=600&q=80' },
];

export const AddEquipmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { key: idempotencyKey, refreshKey } = useIdempotencyKey('create-equipment');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('TRACTOR');
  const [condition, setCondition] = useState('GOOD');
  const [perDay, setPerDay] = useState<number>(2500);
  const [securityDeposit, setSecurityDeposit] = useState<number>(5000);
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('Anand');
  const [state, setState] = useState('Gujarat');
  const [pincode, setPincode] = useState('388001');
  const [hp, setHp] = useState<number>(50);
  const [fuelType, setFuelType] = useState('DIESEL');
  const [selectedPhoto, setSelectedPhoto] = useState(PRESET_PHOTOS[0].url);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const photos = customPhotoUrl.trim() ? [customPhotoUrl.trim(), selectedPhoto] : [selectedPhoto];
      return equipmentApi.createEquipment(
        {
          title: title.trim(),
          category,
          condition,
          pricing: {
            perDay: Number(perDay),
            securityDeposit: Number(securityDeposit),
          },
          location: {
            address: address.trim(),
            district: district.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
          },
          specs: {
            hp: Number(hp),
            fuelType,
          },
          photos,
        },
        idempotencyKey
      );
    },
    onSuccess: (data) => {
      showNotification('success', 'Farm equipment listed successfully!');
      navigate('/owner/equipment');
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        if (err.code === 'KYC_REQUIRED') {
          setErrorMsg('You must complete and verify your KYC before listing machinery.');
        } else {
          setErrorMsg(err.friendlyMessage);
        }
        showNotification('error', err.friendlyMessage, err.correlationId);
      } else {
        setErrorMsg(err.message || 'Failed to list equipment.');
        showNotification('error', err.message);
      }
      refreshKey();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!title.trim()) {
      setErrorMsg('Equipment title is required.');
      return;
    }
    if (perDay <= 0) {
      setErrorMsg('Daily rate must be greater than ₹0.');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <Link
        to="/owner/equipment"
        className="inline-flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to My Equipment
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-earth-900">
          List Machinery for Rent
        </h1>
        <p className="text-earth-600 text-sm mt-1">
          Specify machinery details, daily rental rates, security deposit, and pickup location.
        </p>
      </div>

      <div className="mb-6">
        <KycGate actionName="list farm machinery" />
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-earth-200 shadow-soft space-y-6">
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start">
            <ShieldAlert className="w-5 h-5 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Basic Details */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-earth-700 uppercase tracking-wider">
            Basic Equipment Information
          </h2>

          <div>
            <label className="block text-xs font-semibold text-earth-700 mb-1">
              Equipment Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mahindra 575 DI 45 HP Tractor with Cultivator"
              className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-earth-700 mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              >
                <option value="TRACTOR">Tractor</option>
                <option value="HARVESTER">Combine Harvester</option>
                <option value="TILLER">Rotary Tiller / Rotavator</option>
                <option value="SEEDER">Seeder / Planter</option>
                <option value="SPRAYER">Sprayer / Duster</option>
                <option value="OTHER">Other Implements</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-earth-700 mb-1">
                Machinery Condition *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              >
                <option value="EXCELLENT">Excellent (Under 3 years / well maintained)</option>
                <option value="GOOD">Good (Regularly serviced, minor cosmetic wear)</option>
                <option value="FAIR">Fair (Working condition, higher engine hours)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="border-t border-earth-200 pt-6 space-y-4">
          <h2 className="text-sm font-bold text-earth-700 uppercase tracking-wider">
            Pricing & Security Deposit (INR)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-earth-700 mb-1">
                Daily Rental Rate (₹/day) *
              </label>
              <input
                type="number"
                min="100"
                step="50"
                value={perDay}
                onChange={(e) => setPerDay(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-earth-700 mb-1">
                Refundable Security Deposit (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={securityDeposit}
                onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                required
              />
              <span className="text-xs text-earth-500 mt-1 block">
                Held in escrow during rental to cover potential damage claims.
              </span>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="border-t border-earth-200 pt-6 space-y-4">
          <h2 className="text-sm font-bold text-earth-700 uppercase tracking-wider">
            Pickup Location
          </h2>

          <div>
            <label className="block text-xs font-semibold text-earth-700 mb-1">
              Farm / Village Street Address *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Village Mogar, Near Amul Dairy Road"
              className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-earth-700 mb-1">District *</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-earth-700 mb-1">State *</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-earth-700 mb-1">Pincode *</label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                required
              />
            </div>
          </div>
        </div>

        {/* Photos selection */}
        <div className="border-t border-earth-200 pt-6 space-y-4">
          <h2 className="text-sm font-bold text-earth-700 uppercase tracking-wider">
            Machinery Photo
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PRESET_PHOTOS.map((preset) => (
              <div
                key={preset.url}
                onClick={() => setSelectedPhoto(preset.url)}
                className={`cursor-pointer rounded-xl border-2 overflow-hidden transition-all relative ${
                  selectedPhoto === preset.url ? 'border-emerald-600 ring-2 ring-emerald-400' : 'border-earth-200'
                }`}
              >
                <img src={preset.url} alt={preset.label} className="w-full h-24 object-cover" />
                <div className="p-1.5 bg-white text-center">
                  <span className="text-[10px] font-semibold text-earth-700 truncate block">
                    {preset.label}
                  </span>
                </div>
                {selectedPhoto === preset.url && (
                  <div className="absolute top-1 right-1 bg-emerald-600 text-white rounded-full p-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-earth-700 mb-1">
              Or Custom Photo HTTPS URL
            </label>
            <input
              type="url"
              value={customPhotoUrl}
              onChange={(e) => setCustomPhotoUrl(e.target.value)}
              placeholder="https://images.example.com/tractor.jpg"
              className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
        </div>

        <div className="border-t border-earth-200 pt-6 flex justify-end space-x-3">
          <Link to="/owner/equipment">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={createMutation.isPending}
            disabled={user?.kycStatus !== 'VERIFIED'}
          >
            Publish Equipment Listing
          </Button>
        </div>
      </form>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { equipmentApi } from '../../api/equipment.api';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useNotification } from '../../context/NotificationContext';
import { ApiError } from '../../api/errors';

export const EditEquipmentPage: React.FC = () => {
  const { equipmentId } = useParams<{ equipmentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  const [title, setTitle] = useState('');
  const [condition, setCondition] = useState('GOOD');
  const [perDay, setPerDay] = useState<number>(0);
  const [securityDeposit, setSecurityDeposit] = useState<number>(0);
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch current equipment
  const { data: equipment, isLoading } = useQuery({
    queryKey: ['equipment', equipmentId],
    queryFn: () => equipmentApi.getEquipmentById(equipmentId!),
    enabled: !!equipmentId,
  });

  useEffect(() => {
    if (equipment) {
      setTitle(equipment.title || '');
      setCondition(equipment.condition || 'GOOD');
      setPerDay(equipment.pricing?.perDay || 0);
      setSecurityDeposit(equipment.pricing?.securityDeposit || 0);
      setAddress(equipment.location?.address || '');
      setDistrict(equipment.location?.district || '');
      setState(equipment.location?.state || '');
    }
  }, [equipment]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      return equipmentApi.updateEquipment(equipmentId!, {
        title: title.trim(),
        condition,
        pricing: {
          perDay: Number(perDay),
          securityDeposit: Number(securityDeposit),
        },
        location: {
          address: address.trim(),
          district: district.trim(),
          state: state.trim(),
          pincode: equipment?.location?.pincode || '388001',
        },
      });
    },
    onSuccess: () => {
      showNotification('success', 'Equipment details updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['equipment', equipmentId] });
      queryClient.invalidateQueries({ queryKey: ['my-equipment'] });
      navigate('/owner/equipment');
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        if (err.code === 'NOT_EQUIPMENT_OWNER') {
          setErrorMsg('You do not have permission to modify machinery listed by another owner.');
        } else {
          setErrorMsg(err.friendlyMessage);
        }
        showNotification('error', err.friendlyMessage, err.correlationId);
      } else {
        setErrorMsg(err.message || 'Failed to update equipment.');
        showNotification('error', err.message);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    updateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

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
          Edit Equipment Listing
        </h1>
        <p className="text-earth-600 text-sm mt-1">
          Update machinery pricing, condition, or pickup location.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-earth-200 shadow-soft space-y-6">
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start">
            <ShieldAlert className="w-5 h-5 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-earth-700 mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-earth-700 mb-1">Condition *</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          >
            <option value="EXCELLENT">Excellent</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-earth-700 mb-1">
              Daily Rate (₹/day) *
            </label>
            <input
              type="number"
              value={perDay}
              onChange={(e) => setPerDay(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-earth-700 mb-1">
              Security Deposit (₹) *
            </label>
            <input
              type="number"
              value={securityDeposit}
              onChange={(e) => setSecurityDeposit(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-earth-700 mb-1">
            Pickup Address *
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            required
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-earth-200">
          <Link to="/owner/equipment">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" variant="primary" isLoading={updateMutation.isPending}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};

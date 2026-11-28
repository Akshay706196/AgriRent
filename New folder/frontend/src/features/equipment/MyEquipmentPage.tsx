import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, MapPin, Tag, AlertCircle } from 'lucide-react';
import { equipmentApi } from '../../api/equipment.api';
import { Equipment } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { KycGate } from '../../components/common/KycGate';
import { formatINR } from '../../utils/formatCurrency';
import { useNotification } from '../../context/NotificationContext';

export const MyEquipmentPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);

  const { data: myEquipment, isLoading, error, refetch } = useQuery({
    queryKey: ['my-equipment'],
    queryFn: () => equipmentApi.getMyEquipment(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => equipmentApi.deleteEquipment(id),
    onSuccess: () => {
      showNotification('success', 'Equipment listing deleted.');
      setEquipmentToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['my-equipment'] });
    },
    onError: (err: any) => {
      showNotification('error', err.friendlyMessage || err.message || 'Failed to delete equipment.');
    },
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-earth-900">
            My Equipment Listings
          </h1>
          <p className="text-earth-600 text-sm mt-1">
            Manage your tractors, harvesters, tillers, and machinery available for rent.
          </p>
        </div>
        <Link to="/owner/equipment/new">
          <Button variant="primary" size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            List New Equipment
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <KycGate actionName="list farm machinery for rent" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
          <p className="font-semibold">Unable to load your equipment listings.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            Retry
          </Button>
        </div>
      ) : (myEquipment || []).length === 0 ? (
        <EmptyState
          title="No machinery listed yet"
          description="Monetize your tractors, rotavators, and harvesters by renting to nearby farmers in your district."
          actionLabel="List Your First Machine"
          onAction={() => window.location.assign('/owner/equipment/new')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(myEquipment || []).map((item) => (
            <div
              key={item.equipmentId}
              className="bg-white rounded-2xl border border-earth-200 shadow-soft overflow-hidden hover:shadow-card hover:border-earth-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="h-44 relative bg-earth-100">
                  <img
                    src={item.photos?.[0] || 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80'}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3">
                    <Badge status={item.status || 'AVAILABLE'} />
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center space-x-1.5 text-xs text-earth-500 mb-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{item.category}</span>
                    <span>•</span>
                    <span>{item.condition}</span>
                  </div>

                  <h3 className="font-bold text-earth-900 text-lg leading-tight mb-2 line-clamp-1">
                    {item.title}
                  </h3>

                  <div className="flex items-center text-xs text-earth-600 mb-4">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-earth-400 flex-shrink-0" />
                    <span className="line-clamp-1">
                      {item.location?.district}, {item.location?.state}
                    </span>
                  </div>

                  <div className="bg-earth-50 rounded-xl p-3 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-earth-500 block">Daily Rate</span>
                      <span className="font-extrabold text-emerald-800 text-sm">
                        {formatINR(item.pricing?.perDay || 0)}/day
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-earth-500 block">Security Deposit</span>
                      <span className="font-bold text-earth-900 text-sm">
                        {formatINR(item.pricing?.securityDeposit || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-earth-100 flex items-center justify-between bg-earth-50/50">
                <Link
                  to={`/equipment/${item.equipmentId}`}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  View Public Page
                </Link>

                <div className="flex items-center space-x-2">
                  <Link to={`/owner/equipment/${item.equipmentId}/edit`}>
                    <Button variant="outline" size="sm">
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEquipmentToDelete(item)}
                    className="text-red-700 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      {equipmentToDelete && (
        <ConfirmationDialog
          isOpen={!!equipmentToDelete}
          onClose={() => setEquipmentToDelete(null)}
          onConfirm={() => deleteMutation.mutate(equipmentToDelete.equipmentId)}
          title="Delete Machinery Listing"
          description={`Are you sure you want to delete "${equipmentToDelete.title}"? Active bookings cannot be deleted.`}
          confirmText="Delete Listing"
          variant="danger"
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
};

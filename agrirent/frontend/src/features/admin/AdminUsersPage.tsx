import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserX, UserCheck, ShieldAlert, AlertTriangle, Shield } from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { User } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { useNotification } from '../../context/NotificationContext';
import { formatDateTime } from '../../utils/formatDate';

export const AdminUsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  const [searchUserId, setSearchUserId] = useState('USR101');
  const [activeUserId, setActiveUserId] = useState<string | null>('USR101');
  const [actionType, setActionType] = useState<'BLOCK' | 'SUSPEND' | null>(null);
  const [actionReason, setActionReason] = useState('');

  const { data: user, isLoading, error, refetch } = useQuery<User>({
    queryKey: ['admin-user-details', activeUserId],
    queryFn: () => authApi.getUserDetails(activeUserId!),
    enabled: !!activeUserId,
    retry: false,
  });

  const blockMutation = useMutation({
    mutationFn: () => authApi.blockUser(activeUserId!, actionReason || 'Violation of terms'),
    onSuccess: () => {
      showNotification('success', `User ${activeUserId} has been BLOCKED.`);
      setActionType(null);
      setActionReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-user-details', activeUserId] });
    },
    onError: (err: any) => {
      showNotification('error', err.friendlyMessage || err.message || 'Failed to block user.');
    },
  });

  const suspendMutation = useMutation({
    mutationFn: () => authApi.suspendUser(activeUserId!, actionReason || 'Temporary administrative hold'),
    onSuccess: () => {
      showNotification('success', `User ${activeUserId} has been SUSPENDED.`);
      setActionType(null);
      setActionReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-user-details', activeUserId] });
    },
    onError: (err: any) => {
      showNotification('error', err.friendlyMessage || err.message || 'Failed to suspend user.');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => authApi.restoreUser(activeUserId!),
    onSuccess: () => {
      showNotification('success', `User ${activeUserId} has been RESTORED to ACTIVE.`);
      queryClient.invalidateQueries({ queryKey: ['admin-user-details', activeUserId] });
    },
    onError: (err: any) => {
      showNotification('error', err.friendlyMessage || err.message || 'Failed to restore user.');
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchUserId.trim()) {
      setActiveUserId(searchUserId.trim());
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-earth-900">
          User Account Administration
        </h1>
        <p className="text-earth-600 text-sm mt-1">
          Look up platform farmers by User ID, inspect KYC and credential statuses, and manage access privileges.
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-3 text-earth-400" />
            <input
              type="text"
              value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}
              placeholder="Enter User ID (e.g. USR101, USR102)..."
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-earth-300 rounded-xl text-earth-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-soft"
              required
            />
          </div>
          <Button type="submit" variant="primary">
            Search User
          </Button>
        </div>
      </form>

      {/* User Details Card */}
      {isLoading ? (
        <div className="p-8 bg-white rounded-2xl border border-earth-200 shadow-soft">
          <p className="text-earth-500 text-sm">Loading user account record...</p>
        </div>
      ) : error || !user ? (
        <div className="p-8 bg-earth-50 border border-earth-200 rounded-2xl text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h3 className="font-bold text-earth-900">User Not Found</h3>
          <p className="text-xs text-earth-600 mt-1">
            Could not find user record matching ID "{activeUserId}".
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-earth-200 shadow-soft space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-earth-100 pb-5">
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <h2 className="text-xl font-bold text-earth-900">{user.name || 'AgriRent Farmer'}</h2>
                <Badge status={user.accountStatus || 'ACTIVE'} />
                <Badge status={user.kycStatus || 'NOT_SUBMITTED'} />
              </div>
              <p className="text-xs text-earth-500 font-mono">User ID: #{user.userId}</p>
            </div>

            {/* Status Change Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {user.accountStatus !== 'ACTIVE' ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => restoreMutation.mutate()}
                  isLoading={restoreMutation.isPending}
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1" />
                  Restore Account
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActionType('SUSPEND')}
                    className="text-amber-700 border-amber-300 hover:bg-amber-50"
                  >
                    Suspend User
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActionType('BLOCK')}
                    className="text-red-700 border-red-300 hover:bg-red-50"
                  >
                    <UserX className="w-3.5 h-3.5 mr-1" />
                    Block User
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-earth-50 rounded-xl p-3.5 space-y-1">
              <span className="text-xs font-semibold text-earth-500 block">Contact Information</span>
              <p className="text-earth-900">Email: {user.email || 'None'}</p>
              <p className="text-earth-900">Phone: {user.phone || 'None'}</p>
            </div>
            <div className="bg-earth-50 rounded-xl p-3.5 space-y-1">
              <span className="text-xs font-semibold text-earth-500 block">Account Role</span>
              <p className="text-earth-900 font-bold uppercase">
                {user.roles && user.roles.length > 0 ? user.roles.join(', ') : 'USER'}
              </p>
              <p className="text-xs text-earth-500">
                Registered on {formatDateTime(user.createdAt || new Date().toISOString())}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Block/Suspend Confirmation Modal */}
      {actionType && (
        <ConfirmationDialog
          isOpen={!!actionType}
          onClose={() => setActionType(null)}
          onConfirm={() => {
            if (actionType === 'BLOCK') blockMutation.mutate();
            if (actionType === 'SUSPEND') suspendMutation.mutate();
          }}
          title={`${actionType === 'BLOCK' ? 'Block' : 'Suspend'} Farmer Account`}
          description={`Are you sure you want to ${actionType.toLowerCase()} user ${activeUserId}? This will revoke rental privileges.`}
          confirmText={`Confirm ${actionType}`}
          variant="danger"
          isLoading={blockMutation.isPending || suspendMutation.isPending}
        >
          <div className="mt-3">
            <label className="block text-xs font-semibold text-earth-700 mb-1">
              Administrative reason *
            </label>
            <input
              type="text"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Failure to return machinery, unpaid dispute"
              className="w-full px-3 py-2 bg-earth-50 border border-earth-300 rounded-lg text-sm text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
        </ConfirmationDialog>
      )}
    </div>
  );
};

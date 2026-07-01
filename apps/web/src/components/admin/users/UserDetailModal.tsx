'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fmtDate } from '../../../lib/formatters';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { StatusBadge } from '../StatusBadge';
import { adminApi, AdminUser } from '../../../lib/admin-api';

interface UserDetailModalProps {
  user: AdminUser | null;
  onClose: () => void;
}

export function UserDetailModal({ user, onClose }: UserDetailModalProps) {
  const queryClient = useQueryClient();

  const blockMutation = useMutation({
    mutationFn: (isBlocked: boolean) => adminApi.users.blockToggle(user!.id, isBlocked),
    onSuccess: (_data, isBlocked) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(isBlocked ? 'User blocked' : 'User unblocked');
    },
    onError: () => toast.error('Failed to update user status'),
  });

  if (!user) return null;

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* User Info */}
          <div className="flex items-center gap-4">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-14 h-14 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-lg font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-900 text-lg">{user.name}</p>
              {user.email && <p className="text-sm text-slate-500">{user.email}</p>}
              {user.phone && <p className="text-sm text-slate-500">{user.phone}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs capitalize">
              {user.role.replace('_', ' ')}
            </Badge>
            {user.isBlocked && (
              <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">
                Blocked
              </Badge>
            )}
            <span className="text-xs text-slate-400">
              Joined {fmtDate(user.createdAt)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{user._count?.orders ?? 0}</p>
              <p className="text-xs text-slate-500">Total Orders</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">
                {user.isVerified ? 'Yes' : 'No'}
              </p>
              <p className="text-xs text-slate-500">Verified</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              className={
                user.isBlocked
                  ? 'border-green-300 text-green-700 hover:bg-green-50'
                  : 'border-red-300 text-red-600 hover:bg-red-50'
              }
              disabled={blockMutation.isPending}
              onClick={() => {
                const msg = user.isBlocked
                  ? 'Unblock this user?'
                  : 'Block this user? They will not be able to log in.';
                if (confirm(msg)) {
                  blockMutation.mutate(!user.isBlocked);
                }
              }}
            >
              {blockMutation.isPending
                ? 'Updating...'
                : user.isBlocked
                ? 'Unblock User'
                : 'Block User'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

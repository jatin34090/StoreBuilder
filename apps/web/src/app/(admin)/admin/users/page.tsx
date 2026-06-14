'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Search,
  UserCheck,
  UserX,
  Shield,
  ShoppingBag,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../components/ui/dialog';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { TableSkeleton } from '../../../../components/admin/LoadingSkeleton';
import { adminUsersApi, type AdminUser } from '../../../../lib/admin-api';
import { useDebounce } from '../../../../hooks/useDebounce';

const ROLE_COLORS: Record<string, string> = {
  CUSTOMER: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-purple-100 text-purple-700',
  DELIVERY_AGENT: 'bg-orange-100 text-orange-700',
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [confirmUser, setConfirmUser] = useState<AdminUser | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'users', debouncedSearch, roleFilter, page],
    queryFn: async () => {
      const res = await adminUsersApi.list({
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        page,
        limit: 15,
      });
      return res.data;
    },
  });

  const users: AdminUser[] = (data as { items?: AdminUser[]; data?: AdminUser[] } | undefined)
    ?.items ??
    (data as { items?: AdminUser[]; data?: AdminUser[] } | undefined)?.data ??
    (Array.isArray(data) ? (data as AdminUser[]) : []);
  const total: number = (data as { total?: number } | undefined)?.total ?? users.length;

  const blockMutation = useMutation({
    mutationFn: ({ id, isBlocked }: { id: string; isBlocked: boolean }) =>
      adminUsersApi.blockToggle(id, isBlocked),
    onSuccess: (_, { isBlocked }) => {
      toast.success(isBlocked ? 'User blocked successfully' : 'User unblocked successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setConfirmUser(null);
    },
    onError: () => toast.error('Failed to update user status'),
  });

  const totalPages = Math.ceil(total / 15);

  return (
    <div>
      <PageHeader
        title="Users"
        description={`${total} registered users`}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        >
          <option value="">All Roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="ADMIN">Admin</option>
          <option value="DELIVERY_AGENT">Delivery Agent</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={10} cols={7} />
      ) : isError ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 mb-4">Failed to load users.</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Orders</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Spent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      No users found
                    </td>
                  </tr>
                ) : users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-xs flex-shrink-0">
                          {user.name?.[0]?.toUpperCase() ?? 'U'}
                        </div>
                        <span className="font-medium text-slate-800">{user.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      <div>{user.email ?? '—'}</div>
                      <div className="text-xs">{user.phone ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] ?? 'bg-slate-100 text-slate-700'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-600">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        {user.totalOrders ?? 0}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      ₹{((user.totalSpent ?? 0) / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {user.createdAt ? format(new Date(user.createdAt), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {user.isBlocked ? (
                        <Badge className="bg-red-100 text-red-700 border-0 text-xs">Blocked</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-0 text-xs">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmUser(user)}
                        disabled={user.role === 'ADMIN'}
                        className={`h-7 text-xs ${user.isBlocked ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-red-600 border-red-200 hover:bg-red-50'}`}
                      >
                        {user.isBlocked ? (
                          <><UserCheck className="w-3.5 h-3.5 mr-1" />Unblock</>
                        ) : (
                          <><UserX className="w-3.5 h-3.5 mr-1" />Block</>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of {total} users
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                <span className="text-sm text-slate-600">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Block/Unblock Confirmation Dialog */}
      <Dialog open={!!confirmUser} onOpenChange={() => setConfirmUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              {confirmUser?.isBlocked ? 'Unblock User' : 'Block User'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to {confirmUser?.isBlocked ? 'unblock' : 'block'}{' '}
            <strong>{confirmUser?.name}</strong>?
            {!confirmUser?.isBlocked && (
              <span className="block mt-2 text-red-600">
                This will prevent them from logging in or placing orders.
              </span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUser(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (confirmUser) {
                  blockMutation.mutate({ id: confirmUser.id, isBlocked: !confirmUser.isBlocked });
                }
              }}
              disabled={blockMutation.isPending}
              className={confirmUser?.isBlocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {blockMutation.isPending ? 'Updating...' : confirmUser?.isBlocked ? 'Unblock' : 'Block'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

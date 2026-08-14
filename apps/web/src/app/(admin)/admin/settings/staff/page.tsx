'use client';

import { useEffect, useState } from 'react';
import { UserCheck, UserPlus, MoreVertical, RefreshCw, UserMinus, ChevronDown } from 'lucide-react';
import { adminStoreApi, type StaffMember } from '../../../../../lib/admin-api';
import { useAdminAuthStore } from '../../../../../store/adminAuthStore';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:  'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  INACTIVE:'bg-slate-100 text-slate-500',
};

const INVITABLE_ROLES = ['ADMIN', 'MANAGER', 'STAFF'] as const;
type InvitableRole = typeof INVITABLE_ROLES[number];

export default function StaffPage() {
  const hasPermission = useAdminAuthStore((s) => s.hasPermission);
  const adminRole     = useAdminAuthStore((s) => s.adminRole);

  const [members, setMembers]         = useState<StaffMember[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [actionMenu, setActionMenu]   = useState<string | null>(null); // userId

  const canInvite = hasPermission('staff.invite');
  const canUpdate = hasPermission('staff.update');
  const canRemove = hasPermission('staff.remove');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminStoreApi.listStaff();
      setMembers(Array.isArray(res) ? res : []);
    } catch {
      setError('Failed to load staff members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await adminStoreApi.updateStaffRole(userId, role as 'ADMIN' | 'MANAGER' | 'STAFF');
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to update role.');
    }
    setActionMenu(null);
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm('Deactivate this staff member?')) return;
    try {
      await adminStoreApi.removeStaff(userId);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to deactivate member.');
    }
    setActionMenu(null);
  };

  const handleResend = async (userId: string) => {
    try {
      await adminStoreApi.resendInvite(userId);
      alert('Invitation resent.');
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to resend invitation.');
    }
    setActionMenu(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-primary" />
            Staff Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage your store team and their permissions.</p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            <UserPlus className="w-4 h-4" />
            Invite Staff
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No staff members yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Member</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Role</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600">Joined</th>
                {(canUpdate || canRemove) && (
                  <th className="px-6 py-3" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{m.user?.name ?? m.invitationEmail ?? '—'}</p>
                      <p className="text-slate-500 text-xs">{m.user?.email ?? m.invitationEmail}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {canUpdate && m.role !== 'OWNER' ? (
                      <RoleSelect
                        value={m.role}
                        onChange={(r) => handleRoleChange(m.userId, r)}
                        disabled={adminRole === 'STAFF' || adminRole === 'MANAGER'}
                      />
                    ) : (
                      <span className="text-slate-700 font-medium">{ROLE_LABELS[m.role] ?? m.role}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[m.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : m.invitedAt ? `Invited ${new Date(m.invitedAt).toLocaleDateString()}` : '—'}
                  </td>
                  {(canUpdate || canRemove) && (
                    <td className="px-6 py-4 text-right relative">
                      {m.role !== 'OWNER' && (
                        <>
                          <button
                            onClick={() => setActionMenu(actionMenu === m.userId ? null : m.userId)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {actionMenu === m.userId && (
                            <ActionMenu
                              member={m}
                              canUpdate={canUpdate}
                              canRemove={canRemove}
                              onRoleChange={handleRoleChange}
                              onDeactivate={handleDeactivate}
                              onResend={handleResend}
                              onClose={() => setActionMenu(null)}
                            />
                          )}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => { setShowInviteModal(false); load(); }}
        />
      )}
    </div>
  );
}

function RoleSelect({ value, onChange, disabled }: {
  value: string;
  onChange: (r: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none bg-slate-50 border border-slate-200 rounded-md pl-3 pr-8 py-1 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 cursor-pointer"
      >
        {INVITABLE_ROLES.map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
    </div>
  );
}

function ActionMenu({ member, canUpdate, canRemove, onRoleChange, onDeactivate, onResend, onClose }: {
  member: StaffMember;
  canUpdate: boolean;
  canRemove: boolean;
  onRoleChange: (userId: string, role: string) => void;
  onDeactivate: (userId: string) => void;
  onResend: (userId: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-6 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
        {member.status === 'PENDING' && canUpdate && (
          <button
            onClick={() => { onResend(member.userId); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Resend Invite
          </button>
        )}
        {member.status !== 'INACTIVE' && canRemove && (
          <button
            onClick={() => { onDeactivate(member.userId); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
          >
            <UserMinus className="w-3.5 h-3.5" />
            Deactivate
          </button>
        )}
      </div>
    </>
  );
}

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole]   = useState<InvitableRole>('STAFF');
  const [name, setName]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await adminStoreApi.inviteStaff({ email, role, name: name || undefined });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to send invitation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Invite Staff Member</h2>
          <p className="text-slate-500 text-sm mt-0.5">Send an invitation to join your store team.</p>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Their name"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as InvitableRole)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 transition"
            >
              {loading ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

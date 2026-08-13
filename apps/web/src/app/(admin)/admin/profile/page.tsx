'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, Lock, User, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminAuthStore } from '@/store/adminAuthStore';
import { api } from '@/lib/api';

const profileSchema = z.object({
  name:  z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path:    ['confirmPassword'],
  });

type ProfileForm  = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function AdminProfilePage() {
  const { adminUser, setAdminAuth } = useAdminAuthStore();
  const [profileLoading,  setProfileLoading]  = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const profileForm = useForm<ProfileForm>({
    resolver:      zodResolver(profileSchema),
    defaultValues: { name: adminUser?.name ?? '', email: adminUser?.email ?? '' },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver:      zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSaveProfile = async (data: ProfileForm) => {
    setProfileLoading(true);
    try {
      const res     = await api.patch('/users/me', data);
      const updated = res.data?.data ?? res.data;
      setAdminAuth({
        id:     updated.id ?? adminUser!.id,
        name:   updated.name,
        email:  updated.email,
        role:   'ADMIN',
        avatar: updated.avatar ?? adminUser?.avatar,
      });
      toast.success('Profile updated');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update profile';
      toast.error(msg);
    } finally {
      setProfileLoading(false);
    }
  };

  const onChangePassword = async (data: PasswordForm) => {
    setPasswordLoading(true);
    try {
      await api.patch('/users/me/password', {
        currentPassword: data.currentPassword,
        newPassword:     data.newPassword,
      });
      toast.success('Password changed successfully');
      passwordForm.reset();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to change password';
      toast.error(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const initials = adminUser?.name
    ? adminUser.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AD';

  return (
    <div className="p-6 max-w-2xl">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account credentials</p>
      </div>

      {/* Avatar + name banner */}
      <div className="flex items-center gap-4 mb-8 p-5 rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold flex-shrink-0">
          {adminUser?.avatar
            ? <img src={adminUser.avatar} alt={adminUser.name} className="w-16 h-16 rounded-2xl object-cover" />
            : initials}
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{adminUser?.name ?? 'Admin'}</p>
          <p className="text-sm text-gray-400">{adminUser?.email}</p>
          <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-primary bg-primary/8 px-2 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3" /> Administrator
          </span>
        </div>
      </div>

      <div className="space-y-5">

        {/* ── Account Details ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Account Details</p>
              <p className="text-xs text-gray-400">Update your name and email</p>
            </div>
          </div>
          <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Full Name
                </Label>
                <Input
                  id="name"
                  placeholder="Your full name"
                  className="h-10 text-sm border-gray-200 focus:border-primary focus:ring-primary/20"
                  {...profileForm.register('name')}
                />
                {profileForm.formState.errors.name && (
                  <p className="text-red-500 text-xs">{profileForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@yourbrand.com"
                  className="h-10 text-sm border-gray-200 focus:border-primary focus:ring-primary/20"
                  {...profileForm.register('email')}
                />
                {profileForm.formState.errors.email && (
                  <p className="text-red-500 text-xs">{profileForm.formState.errors.email.message}</p>
                )}
              </div>
            </div>
            <div className="pt-1">
              <Button type="submit" disabled={profileLoading} size="sm" className="h-9 px-5 text-sm gap-2">
                {profileLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Changes
              </Button>
            </div>
          </form>
        </div>

        {/* ── Change Password ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Change Password</p>
              <p className="text-xs text-gray-400">Keep your account secure</p>
            </div>
          </div>
          <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword" className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <KeyRound className="w-3 h-3" /> Current Password
              </Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Enter current password"
                className="h-10 text-sm border-gray-200 focus:border-primary focus:ring-primary/20"
                {...passwordForm.register('currentPassword')}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-red-500 text-xs">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-xs font-medium text-gray-600">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Min 8 characters"
                  className="h-10 text-sm border-gray-200 focus:border-primary focus:ring-primary/20"
                  {...passwordForm.register('newPassword')}
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-red-500 text-xs">{passwordForm.formState.errors.newPassword.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-medium text-gray-600">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat new password"
                  className="h-10 text-sm border-gray-200 focus:border-primary focus:ring-primary/20"
                  {...passwordForm.register('confirmPassword')}
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-red-500 text-xs">{passwordForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
            </div>
            <div className="pt-1">
              <Button type="submit" disabled={passwordLoading} size="sm" className="h-9 px-5 text-sm gap-2">
                {passwordLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                Change Password
              </Button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}

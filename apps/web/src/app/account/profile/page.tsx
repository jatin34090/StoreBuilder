'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { User, Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/authStore';
import { usersApi } from '@/lib/api';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
});

const addressSchema = z.object({
  name:    z.string().min(2, 'Required'),
  phone:   z.string().regex(/^[6-9]\d{9}$/, 'Valid phone required'),
  line1:   z.string().min(5, 'Required'),
  line2:   z.string().optional(),
  city:    z.string().min(2, 'Required'),
  state:   z.string().min(2, 'Required'),
  pincode: z.string().regex(/^\d{6}$/, '6-digit pincode required'),
});

type ProfileForm  = z.infer<typeof profileSchema>;
type AddressForm  = z.infer<typeof addressSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth/login?redirect=/account/profile');
  }, [isAuthenticated, router]);

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => usersApi.profile(),
    enabled: isAuthenticated,
  });
  const profile = profileData?.data?.data;

  const { data: addressesData } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => usersApi.addresses(),
    enabled: isAuthenticated,
  });
  const addresses: Array<{ id: string; name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string; isDefault: boolean }> = addressesData?.data?.data ?? [];

  // ─── Profile form ─────────────────────────────────────────────────────────

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: { name: profile?.name ?? '', email: profile?.email ?? '' },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileForm) => usersApi.updateProfile(data),
    onSuccess: (res) => {
      setUser(res.data.data);
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: () => toast.error('Could not update profile'),
  });

  // ─── Address form ─────────────────────────────────────────────────────────

  const addressForm = useForm<AddressForm>({ resolver: zodResolver(addressSchema) });
  const [showAddAddress, setShowAddAddress] = useToggle(false);

  const addAddressMutation = useMutation({
    mutationFn: (data: AddressForm) => usersApi.addAddress(data),
    onSuccess: () => {
      toast.success('Address added');
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      addressForm.reset();
      setShowAddAddress(false);
    },
    onError: () => toast.error('Could not add address'),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: (id: string) => usersApi.deleteAddress(id),
    onSuccess: () => {
      toast.success('Address removed');
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
  });

  return (
    <MainLayout>
      <div className="container py-8 max-w-xl">
        {/* Profile */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{user?.name ?? 'My Profile'}</h1>
            <p className="text-sm text-muted-foreground">{user?.phone ?? user?.email}</p>
          </div>
        </div>

        <div className="border rounded-xl p-5 bg-card mb-6">
          <h2 className="font-semibold mb-4">Personal Information</h2>
          <form
            onSubmit={profileForm.handleSubmit((d) => updateProfileMutation.mutate(d))}
            className="space-y-3"
          >
            <div>
              <Label>Full Name</Label>
              <Input className="mt-1" {...profileForm.register('name')} />
              {profileForm.formState.errors.name && <p className="text-destructive text-xs mt-0.5">{profileForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <Label>Email</Label>
              <Input className="mt-1" type="email" placeholder="Optional" {...profileForm.register('email')} />
              {profileForm.formState.errors.email && <p className="text-destructive text-xs mt-0.5">{profileForm.formState.errors.email.message}</p>}
            </div>
            <Button type="submit" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </form>
        </div>

        {/* Addresses */}
        <div className="border rounded-xl p-5 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Saved Addresses</h2>
            <Button variant="outline" size="sm" onClick={() => setShowAddAddress((v) => !v)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>

          {showAddAddress && (
            <form onSubmit={addressForm.handleSubmit((d) => addAddressMutation.mutate(d))} className="border rounded-lg p-4 mb-4 space-y-3 bg-muted/30">
              {(['name','phone','line1','line2','city','state','pincode'] as const).map((f) => (
                <div key={f}>
                  <Label className="capitalize text-xs">{f}</Label>
                  <Input className="mt-0.5 h-9" {...addressForm.register(f)} />
                  {addressForm.formState.errors[f] && <p className="text-destructive text-xs">{addressForm.formState.errors[f]?.message}</p>}
                </div>
              ))}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={addAddressMutation.isPending}>
                  {addAddressMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddAddress(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No addresses saved.</p>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div key={addr.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                  <div className="text-sm">
                    <p className="font-medium">{addr.name} · {addr.phone} {addr.isDefault && <span className="text-xs text-primary">(Default)</span>}</p>
                    <p className="text-muted-foreground">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} — {addr.pincode}</p>
                  </div>
                  <button
                    onClick={() => deleteAddressMutation.mutate(addr.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    disabled={deleteAddressMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

// Minimal toggle hook
function useToggle(init: boolean): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [state, setState] = useState(init);
  return [state, setState];
}

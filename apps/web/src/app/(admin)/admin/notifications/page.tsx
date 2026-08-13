'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bell, Send, Users, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { adminNotificationsApi } from '../../../../lib/admin-api';

const broadcastSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  body: z.string().min(5, 'Message must be at least 5 characters').max(500),
  type: z.string().default('SYSTEM'),
});
type BroadcastForm = z.infer<typeof broadcastSchema>;

const directSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  title: z.string().min(3).max(100),
  body: z.string().min(5).max(500),
  type: z.string().default('SYSTEM'),
});
type DirectForm = z.infer<typeof directSchema>;

const NOTIFICATION_TYPES = [
  { value: 'SYSTEM', label: 'System', color: 'text-blue-600' },
  { value: 'ORDER', label: 'Order Update', color: 'text-purple-600' },
  { value: 'OFFER', label: 'Offer', color: 'text-orange-600' },
  { value: 'DELIVERY', label: 'Delivery', color: 'text-green-600' },
  { value: 'REVIEW', label: 'Review', color: 'text-amber-600' },
];

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'broadcast' | 'direct'>('broadcast');

  const broadcastForm = useForm<BroadcastForm>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: { type: 'SYSTEM' },
  });

  const directForm = useForm<DirectForm>({
    resolver: zodResolver(directSchema),
    defaultValues: { type: 'SYSTEM' },
  });

  const broadcastMutation = useMutation({
    mutationFn: (data: BroadcastForm) => adminNotificationsApi.broadcast(data),
    onSuccess: () => {
      toast.success('Broadcast notification sent to all users!');
      broadcastForm.reset({ type: 'SYSTEM' });
    },
    onError: () => toast.error('Failed to send broadcast notification'),
  });

  const directMutation = useMutation({
    mutationFn: (data: DirectForm) => adminNotificationsApi.send(data),
    onSuccess: () => {
      toast.success('Notification sent successfully!');
      directForm.reset({ type: 'SYSTEM' });
    },
    onError: () => toast.error('Failed to send notification'),
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Send push notifications and alerts to users"
      />

      {/* Tab Selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('broadcast')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'broadcast'
              ? 'bg-primary text-white shadow'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Broadcast to All
        </button>
        <button
          onClick={() => setActiveTab('direct')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'direct'
              ? 'bg-primary text-white shadow'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <User className="w-4 h-4" />
          Send to User
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose Panel */}
        <div>
          {activeTab === 'broadcast' ? (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  Broadcast Notification
                </CardTitle>
                <CardDescription>
                  Send a notification to all registered users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={broadcastForm.handleSubmit((d) => broadcastMutation.mutate(d))} className="space-y-4">
                  <div>
                    <Label>Notification Type</Label>
                    <select
                      {...broadcastForm.register('type')}
                      className="mt-1 w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    >
                      {NOTIFICATION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Title *</Label>
                    <Input
                      {...broadcastForm.register('title')}
                      placeholder="e.g. Flash Sale Alert 🎉"
                      className="mt-1"
                    />
                    {broadcastForm.formState.errors.title && (
                      <p className="text-red-500 text-xs mt-1">{broadcastForm.formState.errors.title.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Message *</Label>
                    <textarea
                      {...broadcastForm.register('body')}
                      placeholder="Up to 50% off on all jewellery today only! Shop now..."
                      rows={4}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                    />
                    {broadcastForm.formState.errors.body && (
                      <p className="text-red-500 text-xs mt-1">{broadcastForm.formState.errors.body.message}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={broadcastMutation.isPending}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {broadcastMutation.isPending ? 'Sending...' : 'Send Broadcast'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Direct Notification
                </CardTitle>
                <CardDescription>
                  Send a notification to a specific user by their ID
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={directForm.handleSubmit((d) => directMutation.mutate(d))} className="space-y-4">
                  <div>
                    <Label>User ID *</Label>
                    <Input
                      {...directForm.register('userId')}
                      placeholder="Paste user UUID here"
                      className="mt-1 font-mono text-xs"
                    />
                    {directForm.formState.errors.userId && (
                      <p className="text-red-500 text-xs mt-1">{directForm.formState.errors.userId.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Notification Type</Label>
                    <select
                      {...directForm.register('type')}
                      className="mt-1 w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    >
                      {NOTIFICATION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Title *</Label>
                    <Input {...directForm.register('title')} placeholder="Notification title" className="mt-1" />
                    {directForm.formState.errors.title && (
                      <p className="text-red-500 text-xs mt-1">{directForm.formState.errors.title.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Message *</Label>
                    <textarea
                      {...directForm.register('body')}
                      placeholder="Your order #12345 has been shipped..."
                      rows={4}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                    />
                    {directForm.formState.errors.body && (
                      <p className="text-red-500 text-xs mt-1">{directForm.formState.errors.body.message}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={directMutation.isPending}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {directMutation.isPending ? 'Sending...' : 'Send Notification'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tips Panel */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm bg-amber-50 border-amber-100">
            <CardContent className="p-5">
              <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notification Tips
              </h3>
              <ul className="text-sm text-amber-700 space-y-2">
                <li>• Keep titles short and action-oriented (max 60 chars)</li>
                <li>• Use emojis to increase engagement 🎉</li>
                <li>• Broadcast during peak hours (10am–1pm, 6pm–9pm IST)</li>
                <li>• Don&apos;t over-notify — limit to 1–2 broadcasts per week</li>
                <li>• Use &apos;Order&apos; type for transactional notifications</li>
                <li>• Test with a direct notification to yourself first</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Notification Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {NOTIFICATION_TYPES.map((t) => (
                <div key={t.value} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${t.color.replace('text-', 'bg-')}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t.label}</p>
                    <p className="text-xs text-slate-500">
                      {t.value === 'SYSTEM' && 'General announcements and updates'}
                      {t.value === 'ORDER' && 'Order status changes and tracking'}
                      {t.value === 'PROMO' && 'Sales, discounts and offers'}
                      {t.value === 'ALERT' && 'Important account or security alerts'}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


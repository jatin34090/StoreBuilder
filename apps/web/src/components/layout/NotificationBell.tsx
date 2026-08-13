'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Package, Truck, ShoppingBag, Tag, Info } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  ORDER:    <ShoppingBag className="h-3.5 w-3.5" />,
  DELIVERY: <Truck className="h-3.5 w-3.5" />,
  PAYMENT:  <Tag className="h-3.5 w-3.5" />,
  PROMO:    <Tag className="h-3.5 w-3.5" />,
  SYSTEM:   <Info className="h-3.5 w-3.5" />,
};

const TYPE_COLOR: Record<string, string> = {
  ORDER:    'bg-blue-100 text-blue-600',
  DELIVERY: 'bg-orange-100 text-orange-600',
  PAYMENT:  'bg-green-100 text-green-600',
  PROMO:    'bg-purple-100 text-purple-600',
  SYSTEM:   'bg-slate-100 text-slate-600',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 15 }),
    refetchInterval: 30_000, // poll every 30s
  });

  const notifications: Notification[] = data?.data?.data?.notifications ?? [];
  const unread = notifications.filter((n) => !n.isRead).length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 sm:w-96 bg-popover border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <Package className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex gap-3',
                    !n.isRead && 'bg-primary/5',
                  )}
                  onClick={() => { if (!n.isRead) markReadMutation.mutate(n.id); }}
                >
                  {/* Icon */}
                  <div className={cn('mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0', TYPE_COLOR[n.type] ?? TYPE_COLOR.SYSTEM)}>
                    {TYPE_ICON[n.type] ?? TYPE_ICON.SYSTEM}
                  </div>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-snug">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {/* Unread dot */}
                  {!n.isRead && <span className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

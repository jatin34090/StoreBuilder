'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingBag,
  Users,
  Warehouse,
  Ticket,
  Bell,
  Truck,
  Star,
  Gem,
  Banknote,
  UserCircle,
  Wand2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/categories', label: 'Categories', icon: Tags },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/inventory', label: 'Inventory', icon: Warehouse },
  { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/delivery', label: 'Delivery', icon: Truck },
  { href: '/admin/remittances', label: 'Remittances', icon: Banknote },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/customize', label: 'Customise',  icon: Wand2 },
  { href: '/admin/profile',  label: 'My Profile', icon: UserCircle },
];

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();
  const [brandName, setBrandName] = useState('YourBrand');

  useEffect(() => {
    api.get('/settings/site')
      .then((r) => {
        const data = r.data?.data ?? r.data;
        const name = data?.brandName || data?.data?.brandName;
        if (name) setBrandName(name as string);
      })
      .catch(() => {});
  }, []);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href) && href !== '/admin';
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#1a1a2e] border-r border-white/10 flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div
        className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <Gem className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">{brandName}</p>
            <p className="text-slate-500 text-xs leading-tight">Admin Panel</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-admin py-4 px-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                active
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-black/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/8'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 transition-colors ${
                  active ? 'text-primary-foreground opacity-90' : 'text-slate-500 group-hover:text-slate-300'
                }`}
              />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-4 border-t border-white/10">
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all text-sm font-medium ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

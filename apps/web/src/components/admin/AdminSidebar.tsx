'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, Tags, ShoppingBag, Users, Warehouse,
  Ticket, Bell, Truck, Star, Gem, ChevronLeft, ChevronRight,
  BarChart2, Settings, Palette, Globe, CreditCard, Zap,
  ExternalLink, ChevronDown, ChevronRight as ChevronRightSmall,
} from 'lucide-react';
import { useState } from 'react';
import { useAdminAuthStore } from '../../store/adminAuthStore';

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Catalog',
    items: [
      { href: '/admin/products',   label: 'Products',   icon: Package },
      { href: '/admin/categories', label: 'Categories', icon: Tags },
      { href: '/admin/inventory',  label: 'Inventory',  icon: Warehouse },
      { href: '/admin/reviews',    label: 'Reviews',    icon: Star },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/admin/orders',        label: 'Orders',    icon: ShoppingBag },
      { href: '/admin/users',         label: 'Customers', icon: Users },
      { href: '/admin/coupons',       label: 'Coupons',   icon: Ticket },
    ],
  },
  {
    label: 'Website',
    items: [
      { href: '/admin/customize', label: 'Theme',       icon: Palette },
      { href: '/admin/settings',  label: 'Pages',       icon: Globe },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/delivery',      label: 'Shipping',      icon: Truck },
      { href: '/admin/notifications', label: 'Notifications', icon: Bell },
      { href: '/admin/remittances',   label: 'Payments',      icon: CreditCard },
    ],
  },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE:    'bg-green-500',
    SETUP:     'bg-amber-500',
    DRAFT:     'bg-slate-400',
    SUSPENDED: 'bg-red-500',
    CLOSED:    'bg-slate-600',
  };
  return (
    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[status] ?? 'bg-slate-400'}`} />
  );
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();
  const adminStore = useAdminAuthStore((s) => s.adminStore);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Catalog: true, Sales: true, Website: true, Operations: false,
  });

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href) && href !== '/admin';
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const storeUrl = adminStore?.slug
    ? `${process.env['NEXT_PUBLIC_ROOT_DOMAIN'] ? `https://${adminStore.slug}.${process.env['NEXT_PUBLIC_ROOT_DOMAIN']}` : `http://${adminStore.slug}.localhost:3000`}`
    : null;

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#1a1a2e] border-r border-white/10 flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Store identity header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-white/10 min-h-[64px] ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          {adminStore?.logoUrl ? (
            <img src={adminStore.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <Gem className="w-4 h-4 text-primary-foreground" />
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-white font-bold text-sm leading-tight truncate">
                {adminStore?.name ?? 'My Store'}
              </p>
              {adminStore?.status && <StatusBadge status={adminStore.status} />}
            </div>
            <p className="text-slate-500 text-xs leading-tight truncate">
              {adminStore?.slug ? `/${adminStore.slug}` : 'Store Admin'}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {/* Dashboard */}
        <Link
          href="/admin"
          title={collapsed ? 'Dashboard' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
            pathname === '/admin'
              ? 'bg-primary text-primary-foreground shadow-lg shadow-black/20'
              : 'text-slate-400 hover:text-white hover:bg-white/8'
          } ${collapsed ? 'justify-center' : ''}`}
        >
          <LayoutDashboard className={`w-5 h-5 flex-shrink-0 ${pathname === '/admin' ? 'text-primary-foreground opacity-90' : 'text-slate-500 group-hover:text-slate-300'}`} />
          {!collapsed && <span className="truncate">Dashboard</span>}
        </Link>

        {/* Grouped sections */}
        {navGroups.map((group) => (
          <div key={group.label} className="mt-2">
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-1 mb-0.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
              >
                <span>{group.label}</span>
                {expandedGroups[group.label]
                  ? <ChevronDown className="w-3 h-3" />
                  : <ChevronRightSmall className="w-3 h-3" />}
              </button>
            )}
            {(collapsed || expandedGroups[group.label]) && (
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, exact }) => {
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
                      <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary-foreground opacity-90' : 'text-slate-500 group-hover:text-slate-300'}`} />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Analytics */}
        <div className="mt-2">
          {!collapsed && (
            <div className="px-3 py-1 mb-0.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Analytics
            </div>
          )}
          <Link
            href="/admin/analytics"
            title={collapsed ? 'Analytics' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
              isActive('/admin/analytics')
                ? 'bg-primary text-primary-foreground shadow-lg shadow-black/20'
                : 'text-slate-400 hover:text-white hover:bg-white/8'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <BarChart2 className={`w-5 h-5 flex-shrink-0 ${isActive('/admin/analytics') ? 'text-primary-foreground opacity-90' : 'text-slate-500 group-hover:text-slate-300'}`} />
            {!collapsed && <span className="truncate">Analytics</span>}
          </Link>
        </div>

        {/* Settings */}
        <div className="mt-2">
          {!collapsed && (
            <div className="px-3 py-1 mb-0.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Settings
            </div>
          )}
          <Link
            href="/admin/settings/store"
            title={collapsed ? 'Store Settings' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
              isActive('/admin/settings')
                ? 'bg-primary text-primary-foreground shadow-lg shadow-black/20'
                : 'text-slate-400 hover:text-white hover:bg-white/8'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <Settings className={`w-5 h-5 flex-shrink-0 ${isActive('/admin/settings') ? 'text-primary-foreground opacity-90' : 'text-slate-500 group-hover:text-slate-300'}`} />
            {!collapsed && <span className="truncate">Settings</span>}
          </Link>
        </div>
      </nav>

      {/* View Store + Collapse */}
      <div className="px-2 py-3 border-t border-white/10 space-y-1">
        {storeUrl && (
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'View Store' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all ${collapsed ? 'justify-center' : ''}`}
          >
            <ExternalLink className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="truncate">View Store</span>}
          </a>
        )}
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all text-sm font-medium ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <><ChevronLeft className="w-5 h-5" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}

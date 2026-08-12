'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Store, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props { collapsed: boolean; onToggle: () => void }

const navItems = [
  { href: '/super-admin',        label: 'Overview',  icon: LayoutDashboard, exact: true },
  { href: '/super-admin/stores', label: 'Stores',    icon: Store },
];

export function SuperAdminSidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname();

  return (
    <div className={cn(
      'fixed left-0 top-0 h-full bg-[#0f172a] text-white flex flex-col z-30 transition-all duration-300',
      collapsed ? 'w-16' : 'w-64',
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-xs font-semibold text-white leading-none">Super Admin</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Platform control</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                active ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-10 border-t border-white/10 text-slate-400 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </div>
  );
}

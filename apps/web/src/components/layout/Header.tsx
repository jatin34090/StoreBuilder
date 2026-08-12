'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Heart, Search, Menu, User, LogOut, Package, Sun, Moon } from 'lucide-react';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { authApi, api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CategoryNode { id: string; name: string; slug: string; children?: CategoryNode[] }

export interface BrandConfig {
  brandName:        string;
  logoUrl:          string;
  announcementText: string;
  announcementCode: string;
}

interface HeaderProps {
  brand?: BrandConfig;
}

const SALE_LINK = { label: 'Sale', href: '/products?sort=discount', highlight: true };

// Per-user dark mode toggle — persists to localStorage, respects site default
function useUserDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Initialise from localStorage, fallback to whatever the site set on <html>
    const stored = localStorage.getItem('user-theme');
    const siteDark = document.documentElement.classList.contains('dark');
    const initial = stored ? stored === 'dark' : siteDark;
    setIsDark(initial);
    document.documentElement.classList.toggle('dark', initial);
  }, []);

  const toggle = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('user-theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  };

  return { isDark, toggle };
}

export function Header({ brand }: HeaderProps) {
  const router = useRouter();
  const { isAuthenticated, clearUser } = useAuthStore();
  const totalItems = useCartStore((s) => s.totalItems());
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isDark, toggle: toggleDark } = useUserDarkMode();

  const { data: categoryTree = [] } = useQuery<CategoryNode[]>({
    queryKey: ['categories', 'tree'],
    queryFn:  () => api.get('/categories').then((r) => r.data?.data ?? r.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  const navLinks: { label: string; href: string; highlight?: boolean }[] = [
    ...categoryTree.map((c) => ({ label: c.name, href: `/products?category=${c.slug}` })),
    SALE_LINK,
  ];

  const brandName = brand?.brandName || 'YourBrand';
  const logoUrl   = brand?.logoUrl   || '';
  const annText   = brand?.announcementText || 'Free shipping on orders above ₹999';
  const annCode   = brand?.announcementCode || '';

  const handleLogout = async () => {
    try { await authApi.logout(); } finally {
      clearUser();
      router.push('/');
      toast.success('Logged out successfully');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Announcement bar */}
      <div
        data-tv="primary primary-foreground"
        className="text-center py-2 px-4"
        style={{
          backgroundColor: 'hsl(var(--primary))',
          color:            'hsl(var(--primary-foreground))',
          fontSize:         '0.7rem',
          letterSpacing:    '0.08em',
        }}
      >
        {annText}
        {annCode && (
          <>
            <span className="mx-2 opacity-40">·</span>
            Use code <strong>{annCode}</strong> for 10% off
          </>
        )}
      </div>

      {/* Main header */}
      <div
        data-tv="background border"
        className="border-b"
        style={{ backgroundColor: 'hsl(var(--background) / 0.97)', backdropFilter: 'blur(8px)' }}
      >
        <div className="container flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            {logoUrl ? (
              <Image src={logoUrl} alt={brandName} width={32} height={32} className="rounded-full object-cover" />
            ) : (
              <div
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.06)' }}
              >
                <span
                  className="font-display font-normal"
                  style={{ color: 'hsl(var(--primary))', fontSize: '1rem', lineHeight: 1 }}
                  suppressHydrationWarning
                >
                  {brandName.charAt(0)}
                </span>
              </div>
            )}
            <span
              className="font-display font-normal hidden sm:block"
              style={{ color: 'hsl(var(--foreground))', fontSize: '1.125rem', letterSpacing: '0.02em' }}
            >
              {brandName}
            </span>
          </Link>

          {/* Desktop nav — only at lg+ (1024px). Tablet uses the hamburger sheet. */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-7 overflow-x-auto scrollbar-hide">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'relative text-sm font-medium whitespace-nowrap transition-colors duration-200 pb-0.5 flex-shrink-0',
                  'after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-primary',
                  'after:transition-all after:duration-300 hover:after:w-full',
                  link.highlight
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/search" aria-label="Search"><Search className="h-[18px] w-[18px]" /></Link>
            </Button>

            {/* User light/dark toggle */}
            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle dark mode">
              {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </Button>

            {isAuthenticated && (
              <>
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/wishlist" aria-label="Wishlist"><Heart className="h-[18px] w-[18px]" /></Link>
                </Button>
                <NotificationBell />
              </>
            )}

            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link href="/cart" aria-label="Cart">
                <ShoppingBag className="h-[18px] w-[18px]" />
                {totalItems > 0 && (
                  <span
                    data-tv="primary primary-foreground"
                    className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full text-[10px] flex items-center justify-center font-semibold"
                    style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  >
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                )}
              </Link>
            </Button>

            {isAuthenticated ? (
              <div className="hidden lg:flex items-center gap-0.5">
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/account/orders" aria-label="Orders"><Package className="h-[18px] w-[18px]" /></Link>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/account/profile" aria-label="Profile"><User className="h-[18px] w-[18px]" /></Link>
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
                  <LogOut className="h-[18px] w-[18px]" />
                </Button>
              </div>
            ) : (
              <Button size="sm" className="hidden lg:inline-flex ml-1 tracking-wide" asChild style={{ fontSize: '0.75rem', letterSpacing: '0.06em' }}>
                <Link href="/auth/login">Sign In</Link>
              </Button>
            )}

            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" suppressHydrationWarning>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <div className="flex items-center gap-2.5 mb-8">
                  {logoUrl ? (
                    <Image src={logoUrl} alt={brandName} width={28} height={28} className="rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center" style={{ borderColor: 'hsl(var(--primary))' }}>
                      <span className="font-display text-sm" style={{ color: 'hsl(var(--primary))' }}>{brandName.charAt(0)}</span>
                    </div>
                  )}
                  <span className="font-display" style={{ fontSize: '1.0625rem' }}>{brandName}</span>
                </div>
                <nav className="flex flex-col gap-1">
                  {navLinks.map((link) => (
                    <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                      className={cn('flex items-center px-3 py-2.5 rounded text-sm font-medium transition-colors hover:bg-accent', link.highlight ? 'text-primary' : 'text-foreground')}>
                      {link.label}
                    </Link>
                  ))}
                  <div className="border-t my-3" />
                  {/* Dark mode toggle in mobile sheet */}
                  <button onClick={toggleDark} className="flex items-center gap-2.5 px-3 py-2.5 rounded text-sm hover:bg-accent text-foreground w-full text-left">
                    {isDark ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
                    {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  </button>
                  <div className="border-t my-3" />
                  {isAuthenticated ? (
                    <>
                      <Link href="/account/orders"  onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded text-sm hover:bg-accent text-foreground"><Package className="h-4 w-4 text-muted-foreground" /> My Orders</Link>
                      <Link href="/account/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded text-sm hover:bg-accent text-foreground"><User className="h-4 w-4 text-muted-foreground" /> Profile</Link>
                      <Link href="/wishlist"        onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded text-sm hover:bg-accent text-foreground"><Heart className="h-4 w-4 text-muted-foreground" /> Wishlist</Link>
                      <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="flex items-center gap-2.5 px-3 py-2.5 rounded text-sm text-destructive hover:bg-destructive/10 w-full text-left">
                        <LogOut className="h-4 w-4" /> Logout
                      </button>
                    </>
                  ) : (
                    <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90">
                      <User className="h-4 w-4" /> Sign In
                    </Link>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

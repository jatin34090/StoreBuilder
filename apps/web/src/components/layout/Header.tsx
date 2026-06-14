'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Heart, Search, Menu, User, LogOut, Package } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetTrigger,
} from '@/components/ui/sheet';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { label: 'Rings',     href: '/products?category=rings' },
  { label: 'Necklaces', href: '/products?category=necklaces-pendants' },
  { label: 'Earrings',  href: '/products?category=earrings' },
  { label: 'Bangles',   href: '/products?category=bangles-bracelets' },
  { label: 'Sale',      href: '/products?sort=discount', highlight: true },
];

export function Header() {
  const router = useRouter();
  const { user, isAuthenticated, clearUser } = useAuthStore();
  const totalItems = useCartStore((s) => s.totalItems());
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearUser();
      router.push('/');
      toast.success('Logged out successfully');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Top bar */}
      <div className="bg-primary text-primary-foreground text-xs text-center py-1.5 px-4">
        🎁 Free shipping on orders above ₹999 &nbsp;|&nbsp; Use code{' '}
        <span className="font-bold">WELCOME10</span> for 10% off
      </div>

      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">J</span>
          </div>
          <span className="font-display font-bold text-lg text-primary hidden sm:block">
            YourBrand
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                link.highlight ? 'text-amber-600 font-semibold' : 'text-muted-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/search" aria-label="Search">
              <Search className="h-5 w-5" />
            </Link>
          </Button>

          {isAuthenticated && (
            <Button variant="ghost" size="icon" asChild>
              <Link href="/wishlist" aria-label="Wishlist">
                <Heart className="h-5 w-5" />
              </Link>
            </Button>
          )}

          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/cart" aria-label="Cart">
              <ShoppingBag className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </Link>
          </Button>

          {isAuthenticated ? (
            <div className="hidden sm:flex items-center gap-1">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/account/orders" aria-label="Orders">
                  <Package className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/account/profile" aria-label="Profile">
                  <User className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <Button size="sm" className="hidden sm:inline-flex" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
          )}

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <nav className="flex flex-col gap-1 mt-6">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors hover:bg-accent',
                      link.highlight ? 'text-amber-600' : '',
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="border-t my-2" />
                {isAuthenticated ? (
                  <>
                    <Link href="/account/orders"  onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm hover:bg-accent"><Package className="h-4 w-4" /> My Orders</Link>
                    <Link href="/account/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm hover:bg-accent"><User className="h-4 w-4" /> Profile</Link>
                    <Link href="/wishlist"        onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm hover:bg-accent"><Heart className="h-4 w-4" /> Wishlist</Link>
                    <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-destructive hover:bg-destructive/10 w-full text-left">
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </>
                ) : (
                  <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90">
                    <User className="h-4 w-4" /> Sign In
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

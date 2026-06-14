import Link from 'next/link';
import { Instagram, Facebook, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-muted/30 mt-16">
      <div className="container py-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">J</span>
            </div>
            <span className="font-display font-bold text-primary">YourBrand Jewellery</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Curated artificial jewellery crafted for every occasion. Hypoallergenic, affordable, and beautiful.
          </p>
          <div className="flex gap-3 mt-4">
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Instagram"><Instagram className="h-5 w-5" /></a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Facebook"><Facebook className="h-5 w-5" /></a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Twitter"><Twitter className="h-5 w-5" /></a>
          </div>
        </div>

        {/* Shop */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Shop</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              ['Rings',     '/products?category=rings'],
              ['Necklaces', '/products?category=necklaces-pendants'],
              ['Earrings',  '/products?category=earrings'],
              ['Bangles',   '/products?category=bangles-bracelets'],
              ['New Arrivals', '/products?sort=newest'],
              ['Sale',      '/products?sort=discount'],
            ].map(([label, href]) => (
              <li key={href}><Link href={href} className="hover:text-primary transition-colors">{label}</Link></li>
            ))}
          </ul>
        </div>

        {/* Account */}
        <div>
          <h4 className="font-semibold text-sm mb-3">My Account</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              ['My Orders',   '/account/orders'],
              ['Wishlist',    '/wishlist'],
              ['Profile',     '/account/profile'],
              ['Addresses',   '/account/addresses'],
            ].map(([label, href]) => (
              <li key={href}><Link href={href} className="hover:text-primary transition-colors">{label}</Link></li>
            ))}
          </ul>
        </div>

        {/* Help */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Help</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              ['Contact Us',      '/contact'],
              ['Returns & Refunds', '/returns'],
              ['Shipping Policy', '/shipping'],
              ['Privacy Policy',  '/privacy'],
              ['Terms of Service','/terms'],
            ].map(([label, href]) => (
              <li key={href}><Link href={href} className="hover:text-primary transition-colors">{label}</Link></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} YourBrand Jewellery. All rights reserved.</p>
          <p>Made with ❤️ in India</p>
        </div>
      </div>
    </footer>
  );
}

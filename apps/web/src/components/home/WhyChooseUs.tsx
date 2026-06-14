import { Shield, Truck, RefreshCw, Star, Headphones, Award } from 'lucide-react';

const FEATURES = [
  { icon: Shield,     title: 'Hypoallergenic',      desc: 'Nickel-free, skin-safe materials for sensitive skin' },
  { icon: Truck,      title: 'Free Shipping',        desc: 'Free delivery on orders above ₹999 anywhere in India' },
  { icon: RefreshCw,  title: '7-Day Returns',        desc: 'Easy returns within 7 days of delivery, no questions asked' },
  { icon: Star,       title: 'Premium Quality',      desc: 'Anti-tarnish coating ensures jewellery stays beautiful' },
  { icon: Headphones, title: '24/7 Support',         desc: 'Real human support via WhatsApp, email or phone' },
  { icon: Award,      title: 'Certified Products',   desc: 'All products tested for quality and safety standards' },
];

export function WhyChooseUs() {
  return (
    <section className="bg-muted/30 py-14">
      <div className="container">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Why Shop With Us?</h2>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            We're more than just a jewellery store — we're committed to making you feel beautiful every day
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex gap-4 p-5 rounded-xl bg-card border hover:shadow-md transition-shadow"
            >
              <div className="shrink-0 w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

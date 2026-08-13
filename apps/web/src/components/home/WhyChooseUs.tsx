import {
  Shield, Truck, RefreshCw, Star, Headphones, Award,
  Package, Heart, Zap, Globe, Clock, CheckCircle,
} from 'lucide-react';
import { fetchSiteConfig, DEFAULT_FEATURES } from '@/lib/site-config';
import type { FeatureItem } from '@/lib/site-config';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Shield, Truck, RefreshCw, Star, Headphones, Award,
  Package, Heart, Zap, Globe, Clock, CheckCircle,
};

function FeatureIcon({ name, ...props }: { name: string } & React.SVGProps<SVGSVGElement>) {
  const Icon = ICON_MAP[name] ?? Shield;
  return <Icon {...(props as object)} />;
}

export async function WhyChooseUs() {
  const config = await fetchSiteConfig();
  const items: FeatureItem[] = (config.features?.length ?? 0) > 0 ? config.features : DEFAULT_FEATURES;

  return (
    <section className="py-20" style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
      <div className="container">
        <div className="text-center mb-14">
          <p
            className="text-primary font-medium mb-3"
            style={{ fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase' }}
          >
            Our Promise
          </p>
          <h2 className="font-display font-normal text-foreground text-3xl md:text-4xl mb-4">
            Why Shop With Us?
          </h2>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-primary/40" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            <div className="h-px w-8 bg-primary/40" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/40 rounded overflow-hidden">
          {items.map(({ icon, title, desc }, i) => (
            <div key={i} className="group bg-background hover:bg-card transition-colors duration-300 p-8">
              <div className="flex flex-col gap-4">
                <div
                  className="w-10 h-10 rounded flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(var(--primary) / 0.08)' }}
                >
                  <FeatureIcon
                    name={icon}
                    className="h-5 w-5"
                    style={{ color: 'hsl(var(--primary))' }}
                  />
                </div>
                <div>
                  <h3
                    className="font-display font-normal text-foreground mb-2"
                    style={{ fontSize: '1.0625rem' }}
                  >
                    {title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

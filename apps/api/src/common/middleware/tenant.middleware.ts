import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { TenantService } from '../../modules/tenant/tenant.service';
import { RESERVED_SUBDOMAINS } from '../../common/constants/domains';
import type { Store } from '@prisma/client';

// Extend Express Request to carry tenant context
declare global {
  namespace Express {
    interface Request {
      store?: Store;
      storeId?: string;
    }
  }
}

// Platform base domain — tenant subdomains are resolved from this
const PLATFORM_DOMAIN = process.env['PLATFORM_DOMAIN'] ?? 'localhost';
const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const store = await this.resolveStore(req);
      if (store) {
        if (!store.isActive) {
          // Distinguish trial expiry (402) from admin suspension (503)
          // Trial-expired stores have plan=FREE and isActive=false due to expireTrials()
          const isSuspended = store.status === 'SUSPENDED';
          if (isSuspended) {
            res.status(503).json({ statusCode: 503, message: 'This store is currently suspended. Contact support.' });
          } else {
            res.status(402).json({ statusCode: 402, message: 'Your trial has expired. Please upgrade to reactivate your store.' });
          }
          return;
        }
        req.store   = store;
        req.storeId = store.id;
      } else {
        // Fallback for dev — attach default store so existing code keeps working
        req.storeId = DEFAULT_STORE_ID;
      }
    } catch (e) {
      this.logger.warn(`Tenant resolution failed: ${(e as Error).message}`);
      req.storeId = DEFAULT_STORE_ID;
    }
    next();
  }

  private async resolveStore(req: Request) {
    // 1. Explicit headers — highest priority (API clients, mobile apps, Swagger)
    const headerStoreId = req.headers['x-store-id'] as string | undefined;
    if (headerStoreId) return this.tenantService.resolveById(headerStoreId);

    const headerSlug = req.headers['x-store-slug'] as string | undefined;
    if (headerSlug) return this.tenantService.resolveBySlug(headerSlug);

    // 2. Subdomain resolution: mystore.platform.com → slug = "mystore"
    const host = (req.headers['host'] ?? '') as string;
    const hostname = host.split(':')[0]; // strip port

    // Custom domain match first (www.mybrand.com)
    if (hostname && !hostname.includes(PLATFORM_DOMAIN) && !this.isLocalhost(hostname)) {
      const byDomain = await this.tenantService.resolveByDomain(hostname);
      if (byDomain) return byDomain;
    }

    // Subdomain match: store-slug.platform.com
    if (hostname.endsWith(`.${PLATFORM_DOMAIN}`)) {
      const slug = hostname.slice(0, hostname.length - PLATFORM_DOMAIN.length - 1);
      if (slug && !RESERVED_SUBDOMAINS.has(slug)) {
        const bySlug = await this.tenantService.resolveBySlug(slug);
        if (bySlug) return bySlug;
      }
    }

    return null;
  }

  private isLocalhost(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  }
}

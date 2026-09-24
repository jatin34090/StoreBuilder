import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as dns from 'dns/promises';
import { DomainStatus, DomainType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../notifications/redis.service';
import { normalizeDomain, isValidDomain, RESERVED_SUBDOMAINS } from '../../common/constants/domains';

const DOMAIN_CACHE_TTL = 300; // 5 min — matches store cache TTL

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── List domains for a store ─────────────────────────────────────────────

  async listDomains(storeId: string) {
    return this.prisma.storeDomain.findMany({
      where: { storeId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  // ─── Add a custom domain ─────────────────────────────────────────────────

  async addDomain(storeId: string, rawDomain: string) {
    const normalized = normalizeDomain(rawDomain);

    if (!isValidDomain(normalized)) {
      throw new BadRequestException(`'${rawDomain}' is not a valid domain`);
    }

    // Reject reserved subdomains used as full custom domains
    const firstLabel = normalized.split('.')[0]!;
    if (RESERVED_SUBDOMAINS.has(firstLabel) && normalized.split('.').length <= 2) {
      throw new BadRequestException(`'${normalized}' is a reserved domain name`);
    }

    // Ensure uniqueness
    const existing = await this.prisma.storeDomain.findUnique({
      where: { normalizedDomain: normalized },
    });
    if (existing) {
      if (existing.storeId === storeId) {
        throw new ConflictException('This domain is already connected to your store');
      }
      throw new ConflictException('This domain is already registered on the platform');
    }

    // Generate verification token — cryptographically secure
    const verificationToken = `sv_${crypto.randomBytes(24).toString('hex')}`;

    const record = await this.prisma.storeDomain.create({
      data: {
        storeId,
        domain:           normalized,
        normalizedDomain: normalized,
        type:             DomainType.CUSTOM_DOMAIN,
        status:           DomainStatus.PENDING,
        isPrimary:        false,
        verificationToken,
      },
    });

    this.logger.log(`Domain added: ${normalized} → store ${storeId}`);
    return {
      ...record,
      verificationInstructions: this.buildVerificationInstructions(normalized, verificationToken),
    };
  }

  // ─── Verify a domain via DNS TXT check ───────────────────────────────────

  async verifyDomain(storeId: string, domainId: string) {
    const record = await this.prisma.storeDomain.findUnique({ where: { id: domainId } });
    if (!record) throw new NotFoundException('Domain not found');
    if (record.storeId !== storeId) throw new NotFoundException('Domain not found');
    if (record.type === DomainType.PLATFORM_SUBDOMAIN) {
      throw new BadRequestException('Platform subdomains do not require verification');
    }
    if (record.status === DomainStatus.ACTIVE) {
      return { verified: true, message: 'Domain is already active' };
    }
    if (!record.verificationToken) {
      throw new BadRequestException('No verification token found');
    }

    const txtHost = `_store-verification.${record.normalizedDomain}`;
    let dnsVerified = false;

    try {
      const records = await dns.resolveTxt(txtHost);
      const flat = records.flat();
      dnsVerified = flat.includes(record.verificationToken);
    } catch (e) {
      this.logger.debug(`DNS lookup failed for ${txtHost}: ${(e as Error).message}`);
      // DNS lookup failure = not yet configured, not a server error
    }

    if (!dnsVerified) {
      // Update status to FAILED if previously VERIFIED but now failing
      if (record.status === DomainStatus.VERIFIED) {
        await this.prisma.storeDomain.update({
          where: { id: domainId },
          data: { status: DomainStatus.FAILED },
        });
        this.invalidateDomainCache(record.normalizedDomain);
      }
      return {
        verified: false,
        message: `DNS TXT record not found. Add a TXT record to _store-verification.${record.normalizedDomain} with value: ${record.verificationToken}`,
      };
    }

    // DNS confirmed — mark ACTIVE
    const updated = await this.prisma.storeDomain.update({
      where: { id: domainId },
      data: {
        status:     DomainStatus.ACTIVE,
        verifiedAt: new Date(),
      },
    });

    this.invalidateDomainCache(record.normalizedDomain);
    this.logger.log(`Domain verified: ${record.normalizedDomain} → store ${storeId}`);
    return { verified: true, message: 'Domain verified and is now active', domain: updated };
  }

  // ─── Set primary domain ───────────────────────────────────────────────────

  async setPrimary(storeId: string, domainId: string) {
    const record = await this.prisma.storeDomain.findUnique({ where: { id: domainId } });
    if (!record) throw new NotFoundException('Domain not found');
    if (record.storeId !== storeId) throw new NotFoundException('Domain not found');
    if (record.status !== DomainStatus.ACTIVE && record.type !== DomainType.PLATFORM_SUBDOMAIN) {
      throw new BadRequestException('Only active domains can be set as primary');
    }

    // Unset all other primary flags for this store, then set this one
    await this.prisma.$transaction([
      this.prisma.storeDomain.updateMany({
        where:  { storeId, isPrimary: true },
        data:   { isPrimary: false },
      }),
      this.prisma.storeDomain.update({
        where: { id: domainId },
        data:  { isPrimary: true },
      }),
    ]);

    this.logger.log(`Primary domain set: ${record.normalizedDomain} → store ${storeId}`);
    return { success: true, domain: record.normalizedDomain };
  }

  // ─── Remove a domain ─────────────────────────────────────────────────────

  async removeDomain(storeId: string, domainId: string) {
    const record = await this.prisma.storeDomain.findUnique({ where: { id: domainId } });
    if (!record) throw new NotFoundException('Domain not found');
    if (record.storeId !== storeId) throw new NotFoundException('Domain not found');
    if (record.type === DomainType.PLATFORM_SUBDOMAIN) {
      throw new BadRequestException('Platform subdomains cannot be removed');
    }
    if (record.isPrimary) {
      throw new BadRequestException(
        'Cannot remove the primary domain. Set another domain as primary first.',
      );
    }

    await this.prisma.storeDomain.delete({ where: { id: domainId } });
    this.invalidateDomainCache(record.normalizedDomain);
    this.logger.log(`Domain removed: ${record.normalizedDomain} from store ${storeId}`);
    return { success: true };
  }

  // ─── Create platform subdomain record (called on store provisioning) ──────

  async ensurePlatformSubdomain(storeId: string, slug: string, platformDomain: string) {
    const subdomain = `${slug}.${platformDomain}`;
    const existing = await this.prisma.storeDomain.findUnique({
      where: { normalizedDomain: subdomain },
    });
    if (existing) return existing;

    return this.prisma.storeDomain.create({
      data: {
        storeId,
        domain:           subdomain,
        normalizedDomain: subdomain,
        type:             DomainType.PLATFORM_SUBDOMAIN,
        status:           DomainStatus.ACTIVE,
        isPrimary:        true,
        verificationToken: null,
        verifiedAt:       new Date(),
      },
    });
  }

  // ─── Resolve store ID from a normalized domain (used by TenantService) ────

  async resolveStoreIdByDomain(normalized: string): Promise<string | null> {
    const record = await this.prisma.storeDomain.findFirst({
      where: {
        normalizedDomain: normalized,
        status: DomainStatus.ACTIVE,
      },
      select: { storeId: true },
    });
    return record?.storeId ?? null;
  }

  // ─── Get verification instructions ───────────────────────────────────────

  async getVerificationInstructions(storeId: string, domainId: string) {
    let record = await this.prisma.storeDomain.findUnique({ where: { id: domainId } });
    if (!record || record.storeId !== storeId) throw new NotFoundException('Domain not found');

    // Auto-generate a missing verification token so instructions are always available
    if (record.type === DomainType.CUSTOM_DOMAIN && !record.verificationToken) {
      const verificationToken = `sv_${crypto.randomBytes(24).toString('hex')}`;
      record = await this.prisma.storeDomain.update({
        where: { id: domainId },
        data: { verificationToken },
      });
    }

    return {
      domain: record.normalizedDomain,
      status: record.status,
      verificationInstructions:
        record.type === DomainType.CUSTOM_DOMAIN && record.verificationToken
          ? this.buildVerificationInstructions(record.normalizedDomain, record.verificationToken)
          : null,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private buildVerificationInstructions(domain: string, token: string) {
    return {
      txtRecord: {
        host:  `_store-verification.${domain}`,
        type:  'TXT',
        value: token,
        ttl:   300,
      },
      cnameRecord: {
        host:   domain.startsWith('www.') ? domain : `www.${domain}`,
        type:   'CNAME',
        target: `${process.env['PLATFORM_DOMAIN'] ?? 'platform.example.com'}`,
        note:   'Point your domain to the platform after TXT verification',
      },
    };
  }

  invalidateDomainCache(normalizedDomain: string): void {
    void this.redis.del(`store:domain:${normalizedDomain}`);
  }
}

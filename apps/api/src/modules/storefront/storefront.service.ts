import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HomepageSectionType, Prisma } from '@prisma/client';

const DEFAULT_SECTIONS = [
  { type: HomepageSectionType.HERO,             sortOrder: 0, enabled: true },
  { type: HomepageSectionType.BANNERS,          sortOrder: 1, enabled: true },
  { type: HomepageSectionType.CATEGORIES,       sortOrder: 2, enabled: true },
  { type: HomepageSectionType.FEATURED_PRODUCTS,sortOrder: 3, enabled: true },
  { type: HomepageSectionType.WHY_CHOOSE_US,   sortOrder: 4, enabled: true },
];

@Injectable()
export class StorefrontService {
  constructor(private prisma: PrismaService) {}

  async getHomepageSections(storeId: string) {
    if (!storeId) return DEFAULT_SECTIONS;
    const rows = await this.prisma.homepageSection.findMany({
      where: { storeId },
      orderBy: { sortOrder: 'asc' },
    });
    if (rows.length === 0) {
      // Return defaults if no sections have been configured yet
      return DEFAULT_SECTIONS;
    }
    return rows;
  }

  async upsertSection(
    storeId: string,
    type: HomepageSectionType,
    data: { enabled?: boolean; sortOrder?: number; config?: Prisma.InputJsonValue },
  ) {
    return this.prisma.homepageSection.upsert({
      where:  { storeId_type: { storeId, type } },
      update: {
        enabled:   data.enabled,
        sortOrder: data.sortOrder,
        config:    data.config,
      },
      create: {
        storeId,
        type,
        enabled:   data.enabled ?? true,
        sortOrder: data.sortOrder ?? 0,
        config:    (data.config ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async reorderSections(storeId: string, order: HomepageSectionType[]) {
    await Promise.all(
      order.map((type, index) =>
        this.prisma.homepageSection.upsert({
          where:  { storeId_type: { storeId, type } },
          update: { sortOrder: index },
          create: { storeId, type, sortOrder: index, enabled: true, config: {} as Prisma.InputJsonValue },
        }),
      ),
    );
  }
}

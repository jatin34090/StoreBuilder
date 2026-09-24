import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateBannerDto {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaUrl?: string;
  desktopImage: string;
  mobileImage?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateBannerDto extends Partial<CreateBannerDto> {}

@Injectable()
export class BannersService {
  constructor(private prisma: PrismaService) {}

  async list(storeId: string) {
    return this.prisma.banner.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async listActive(storeId: string) {
    return this.prisma.banner.findMany({
      where: { storeId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(storeId: string, dto: CreateBannerDto) {
    return this.prisma.banner.create({
      data: {
        storeId,
        title:        dto.title,
        subtitle:     dto.subtitle,
        ctaText:      dto.ctaText,
        ctaUrl:       dto.ctaUrl,
        desktopImage: dto.desktopImage,
        mobileImage:  dto.mobileImage,
        sortOrder:    dto.sortOrder ?? 0,
        isActive:     dto.isActive ?? true,
      },
    });
  }

  async update(storeId: string, id: string, dto: UpdateBannerDto) {
    await this.findOneOrFail(storeId, id);
    return this.prisma.banner.update({
      where: { id },
      data: {
        title:        dto.title,
        subtitle:     dto.subtitle,
        ctaText:      dto.ctaText,
        ctaUrl:       dto.ctaUrl,
        desktopImage: dto.desktopImage,
        mobileImage:  dto.mobileImage,
        sortOrder:    dto.sortOrder,
        isActive:     dto.isActive,
      },
    });
  }

  async remove(storeId: string, id: string) {
    await this.findOneOrFail(storeId, id);
    // Include storeId in the delete where-clause as defense-in-depth.
    await this.prisma.banner.deleteMany({ where: { id, storeId } });
  }

  async reorder(storeId: string, ids: string[]) {
    await Promise.all(
      ids.map((id, index) =>
        this.prisma.banner.updateMany({
          where: { id, storeId },
          data:  { sortOrder: index },
        }),
      ),
    );
  }

  private async findOneOrFail(storeId: string, id: string) {
    const banner = await this.prisma.banner.findFirst({ where: { id, storeId } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }
}

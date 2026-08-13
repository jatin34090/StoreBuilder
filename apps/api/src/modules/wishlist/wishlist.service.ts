import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ToggleWishlistDto } from './dto/toggle-wishlist.dto';

const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';

// ─── Select shape ─────────────────────────────────────────────────────────────

const WISHLIST_ITEM_SELECT = {
  id: true,
  createdAt: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      basePrice: true,
      discountPct: true,
      isActive: true,
      images: {
        where: { isPrimary: true },
        select: { url: true },
        take: 1,
      },
      variants: {
        select: { price: true, stock: true },
        orderBy: { price: 'asc' as const },
        take: 1,
      },
      _count: { select: { reviews: true } },
    },
  },
} as const;

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Get wishlist ─────────────────────────────────────────────────────────

  async getWishlist(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      select: WISHLIST_ITEM_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return { items, total: items.length };
  }

  // ─── Toggle (add if absent, remove if present) ────────────────────────────

  async toggle(userId: string, dto: ToggleWishlistDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, name: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.wishlistItem.findUnique({
      where: { storeId_userId_productId: { storeId: DEFAULT_STORE_ID, userId, productId: dto.productId } },
    });

    if (existing) {
      await this.prisma.wishlistItem.delete({
        where: { storeId_userId_productId: { storeId: DEFAULT_STORE_ID, userId, productId: dto.productId } },
      });
      this.logger.debug(`Wishlist: removed product ${dto.productId} for user ${userId}`);
      return { action: 'removed', productId: dto.productId, wishlisted: false };
    }

    await this.prisma.wishlistItem.create({
      data: { storeId: DEFAULT_STORE_ID, userId, productId: dto.productId },
    });
    this.logger.debug(`Wishlist: added product ${dto.productId} for user ${userId}`);
    return { action: 'added', productId: dto.productId, wishlisted: true };
  }

  // ─── Check single product ─────────────────────────────────────────────────

  async check(userId: string, productId: string) {
    const item = await this.prisma.wishlistItem.findUnique({
      where: { storeId_userId_productId: { storeId: DEFAULT_STORE_ID, userId, productId } },
      select: { id: true },
    });
    return { productId, wishlisted: !!item };
  }

  // ─── Remove specific item ─────────────────────────────────────────────────

  async remove(userId: string, productId: string) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { storeId_userId_productId: { storeId: DEFAULT_STORE_ID, userId, productId } },
    });
    if (!existing) throw new NotFoundException('Wishlist item not found');

    await this.prisma.wishlistItem.delete({
      where: { storeId_userId_productId: { storeId: DEFAULT_STORE_ID, userId, productId } },
    });
    return { message: 'Removed from wishlist', productId, wishlisted: false };
  }

  // ─── Get wishlist product IDs (for fast frontend check) ──────────────────

  async getWishlistIds(userId: string): Promise<string[]> {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      select: { productId: true },
    });
    return items.map((i) => i.productId);
  }
}

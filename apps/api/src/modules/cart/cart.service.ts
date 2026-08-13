import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpsertCartItemDto } from './dto/upsert-cart-item.dto';
import type { MergeCartDto } from './dto/merge-cart.dto';

const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';

// ─── Select shape ─────────────────────────────────────────────────────────────

const CART_ITEM_SELECT = {
  id: true,
  quantity: true,
  updatedAt: true,
  variant: {
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      price: true,
      stock: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          discountPct: true,
          isActive: true,
          images: {
            where: { isPrimary: true },
            select: { url: true },
            take: 1,
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Get cart ─────────────────────────────────────────────────────────────

  async getCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      select: CART_ITEM_SELECT,
      orderBy: { updatedAt: 'desc' },
    });

    return {
      items,
      summary: this.computeSummary(items),
    };
  }

  // ─── Upsert single item ───────────────────────────────────────────────────

  async upsertItem(userId: string, dto: UpsertCartItemDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      select: {
        id: true,
        stock: true,
        product: { select: { isActive: true, name: true } },
      },
    });

    if (!variant) throw new NotFoundException('Product variant not found');
    if (!variant.product.isActive) {
      throw new BadRequestException(`"${variant.product.name}" is no longer available`);
    }
    if (variant.stock < dto.quantity) {
      throw new BadRequestException(
        `Only ${variant.stock} unit(s) available for this item`,
      );
    }

    const item = await this.prisma.cartItem.upsert({
      where: { storeId_userId_variantId: { storeId: DEFAULT_STORE_ID, userId, variantId: dto.variantId } },
      update: { quantity: dto.quantity },
      create: { storeId: DEFAULT_STORE_ID, userId, variantId: dto.variantId, quantity: dto.quantity },
      select: CART_ITEM_SELECT,
    });

    return item;
  }

  // ─── Remove single item ───────────────────────────────────────────────────

  async removeItem(userId: string, variantId: string) {
    const existing = await this.prisma.cartItem.findUnique({
      where: { storeId_userId_variantId: { storeId: DEFAULT_STORE_ID, userId, variantId } },
    });
    if (!existing) throw new NotFoundException('Cart item not found');

    await this.prisma.cartItem.delete({
      where: { storeId_userId_variantId: { storeId: DEFAULT_STORE_ID, userId, variantId } },
    });

    return { message: 'Item removed from cart' };
  }

  // ─── Clear entire cart ────────────────────────────────────────────────────

  async clearCart(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return { message: 'Cart cleared' };
  }

  // ─── Merge guest cart after login ─────────────────────────────────────────
  /**
   * Merges guest cart (from localStorage) into the server cart after login.
   * Strategy: server quantity wins if item already exists, otherwise item is added.
   * Invalid / out-of-stock items are silently skipped.
   */
  async mergeGuestCart(userId: string, dto: MergeCartDto) {
    const results = { added: 0, skipped: 0, errors: [] as string[] };

    for (const guestItem of dto.items) {
      try {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: guestItem.variantId },
          select: {
            id: true,
            stock: true,
            product: { select: { isActive: true, name: true } },
          },
        });

        if (!variant || !variant.product.isActive || variant.stock === 0) {
          results.skipped++;
          continue;
        }

        const safeQty = Math.min(guestItem.quantity, variant.stock);

        // Only insert if not already in cart — server cart takes priority
        await this.prisma.cartItem.upsert({
          where: { storeId_userId_variantId: { storeId: DEFAULT_STORE_ID, userId, variantId: guestItem.variantId } },
          update: {}, // keep server quantity if exists
          create: { storeId: DEFAULT_STORE_ID, userId, variantId: guestItem.variantId, quantity: safeQty },
        });

        results.added++;
      } catch (err) {
        this.logger.warn(`mergeGuestCart: failed for variant ${guestItem.variantId}`, err);
        results.skipped++;
      }
    }

    const cart = await this.getCart(userId);
    return { ...results, cart };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private computeSummary(items: Array<{ quantity: number; variant: { price: unknown; product: { discountPct: number } } }>) {
    let subtotal = 0;
    let totalItems = 0;

    for (const item of items) {
      const price = Number(item.variant.price);
      subtotal += price * item.quantity;
      totalItems += item.quantity;
    }

    return {
      totalItems,
      subtotal: Math.round(subtotal * 100) / 100,
      shippingCharge: subtotal >= 999 ? 0 : 49,
      total: Math.round((subtotal + (subtotal >= 999 ? 0 : 49)) * 100) / 100,
    };
  }
}

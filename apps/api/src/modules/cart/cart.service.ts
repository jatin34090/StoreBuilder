import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { UpsertCartItemDto } from './dto/upsert-cart-item.dto';
import type { MergeCartDto } from './dto/merge-cart.dto';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // ─── Get cart ─────────────────────────────────────────────────────────────

  async getCart(userId: string, storeId: string) {
    const [items, shippingCfg] = await Promise.all([
      this.prisma.cartItem.findMany({
        where: { userId, storeId },
        select: CART_ITEM_SELECT,
        orderBy: { updatedAt: 'desc' },
      }),
      this.settings.getShippingConfig(storeId),
    ]);

    return {
      items,
      summary: this.computeSummary(items, shippingCfg),
    };
  }

  // ─── Upsert single item ───────────────────────────────────────────────────

  async upsertItem(userId: string, dto: UpsertCartItemDto, storeId: string) {
    // Verify the variant belongs to the current store (prevents cross-store cart poisoning)
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      select: {
        id: true,
        stock: true,
        product: { select: { isActive: true, name: true, storeId: true } },
      },
    });

    if (!variant) throw new NotFoundException('Product variant not found');
    if (variant.product.storeId !== storeId) {
      throw new NotFoundException('Product variant not found');
    }
    if (!variant.product.isActive) {
      throw new BadRequestException(`"${variant.product.name}" is no longer available`);
    }
    if (variant.stock < dto.quantity) {
      throw new BadRequestException(
        `Only ${variant.stock} unit(s) available for this item`,
      );
    }

    const item = await this.prisma.cartItem.upsert({
      where: { storeId_userId_variantId: { storeId, userId, variantId: dto.variantId } },
      update: { quantity: dto.quantity },
      create: { storeId, userId, variantId: dto.variantId, quantity: dto.quantity },
      select: CART_ITEM_SELECT,
    });

    return item;
  }

  // ─── Remove single item ───────────────────────────────────────────────────

  async removeItem(userId: string, variantId: string, storeId: string) {
    const existing = await this.prisma.cartItem.findUnique({
      where: { storeId_userId_variantId: { storeId, userId, variantId } },
    });
    if (!existing) throw new NotFoundException('Cart item not found');

    await this.prisma.cartItem.delete({
      where: { storeId_userId_variantId: { storeId, userId, variantId } },
    });

    return { message: 'Item removed from cart' };
  }

  // ─── Clear entire cart ────────────────────────────────────────────────────

  async clearCart(userId: string, storeId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId, storeId } });
    return { message: 'Cart cleared' };
  }

  // ─── Merge guest cart after login ─────────────────────────────────────────
  /**
   * Merges guest cart (from localStorage) into the server cart after login.
   * Strategy: server quantity wins if item already exists, otherwise item is added.
   * Invalid / out-of-stock items are silently skipped.
   */
  async mergeGuestCart(userId: string, dto: MergeCartDto, storeId: string) {
    const results = { added: 0, skipped: 0, errors: [] as string[] };

    for (const guestItem of dto.items) {
      try {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: guestItem.variantId },
          select: {
            id: true,
            stock: true,
            product: { select: { isActive: true, name: true, storeId: true } },
          },
        });

        // Skip items that don't belong to this store
        if (!variant || variant.product.storeId !== storeId || !variant.product.isActive || variant.stock === 0) {
          results.skipped++;
          continue;
        }

        const safeQty = Math.min(guestItem.quantity, variant.stock);

        // Only insert if not already in cart — server cart takes priority
        await this.prisma.cartItem.upsert({
          where: { storeId_userId_variantId: { storeId, userId, variantId: guestItem.variantId } },
          update: {}, // keep server quantity if exists
          create: { storeId, userId, variantId: guestItem.variantId, quantity: safeQty },
        });

        results.added++;
      } catch (err) {
        this.logger.warn(`mergeGuestCart: failed for variant ${guestItem.variantId}`, err);
        results.skipped++;
      }
    }

    const cart = await this.getCart(userId, storeId);
    return { ...results, cart };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private computeSummary(
    items: Array<{ quantity: number; variant: { price: unknown; product: { discountPct: number } } }>,
    shippingCfg: { enabled: boolean; flatRate: number; freeThreshold: number },
  ) {
    let subtotal = 0;
    let totalItems = 0;

    for (const item of items) {
      const price = Number(item.variant.price);
      subtotal += price * item.quantity;
      totalItems += item.quantity;
    }

    const shippingCharge = !shippingCfg.enabled
      ? 0
      : shippingCfg.freeThreshold > 0 && subtotal >= shippingCfg.freeThreshold
        ? 0
        : shippingCfg.flatRate;

    return {
      totalItems,
      subtotal:      Math.round(subtotal * 100) / 100,
      shippingCharge,
      total:         Math.round((subtotal + shippingCharge) * 100) / 100,
    };
  }
}

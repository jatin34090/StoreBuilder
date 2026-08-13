import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdjustStockDto } from './dto/adjust-stock.dto';
import type { QueryInventoryDto } from './dto/query-inventory.dto';

const LOW_STOCK_DEFAULT_THRESHOLD = 5;

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(dto: QueryInventoryDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (dto.search) {
      where['OR'] = [
        { sku: { contains: dto.search, mode: 'insensitive' } },
        { product: { name: { contains: dto.search, mode: 'insensitive' } } },
      ];
    }

    if (dto.categoryId) {
      where['product'] = { categoryId: dto.categoryId };
    }

    if (dto.threshold !== undefined) {
      where['stock'] = { lte: dto.threshold };
    }

    const [variants, total] = await this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where,
        select: {
          id: true,
          sku: true,
          size: true,
          color: true,
          price: true,
          stock: true,
          weight: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              category: { select: { id: true, name: true } },
              images: {
                where: { isPrimary: true },
                select: { url: true },
                take: 1,
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { stock: 'asc' },
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    return {
      variants: variants.map((v) => ({
        ...v,
        isLowStock: v.stock <= LOW_STOCK_DEFAULT_THRESHOLD,
        isOutOfStock: v.stock === 0,
      })),
      pagination: { page, limit, total },
    };
  }

  async getLowStock(threshold = LOW_STOCK_DEFAULT_THRESHOLD) {
    const variants = await this.prisma.productVariant.findMany({
      where: { stock: { lte: threshold }, product: { isActive: true } },
      select: {
        id: true,
        sku: true,
        stock: true,
        price: true,
        size: true,
        color: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { stock: 'asc' },
    });

    return { variants, threshold };
  }

  async adjustStock(variantId: string, dto: AdjustStockDto, adminId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, sku: true, stock: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const newStock = variant.stock + dto.delta;
    if (newStock < 0) {
      throw new BadRequestException(
        `Cannot reduce stock below 0. Current stock: ${variant.stock}, delta: ${dto.delta}`,
      );
    }

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { stock: newStock },
      select: { id: true, sku: true, stock: true, price: true, product: { select: { name: true } } },
    });

    this.logger.log(
      `Inventory: ${variant.sku} adjusted by ${dto.delta > 0 ? '+' : ''}${dto.delta} ` +
        `(${variant.stock} → ${newStock}) by admin ${adminId}. Reason: ${dto.reason} — ${dto.note}`,
    );

    return {
      variant: updated,
      adjustment: {
        previous: variant.stock,
        delta: dto.delta,
        current: newStock,
        reason: dto.reason,
        note: dto.note,
      },
    };
  }

  async getVariantById(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    return variant;
  }

  // Called internally by order service to decrement stock atomically
  async decrementStock(variantId: string, quantity: number): Promise<void> {
    const result = await this.prisma.productVariant.updateMany({
      where: { id: variantId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });

    if (result.count === 0) {
      throw new BadRequestException('Insufficient stock for variant');
    }
  }

  // Called by order cancellation / return to restore stock
  async incrementStock(variantId: string, quantity: number): Promise<void> {
    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { stock: { increment: quantity } },
    });
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { CouponType } from '@jewellery/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateCouponDto } from './dto/create-coupon.dto';
import type { ValidateCouponDto } from './dto/validate-coupon.dto';

export interface CouponValidationResult {
  valid: true;
  coupon: {
    id: string;
    code: string;
    type: string;
    value: number;
  };
  discountAmount: number;
  finalTotal: number;
}

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Public — Validate at checkout ────────────────────────────────────────

  async validate(dto: ValidateCouponDto): Promise<CouponValidationResult> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: dto.code.toUpperCase().trim() },
    });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Coupon code is invalid or inactive');
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('This coupon has expired');
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    const minOrder = coupon.minOrderAmount ? Number(coupon.minOrderAmount) : 0;
    if (dto.orderSubtotal < minOrder) {
      throw new BadRequestException(
        `Minimum order amount of ₹${minOrder.toFixed(2)} required for this coupon`,
      );
    }

    const discountAmount = this.computeDiscount(coupon, dto.orderSubtotal);
    const finalTotal = Math.max(0, dto.orderSubtotal - discountAmount);

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value),
      },
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalTotal: Math.round(finalTotal * 100) / 100,
    };
  }

  // Called by OrderService when order is placed — increments usedCount atomically
  async consume(couponId: string): Promise<void> {
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async adminFindAll() {
    return this.prisma.coupon.findMany({
      orderBy: { isActive: 'desc' },
      include: { _count: { select: { orders: true } } },
    });
  }

  async create(dto: CreateCouponDto) {
    const code = dto.code.toUpperCase().trim();

    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Coupon code '${code}' already exists`);

    // Validate PERCENT type cap
    if (dto.type === CouponType.PERCENT && Number(dto.value) > 100) {
      throw new BadRequestException('Percentage coupon value cannot exceed 100');
    }

    return this.prisma.coupon.create({
      data: {
        code,
        type: dto.type,
        value: dto.value,
        minOrderAmount: dto.minOrderAmount,
        maxDiscount: dto.maxDiscount,
        usageLimit: dto.usageLimit,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: Partial<CreateCouponDto>) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    if (dto.code && dto.code.toUpperCase() !== coupon.code) {
      const existing = await this.prisma.coupon.findUnique({
        where: { code: dto.code.toUpperCase() },
      });
      if (existing) throw new ConflictException('Coupon code already taken');
    }

    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.code && { code: dto.code.toUpperCase().trim() }),
        ...(dto.type && { type: dto.type }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.minOrderAmount !== undefined && { minOrderAmount: dto.minOrderAmount }),
        ...(dto.maxDiscount !== undefined && { maxDiscount: dto.maxDiscount }),
        ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private computeDiscount(
    coupon: { type: string; value: unknown; maxDiscount: unknown },
    subtotal: number,
  ): number {
    const value = Number(coupon.value);
    const maxDiscount = coupon.maxDiscount ? Number(coupon.maxDiscount) : Infinity;

    if (coupon.type === CouponType.PERCENT) {
      const discount = (subtotal * value) / 100;
      return Math.min(discount, maxDiscount);
    }

    // FLAT
    return Math.min(value, maxDiscount, subtotal);
  }
}

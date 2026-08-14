import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { CreateAddressDto } from './dto/create-address.dto';
import type { UpdateAddressDto } from './dto/update-address.dto';
import type { AdminQueryUsersDto } from './dto/admin-query-users.dto';

const USER_SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isVerified: true,
  isBlocked: true,
  avatar: true,
  dob: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SAFE_SELECT,
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) data['name'] = dto.name.trim();
    if (dto.avatar !== undefined) data['avatar'] = dto.avatar;
    if (dto.dob !== undefined) data['dob'] = new Date(dto.dob);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: USER_SAFE_SELECT,
    });

    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.passwordHash) throw new BadRequestException('This account uses social login and has no password.');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
  }

  async updatePushToken(userId: string, token: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { expoPushToken: token },
    });
  }

  // ─── Addresses ────────────────────────────────────────────────────────────

  async getAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    const addressCount = await this.prisma.address.count({ where: { userId } });
    if (addressCount >= 10) {
      throw new BadRequestException('Maximum 10 addresses allowed per account');
    }

    // If this is the first address or isDefault is requested, handle default logic
    const shouldBeDefault = dto.isDefault ?? addressCount === 0;

    if (shouldBeDefault) {
      // Unset any existing default
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        userId,
        name: dto.name.trim(),
        phone: dto.phone,
        line1: dto.line1.trim(),
        line2: dto.line2?.trim(),
        city: dto.city.trim(),
        state: dto.state.trim(),
        pincode: dto.pincode,
        isDefault: shouldBeDefault,
      },
    });
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    await this.findAddressOrThrow(userId, addressId);

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.line1 && { line1: dto.line1.trim() }),
        ...(dto.line2 !== undefined && { line2: dto.line2?.trim() }),
        ...(dto.city && { city: dto.city.trim() }),
        ...(dto.state && { state: dto.state.trim() }),
        ...(dto.pincode && { pincode: dto.pincode }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.findAddressOrThrow(userId, addressId);

    await this.prisma.address.delete({ where: { id: addressId } });

    // If deleted address was default, promote the next one
    if (address.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { id: 'asc' },
      });
      if (next) {
        await this.prisma.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async adminListUsers(dto: AdminQueryUsersDto, storeId?: string) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Scope to users who have placed orders in this store or are StoreUsers of it.
    // When search is combined with storeId, use AND to preserve tenant isolation.
    if (storeId) {
      const tenantScope = {
        OR: [
          { orders: { some: { storeId } } },
          { storeUsers: { some: { storeId } } },
        ],
      };
      if (dto.search) {
        const s = dto.search.trim();
        where['AND'] = [
          tenantScope,
          {
            OR: [
              { name: { contains: s, mode: 'insensitive' } },
              { email: { contains: s, mode: 'insensitive' } },
              { phone: { contains: s } },
            ],
          },
        ];
      } else {
        Object.assign(where, tenantScope);
      }
    } else if (dto.search) {
      const s = dto.search.trim();
      where['OR'] = [
        { name: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
      ];
    }

    if (dto.role) where['role'] = dto.role;
    if (dto.isBlocked !== undefined) where['isBlocked'] = dto.isBlocked;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          ...USER_SAFE_SELECT,
          _count: { select: { orders: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, pagination: { page, limit, total } };
  }

  async adminBlockUser(adminId: string, targetUserId: string, block: boolean) {
    if (adminId === targetUserId) {
      throw new ForbiddenException('You cannot block your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, isBlocked: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new ForbiddenException('Cannot block another admin');

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isBlocked: block },
      select: USER_SAFE_SELECT,
    });

    this.logger.log(`Admin ${adminId} ${block ? 'blocked' : 'unblocked'} user ${targetUserId}`);
    return updated;
  }

  // ─── Wishlist ─────────────────────────────────────────────────────────────

  async getWishlist(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: {
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
              select: { url: true, publicId: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.filter((i) => i.product.isActive);
  }

  async addToWishlist(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId, isActive: true },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.wishlistItem.upsert({
      where: { storeId_userId_productId: { storeId: DEFAULT_STORE_ID, userId, productId } },
      create: { storeId: DEFAULT_STORE_ID, userId, productId },
      update: {},
    });
  }

  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async findAddressOrThrow(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateReviewDto } from './dto/create-review.dto';
import type { UpdateReviewDto } from './dto/update-review.dto';
import type { QueryReviewsDto, AdminQueryReviewsDto } from './dto/query-reviews.dto';
import type { ModerateReviewDto } from './dto/moderate-review.dto';
import { ReviewSortBy } from './dto/query-reviews.dto';
import type { SearchService } from '../search/search.service';

const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';

// ─── Sort mapping ─────────────────────────────────────────────────────────────

const SORT_MAP: Record<ReviewSortBy, Prisma.ReviewOrderByWithRelationInput> = {
  [ReviewSortBy.NEWEST]:      { createdAt: 'desc' },
  [ReviewSortBy.OLDEST]:      { createdAt: 'asc' },
  [ReviewSortBy.RATING_HIGH]: { rating: 'desc' },
  [ReviewSortBy.RATING_LOW]:  { rating: 'asc' },
};

// ─── Select shape shared between public and admin ─────────────────────────────

const REVIEW_PUBLIC_SELECT = {
  id: true,
  rating: true,
  title: true,
  body: true,
  images: true,
  isVisible: true,
  createdAt: true,
  user: { select: { id: true, name: true, avatar: true } },
} as const;

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly search: SearchService,
  ) {}

  // ─── Customer: Create Review ───────────────────────────────────────────────

  async createReview(userId: string, storeId: string, dto: CreateReviewDto) {
    // 1. Verify the order exists, belongs to this user and store, and is DELIVERED
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, userId, storeId },
      select: {
        id: true,
        status: true,
        items: {
          select: {
            id: true,
            variant: { select: { productId: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        `Reviews can only be submitted for delivered orders. Order status: ${order.status}`,
      );
    }

    // 2. Verify the product was actually in this order
    const productInOrder = order.items.some(
      (item) => item.variant.productId === dto.productId,
    );
    if (!productInOrder) {
      throw new BadRequestException('This product was not part of the specified order');
    }

    // 3. Check for duplicate review (unique constraint: userId + orderId + productId)
    const existing = await this.prisma.review.findUnique({
      where: {
        userId_orderId_productId: {
          userId,
          orderId: dto.orderId,
          productId: dto.productId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('You have already reviewed this product for this order');
    }

    // 4. Verify the product exists and belongs to this store
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, name: true, storeId: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.storeId !== storeId) throw new NotFoundException('Product not found');

    // 5. Create the review
    const review = await this.prisma.review.create({
      data: {
        storeId,
        userId,
        orderId: dto.orderId,
        productId: dto.productId,
        rating: dto.rating,
        title: dto.title ?? null,
        body: dto.body ?? null,
        images: dto.images ?? [],
        isVisible: true,
      },
      select: REVIEW_PUBLIC_SELECT,
    });

    this.logger.log(`Review created: ${review.id} by user ${userId} for product ${dto.productId}`);
    this.search?.indexProduct(dto.productId).catch((e) =>
      this.logger.error('Search index after review create failed', e),
    );

    return review;
  }

  // ─── Customer: Update Own Review ──────────────────────────────────────────

  async updateReview(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true, productId: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('You can only edit your own reviews');

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.title !== undefined  && { title: dto.title }),
        ...(dto.body  !== undefined  && { body: dto.body }),
        ...(dto.images !== undefined && { images: dto.images }),
      },
      select: REVIEW_PUBLIC_SELECT,
    });

    this.search?.indexProduct(review.productId).catch((e) =>
      this.logger.error('Search index after review update failed', e),
    );

    return updated;
  }

  // ─── Customer: Delete Own Review ──────────────────────────────────────────

  async deleteReview(userId: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true, productId: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('You can only delete your own reviews');

    await this.prisma.review.delete({ where: { id: reviewId } });

    this.logger.log(`Review ${reviewId} deleted by user ${userId}`);
    this.search?.indexProduct(review.productId).catch((e) =>
      this.logger.error('Search index after review delete failed', e),
    );

    return { message: 'Review deleted' };
  }

  // ─── Public: Product Reviews ───────────────────────────────────────────────

  async getProductReviews(productId: string, dto: QueryReviewsDto) {
    const page  = dto.page  ?? 1;
    const limit = Math.min(dto.limit ?? 10, 50);
    const skip  = (page - 1) * limit;

    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const where: Prisma.ReviewWhereInput = {
      productId,
      isVisible: true, // public only sees visible reviews
      ...(dto.rating && { rating: dto.rating }),
    };

    const orderBy = SORT_MAP[dto.sortBy ?? ReviewSortBy.NEWEST];

    const [reviews, total, ratingAgg] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        select: REVIEW_PUBLIC_SELECT,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { productId, isVisible: true },
        _count: { _all: true },
        orderBy: { rating: 'desc' },
      }),
    ]);

    // Build rating distribution map { 5: 12, 4: 8, 3: 3, 2: 1, 1: 0 }
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRatingSum = 0;
    let totalRatingCount = 0;
    for (const group of ratingAgg) {
      const cnt = typeof group._count === 'object' && group._count !== null
        ? ((group._count as Record<string, number>)['_all'] ?? 0)
        : 0;
      distribution[group.rating] = cnt;
      totalRatingSum  += group.rating * cnt;
      totalRatingCount += cnt;
    }
    const averageRating = totalRatingCount > 0
      ? Math.round((totalRatingSum / totalRatingCount) * 10) / 10
      : 0;

    return {
      reviews,
      stats: {
        averageRating,
        totalReviews: totalRatingCount,
        distribution,
      },
      pagination: { page, limit, total },
    };
  }

  // ─── Customer: My Reviews ──────────────────────────────────────────────────

  async getMyReviews(userId: string, dto: QueryReviewsDto) {
    const page  = dto.page  ?? 1;
    const limit = Math.min(dto.limit ?? 10, 50);
    const skip  = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = { userId };

    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        select: {
          ...REVIEW_PUBLIC_SELECT,
          product: { select: { id: true, name: true, slug: true } },
        },
        skip,
        take: limit,
        orderBy: SORT_MAP[dto.sortBy ?? ReviewSortBy.NEWEST],
      }),
      this.prisma.review.count({ where }),
    ]);

    return { reviews, pagination: { page, limit, total } };
  }

  // ─── Admin: List All Reviews ───────────────────────────────────────────────

  async adminListReviews(dto: AdminQueryReviewsDto, storeId: string) {
    const page  = dto.page  ?? 1;
    const limit = Math.min(dto.limit ?? 10, 50);
    const skip  = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      storeId,
      ...(dto.productId  && { productId: dto.productId }),
      ...(dto.userId     && { userId: dto.userId }),
      ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
      ...(dto.rating     && { rating: dto.rating }),
    };

    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        select: {
          ...REVIEW_PUBLIC_SELECT,
          product: { select: { id: true, name: true, slug: true } },
        },
        skip,
        take: limit,
        orderBy: SORT_MAP[dto.sortBy ?? ReviewSortBy.NEWEST],
      }),
      this.prisma.review.count({ where }),
    ]);

    return { reviews, pagination: { page, limit, total } };
  }

  // ─── Admin: Moderate (show/hide) ───────────────────────────────────────────

  async moderateReview(reviewId: string, storeId: string, dto: ModerateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, productId: true, storeId: true, isVisible: true },
    });
    if (!review || review.storeId !== storeId) throw new NotFoundException('Review not found');

    if (review.isVisible === dto.isVisible) {
      return { message: `Review is already ${dto.isVisible ? 'visible' : 'hidden'}` };
    }

    await this.prisma.review.update({
      where: { id: reviewId },
      data: { isVisible: dto.isVisible },
    });

    this.logger.log(`Review ${reviewId} ${dto.isVisible ? 'shown' : 'hidden'} by admin`);
    this.search?.indexProduct(review.productId).catch((e) =>
      this.logger.error('Search index after moderation failed', e),
    );

    return { message: `Review ${dto.isVisible ? 'made visible' : 'hidden'} successfully` };
  }

  // ─── Admin: Delete Any Review ──────────────────────────────────────────────

  async adminDeleteReview(reviewId: string, storeId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, productId: true, storeId: true },
    });
    if (!review || review.storeId !== storeId) throw new NotFoundException('Review not found');

    await this.prisma.review.delete({ where: { id: reviewId } });

    this.logger.log(`Review ${reviewId} hard-deleted by admin`);
    this.search?.indexProduct(review.productId).catch((e) =>
      this.logger.error('Search index after admin delete failed', e),
    );

    return { message: 'Review permanently deleted' };
  }
}

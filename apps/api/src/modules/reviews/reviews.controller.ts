import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryReviewsDto, AdminQueryReviewsDto } from './dto/query-reviews.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { type AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ─── Public: Product Reviews ───────────────────────────────────────────────

  @Get('products/:productId/reviews')
  @Public()
  @ApiOperation({
    summary: 'List visible reviews for a product',
    description:
      'Returns paginated reviews with rating stats (average, distribution). ' +
      'Only isVisible:true reviews are shown. Supports rating filter and sort.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', format: 'uuid' })
  @ApiOkResponse({
    description: 'Reviews with aggregate stats',
    schema: {
      type: 'object',
      properties: {
        reviews:    { type: 'array' },
        stats:      { type: 'object', properties: {
          averageRating: { type: 'number' },
          totalReviews:  { type: 'number' },
          distribution:  { type: 'object' },
        }},
        pagination: { type: 'object' },
      },
    },
  })
  getProductReviews(
    @Param('productId') productId: string,
    @Query() query: QueryReviewsDto,
  ) {
    return this.reviewsService.getProductReviews(productId, query);
  }

  // ─── Customer: Create Review ───────────────────────────────────────────────

  @Post('reviews')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a product review',
    description:
      'Requires an order with status DELIVERED that contains the specified product. ' +
      'One review per (user, order, product) combination — returns 409 on duplicate.',
  })
  @ApiCreatedResponse({ description: 'Review created' })
  createReview(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(user.id, dto);
  }

  // ─── Customer: My Reviews ──────────────────────────────────────────────────

  @Get('reviews/me')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'List all reviews written by the authenticated customer' })
  getMyReviews(@CurrentUser() user: AuthUser, @Query() query: QueryReviewsDto) {
    return this.reviewsService.getMyReviews(user.id, query);
  }

  // ─── Customer: Update Own Review ──────────────────────────────────────────

  @Patch('reviews/:id')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update an existing review',
    description: 'Customers can only edit their own reviews. All fields are optional.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID', format: 'uuid' })
  updateReview(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.updateReview(user.id, id, dto);
  }

  // ─── Customer: Delete Own Review ──────────────────────────────────────────

  @Delete('reviews/:id')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete own review' })
  @ApiParam({ name: 'id', description: 'Review UUID', format: 'uuid' })
  deleteReview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reviewsService.deleteReview(user.id, id);
  }

  // ─── Admin: List All Reviews ───────────────────────────────────────────────

  @Get('admin/reviews')
  @Roles(Role.ADMIN)
  @RequirePermission('reviews.read')
  @ApiOperation({
    summary: 'Admin: list all reviews with filters',
    description: 'Filter by productId, userId, isVisible status, and star rating.',
  })
  adminListReviews(@Query() query: AdminQueryReviewsDto) {
    return this.reviewsService.adminListReviews(query);
  }

  // ─── Admin: Moderate Review ────────────────────────────────────────────────

  @Patch('admin/reviews/:id/visibility')
  @Roles(Role.ADMIN)
  @RequirePermission('reviews.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: show or hide a review',
    description:
      'Hidden reviews (isVisible:false) are excluded from public product listings. ' +
      'Idempotent — returns a message if state is already set.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID', format: 'uuid' })
  moderateReview(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.reviewsService.moderateReview(id, dto);
  }

  // ─── Admin: Hard-delete Review ─────────────────────────────────────────────

  @Delete('admin/reviews/:id')
  @Roles(Role.ADMIN)
  @RequirePermission('reviews.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: permanently delete a review',
    description: 'Hard delete — cannot be undone. Prefer /visibility for reversible moderation.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID', format: 'uuid' })
  adminDeleteReview(@Param('id') id: string) {
    return this.reviewsService.adminDeleteReview(id);
  }
}

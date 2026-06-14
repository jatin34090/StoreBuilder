import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Role } from '@jewellery/types';
import { WishlistService } from './wishlist.service';
import { ToggleWishlistDto } from './dto/toggle-wishlist.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Wishlist')
@ApiBearerAuth()
@Controller('wishlist')
@Roles(Role.CUSTOMER)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  // ─── Get Wishlist ──────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Get authenticated user wishlist',
    description: 'Returns all wishlisted products with variant pricing and primary image.',
  })
  @ApiOkResponse({ description: 'Wishlist items with total count' })
  getWishlist(@CurrentUser() user: AuthUser) {
    return this.wishlistService.getWishlist(user.id);
  }

  // ─── Get Wishlist Product IDs ──────────────────────────────────────────────

  @Get('ids')
  @ApiOperation({
    summary: 'Get wishlist product IDs',
    description:
      'Returns a flat array of product IDs in the wishlist. ' +
      'Useful for frontend to mark product cards as wishlisted without fetching full details.',
  })
  @ApiOkResponse({ description: 'Array of product UUIDs' })
  getWishlistIds(@CurrentUser() user: AuthUser) {
    return this.wishlistService.getWishlistIds(user.id);
  }

  // ─── Toggle (Add / Remove) ─────────────────────────────────────────────────

  @Post('toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle wishlist item (add if absent, remove if present)',
    description:
      'Idempotent toggle. Returns { action: "added" | "removed", wishlisted: boolean }.',
  })
  @ApiOkResponse({ description: 'Toggle result with action and new state' })
  toggle(@CurrentUser() user: AuthUser, @Body() dto: ToggleWishlistDto) {
    return this.wishlistService.toggle(user.id, dto);
  }

  // ─── Check Single Product ──────────────────────────────────────────────────

  @Get(':productId/check')
  @ApiOperation({
    summary: 'Check if a product is wishlisted',
    description: 'Returns { productId, wishlisted: boolean }.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Wishlist status for the product' })
  check(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.check(user.id, productId);
  }

  // ─── Remove Specific Item ──────────────────────────────────────────────────

  @Delete(':productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a specific product from wishlist' })
  @ApiParam({ name: 'productId', description: 'Product UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Item removed from wishlist' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.remove(user.id, productId);
  }
}

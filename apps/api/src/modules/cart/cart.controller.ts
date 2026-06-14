import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
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
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CartService } from './cart.service';
import { UpsertCartItemDto } from './dto/upsert-cart-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { type AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
@Roles(Role.CUSTOMER)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // ─── Get Cart ──────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Get authenticated user cart',
    description:
      'Returns all cart items with full variant and product details, ' +
      'plus a computed summary (subtotal, shipping charge, total).',
  })
  @ApiOkResponse({ description: 'Cart with items and summary' })
  getCart(@CurrentUser() user: AuthUser) {
    return this.cartService.getCart(user.id);
  }

  // ─── Add / Update Item ─────────────────────────────────────────────────────

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add or update a cart item',
    description:
      'Upserts a cart item by variantId. If the item already exists, quantity is replaced. ' +
      'Validates stock availability before inserting. Max quantity: 99.',
  })
  @ApiOkResponse({ description: 'Updated cart item' })
  upsertItem(@CurrentUser() user: AuthUser, @Body() dto: UpsertCartItemDto) {
    return this.cartService.upsertItem(user.id, dto);
  }

  // ─── Remove Item ───────────────────────────────────────────────────────────

  @Delete('items/:variantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a specific item from cart by variantId' })
  @ApiParam({ name: 'variantId', description: 'Product variant UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Item removed' })
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('variantId') variantId: string,
  ) {
    return this.cartService.removeItem(user.id, variantId);
  }

  // ─── Clear Cart ────────────────────────────────────────────────────────────

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear entire cart' })
  @ApiOkResponse({ description: 'Cart cleared' })
  clearCart(@CurrentUser() user: AuthUser) {
    return this.cartService.clearCart(user.id);
  }

  // ─── Merge Guest Cart ──────────────────────────────────────────────────────

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Merge guest cart after login',
    description:
      'Called immediately after authentication. ' +
      'Sends guest localStorage cart items; server adds any items not already present. ' +
      'Server cart quantity wins on conflict. Out-of-stock / inactive items are silently skipped. ' +
      'Returns merged cart with summary.',
  })
  @ApiCreatedResponse({ description: 'Merged cart with summary' })
  mergeGuestCart(@CurrentUser() user: AuthUser, @Body() dto: MergeCartDto) {
    return this.cartService.mergeGuestCart(user.id, dto);
  }
}

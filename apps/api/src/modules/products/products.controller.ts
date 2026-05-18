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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { CreateVariantDto } from './dto/product-variant.dto';
import { ReorderImagesDto } from './dto/reorder-images.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@jewellery/types';

@ApiTags('Products')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─── Public — Listing & Detail ────────────────────────────────────────────

  @Public()
  @Get('products')
  @ApiOperation({ summary: 'List products with filters, sort, and pagination' })
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get('products/:slug')
  @ApiOperation({ summary: 'Get full product details by slug (with variants, images, reviews)' })
  @ApiParam({ name: 'slug', example: 'gold-plated-kundan-necklace-set' })
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  // ─── Customer — Cart ─────────────────────────────────────────────────────

  @Get('cart')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get server-synced cart with variant details' })
  getCart(@CurrentUser() user: AuthUser) {
    return this.productsService.getCart(user.id);
  }

  @Post('cart/items')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Add item to cart or increment quantity' })
  @ApiBody({ schema: { properties: { variantId: { type: 'string' }, quantity: { type: 'integer', minimum: 1 } } } })
  addToCart(
    @CurrentUser() user: AuthUser,
    @Body('variantId', ParseUUIDPipe) variantId: string,
    @Body('quantity') quantity = 1,
  ) {
    return this.productsService.addToCart(user.id, variantId, quantity);
  }

  @Patch('cart/items/:variantId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update cart item quantity (0 = remove)' })
  updateCartItem(
    @CurrentUser() user: AuthUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.productsService.updateCartItem(user.id, variantId, quantity);
  }

  @Delete('cart/items/:variantId')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove item from cart' })
  removeCartItem(
    @CurrentUser() user: AuthUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.productsService.removeCartItem(user.id, variantId);
  }

  // ─── Admin — Product CRUD ─────────────────────────────────────────────────

  @Get('admin/products')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] List all products including inactive' })
  adminFindAll(@Query() query: QueryProductsDto) {
    return this.productsService.adminFindAll(query);
  }

  @Post('admin/products')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Create product with variants' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch('admin/products/:id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Update product fields' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete('admin/products/:id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Soft-delete product (deactivates it)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.softDelete(id);
  }

  // ─── Admin — Variants ─────────────────────────────────────────────────────

  @Post('admin/products/:id/variants')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Add a new variant to an existing product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  addVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.productsService.addVariant(id, dto);
  }

  @Patch('admin/products/:id/variants/:variantId')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Update a variant (price, stock, SKU, etc.)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID' })
  updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.productsService.updateVariant(id, variantId, dto);
  }

  @Delete('admin/products/:id/variants/:variantId')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Delete a product variant (must have at least 2)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID' })
  deleteVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.productsService.deleteVariant(id, variantId);
  }

  // ─── Admin — Images (metadata only — actual upload via UploadModule) ──────

  @Delete('admin/products/:id/images/:imgId')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Remove product image record' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiParam({ name: 'imgId', description: 'Image UUID' })
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imgId', ParseUUIDPipe) imgId: string,
  ) {
    return this.productsService.removeImage(id, imgId);
  }

  @Patch('admin/products/:id/images/reorder')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Reorder product images (first ID becomes primary)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  reorderImages(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderImagesDto,
  ) {
    return this.productsService.reorderImages(id, dto);
  }
}

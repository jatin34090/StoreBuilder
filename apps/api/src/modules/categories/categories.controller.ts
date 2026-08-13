import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentStoreId } from '../../common/decorators/current-store.decorator';
import { Role } from '@jewellery/types';

@ApiTags('Categories')
@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ─── Public (storefront) ──────────────────────────────────────────────────

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Get full category tree (active, store-scoped)' })
  getTree(@CurrentStoreId() storeId: string) {
    return this.categoriesService.getTree(storeId);
  }

  @Public()
  @Get('categories/:slug')
  @ApiOperation({ summary: 'Get category by slug (store-scoped)' })
  @ApiParam({ name: 'slug', example: 'necklaces' })
  getCategoryBySlug(@Param('slug') slug: string, @CurrentStoreId() storeId: string) {
    return this.categoriesService.getCategoryBySlug(slug, storeId);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Get('admin/categories')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] List all categories for this store' })
  adminListAll(@CurrentStoreId() storeId: string) {
    return this.categoriesService.adminListAll(storeId);
  }

  @Post('admin/categories')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Create a category in this store' })
  create(@Body() dto: CreateCategoryDto, @CurrentStoreId() storeId: string) {
    return this.categoriesService.create(dto, storeId);
  }

  @Patch('admin/categories/:id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Update a category (store-scoped)' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentStoreId() storeId: string,
  ) {
    return this.categoriesService.update(id, dto, storeId);
  }

  @Delete('admin/categories/:id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Delete a category (store-scoped)' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  delete(@Param('id') id: string, @CurrentStoreId() storeId: string) {
    return this.categoriesService.delete(id, storeId);
  }
}

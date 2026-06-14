import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@jewellery/types';

@ApiTags('Categories')
@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Get full category tree (active categories only)' })
  getTree() {
    return this.categoriesService.getTree();
  }

  @Public()
  @Get('categories/:slug')
  @ApiOperation({ summary: 'Get category by slug with children and parent' })
  @ApiParam({ name: 'slug', example: 'necklaces' })
  getCategoryBySlug(@Param('slug') slug: string) {
    return this.categoriesService.getCategoryBySlug(slug);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Get('admin/categories')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] List all categories including inactive' })
  adminListAll() {
    return this.categoriesService.adminListAll();
  }

  @Post('admin/categories')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Create a new category' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch('admin/categories/:id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Update category name, image, parent, or sort order' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }

  @Delete('admin/categories/:id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Soft-delete category (deactivates it and all children)' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  softDelete(@Param('id') id: string) {
    return this.categoriesService.softDelete(id);
  }
}

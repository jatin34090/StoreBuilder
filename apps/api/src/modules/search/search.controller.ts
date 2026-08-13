import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Role } from '@jewellery/types';
import { SearchService } from './search.service';
import { SearchProductsDto } from './dto/search-products.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentStoreId } from '../../common/decorators/current-store.decorator';
import { RateCategory } from '../../common/decorators/rate-category.decorator';

@ApiTags('Search')
@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // ─── Public: Customer Search ───────────────────────────────────────────────

  @Get('search')
  @Public()
  @RateCategory('search')
  @ApiOperation({
    summary: 'Typo-tolerant product search',
    description:
      'Searches Typesense for products with typo-tolerance. ' +
      'Supports full-text query, category/price/attribute filters, sorting, and pagination. ' +
      'Returns facet counts for dynamic filter UI. ' +
      'Always filters to isActive:true for public access.',
  })
  @ApiOkResponse({
    description: 'Paginated search results with facets',
    schema: {
      type: 'object',
      properties: {
        results: { type: 'array', items: { type: 'object' } },
        pagination: {
          type: 'object',
          properties: {
            page:      { type: 'number' },
            limit:     { type: 'number' },
            total:     { type: 'number' },
            pageCount: { type: 'number' },
          },
        },
        facets: { type: 'object', description: 'Facet counts per field' },
      },
    },
  })
  search(@Query() dto: SearchProductsDto, @CurrentStoreId() storeId: string) {
    return this.searchService.search(dto, false, storeId);
  }

  // ─── Admin: Search with inactive products ─────────────────────────────────

  @Get('admin/search')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin: search products including inactive',
    description: 'Same as public search but includes isActive:false products.',
  })
  adminSearch(@Query() dto: SearchProductsDto, @CurrentStoreId() storeId: string) {
    return this.searchService.search(dto, true, storeId);
  }

  // ─── Admin: Full Reindex ───────────────────────────────────────────────────

  @Post('admin/search/reindex')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: reindex all products in Typesense',
    description:
      'Fetches all products from PostgreSQL and batch-upserts into the Typesense collection. ' +
      'Use after Typesense data loss, schema migration, or first-time setup. ' +
      'Processes in batches of 500 — may take several seconds for large catalogues.',
  })
  reindex() {
    return this.searchService.adminReindex();
  }
}

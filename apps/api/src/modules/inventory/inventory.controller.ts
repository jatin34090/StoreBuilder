import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@jewellery/types';

@ApiTags('Inventory')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN)
@Controller('admin/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] List all variants with stock levels, search, and filters' })
  findAll(@Query() query: QueryInventoryDto) {
    return this.inventoryService.findAll(query);
  }

  @Get('low-stock')
  @ApiOperation({ summary: '[Admin] Get variants at or below stock threshold' })
  @ApiQuery({ name: 'threshold', required: false, type: Number, description: `Default: 5` })
  getLowStock(@Query('threshold') threshold?: number) {
    return this.inventoryService.getLowStock(threshold ? Number(threshold) : undefined);
  }

  @Get(':variantId')
  @ApiOperation({ summary: '[Admin] Get single variant details with product info' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID' })
  getVariant(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.inventoryService.getVariantById(variantId);
  }

  @Patch(':variantId')
  @ApiOperation({ summary: '[Admin] Adjust variant stock (add or subtract units with reason + note)' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID' })
  adjustStock(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.inventoryService.adjustStock(variantId, dto, admin.id);
  }
}

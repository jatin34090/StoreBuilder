import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { QueryCouponsDto } from './dto/query-coupons.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Role } from '@jewellery/types';
import { CurrentStoreId } from '../../common/decorators/current-store.decorator';

@ApiTags('Coupons')
@Controller()
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // ─── Customer — Validate at checkout ─────────────────────────────────────

  @Post('coupons/validate')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate coupon code and compute discount at checkout' })
  validate(@Body() dto: ValidateCouponDto, @CurrentStoreId() storeId: string) {
    return this.couponsService.validate(dto, storeId);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Get('admin/coupons')
  @Roles(Role.ADMIN)
  @RequirePermission('coupons.read')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] List all coupons with usage stats' })
  adminFindAll(@CurrentStoreId() storeId: string, @Query() query: QueryCouponsDto) {
    return this.couponsService.adminFindAll(storeId, query.limit);
  }

  @Post('admin/coupons')
  @Roles(Role.ADMIN)
  @RequirePermission('coupons.create')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Create a new coupon code' })
  create(@Body() dto: CreateCouponDto, @CurrentStoreId() storeId: string) {
    return this.couponsService.create(dto, storeId);
  }

  @Patch('admin/coupons/:id')
  @Roles(Role.ADMIN)
  @RequirePermission('coupons.update')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Update coupon (value, expiry, status, etc.)' })
  @ApiParam({ name: 'id', description: 'Coupon UUID' })
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCouponDto>,
    @CurrentStoreId() storeId: string,
  ) {
    return this.couponsService.update(id, dto, storeId);
  }
}

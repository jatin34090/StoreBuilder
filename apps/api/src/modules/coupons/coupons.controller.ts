import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@jewellery/types';

@ApiTags('Coupons')
@Controller()
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // ─── Customer — Validate at checkout ─────────────────────────────────────

  @Post('coupons/validate')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate coupon code and compute discount at checkout' })
  validate(@Body() dto: ValidateCouponDto) {
    return this.couponsService.validate(dto);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Get('admin/coupons')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] List all coupons with usage stats' })
  adminFindAll() {
    return this.couponsService.adminFindAll();
  }

  @Post('admin/coupons')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Create a new coupon code' })
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Patch('admin/coupons/:id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[Admin] Update coupon (value, expiry, status, etc.)' })
  @ApiParam({ name: 'id', description: 'Coupon UUID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateCouponDto>,
  ) {
    return this.couponsService.update(id, dto);
  }
}

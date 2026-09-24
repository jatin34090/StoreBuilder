import {
  Controller, Get, Post, Patch, Delete, Body, Param, Req, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { BannersService, type CreateBannerDto, type UpdateBannerDto } from './banners.service';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '@prisma/client';

@ApiTags('Banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active banners for the current store (public)' })
  listActive(@Req() req: Request) {
    // Use the middleware-resolved storeId (authoritative, validated against DB).
    // Never read x-store-id from headers directly here — the middleware already did that.
    const storeId = req.storeId ?? '';
    return this.bannersService.listActive(storeId);
  }

  /** Throw 403 when the authenticated user has no store context in their JWT. */
  private requireStoreId(user: AuthUser): string {
    if (!user.storeId) throw new ForbiddenException('No store context in session');
    return user.storeId;
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] List all banners' })
  listAll(@CurrentUser() user: AuthUser) {
    return this.bannersService.list(this.requireStoreId(user));
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Create a banner' })
  create(@Body() dto: CreateBannerDto, @CurrentUser() user: AuthUser) {
    return this.bannersService.create(this.requireStoreId(user), dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Update a banner' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bannersService.update(this.requireStoreId(user), id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Delete a banner' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bannersService.remove(this.requireStoreId(user), id);
  }

  @Post('reorder')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Reorder banners' })
  reorder(@Body() body: { ids: string[] }, @CurrentUser() user: AuthUser) {
    return this.bannersService.reorder(this.requireStoreId(user), body.ids);
  }
}

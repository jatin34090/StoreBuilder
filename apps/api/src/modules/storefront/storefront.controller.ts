import { Controller, Get, Patch, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { StorefrontService } from './storefront.service';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role, HomepageSectionType, Prisma } from '@prisma/client';

@ApiTags('Storefront')
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Public()
  @Get('homepage')
  @ApiOperation({ summary: 'Get homepage section layout (public)' })
  getHomepageSections(@Req() req: Request) {
    const storeId = (req.headers['x-store-id'] as string) || (req as any).storeId || '';
    return this.storefrontService.getHomepageSections(storeId);
  }

  @Patch('homepage/reorder')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Reorder homepage sections' })
  reorderSections(
    @Body() body: { order: HomepageSectionType[] },
    @CurrentUser() user: AuthUser,
  ) {
    return this.storefrontService.reorderSections(user.storeId ?? '', body.order);
  }

  @Patch('homepage/section')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Update a homepage section (enable/disable/config)' })
  upsertSection(
    @Body() body: { type: HomepageSectionType; enabled?: boolean; sortOrder?: number; config?: Prisma.InputJsonValue },
    @CurrentUser() user: AuthUser,
  ) {
    return this.storefrontService.upsertSection(user.storeId ?? '', body.type, body);
  }
}

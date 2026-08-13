import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { StoreRole } from '@prisma/client';
import { StoresService } from './stores.service';
import { StoreProvisioningService } from './store-provisioning.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { QueryStoresDto } from './dto/query-stores.dto';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentStoreId } from '../../common/decorators/current-store.decorator';
import { Role } from '@jewellery/types';

// ─── Super Admin Routes (/super-admin/stores) ─────────────────────────────────

@ApiTags('Super Admin — Stores')
@ApiBearerAuth('access-token')
@Controller('super-admin/stores')
export class SuperAdminStoresController {
  constructor(
    private readonly storesService: StoresService,
    private readonly provisioning: StoreProvisioningService,
  ) {}

  @Get('overview')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform-wide overview: total stores, revenue, recent API logs' })
  getPlatformOverview() {
    return this.storesService.getPlatformOverview();
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all tenant stores with filters and pagination' })
  findAll(@Query() query: QueryStoresDto) {
    return this.storesService.findAll(query);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create and fully provision a new tenant store (uses StoreProvisioningService)' })
  create(@Body() dto: CreateStoreDto) {
    if (dto.ownerUserId) {
      // Full provisioning with default theme, nav, subscription, onboarding state
      return this.provisioning.provision({
        name:        dto.name,
        slug:        dto.slug,
        plan:        dto.plan,
        logoUrl:     dto.logoUrl,
        ownerUserId: dto.ownerUserId,
      });
    }
    // No owner yet — simple store shell (super-admin can assign owner later)
    return this.storesService.create(dto);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get full store details including members, settings, and quota' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  findOne(@Param('id') id: string) {
    return this.storesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update store plan, domain, branding, or active status' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  update(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.storesService.update(id, dto);
  }

  @Patch(':id/suspend')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend a store (sets isActive=false, blocks all requests)' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  suspend(@Param('id') id: string) {
    return this.storesService.suspend(id);
  }

  @Patch(':id/reinstate')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reinstate a suspended store' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  reinstate(@Param('id') id: string) {
    return this.storesService.reinstate(id);
  }

  @Get(':id/usage')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get per-tenant quota usage vs plan limits' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  getUsage(@Param('id') id: string) {
    return this.storesService.getUsage(id);
  }
}

// ─── Admin Routes (/admin/store) — store owner manages their own store ─────────

@ApiTags('Admin — Store Management')
@ApiBearerAuth('access-token')
@Controller('admin/store')
export class AdminStoreController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get the current store details' })
  getMyStore(@CurrentStoreId() storeId: string) {
    return this.storesService.findOne(storeId);
  }

  @Patch()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update store branding (name, logo, favicon, custom domain)' })
  updateMyStore(@CurrentStoreId() storeId: string, @Body() dto: UpdateStoreDto) {
    // Strip plan/isActive — only super admin can change those
    const { plan: _p, isActive: _a, ...safeDto } = dto;
    return this.storesService.update(storeId, safeDto);
  }

  @Get('usage')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'View your plan usage vs limits' })
  getUsage(@CurrentStoreId() storeId: string) {
    return this.storesService.getUsage(storeId);
  }

  // ─── Settings ───────────────────────────────────────────────────────────

  @Get('settings')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all store settings as a key-value map' })
  getSettings(@CurrentStoreId() storeId: string) {
    return this.storesService.getSettings(storeId);
  }

  @Post('settings')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create or update a store setting' })
  upsertSetting(@CurrentStoreId() storeId: string, @Body() dto: UpsertSettingDto) {
    return this.storesService.upsertSetting(storeId, dto);
  }

  @Delete('settings/:key')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a store setting by key' })
  @ApiParam({ name: 'key', description: 'Setting key' })
  deleteSetting(@CurrentStoreId() storeId: string, @Param('key') key: string) {
    return this.storesService.deleteSetting(storeId, key);
  }

  // ─── Team Members ────────────────────────────────────────────────────────

  @Get('members')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all staff members of this store' })
  listMembers(@CurrentStoreId() storeId: string) {
    return this.storesService.listMembers(storeId);
  }

  @Post('members')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Add a user as a staff member' })
  addMember(
    @CurrentStoreId() storeId: string,
    @Body('userId') userId: string,
    @Body('role') role: StoreRole,
  ) {
    return this.storesService.addMember(storeId, userId, role ?? StoreRole.STAFF);
  }

  @Patch('members/:userId/role')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Change a member role' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  updateMemberRole(
    @CurrentStoreId() storeId: string,
    @Param('userId') userId: string,
    @Body('role') role: StoreRole,
  ) {
    return this.storesService.updateMemberRole(storeId, userId, role);
  }

  @Delete('members/:userId')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a staff member from this store' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  removeMember(@CurrentStoreId() storeId: string, @Param('userId') userId: string) {
    return this.storesService.removeMember(storeId, userId);
  }
}

// ─── Public Routes (/stores/public) — no auth, used by Next.js middleware ────

@ApiTags('Public — Store Resolution')
@Controller('stores/public')
export class PublicStoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get('resolve')
  @Public()
  @ApiOperation({ summary: 'Resolve store metadata by slug or custom domain (no auth)' })
  resolve(@Query('slug') slug?: string, @Query('domain') domain?: string) {
    return this.storesService.resolvePublic(slug, domain);
  }

  @Get('check-slug')
  @Public()
  @ApiOperation({ summary: 'Check if a store slug is available (no auth)' })
  checkSlug(@Query('slug') slug: string) {
    return this.storesService.checkSlug(slug);
  }
}

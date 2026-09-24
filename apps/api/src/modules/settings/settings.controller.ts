import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentStoreId } from '../../common/decorators/current-store.decorator';
import { Role } from '@prisma/client';

@ApiTags('Settings')
@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── Theme ────────────────────────────────────────────────────────────────

  @Public()
  @Get('settings/theme')
  @ApiOperation({ summary: 'Get current store theme (public)' })
  getTheme(@CurrentStoreId() storeId: string) {
    return this.settingsService.getTheme(storeId ?? '');
  }

  @Patch('settings/theme')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Update store theme' })
  updateTheme(@Body() body: Record<string, string>, @CurrentUser() user: AuthUser) {
    return this.settingsService.updateTheme(user.storeId ?? '', body);
  }

  @Public()
  @Get('settings/theme/presets')
  @ApiOperation({ summary: 'Get custom theme presets (public)' })
  getCustomPresets(@CurrentStoreId() storeId: string) {
    return this.settingsService.getCustomPresets(storeId ?? '');
  }

  @Patch('settings/theme/presets')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Save custom theme presets' })
  updateCustomPresets(@Body() body: { presets: unknown[] }, @CurrentUser() user: AuthUser) {
    return this.settingsService.updateCustomPresets(user.storeId ?? '', body.presets);
  }

  // ── Site Config ──────────────────────────────────────────────────────────

  @Public()
  @Get('settings/site')
  @ApiOperation({ summary: 'Get store branding & content config (public)' })
  getSiteConfig(@CurrentStoreId() storeId: string) {
    return this.settingsService.getSiteConfig(storeId ?? '');
  }

  @Patch('settings/site')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Update store branding & content config' })
  updateSiteConfig(@Body() body: Record<string, string>, @CurrentUser() user: AuthUser) {
    return this.settingsService.updateSiteConfig(user.storeId ?? '', body);
  }

  // ── Layout Config ────────────────────────────────────────────────────────

  @Public()
  @Get('settings/layout')
  @ApiOperation({ summary: 'Get layout preferences (public)' })
  getLayoutConfig(@CurrentStoreId() storeId: string) {
    return this.settingsService.getLayoutConfig(storeId ?? '');
  }

  @Patch('settings/layout')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Update layout preferences' })
  updateLayoutConfig(@Body() body: Record<string, string>, @CurrentUser() user: AuthUser) {
    return this.settingsService.updateLayoutConfig(user.storeId ?? '', body);
  }

  // ── Shipping Config ──────────────────────────────────────────────────────

  @Public()
  @Get('settings/shipping')
  @ApiOperation({ summary: 'Get store shipping configuration (public)' })
  getShippingConfig(@CurrentStoreId() storeId: string) {
    return this.settingsService.getShippingConfig(storeId ?? '');
  }

  @Patch('settings/shipping')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Update shipping configuration' })
  updateShippingConfig(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    return this.settingsService.updateShippingConfig(user.storeId ?? '', body as any);
  }
}

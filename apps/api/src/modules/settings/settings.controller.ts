import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '@prisma/client';

@ApiTags('Settings')
@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── Theme ────────────────────────────────────────────────────────────────

  @Public()
  @Get('settings/theme')
  @ApiOperation({ summary: 'Get current site theme (public)' })
  getTheme() {
    return this.settingsService.getTheme();
  }

  @Patch('settings/theme')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Update site theme' })
  updateTheme(@Body() body: Record<string, string>) {
    return this.settingsService.updateTheme(body);
  }

  @Public()
  @Get('settings/theme/presets')
  @ApiOperation({ summary: 'Get custom theme presets (public)' })
  getCustomPresets() {
    return this.settingsService.getCustomPresets();
  }

  @Patch('settings/theme/presets')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Save custom theme presets' })
  updateCustomPresets(@Body() body: { presets: unknown[] }) {
    return this.settingsService.updateCustomPresets(body.presets);
  }

  // ── Site Config ──────────────────────────────────────────────────────────

  @Public()
  @Get('settings/site')
  @ApiOperation({ summary: 'Get site branding & content config (public)' })
  getSiteConfig() {
    return this.settingsService.getSiteConfig();
  }

  @Patch('settings/site')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Update site branding & content config' })
  updateSiteConfig(@Body() body: Record<string, string>) {
    return this.settingsService.updateSiteConfig(body);
  }

  // ── Layout Config ────────────────────────────────────────────────────────

  @Public()
  @Get('settings/layout')
  @ApiOperation({ summary: 'Get layout preferences (public)' })
  getLayoutConfig() {
    return this.settingsService.getLayoutConfig();
  }

  @Patch('settings/layout')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Update layout preferences' })
  updateLayoutConfig(@Body() body: Record<string, string>) {
    return this.settingsService.updateLayoutConfig(body);
  }
}

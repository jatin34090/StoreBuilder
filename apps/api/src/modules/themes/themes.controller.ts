import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { THEME_REGISTRY } from './themes.registry';

@ApiTags('Themes')
@Controller('themes')
export class ThemesController {

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all available storefront themes' })
  listThemes() {
    return THEME_REGISTRY.filter((t) => t.status !== 'deprecated');
  }
}

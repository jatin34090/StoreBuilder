import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SetMetadata } from '@nestjs/common';
import { SKIP_TENANT_RATE_LIMIT } from '../../common/guards/tenant-rate-limit.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@jewellery/types';
import { DomainsService } from './domains.service';
import { AddDomainDto } from './dto/add-domain.dto';

@ApiTags('Admin — Domain Management')
@ApiBearerAuth('access-token')
@SetMetadata(SKIP_TENANT_RATE_LIMIT, true)
@Controller('admin/store/domains')
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  private sid(user: AuthUser): string {
    if (!user.storeId) throw new ForbiddenException('No store context in session');
    return user.storeId;
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all domains for the authenticated store' })
  list(@CurrentUser() user: AuthUser) {
    return this.domains.listDomains(this.sid(user));
  }

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a custom domain to connect' })
  add(@CurrentUser() user: AuthUser, @Body() dto: AddDomainDto) {
    return this.domains.addDomain(this.sid(user), dto.domain);
  }

  @Get(':id/instructions')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get DNS verification instructions for a domain' })
  @ApiParam({ name: 'id', description: 'StoreDomain UUID' })
  instructions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.domains.getVerificationInstructions(this.sid(user), id);
  }

  @Post(':id/verify')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger DNS verification check for a domain' })
  @ApiParam({ name: 'id', description: 'StoreDomain UUID' })
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.domains.verifyDomain(this.sid(user), id);
  }

  @Patch(':id/primary')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a domain as the primary domain for this store' })
  @ApiParam({ name: 'id', description: 'StoreDomain UUID' })
  setPrimary(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.domains.setPrimary(this.sid(user), id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a custom domain from this store' })
  @ApiParam({ name: 'id', description: 'StoreDomain UUID' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.domains.removeDomain(this.sid(user), id);
  }
}

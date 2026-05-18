import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { PushTokenDto } from './dto/push-token.dto';
import { AdminQueryUsersDto } from './dto/admin-query-users.dto';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@jewellery/types';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Customer — Profile ──────────────────────────────────────────────────

  @Get('users/me')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  getProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('users/me')
  @ApiOperation({ summary: 'Update name, avatar, or date of birth' })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('users/me/push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Register Expo push notification token' })
  updatePushToken(@CurrentUser() user: AuthUser, @Body() dto: PushTokenDto) {
    return this.usersService.updatePushToken(user.id, dto.token);
  }

  // ─── Customer — Addresses ────────────────────────────────────────────────

  @Get('users/me/addresses')
  @ApiOperation({ summary: 'List saved delivery addresses' })
  getAddresses(@CurrentUser() user: AuthUser) {
    return this.usersService.getAddresses(user.id);
  }

  @Post('users/me/addresses')
  @ApiOperation({ summary: 'Add a new delivery address (max 10)' })
  createAddress(@CurrentUser() user: AuthUser, @Body() dto: CreateAddressDto) {
    return this.usersService.createAddress(user.id, dto);
  }

  @Patch('users/me/addresses/:id')
  @ApiOperation({ summary: 'Update a delivery address' })
  @ApiParam({ name: 'id', description: 'Address UUID' })
  updateAddress(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(user.id, id, dto);
  }

  @Delete('users/me/addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a delivery address' })
  @ApiParam({ name: 'id', description: 'Address UUID' })
  deleteAddress(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.deleteAddress(user.id, id);
  }

  // ─── Customer — Wishlist ─────────────────────────────────────────────────

  @Get('wishlist')
  @ApiOperation({ summary: 'Get product wishlist' })
  getWishlist(@CurrentUser() user: AuthUser) {
    return this.usersService.getWishlist(user.id);
  }

  @Post('wishlist/:productId')
  @ApiOperation({ summary: 'Add product to wishlist' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  addToWishlist(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.usersService.addToWishlist(user.id, productId);
  }

  @Delete('wishlist/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove product from wishlist' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  removeFromWishlist(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.usersService.removeFromWishlist(user.id, productId);
  }

  // ─── Admin — User Management ─────────────────────────────────────────────

  @Get('admin/users')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] List all users with filters and pagination' })
  adminListUsers(@Query() query: AdminQueryUsersDto) {
    return this.usersService.adminListUsers(query);
  }

  @Patch('admin/users/:id/block')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Block or unblock a user account' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  adminBlockUser(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) targetId: string,
    @Body('block') block: boolean,
  ) {
    return this.usersService.adminBlockUser(admin.id, targetId, block);
  }
}

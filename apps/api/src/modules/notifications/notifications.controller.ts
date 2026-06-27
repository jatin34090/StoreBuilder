import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { type AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ─── Customer Routes ───────────────────────────────────────────────────────

  @Get('notifications')
  @ApiOperation({
    summary: 'Get authenticated user notifications',
    description:
      'Returns paginated notifications for the current user. ' +
      'Includes total unread count in every response for badge display. ' +
      'Filter by type or isRead status.',
  })
  @ApiOkResponse({
    description: 'Paginated notifications with unread count',
    schema: {
      type: 'object',
      properties: {
        notifications: { type: 'array' },
        unreadCount:   { type: 'number' },
        pagination:    { type: 'object' },
      },
    },
  })
  getNotifications(@CurrentUser() user: AuthUser, @Query() query: QueryNotificationsDto) {
    return this.notificationsService.getUserNotifications(user.id, query);
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'Get unread notification count (for badge)' })
  @ApiOkResponse({ schema: { type: 'object', properties: { count: { type: 'number' } } } })
  getUnreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'Notification UUID', format: 'uuid' })
  markAsRead(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Patch('notifications/push-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register/refresh the current user Expo push token' })
  savePushToken(@CurrentUser() user: AuthUser, @Body('token') token: string) {
    return this.notificationsService.savePushToken(user.id, token);
  }

  // ─── Admin Routes ──────────────────────────────────────────────────────────

  @Post('admin/notifications')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Admin: send notification to a specific user',
    description: 'Creates an in-app notification and triggers push/WebSocket channels.',
  })
  @ApiCreatedResponse({ description: 'Notification created' })
  adminCreate(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.adminCreate(dto);
  }

  @Post('admin/notifications/broadcast')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: broadcast notification to users',
    description:
      'Targets users by role (CUSTOMER, ADMIN, DELIVERY_AGENT) or explicit userIds list. ' +
      'Omit both to notify every non-blocked user. ' +
      'Uses createMany for efficient batch insert. Returns count of users notified.',
  })
  @ApiOkResponse({ schema: { type: 'object', properties: { sent: { type: 'number' } } } })
  adminBroadcast(@Body() dto: BroadcastNotificationDto) {
    return this.notificationsService.adminBroadcast(dto);
  }
}

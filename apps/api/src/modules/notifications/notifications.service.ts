import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma, NotificationType, Role, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateNotificationDto } from './dto/create-notification.dto';
import type { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import type { QueryNotificationsDto } from './dto/query-notifications.dto';

// ─── Internal helper types ────────────────────────────────────────────────────

interface NotifyOptions {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Customer: List Notifications ─────────────────────────────────────────

  async getUserNotifications(userId: string, dto: QueryNotificationsDto) {
    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 20;
    const skip  = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(dto.type    !== undefined && { type: dto.type }),
      ...(dto.isRead  !== undefined && { isRead: dto.isRead }),
    };

    const [notifications, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          data: true,
          isRead: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: { page, limit, total },
    };
  }

  // ─── Customer: Unread Count ────────────────────────────────────────────────

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  // ─── Customer: Mark Single As Read ────────────────────────────────────────

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, userId: true, isRead: true },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException('Not your notification');

    if (notification.isRead) return { message: 'Already marked as read' };

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
    return { message: 'Notification marked as read' };
  }

  // ─── Customer: Mark All As Read ───────────────────────────────────────────

  async markAllAsRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: `${count} notification${count !== 1 ? 's' : ''} marked as read` };
  }

  // ─── Admin: Create For Specific User ──────────────────────────────────────

  async adminCreate(dto: CreateNotificationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, expoPushToken: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        data: (dto.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
      select: { id: true, type: true, title: true, body: true, createdAt: true },
    });

    this.fireDeliveryChannels(dto.userId, user.expoPushToken, dto.title, dto.body, dto.data);

    return notification;
  }

  // ─── Admin: Broadcast ─────────────────────────────────────────────────────

  async adminBroadcast(dto: BroadcastNotificationDto): Promise<{ sent: number }> {
    // Resolve target user IDs
    let userIds: string[];
    let pushTokens: Map<string, string | null>;

    if (dto.userIds && dto.userIds.length > 0) {
      // Explicit user list
      const users = await this.prisma.user.findMany({
        where: { id: { in: dto.userIds }, isBlocked: false },
        select: { id: true, expoPushToken: true },
      });
      userIds   = users.map((u) => u.id);
      pushTokens = new Map(users.map((u) => [u.id, u.expoPushToken ?? null]));
    } else {
      // Target by role (or all if no role given)
      const where: Prisma.UserWhereInput = {
        isBlocked: false,
        ...(dto.targetRole && { role: dto.targetRole }),
      };
      const users = await this.prisma.user.findMany({
        where,
        select: { id: true, expoPushToken: true },
      });
      userIds   = users.map((u) => u.id);
      pushTokens = new Map(users.map((u) => [u.id, u.expoPushToken ?? null]));
    }

    if (userIds.length === 0) return { sent: 0 };

    // Batch-insert notifications
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        data: (dto.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        isRead: false,
      })),
      skipDuplicates: true,
    });

    // Fire push for users with tokens
    for (const userId of userIds) {
      const token = pushTokens.get(userId) ?? null;
      this.fireDeliveryChannels(userId, token, dto.title, dto.body, dto.data);
    }

    this.logger.log(
      `Broadcast sent: type=${dto.type}, target=${dto.targetRole ?? 'all'}, sent=${userIds.length}`,
    );

    return { sent: userIds.length };
  }

  async savePushToken(userId: string, token: string): Promise<{ success: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { expoPushToken: token ?? null },
    });
    return { success: true };
  }

  // ─── Core: notify() — used by all other modules ───────────────────────────

  /**
   * Creates a single in-app notification and triggers all delivery channels.
   * Never throws — failures are logged so callers are never blocked.
   */
  async notify(userId: string, options: NotifyOptions): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { expoPushToken: true },
      });

      await this.prisma.notification.create({
        data: {
          userId,
          type: options.type,
          title: options.title,
          body: options.body,
          data: (options.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });

      this.fireDeliveryChannels(userId, user?.expoPushToken ?? null, options.title, options.body, options.data);
    } catch (error) {
      this.logger.error(`notify() failed for user ${userId}`, error);
    }
  }

  /**
   * Batch-notifies multiple users with the same message.
   */
  async notifyMany(userIds: string[], options: NotifyOptions): Promise<void> {
    if (userIds.length === 0) return;
    try {
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          type: options.type,
          title: options.title,
          body: options.body,
          data: (options.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          isRead: false,
        })),
        skipDuplicates: true,
      });

      // Fire push for each (tokens fetched lazily per user in fireDeliveryChannels)
      for (const userId of userIds) {
        this.fireDeliveryChannels(userId, null, options.title, options.body, options.data);
      }
    } catch (error) {
      this.logger.error('notifyMany() failed', error);
    }
  }

  // ─── Domain-specific Helper Methods ───────────────────────────────────────
  //     Called by OrdersService, PaymentsService, ReviewsService, etc.

  async notifyOrderPlaced(userId: string, orderId: string, orderNumber: string, total: number) {
    await this.notify(userId, {
      type: NotificationType.ORDER,
      title: 'Order Placed Successfully!',
      body: `Your order ${orderNumber} for ₹${total.toFixed(2)} has been placed. We'll confirm it shortly.`,
      data: { orderId, orderNumber },
    });
  }

  async notifyOrderStatusUpdated(
    userId: string,
    orderId: string,
    orderNumber: string,
    status: OrderStatus,
  ) {
    const statusMessages: Partial<Record<OrderStatus, string>> = {
      [OrderStatus.CONFIRMED]:        'Your order has been confirmed and is being prepared.',
      [OrderStatus.PROCESSING]:       'Your order is being processed.',
      [OrderStatus.SHIPPED]:          'Your order has been shipped! Track it in the app.',
      [OrderStatus.OUT_FOR_DELIVERY]: 'Your order is out for delivery. Expect it today!',
      [OrderStatus.DELIVERED]:        'Your order has been delivered. Enjoy your jewellery!',
      [OrderStatus.CANCELLED]:        'Your order has been cancelled. Any payment will be refunded.',
      [OrderStatus.RETURN_REQUESTED]: 'Your return request has been received.',
      [OrderStatus.RETURNED]:         'Your return has been processed.',
      [OrderStatus.REFUNDED]:         'Your refund has been initiated and will appear within 5-7 days.',
    };

    const body = statusMessages[status] ?? `Order ${orderNumber} status updated to ${status}.`;

    await this.notify(userId, {
      type: NotificationType.ORDER,
      title: `Order ${orderNumber}: ${status.replace(/_/g, ' ')}`,
      body,
      data: { orderId, orderNumber, status },
    });
  }

  async notifyDeliveryAssigned(userId: string, orderId: string, orderNumber: string) {
    await this.notify(userId, {
      type: NotificationType.DELIVERY,
      title: 'Delivery Agent Assigned',
      body: `A delivery agent has been assigned to your order ${orderNumber} and will pick it up soon.`,
      data: { orderId, orderNumber },
    });
  }

  async notifyPaymentFailed(userId: string, orderId: string, orderNumber: string) {
    await this.notify(userId, {
      type: NotificationType.ORDER,
      title: 'Payment Failed',
      body: `Payment for order ${orderNumber} could not be processed. Please retry or use a different payment method.`,
      data: { orderId, orderNumber },
    });
  }

  async notifyRefundInitiated(userId: string, orderId: string, amount: number) {
    await this.notify(userId, {
      type: NotificationType.ORDER,
      title: 'Refund Initiated',
      body: `A refund of ₹${amount.toFixed(2)} has been initiated and will reflect in 5-7 business days.`,
      data: { orderId, amount },
    });
  }

  async notifyOfferCreated(couponCode: string, description: string, expiresAt?: Date) {
    const expiry = expiresAt
      ? ` Valid until ${expiresAt.toLocaleDateString('en-IN')}.`
      : '';
    await this.prisma.notification.createMany({
      data: (
        await this.prisma.user.findMany({
          where: { role: Role.CUSTOMER, isBlocked: false },
          select: { id: true },
        })
      ).map((u) => ({
        userId: u.id,
        type: NotificationType.OFFER,
        title: `New Offer: ${couponCode}`,
        body: `${description}${expiry}`,
        data: { couponCode } as Prisma.InputJsonValue,
        isRead: false,
      })),
      skipDuplicates: true,
    });
    this.logger.log(`Offer notification broadcast: coupon=${couponCode}`);
  }

  async notifyReviewApproved(userId: string, productName: string) {
    await this.notify(userId, {
      type: NotificationType.REVIEW,
      title: 'Review Published',
      body: `Your review for "${productName}" is now live. Thank you for sharing your experience!`,
      data: { productName },
    });
  }

  async notifyReviewHidden(userId: string, productName: string) {
    await this.notify(userId, {
      type: NotificationType.REVIEW,
      title: 'Review Under Review',
      body: `Your review for "${productName}" has been temporarily hidden by our moderation team.`,
      data: { productName },
    });
  }

  async notifySystemMessage(userId: string, title: string, body: string) {
    await this.notify(userId, { type: NotificationType.SYSTEM, title, body });
  }

  // ─── Phase 2 Delivery Channel Placeholders ────────────────────────────────

  private fireDeliveryChannels(
    userId: string,
    expoPushToken: string | null | undefined,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): void {
    // Fire all async — never block the caller
    this.emitWebSocket(userId, title, body, data);
    if (expoPushToken) {
      this.sendExpoPush(expoPushToken, title, body, data).catch((e) =>
        this.logger.error(`Push failed for user ${userId}`, e),
      );
    }
  }

  /**
   * Phase 2: Replace with actual Expo Push Notifications SDK call.
   * Expo push token stored at User.expoPushToken (set from mobile app).
   * Ref: https://docs.expo.dev/push-notifications/sending-notifications/
   */
  private async sendExpoPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    // TODO (Phase 2):
    // const message: ExpoPushMessage = { to: token, title, body, data, sound: 'default' };
    // await expo.sendPushNotificationsAsync([message]);
    this.logger.debug(`[PUSH:EXPO] to=${token} title="${title}" data=${JSON.stringify(data)}`);
  }

  /**
   * Phase 2: Replace with Resend API call for transactional email.
   * Use for order confirmations, shipping updates, password resets.
   * Ref: https://resend.com/docs/api-reference/emails/send-email
   */
  async sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
    // TODO (Phase 2):
    // await resend.emails.send({ from: RESEND_FROM_EMAIL, to, subject, html: htmlBody });
    this.logger.debug(`[EMAIL:RESEND] to=${to} subject="${subject}"`);
  }

  /**
   * Phase 2: Replace with MSG91 SMS API call.
   * Used for OTP delivery and critical order alerts.
   * Ref: https://docs.msg91.com/reference/send-sms
   */
  async sendSms(phone: string, message: string): Promise<void> {
    // TODO (Phase 2):
    // await msg91.sendSms({ to: phone, message, sender: MSG91_SENDER_ID });
    this.logger.debug(`[SMS:MSG91] to=${phone} message="${message}"`);
  }

  /**
   * Phase 2: Replace with Socket.IO gateway call.
   * Emits 'notification:new' event to the authenticated user's room.
   * Ref: NotificationsGateway (to be built in Phase 2)
   */
  private emitWebSocket(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): void {
    // TODO (Phase 2):
    // this.notificationsGateway.emitToUser(userId, 'notification:new', { title, body, data });
    this.logger.debug(`[WS] notification:new → user ${userId} title="${title}"`);
  }
}

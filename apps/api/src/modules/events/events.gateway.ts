import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// ─── Room naming conventions ──────────────────────────────────────────────────
//
//  user:{userId}              — customer receives their own order/delivery updates
//  store:{storeId}            — store admin receives all store-level events
//  store:{storeId}:delivery   — delivery agents receive their assigned delivery events
//  super-admin                — super admins receive platform-wide events

export const Rooms = {
  user:     (userId: string)  => `user:${userId}`,
  store:    (storeId: string) => `store:${storeId}`,
  delivery: (storeId: string) => `store:${storeId}:delivery`,
  superAdmin: ()              => 'super-admin',
} as const;

// ─── Event name catalogue ─────────────────────────────────────────────────────

export const WsEvents = {
  // Order lifecycle
  ORDER_PLACED:            'order:placed',
  ORDER_STATUS_CHANGED:    'order:status_changed',
  ORDER_PAYMENT_CONFIRMED: 'order:payment_confirmed',
  ORDER_CANCELLED:         'order:cancelled',
  ORDER_RETURN_REQUESTED:  'order:return_requested',

  // Delivery lifecycle
  DELIVERY_ASSIGNED:        'delivery:assigned',
  DELIVERY_STATUS_CHANGED:  'delivery:status_changed',

  // Platform (super-admin)
  STORE_CREATED:    'store:created',
  STORE_SUSPENDED:  'store:suspended',
  STORE_REINSTATED: 'store:reinstated',
} as const;

interface JwtPayload {
  sub:       string;
  role:      string;
  storeId?:  string;
  storeRole?: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    // Allow same origins as HTTP — driven by env at runtime
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      // Allow all in dev; tighten via CORS_ORIGINS in prod
      cb(null, true);
    },
    credentials: true,
  },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly publicKey: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.publicKey = Buffer.from(
      this.config.getOrThrow<string>('JWT_PUBLIC_KEY'),
      'base64',
    ).toString('utf-8');
  }

  afterInit() {
    this.logger.log('WebSocket gateway initialised at /ws');
  }

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const payload = this.extractAndVerifyToken(client);
      if (!payload) {
        client.disconnect(true);
        return;
      }

      // Store identity on socket for later reference
      client.data['userId']    = payload.sub;
      client.data['role']      = payload.role;
      client.data['storeId']   = payload.storeId;
      client.data['storeRole'] = payload.storeRole;

      // Auto-join rooms based on role
      await client.join(Rooms.user(payload.sub));

      if (payload.storeId) {
        // Store admin / staff join store room
        await client.join(Rooms.store(payload.storeId));

        // Delivery agents join the delivery room
        if (payload.storeRole === 'DELIVERY_AGENT' || payload.role === 'DELIVERY_AGENT') {
          await client.join(Rooms.delivery(payload.storeId));
        }
      }

      if (payload.role === 'SUPER_ADMIN') {
        await client.join(Rooms.superAdmin());
      }

      this.logger.debug(
        `Client connected: ${client.id} userId=${payload.sub} role=${payload.role} storeId=${payload.storeId ?? '-'}`,
      );
    } catch (e) {
      this.logger.warn(`WS connection rejected: ${(e as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(
      `Client disconnected: ${client.id} userId=${client.data['userId'] ?? '?'}`,
    );
  }

  // ─── Client message: join an extra room on demand ─────────────────────────
  //   Use case: admin dashboard subscribes to a specific order for live updates

  @SubscribeMessage('join:order')
  async handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (!data?.orderId) throw new WsException('orderId required');
    const storeId = client.data['storeId'] as string | undefined;
    if (!storeId) throw new WsException('No store context on this connection');
    await client.join(`order:${data.orderId}`);
    return { joined: `order:${data.orderId}` };
  }

  @SubscribeMessage('leave:order')
  async handleLeaveOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (!data?.orderId) throw new WsException('orderId required');
    await client.leave(`order:${data.orderId}`);
    return { left: `order:${data.orderId}` };
  }

  // ─── Emit helpers (called by OrdersService, DeliveryService, StoresService) ─

  /** Emit to the customer who placed the order AND to the store admin room. */
  emitOrderEvent(
    event: string,
    payload: {
      orderId:  string;
      storeId?: string;
      userId?:  string;
      [key: string]: unknown;
    },
  ): void {
    // Customer room
    if (payload.userId) {
      this.server.to(Rooms.user(payload.userId)).emit(event, payload);
    }

    // Store admin room — all admins/staff of the store see every order event
    if (payload.storeId) {
      this.server.to(Rooms.store(payload.storeId)).emit(event, payload);
    }

    // Any socket that joined the specific order room (e.g. live order detail page)
    this.server.to(`order:${payload.orderId}`).emit(event, payload);

    this.logger.debug(`[WS emit] ${event} → orderId=${payload.orderId}`);
  }

  /** Emit delivery update to the delivery agent room AND the store admin room. */
  emitDeliveryEvent(
    event: string,
    payload: {
      orderId:  string;
      storeId?: string;
      agentId?: string;
      [key: string]: unknown;
    },
  ): void {
    if (payload.storeId) {
      this.server.to(Rooms.store(payload.storeId)).emit(event, payload);
      this.server.to(Rooms.delivery(payload.storeId)).emit(event, payload);
    }
    this.server.to(`order:${payload.orderId}`).emit(event, payload);
    this.logger.debug(`[WS emit] ${event} → orderId=${payload.orderId}`);
  }

  /** Emit platform-wide event to the super-admin room. */
  emitPlatformEvent(event: string, payload: Record<string, unknown>): void {
    this.server.to(Rooms.superAdmin()).emit(event, payload);
    this.logger.debug(`[WS emit platform] ${event}`);
  }

  // ─── JWT extraction & verification ────────────────────────────────────────

  private extractAndVerifyToken(client: Socket): JwtPayload | null {
    // Accept token from handshake auth OR query param (for clients that can't set headers)
    const authHeader = client.handshake.headers['authorization'] as string | undefined;
    const queryToken = client.handshake.query['token'] as string | undefined;

    let token: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (queryToken) {
      token = queryToken;
    }

    if (!token) {
      this.logger.warn(`WS connection without token from ${client.id}`);
      return null;
    }

    try {
      return this.jwtService.verify<JwtPayload>(token, {
        publicKey: this.publicKey,
        algorithms: ['RS256'],
      });
    } catch (e) {
      this.logger.warn(`WS invalid token: ${(e as Error).message}`);
      return null;
    }
  }
}

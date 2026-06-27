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
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Role, DeliveryStatus } from '@prisma/client';
import { DeliveryService } from './delivery.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { QueryDeliveriesDto } from './dto/query-deliveries.dto';
import { UpdateDeliveryStatusDto } from '../orders/dto/update-delivery-status.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { type AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Delivery')
@ApiBearerAuth()
@Controller()
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  // ─── Admin: Agent Management ───────────────────────────────────────────────

  @Post('admin/agents')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Admin: register a user as a delivery agent',
    description:
      'Creates a DeliveryAgent profile for an existing user and promotes their role to DELIVERY_AGENT. ' +
      'The user must already exist and must not have an agent profile.',
  })
  @ApiCreatedResponse({ description: 'Delivery agent profile created' })
  createAgent(@Body() dto: CreateAgentDto) {
    return this.deliveryService.createAgent(dto);
  }

  @Get('admin/agents')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: list all delivery agents with pagination and search' })
  @ApiOkResponse({ description: 'Paginated list of delivery agents' })
  listAgents(@Query() query: QueryDeliveriesDto) {
    return this.deliveryService.adminListAgents(query);
  }

  @Get('admin/agents/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: get a single delivery agent with recent deliveries' })
  @ApiParam({ name: 'id', description: 'DeliveryAgent UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Delivery agent details' })
  getAgent(@Param('id') id: string) {
    return this.deliveryService.adminGetAgent(id);
  }

  @Patch('admin/agents/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: update delivery agent vehicle type or zones' })
  @ApiParam({ name: 'id', description: 'DeliveryAgent UUID', format: 'uuid' })
  updateAgent(
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
  ) {
    return this.deliveryService.adminUpdateAgent(id, dto);
  }

  @Delete('admin/agents/:id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: remove a delivery agent',
    description: 'Deletes the agent profile and resets the user role to CUSTOMER. Blocked if the agent has active deliveries.',
  })
  @ApiParam({ name: 'id', description: 'DeliveryAgent UUID', format: 'uuid' })
  deleteAgent(@Param('id') id: string) {
    return this.deliveryService.adminDeleteAgent(id);
  }

  // ─── Admin: Delivery Management ────────────────────────────────────────────

  @Get('admin/deliveries')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Admin: list all deliveries',
    description:
      'Returns all delivery records with full order and agent details. ' +
      'Filter by status, type (SELF / THIRD_PARTY), or search by order number / customer.',
  })
  @ApiOkResponse({ description: 'Paginated delivery list' })
  adminListDeliveries(@Query() query: QueryDeliveriesDto) {
    return this.deliveryService.adminListDeliveries(query);
  }

  @Get('admin/deliveries/:orderId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: get full delivery details for an order' })
  @ApiParam({ name: 'orderId', description: 'Order UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Full delivery record including location log and agent info' })
  adminGetDelivery(@Param('orderId') orderId: string) {
    return this.deliveryService.adminGetDelivery(orderId);
  }

  @Post('admin/deliveries/:orderId/regenerate-otp')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: regenerate delivery OTP and notify customer',
    description:
      'Generates a new 6-digit OTP (bcrypt-hashed), stores it on the Delivery record, ' +
      'and sends the plain OTP to the customer via in-app notification. ' +
      'Only valid for SELF deliveries that have not yet been delivered.',
  })
  @ApiParam({ name: 'orderId', description: 'Order UUID', format: 'uuid' })
  adminRegenerateOtp(@Param('orderId') orderId: string) {
    return this.deliveryService.adminRegenerateOtp(orderId);
  }

  // ─── Delivery Agent: Profile ───────────────────────────────────────────────

  @Get('agent/profile')
  @Roles(Role.DELIVERY_AGENT)
  @ApiOperation({ summary: 'Agent: view own delivery agent profile' })
  @ApiOkResponse({ description: 'DeliveryAgent profile with delivery count' })
  getMyProfile(@CurrentUser() user: AuthUser) {
    return this.deliveryService.getMyProfile(user.id);
  }

  @Patch('agent/profile')
  @Roles(Role.DELIVERY_AGENT)
  @ApiOperation({ summary: 'Agent: update own vehicle type or serviceable zones' })
  updateMyProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateAgentDto) {
    return this.deliveryService.updateMyProfile(user.id, dto);
  }

  @Patch('agent/online')
  @Roles(Role.DELIVERY_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Agent: toggle online/offline status',
    description:
      'Sets isOnline flag on the DeliveryAgent. Only online agents can be assigned new deliveries.',
  })
  toggleOnline(
    @CurrentUser() user: AuthUser,
    @Body('isOnline') isOnline: boolean,
  ) {
    return this.deliveryService.toggleOnline(user.id, isOnline);
  }

  @Patch('agent/location')
  @Roles(Role.DELIVERY_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Agent: push current GPS location',
    description:
      'Updates the agent\'s currentLat/currentLng on DeliveryAgent. ' +
      'If an active delivery exists, the point is appended to Delivery.locationLog (last 50 kept). ' +
      'Phase 2: also emits a "delivery:location" Socket.IO event to the customer.',
  })
  updateLocation(@CurrentUser() user: AuthUser, @Body() dto: UpdateLocationDto) {
    return this.deliveryService.updateLocation(user.id, dto);
  }

  // ─── Delivery Agent: Deliveries ────────────────────────────────────────────

  @Get('agent/deliveries')
  @Roles(Role.DELIVERY_AGENT)
  @ApiOperation({
    summary: 'Agent: list own assigned deliveries',
    description: 'Returns paginated deliveries assigned to this agent with full order and address details.',
  })
  @ApiOkResponse({ description: 'Paginated delivery list for the agent' })
  agentListDeliveries(@CurrentUser() user: AuthUser, @Query() query: QueryDeliveriesDto) {
    return this.deliveryService.agentListDeliveries(user.id, query);
  }

  @Get('agent/deliveries/:orderId')
  @Roles(Role.DELIVERY_AGENT)
  @ApiOperation({ summary: 'Agent: get one assigned delivery with full order, payment and notes' })
  @ApiParam({ name: 'orderId', description: 'Order UUID', format: 'uuid' })
  agentGetDelivery(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.deliveryService.agentGetDelivery(user.id, orderId);
  }

  @Patch('agent/deliveries/:orderId/status')
  @Roles(Role.DELIVERY_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Agent: update delivery status',
    description:
      'State machine: ASSIGNED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → (FAILED). ' +
      'DELIVERED is reached exclusively via /verify-otp. ' +
      'Transitioning to OUT_FOR_DELIVERY auto-generates and sends a 6-digit OTP to the customer (SELF delivery only).',
  })
  @ApiParam({ name: 'orderId', description: 'Order UUID', format: 'uuid' })
  agentUpdateStatus(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.deliveryService.agentUpdateStatus(user.id, orderId, dto.status, dto.failureReason);
  }

  @Post('agent/deliveries/:orderId/verify-otp')
  @Roles(Role.DELIVERY_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Agent: verify customer OTP to confirm delivery',
    description:
      'The customer reads their OTP from the in-app notification. ' +
      'The agent enters it here. On success: delivery → DELIVERED, order → DELIVERED, deliveredAt set. ' +
      'Requires delivery status to be OUT_FOR_DELIVERY. Wrong OTP returns 400.',
  })
  @ApiParam({ name: 'orderId', description: 'Order UUID', format: 'uuid' })
  agentVerifyOtp(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Body() dto: VerifyOtpDto,
  ) {
    return this.deliveryService.agentVerifyOtp(user.id, orderId, dto);
  }

  // ─── Customer: Delivery Tracking ───────────────────────────────────────────

  @Get('orders/:orderId/tracking')
  @ApiOperation({
    summary: 'Customer: track delivery status for an order',
    description:
      'Returns delivery status, agent details (name, phone, vehicle, live coordinates), ' +
      'third-party AWB + tracking URL, and the last 10 GPS points. ' +
      'Only returns the delivery for orders that belong to the authenticated user.',
  })
  @ApiParam({ name: 'orderId', description: 'Order UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Delivery tracking info with agent location' })
  trackDelivery(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
  ) {
    return this.deliveryService.trackDelivery(user.id, orderId);
  }
}

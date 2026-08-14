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
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ReturnOrderDto } from './dto/return-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AssignDeliveryDto } from './dto/assign-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { type AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentStoreId } from '../../common/decorators/current-store.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ─── Customer Routes ───────────────────────────────────────────────────────

  @Post('orders')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Place a new order',
    description:
      'Validates stock, applies coupon, creates Razorpay order for non-COD payments. ' +
      'Returns razorpayOrderId and razorpayKeyId for frontend checkout integration.',
  })
  @ApiCreatedResponse({ description: 'Order placed successfully with payment initialization data' })
  placeOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto, @CurrentStoreId() storeId: string) {
    return this.ordersService.placeOrder(user.id, dto, storeId);
  }

  @Get('orders')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'List authenticated customer orders with pagination' })
  @ApiOkResponse({ description: 'Paginated order list' })
  findMyOrders(@CurrentUser() user: AuthUser, @Query() query: QueryOrdersDto) {
    return this.ordersService.findMyOrders(user.id, query);
  }

  @Get('orders/:id')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Get order details (customer can only access own orders)' })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  findMyOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.findMyOrderById(user.id, id);
  }

  @Patch('orders/:id/cancel')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an order',
    description: 'Only PENDING or CONFIRMED orders can be cancelled. Restores stock on cancellation.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  cancelOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(user.id, id, dto);
  }

  @Patch('orders/:id/return')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a return for a delivered order',
    description: 'Only DELIVERED orders can have a return requested.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  requestReturn(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReturnOrderDto,
  ) {
    return this.ordersService.requestReturn(user.id, id, dto);
  }

  // ─── Admin Routes ──────────────────────────────────────────────────────────

  @Get('admin/orders')
  @Roles(Role.ADMIN)
  @RequirePermission('orders.read')
  @ApiOperation({
    summary: 'Admin: list all orders with search, status filter, and date range',
  })
  adminListOrders(@Query() query: QueryOrdersDto, @CurrentStoreId() storeId: string) {
    return this.ordersService.adminListOrders(query, storeId);
  }

  @Get('admin/orders/:id')
  @Roles(Role.ADMIN)
  @RequirePermission('orders.read')
  @ApiOperation({ summary: 'Admin: get full order details including user info' })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  adminGetOrder(@Param('id') id: string, @CurrentStoreId() storeId: string) {
    return this.ordersService.adminGetOrder(id, storeId);
  }

  @Patch('admin/orders/:id/status')
  @Roles(Role.ADMIN)
  @RequirePermission('orders.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: update order status',
    description:
      'Enforces state machine transitions. Cancellation restores stock. ' +
      'DELIVERED status syncs delivery record.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  adminUpdateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentStoreId() storeId: string,
  ) {
    return this.ordersService.adminUpdateStatus(id, dto, storeId);
  }

  @Patch('admin/orders/:id/delivery')
  @Roles(Role.ADMIN)
  @RequirePermission('orders.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: assign or update delivery details',
    description:
      'For SELF delivery: assign a delivery agent by UUID. ' +
      'For THIRD_PARTY: set provider, AWB code, and tracking URL.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  adminAssignDelivery(
    @Param('id') id: string,
    @Body() dto: AssignDeliveryDto,
    @CurrentStoreId() storeId: string,
  ) {
    return this.ordersService.adminAssignDelivery(id, storeId, dto);
  }

  // ─── Delivery Agent Routes ─────────────────────────────────────────────────

  @Get('delivery/orders')
  @Roles(Role.DELIVERY_AGENT)
  @ApiOperation({ summary: 'Delivery agent: list orders assigned to me' })
  agentListOrders(@CurrentUser() user: AuthUser, @Query() query: QueryOrdersDto) {
    return this.ordersService.agentListOrders(user.id, query);
  }

  @Patch('delivery/orders/:orderId/status')
  @Roles(Role.DELIVERY_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delivery agent: update delivery status for an assigned order',
    description:
      'State machine: ASSIGNED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED | FAILED. ' +
      'DELIVERED automatically marks the order as DELIVERED.',
  })
  @ApiParam({ name: 'orderId', description: 'Order UUID', format: 'uuid' })
  agentUpdateDeliveryStatus(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.ordersService.agentUpdateDeliveryStatus(user.id, orderId, dto);
  }
}

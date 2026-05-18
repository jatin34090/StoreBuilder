/** Socket.IO event names — keep in sync with gateways */
export const SocketEvents = {
  // Delivery agent → Server → Customer
  DELIVERY_LOCATION: 'delivery:location',
  AGENT_LOCATION_ACK: 'agent:location_ack',

  // Server → Customer
  ORDER_STATUS_UPDATED: 'order:status_updated',
  DELIVERY_OTP_SENT: 'delivery:otp_sent',

  // Server → Admin
  ADMIN_NEW_ORDER: 'admin:new_order',

  // Server → User
  NOTIFICATION_NEW: 'notification:new',

  // Bidirectional — Support chat
  CHAT_MESSAGE: 'chat:message',
} as const;

export type SocketEvent = (typeof SocketEvents)[keyof typeof SocketEvents];

export interface DeliveryLocationPayload {
  deliveryId: string;
  lat: number;
  lng: number;
  timestamp: number;
}

export interface OrderStatusPayload {
  orderId: string;
  status: string;
  message: string;
}

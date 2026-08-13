import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CachedToken {
  token: string;
  expiresAt: Date;
}

// Shiprocket status strings → our DeliveryStatus
const STATUS_MAP: Record<string, string> = {
  'Dispatched':       'PICKED_UP',
  'In Transit':       'IN_TRANSIT',
  'Out for Delivery': 'OUT_FOR_DELIVERY',
  'Delivered':        'DELIVERED',
  'Undelivered':      'FAILED',
  'Failed Delivery':  'FAILED',
  'Cancelled':        'FAILED',
};

export interface CreateShipmentInput {
  orderNumber: string;
  total:       number;
  payment:     { method: string }; // COD or prepaid
  items: Array<{
    name:     string;
    sku:      string;
    quantity: number;
    price:    number;
    weight:   number; // grams
  }>;
  address: {
    name:    string;
    phone:   string;
    line1:   string;
    line2?:  string | null;
    city:    string;
    state:   string;
    pincode: string;
  };
}

export interface ShipmentResult {
  shiprocketOrderId: number;
  shipmentId:        number;
  awbCode:           string;
  courierName:       string;
  trackingUrl:       string;
}

@Injectable()
export class ShiprocketService {
  private readonly logger = new Logger(ShiprocketService.name);
  private readonly BASE  = 'https://apiv2.shiprocket.in/v1/external';
  private tokenCache: CachedToken | null = null;
  private readonly isMock: boolean;

  constructor(private readonly config: ConfigService) {
    this.isMock = this.config.get<string>('SHIPROCKET_MOCK') === 'true';
    if (this.isMock) this.logger.warn('Shiprocket running in MOCK mode — no real API calls will be made');
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > new Date()) {
      return this.tokenCache.token;
    }

    const email    = this.config.get<string>('SHIPROCKET_EMAIL');
    const password = this.config.get<string>('SHIPROCKET_PASSWORD');
    if (!email || !password) {
      throw new BadRequestException('Shiprocket credentials not configured (SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD)');
    }

    const res  = await fetch(`${this.BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) throw new Error(`Shiprocket auth failed: ${await res.text()}`);
    const data = (await res.json()) as { token: string };

    // Token valid for 10 days — cache for 9 to avoid edge expiry
    this.tokenCache = { token: data.token, expiresAt: new Date(Date.now() + 9 * 86_400_000) };
    this.logger.log('Shiprocket token refreshed');
    return data.token;
  }

  private async call<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const res   = await fetch(`${this.BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Shiprocket ${path} failed (${res.status}): ${body}`);
    }
    return res.json() as Promise<T>;
  }

  // ─── Create Shipment ──────────────────────────────────────────────────────

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    if (this.isMock) {
      const awbCode = `MOCK${Date.now()}`;
      this.logger.log(`[MOCK] Shiprocket shipment for order ${input.orderNumber}: AWB=${awbCode}`);
      return {
        shiprocketOrderId: Math.floor(Math.random() * 9_000_000) + 1_000_000,
        shipmentId:        Math.floor(Math.random() * 9_000_000) + 1_000_000,
        awbCode,
        courierName:       'Mock Courier',
        trackingUrl:       `https://shiprocket.co/tracking/${awbCode}`,
      };
    }

    const isCod   = input.payment.method === 'COD';
    const totalKg = Math.max(0.1, input.items.reduce((s, i) => s + (i.weight * i.quantity), 0) / 1000);

    const orderPayload = {
      order_id:              input.orderNumber,
      order_date:            new Date().toISOString().split('T')[0],
      pickup_location:       this.config.get('SHIPROCKET_PICKUP_LOCATION', 'Primary'),
      billing_customer_name: input.address.name,
      billing_last_name:     '',
      billing_address:       input.address.line1,
      billing_address_2:     input.address.line2 ?? '',
      billing_city:          input.address.city,
      billing_pincode:       input.address.pincode,
      billing_state:         input.address.state,
      billing_country:       'India',
      billing_email:         '',
      billing_phone:         input.address.phone,
      shipping_is_billing:   true,
      order_items: input.items.map((i) => ({
        name:          i.name,
        sku:           i.sku,
        units:         i.quantity,
        selling_price: i.price,
        discount:      0,
        tax:           0,
        hsn:           71131900, // jewellery HSN
      })),
      payment_method: isCod ? 'COD' : 'Prepaid',
      sub_total:      input.total,
      length:         12,
      breadth:        10,
      height:         5,
      weight:         totalKg,
    };

    type OrderResp = { order_id: number; shipment_id: number };
    const orderRes = await this.call<OrderResp>('/orders/create/adhoc', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });

    // Auto-assign best courier and generate AWB
    type AwbResp = {
      awb_assign_status?: number;
      response?: { data?: { awb_code?: string; courier_name?: string } };
      // some accounts return a flat structure
      awb_code?: string;
      courier_name?: string;
    };
    const awbRes = await this.call<AwbResp>('/courier/assign/awb', {
      method: 'POST',
      body: JSON.stringify({ shipment_id: orderRes.shipment_id }),
    });

    this.logger.log(`Shiprocket AWB response: ${JSON.stringify(awbRes)}`);

    const awbCode    = awbRes.response?.data?.awb_code ?? awbRes.awb_code;
    const courierName = awbRes.response?.data?.courier_name ?? awbRes.courier_name ?? 'Unknown';

    if (!awbCode) {
      throw new BadRequestException(
        `Shiprocket AWB assignment failed. Response: ${JSON.stringify(awbRes)}`,
      );
    }

    this.logger.log(`Shiprocket shipment created: AWB=${awbCode} courier=${courierName}`);

    return {
      shiprocketOrderId: orderRes.order_id,
      shipmentId:        orderRes.shipment_id,
      awbCode,
      courierName,
      trackingUrl: `https://shiprocket.co/tracking/${awbCode}`,
    };
  }

  // ─── Track ────────────────────────────────────────────────────────────────

  async trackShipment(awbCode: string) {
    type TrackResp = { tracking_data: unknown };
    const res = await this.call<TrackResp>(`/courier/track/awb/${awbCode}`);
    return res.tracking_data;
  }

  // ─── Webhook Status Mapping ───────────────────────────────────────────────

  mapStatus(shiprocketStatus: string): string | null {
    return STATUS_MAP[shiprocketStatus] ?? null;
  }
}

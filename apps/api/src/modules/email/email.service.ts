import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface OrderEmailContext {
  storeId:     string;
  orderId:     string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  storeName:   string;
  storeUrl?:   string;
  items: Array<{ name: string; quantity: number; price: number; image?: string }>;
  subtotal:    number;
  shipping:    number;
  discount:    number;
  total:       number;
  paymentMethod: string;
  deliveryAddress: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly isEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.from   = this.config.get<string>('SMTP_FROM') ?? `noreply@${host ?? 'localhost'}`;

    if (!host || !user || !pass) {
      this.logger.warn(
        'Email service disabled — SMTP_HOST, SMTP_USER, or SMTP_PASS not configured. ' +
        'Set these env vars to enable transactional emails.',
      );
      this.isEnabled   = false;
      this.transporter = null;
      return;
    }

    this.isEnabled   = true;
    this.transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    this.logger.log(`Email service enabled — SMTP host: ${host}:${port}`);
  }

  // ─── Send helpers ─────────────────────────────────────────────────────────

  async sendOrderConfirmation(ctx: OrderEmailContext): Promise<void> {
    await this.send({
      to:      ctx.customerEmail,
      subject: `Order Confirmed — #${ctx.orderNumber}`,
      html:    this.buildOrderConfirmationHtml(ctx),
    });
  }

  async sendPaymentConfirmation(ctx: OrderEmailContext): Promise<void> {
    await this.send({
      to:      ctx.customerEmail,
      subject: `Payment Received — #${ctx.orderNumber}`,
      html:    this.buildPaymentConfirmationHtml(ctx),
    });
  }

  async sendOrderShipped(ctx: OrderEmailContext & { awbCode?: string; trackingUrl?: string }): Promise<void> {
    await this.send({
      to:      ctx.customerEmail,
      subject: `Your Order Is On The Way — #${ctx.orderNumber}`,
      html:    this.buildShippedHtml(ctx),
    });
  }

  async sendOrderDelivered(ctx: OrderEmailContext): Promise<void> {
    await this.send({
      to:      ctx.customerEmail,
      subject: `Order Delivered — #${ctx.orderNumber}`,
      html:    this.buildDeliveredHtml(ctx),
    });
  }

  async sendOrderCancelled(ctx: OrderEmailContext & { reason?: string }): Promise<void> {
    await this.send({
      to:      ctx.customerEmail,
      subject: `Order Cancelled — #${ctx.orderNumber}`,
      html:    this.buildCancelledHtml(ctx),
    });
  }

  // ─── Core send ────────────────────────────────────────────────────────────

  private async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.isEnabled || !this.transporter) {
      this.logger.debug(`[EMAIL SKIPPED] to=${opts.to} subject="${opts.subject}" (SMTP not configured)`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, ...opts });
      this.logger.log(`[EMAIL SENT] to=${opts.to} subject="${opts.subject}"`);
    } catch (err) {
      // Non-fatal — log and continue; email failure must never block the order flow
      this.logger.error(`[EMAIL FAILED] to=${opts.to} subject="${opts.subject}"`, err);
    }
  }

  // ─── Templates ────────────────────────────────────────────────────────────
  // Minimal, plain-HTML templates that are tenant-aware. No external CSS/fonts.

  private formatPrice(n: number): string {
    return `₹${n.toFixed(2)}`;
  }

  private itemRows(items: OrderEmailContext['items']): string {
    return items
      .map(
        (i) =>
          `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${i.name} × ${i.quantity}</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${this.formatPrice(i.price * i.quantity)}</td>
          </tr>`,
      )
      .join('');
  }

  private baseLayout(storeName: string, storeUrl: string | undefined, content: string): string {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${storeName}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#333;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
      <tr><td style="background:#111;padding:20px 32px;">
        <span style="color:#fff;font-size:20px;font-weight:bold;">${storeName}</span>
      </td></tr>
      <tr><td style="padding:32px;">${content}</td></tr>
      <tr><td style="background:#f9f9f9;padding:16px 32px;text-align:center;font-size:12px;color:#888;">
        © ${year} ${storeName}${storeUrl ? ` · <a href="${storeUrl}" style="color:#888;">${storeUrl}</a>` : ''}
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  }

  private summaryTable(ctx: OrderEmailContext): string {
    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${this.itemRows(ctx.items)}
      <tr><td style="padding:8px 0;">Subtotal</td><td style="text-align:right;">${this.formatPrice(ctx.subtotal)}</td></tr>
      ${ctx.shipping > 0 ? `<tr><td style="padding:4px 0;">Shipping</td><td style="text-align:right;">${this.formatPrice(ctx.shipping)}</td></tr>` : `<tr><td style="padding:4px 0;color:#27ae60;">Shipping</td><td style="text-align:right;color:#27ae60;">Free</td></tr>`}
      ${ctx.discount > 0 ? `<tr><td style="padding:4px 0;color:#e74c3c;">Discount</td><td style="text-align:right;color:#e74c3c;">−${this.formatPrice(ctx.discount)}</td></tr>` : ''}
      <tr><td style="padding:12px 0;font-weight:bold;font-size:16px;border-top:2px solid #333;">Total</td><td style="text-align:right;font-weight:bold;font-size:16px;border-top:2px solid #333;">${this.formatPrice(ctx.total)}</td></tr>
    </table>`;
  }

  private buildOrderConfirmationHtml(ctx: OrderEmailContext): string {
    const content = `
      <h2 style="margin-top:0;">Your order is confirmed! 🎉</h2>
      <p>Hi ${ctx.customerName},</p>
      <p>Thank you for shopping with <strong>${ctx.storeName}</strong>. We've received your order and are getting it ready.</p>
      <p><strong>Order #${ctx.orderNumber}</strong> · Payment: ${ctx.paymentMethod}</p>
      <p>Delivering to: ${ctx.deliveryAddress}</p>
      ${this.summaryTable(ctx)}
      <p style="margin-top:24px;color:#666;font-size:13px;">We'll send you another email when your order ships.</p>`;
    return this.baseLayout(ctx.storeName, ctx.storeUrl, content);
  }

  private buildPaymentConfirmationHtml(ctx: OrderEmailContext): string {
    const content = `
      <h2 style="margin-top:0;">Payment received ✅</h2>
      <p>Hi ${ctx.customerName},</p>
      <p>We've received your payment of <strong>${this.formatPrice(ctx.total)}</strong> for order <strong>#${ctx.orderNumber}</strong>.</p>
      ${this.summaryTable(ctx)}`;
    return this.baseLayout(ctx.storeName, ctx.storeUrl, content);
  }

  private buildShippedHtml(ctx: OrderEmailContext & { awbCode?: string; trackingUrl?: string }): string {
    const tracking = ctx.trackingUrl
      ? `<p>Track your shipment: <a href="${ctx.trackingUrl}">${ctx.awbCode ?? 'Track Order'}</a></p>`
      : ctx.awbCode
        ? `<p>AWB Code: <strong>${ctx.awbCode}</strong></p>`
        : '';
    const content = `
      <h2 style="margin-top:0;">Your order is on the way! 🚚</h2>
      <p>Hi ${ctx.customerName},</p>
      <p>Good news! Your order <strong>#${ctx.orderNumber}</strong> has been shipped.</p>
      ${tracking}
      <p>Delivering to: ${ctx.deliveryAddress}</p>`;
    return this.baseLayout(ctx.storeName, ctx.storeUrl, content);
  }

  private buildDeliveredHtml(ctx: OrderEmailContext): string {
    const content = `
      <h2 style="margin-top:0;">Order delivered! 📦</h2>
      <p>Hi ${ctx.customerName},</p>
      <p>Your order <strong>#${ctx.orderNumber}</strong> has been delivered. We hope you love your jewellery!</p>
      <p>If you have any questions, please contact us at ${ctx.storeUrl ?? ctx.storeName}.</p>`;
    return this.baseLayout(ctx.storeName, ctx.storeUrl, content);
  }

  private buildCancelledHtml(ctx: OrderEmailContext & { reason?: string }): string {
    const content = `
      <h2 style="margin-top:0;">Order cancelled</h2>
      <p>Hi ${ctx.customerName},</p>
      <p>Your order <strong>#${ctx.orderNumber}</strong> has been cancelled.</p>
      ${ctx.reason ? `<p>Reason: ${ctx.reason}</p>` : ''}
      <p>If you paid online, a refund will be processed within 5–7 business days.</p>`;
    return this.baseLayout(ctx.storeName, ctx.storeUrl, content);
  }
}

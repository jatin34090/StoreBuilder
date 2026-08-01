import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { SendOtpDto } from './dto/send-otp.dto';
import type { VerifyOtpDto } from './dto/verify-otp.dto';
import type { LoginDto } from './dto/login.dto';
import { RedisService } from '../notifications/redis.service';

const BCRYPT_ROUNDS = 10;
const OTP_TTL_SECONDS = 600; // 10 minutes
const OTP_RATE_LIMIT_TTL = 900; // 15 minutes window
const OTP_RATE_LIMIT_MAX = 3;
const OTP_ATTEMPT_MAX = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redis: RedisService,
  ) {}

  // ─── OTP Auth ──────────────────────────────────────────────────────────────

  async sendOtp(dto: SendOtpDto): Promise<{ message: string }> {
    const rateLimitKey = `otp_rate:${dto.phone}`;
    const count = await this.redis.incr(rateLimitKey);

    if (count === 1) {
      await this.redis.expire(rateLimitKey, OTP_RATE_LIMIT_TTL);
    }

    if (count > OTP_RATE_LIMIT_MAX) {
      throw new BadRequestException('Too many OTP requests. Please wait 15 minutes.');
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);

    // Store hash in Redis with TTL
    await this.redis.setEx(`otp:${dto.phone}`, OTP_TTL_SECONDS, otpHash);
    // Reset attempt counter
    await this.redis.del(`otp_attempts:${dto.phone}`);

    // Send SMS via MSG91
    await this.sendOtpSms(dto.phone, otp);

    this.logger.log(`OTP sent to ${dto.phone.slice(0, 5)}*****`);
    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }> {
    const attemptsKey = `otp_attempts:${dto.phone}`;
    const attempts = await this.redis.incr(attemptsKey);
    await this.redis.expire(attemptsKey, OTP_TTL_SECONDS);

    if (attempts > OTP_ATTEMPT_MAX) {
      await this.redis.del(`otp:${dto.phone}`);
      throw new UnauthorizedException('Too many failed attempts. Request a new OTP.');
    }

    const storedHash = await this.redis.get(`otp:${dto.phone}`);
    if (!storedHash) {
      throw new UnauthorizedException('OTP expired or not found. Request a new one.');
    }

    const isValid = await bcrypt.compare(dto.otp, storedHash);
    if (!isValid) {
      throw new UnauthorizedException(`Invalid OTP. ${OTP_ATTEMPT_MAX - attempts} attempt(s) remaining.`);
    }

    // OTP verified — clean up Redis
    await this.redis.del(`otp:${dto.phone}`);
    await this.redis.del(attemptsKey);

    // Upsert user
    const user = await this.prisma.user.upsert({
      where: { phone: dto.phone },
      create: { phone: dto.phone, name: 'Customer', isVerified: true },
      update: { isVerified: true },
      select: { id: true, name: true, phone: true, email: true, role: true, avatar: true },
    });

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.role);
    await this.storeRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken, user };
  }

  // ─── Email/Password (Admin fallback) ─────────────────────────────────────

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true, phone: true, role: true, passwordHash: true, isBlocked: true, avatar: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.role);
    await this.storeRefreshToken(user.id, refreshToken);

    const { passwordHash: _h, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser };
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  async handleGoogleCallback(googleProfile: {
    googleId: string;
    name: string;
    email: string;
    avatar?: string;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    let user = await this.prisma.user.findUnique({
      where: { email: googleProfile.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: googleProfile.email,
          name: googleProfile.name,
          avatar: googleProfile.avatar,
          isVerified: true,
        },
      });
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.role);
    await this.storeRefreshToken(user.id, refreshToken);
    return { accessToken, refreshToken };
  }

  // ─── Token Rotation ───────────────────────────────────────────────────────

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    const tokenHash = this.tokenHash(refreshToken);

    const dbToken = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: { select: { id: true, role: true, isBlocked: true } } },
    });

    if (!dbToken || dbToken.expiresAt < new Date()) {
      // Possible token theft — invalidate entire family
      if (dbToken) {
        await this.prisma.refreshToken.deleteMany({ where: { userId: dbToken.userId } });
        this.logger.warn(`Token reuse detected for user ${dbToken.userId} — all sessions invalidated`);
      }
      throw new UnauthorizedException('Invalid or expired session. Please log in again.');
    }

    if (dbToken.user.isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    // Rotate: delete old, issue new
    await this.prisma.refreshToken.delete({ where: { id: dbToken.id } });
    const { accessToken, refreshToken: newRefreshToken } = await this.generateTokens(
      dbToken.user.id,
      dbToken.user.role,
    );
    await this.storeRefreshToken(dbToken.user.id, newRefreshToken);

    return { accessToken };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.tokenHash(refreshToken);
    await this.prisma.refreshToken.deleteMany({
      where: { userId, tokenHash },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async generateTokens(userId: string, role: string) {
    const privateKey = Buffer.from(
      this.configService.getOrThrow<string>('JWT_PRIVATE_KEY'),
      'base64',
    ).toString('utf-8');

    const accessToken = this.jwtService.sign(
      { sub: userId, role },
      {
        privateKey,
        algorithm: 'RS256',
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      },
    );

    const refreshToken = crypto.randomUUID();
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = this.tokenHash(token);
    const expiresInDays = 30;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  private tokenHash(plainToken: string): string {
    // SHA-256 is deterministic — same input always gives same output, suitable
    // for DB lookup. bcrypt can't be used for lookup because it generates a new
    // random salt on every call, so bcrypt.hash(x) !== bcrypt.hash(x).
    return crypto.createHash('sha256').update(plainToken).digest('hex');
  }

  private async sendOtpSms(phone: string, otp: string): Promise<void> {
    const authKey = this.configService.get<string>('MSG91_AUTH_KEY');
    const templateId = this.configService.get<string>('MSG91_TEMPLATE_ID_OTP');
    const senderId = this.configService.get<string>('MSG91_SENDER_ID');

    if (!authKey || !templateId) {
      // In development, just log the OTP
      this.logger.warn(`[DEV] OTP for ${phone}: ${otp}`);
      return;
    }

    try {
      const response = await fetch('https://api.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: authKey,
        },
        body: JSON.stringify({
          template_id: templateId,
          mobile: `91${phone}`,
          otp,
          sender: senderId,
        }),
      });

      if (!response.ok) {
        this.logger.error(`MSG91 OTP send failed: ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error('MSG91 SMS send error', error);
    }
  }
}

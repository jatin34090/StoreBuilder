import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  role: string;
  storeId?: string;
  storeRole?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const publicKey = Buffer.from(
      configService.getOrThrow<string>('JWT_PUBLIC_KEY'),
      'base64',
    ).toString('utf-8');

    super({
      // Try cookie first, fall back to Authorization header for API clients / Swagger
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['access_token'] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, phone: true, isBlocked: true },
    });

    if (!user || user.isBlocked) {
      throw new UnauthorizedException('Account not found or blocked');
    }

    return {
      id:        user.id,
      role:      user.role,
      email:     user.email ?? undefined,
      phone:     user.phone ?? undefined,
      storeId:   payload.storeId,
      storeRole: payload.storeRole,
    };
  }
}

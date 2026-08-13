import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateCategory } from '../../common/decorators/rate-category.decorator';
import { ConfigService } from '@nestjs/config';

const isProduction = process.env['NODE_ENV'] === 'production';

const BASE_COOKIE = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
};

// Access token — short-lived, sent with every API request
const ACCESS_COOKIE_OPTIONS = {
  ...BASE_COOKIE,
  path: '/api/v1',
  maxAge: 15 * 60 * 1000, // 15 minutes
};

// Refresh token — long-lived, only sent to the refresh endpoint
const REFRESH_COOKIE_OPTIONS = {
  ...BASE_COOKIE,
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

function setAuthCookies(res: import('express').Response, accessToken: string, refreshToken: string) {
  res.cookie('access_token', accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @RateCategory('auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new store owner account (email + password)' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Public()
  @Post('send-otp')
  @RateCategory('auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to phone number via MSG91' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Public()
  @Post('verify-otp')
  @RateCategory('auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and receive access token' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyOtp(dto);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Public()
  @Post('login')
  @RateCategory('auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email + password login' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies['refresh_token'] as string | undefined;
    if (!token) return { ok: false };
    const result = await this.authService.refresh(token);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invalidate refresh token and clear cookies' })
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies['refresh_token'] as string | undefined;
    if (token) await this.authService.logout(user.id, token);
    res.clearCookie('access_token', { path: '/api/v1' });
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  googleAuth() {
    // Passport redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Req() req: Request & { user: { googleId: string; name: string; email: string; avatar?: string } }, @Res() res: Response) {
    const result = await this.authService.handleGoogleCallback(req.user);
    const webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.redirect(`${webUrl}/auth/callback`);
  }
}

import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsInt,
  IsDateString,
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponType } from '@jewellery/types';

export class CreateCouponDto {
  @ApiProperty({ example: 'SAVE20', description: 'Unique coupon code (max 32 chars, uppercase)' })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Code must be uppercase alphanumeric with - or _' })
  code: string;

  @ApiProperty({ enum: CouponType, description: 'PERCENT or FLAT discount' })
  @IsEnum(CouponType)
  type: CouponType;

  @ApiProperty({
    example: 20,
    description: 'Discount value — percentage (0–100) or flat INR amount',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Minimum order subtotal in INR to apply coupon',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({
    example: 200,
    description: 'Maximum discount in INR (applies to PERCENT type to cap savings)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxDiscount?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Total number of times this coupon can be used (null = unlimited)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({
    example: '2025-12-31T23:59:59Z',
    description: 'Coupon expiry date-time (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

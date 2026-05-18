import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum RefundSpeed {
  NORMAL = 'normal',
  OPTIMUM = 'optimum',
}

export class RefundDto {
  @ApiPropertyOptional({
    description: 'Partial refund amount in rupees. Omit for full refund.',
    example: 499.0,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({ description: 'Internal reason for the refund (stored in notes)', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional({
    enum: RefundSpeed,
    description: '"normal" (5-7 days) or "optimum" (instant if eligible)',
    default: RefundSpeed.OPTIMUM,
  })
  @IsOptional()
  @IsEnum(RefundSpeed)
  speed?: RefundSpeed = RefundSpeed.OPTIMUM;
}

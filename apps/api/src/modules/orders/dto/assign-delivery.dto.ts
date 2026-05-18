import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryType } from '@prisma/client';

export class AssignDeliveryDto {
  @ApiPropertyOptional({ enum: DeliveryType, description: 'Override delivery type if needed' })
  @IsOptional()
  @IsEnum(DeliveryType)
  type?: DeliveryType;

  @ApiPropertyOptional({ description: 'DeliveryAgent UUID (for SELF delivery)', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ description: 'Third-party logistics provider name (e.g., shiprocket)', example: 'shiprocket' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;

  @ApiPropertyOptional({ description: 'Airway Bill code from logistics provider', example: '123456789012' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  awbCode?: string;

  @ApiPropertyOptional({ description: 'Public tracking URL', example: 'https://track.shiprocket.in/...' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string;

  @ApiPropertyOptional({ description: 'Estimated delivery date (ISO 8601)', example: '2025-08-01T10:00:00Z' })
  @IsOptional()
  @IsISO8601()
  estimatedAt?: string;
}

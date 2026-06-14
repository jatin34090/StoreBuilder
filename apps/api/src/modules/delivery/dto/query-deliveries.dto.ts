import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryStatus, DeliveryType } from '@prisma/client';
import { Type } from 'class-transformer';

export class QueryDeliveriesDto {
  @ApiPropertyOptional({ enum: DeliveryStatus, description: 'Filter by delivery status' })
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  @ApiPropertyOptional({ enum: DeliveryType, description: 'Filter by delivery type' })
  @IsOptional()
  @IsEnum(DeliveryType)
  type?: DeliveryType;

  @ApiPropertyOptional({ description: 'Search by order number or customer name/phone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

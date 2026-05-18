import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryStatus } from '@prisma/client';

export class UpdateDeliveryStatusDto {
  @ApiProperty({
    enum: DeliveryStatus,
    description: 'New delivery status',
    example: DeliveryStatus.PICKED_UP,
  })
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;

  @ApiPropertyOptional({ description: 'Reason for failed delivery (required when status=FAILED)', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  failureReason?: string;
}

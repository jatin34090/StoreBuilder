import { IsEnum, IsObject, IsOptional, IsString,MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Target user UUID', format: 'uuid' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: NotificationType, description: 'Notification category' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Notification title', minLength: 1, maxLength: 100, example: 'Order Confirmed!' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: 'Notification body text', minLength: 1, maxLength: 500, example: 'Your order #ORD123 has been confirmed.' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body: string;

  @ApiPropertyOptional({
    description: 'Structured metadata payload (e.g. orderId, productId)',
    example: { orderId: 'uuid', orderNumber: 'ORD-123' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

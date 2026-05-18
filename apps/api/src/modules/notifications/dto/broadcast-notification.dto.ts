import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, Role } from '@prisma/client';

export class BroadcastNotificationDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ maxLength: 100, example: 'Flash Sale — 40% Off Today!' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiProperty({ maxLength: 500, example: 'Use code FLASH40 at checkout. Valid until midnight.' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body: string;

  @ApiPropertyOptional({
    enum: Role,
    description:
      'Target all users of this role. Omit to broadcast to every user. ' +
      'Ignored if userIds is provided.',
    example: Role.CUSTOMER,
  })
  @IsOptional()
  @IsEnum(Role)
  targetRole?: Role;

  @ApiPropertyOptional({
    type: [String],
    description: 'Explicit list of user UUIDs to notify. Overrides targetRole. Max 500.',
    maxItems: 500,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  userIds?: string[];

  @ApiPropertyOptional({ description: 'Extra structured metadata', example: { couponCode: 'FLASH40' } })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

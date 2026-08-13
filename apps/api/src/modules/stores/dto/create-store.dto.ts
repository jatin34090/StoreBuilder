import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUrl, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class CreateStoreDto {
  @ApiProperty({ example: 'Meena Jewels' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'meena-jewels', description: 'Becomes the subdomain: meena-jewels.platform.com' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug may only contain lowercase letters, numbers, and hyphens' })
  slug: string;

  @ApiPropertyOptional({ enum: Plan, default: Plan.FREE })
  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;

  @ApiPropertyOptional({ example: 'meena-jewels.com' })
  @IsOptional()
  @IsString()
  customDomain?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'User ID to assign as store OWNER' })
  @IsOptional()
  @IsString()
  ownerUserId?: string;
}

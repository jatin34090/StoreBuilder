import {
  IsString, IsNotEmpty, IsOptional, IsEnum,
  MinLength, MaxLength, Matches, IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class CreateStoreOnboardingDto {
  @ApiProperty({ example: 'Jatin Jewellery Pvt Ltd' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  businessName: string;

  @ApiProperty({ example: 'Jatin Jewellery' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'jatin-jewellery' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug may only contain lowercase letters, numbers, and hyphens' })
  slug: string;

  @ApiPropertyOptional({ example: 'JEWELLERY' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: 'Fine jewellery since 1985' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'info@jatinjewellery.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+91 98765 43210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: '12 MG Road, Bengaluru' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ example: 'IN', default: 'IN' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ example: 'INR', default: 'INR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata', default: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @ApiPropertyOptional({ enum: Plan, default: Plan.FREE })
  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;
}

export class MarkOnboardingStepDto {
  @ApiProperty({ example: 'firstProduct', description: 'businessInfo | storeUrl | theme | firstProduct | payment | shipping | launched' })
  @IsString()
  @IsNotEmpty()
  step: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  done?: boolean;
}

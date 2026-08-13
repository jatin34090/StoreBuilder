import { IsString, IsOptional, IsEnum, IsBoolean, MaxLength, Matches, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class UpdateStoreDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: Plan })
  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customDomain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

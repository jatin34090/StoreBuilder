import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProductAttributesDto {
  @ApiPropertyOptional({ example: 'Gold-Plated Brass', description: 'Base material' })
  @IsOptional()
  @IsString()
  material?: string;

  @ApiPropertyOptional({ example: 'Wedding', description: 'Occasion suitability' })
  @IsOptional()
  @IsString()
  occasion?: string;

  @ApiPropertyOptional({ example: 'Golden', description: 'Primary color' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 'Polished', description: 'Surface finish' })
  @IsOptional()
  @IsString()
  finish?: string;

  @ApiPropertyOptional({ example: 'Cubic Zirconia', description: 'Stone type' })
  @IsOptional()
  @IsString()
  stone?: string;

  @ApiPropertyOptional({ example: 45.5, description: 'Weight in grams' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;
}

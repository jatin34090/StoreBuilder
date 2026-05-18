import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUUID,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductAttributesDto } from './product-attributes.dto';
import { CreateVariantDto } from './product-variant.dto';

export class CreateProductDto {
  @ApiProperty({ example: 'Gold-Plated Kundan Necklace Set' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'Beautiful handcrafted kundan necklace...' })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({ description: 'Category UUID' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 999.00, description: 'Base price before discount (INR)' })
  @Type(() => Number)
  @Min(0)
  basePrice: number;

  @ApiPropertyOptional({ example: 10, description: 'Discount percentage 0–100', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPct?: number;

  @ApiPropertyOptional({ type: ProductAttributesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductAttributesDto)
  attributes?: ProductAttributesDto;

  @ApiPropertyOptional({ example: ['necklace', 'kundan', 'gold'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'Gold-Plated Kundan Necklace Set | YourBrand Jewellery' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string;

  @ApiPropertyOptional({ example: 'Shop our stunning Gold-Plated Kundan Necklace...' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDesc?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [CreateVariantDto], description: 'At least one variant required' })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one variant is required' })
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants: CreateVariantDto[];
}

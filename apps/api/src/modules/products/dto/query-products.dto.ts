import { IsOptional, IsString, IsInt, IsEnum, IsUUID, Min, Max, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ProductSortBy {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  POPULAR = 'popular',
  FEATURED = 'featured',
}

export class QueryProductsDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Category UUID or slug' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 100, description: 'Minimum price in INR' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Maximum price in INR' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ example: 'Golden', description: 'Filter by color attribute' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 'Gold-Plated Brass', description: 'Filter by material attribute' })
  @IsOptional()
  @IsString()
  material?: string;

  @ApiPropertyOptional({ example: 'Wedding', description: 'Filter by occasion attribute' })
  @IsOptional()
  @IsString()
  occasion?: string;

  @ApiPropertyOptional({ enum: ProductSortBy, default: ProductSortBy.NEWEST })
  @IsOptional()
  @IsEnum(ProductSortBy)
  sortBy?: ProductSortBy = ProductSortBy.NEWEST;

  @ApiPropertyOptional({ description: 'Show featured products only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Filter by tag' })
  @IsOptional()
  @IsString()
  tag?: string;
}

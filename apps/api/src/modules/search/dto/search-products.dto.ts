import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SearchSortBy {
  NEWEST     = 'NEWEST',
  PRICE_ASC  = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  POPULAR    = 'POPULAR',
  RATING     = 'RATING',
}

export class SearchProductsDto {
  @ApiPropertyOptional({ description: 'Search query. Use "*" or omit to browse all.', example: 'gold ring' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by category UUID', format: 'uuid' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Minimum effective price (rupees)', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum effective price (rupees)', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Filter by material attribute', example: 'gold' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  material?: string;

  @ApiPropertyOptional({ description: 'Filter by occasion attribute', example: 'wedding' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  occasion?: string;

  @ApiPropertyOptional({ description: 'Filter by stone attribute', example: 'diamond' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  stone?: string;

  @ApiPropertyOptional({ description: 'Filter by color attribute', example: 'yellow' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ description: 'Show only featured products' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Show only in-stock products (maxStock > 0)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ enum: SearchSortBy, default: SearchSortBy.NEWEST })
  @IsOptional()
  @IsEnum(SearchSortBy)
  sortBy?: SearchSortBy = SearchSortBy.NEWEST;
}

import { IsString, IsOptional, IsNumber, IsInt, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVariantDto {
  @ApiProperty({ example: 'NKLC-GOLD-M' })
  @IsString()
  @MaxLength(100)
  sku: string;

  @ApiPropertyOptional({ example: 'Medium' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ example: 'Golden' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: 899.00, description: 'Selling price in INR' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiProperty({ example: 50, description: 'Available stock quantity' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({ example: 45.5, description: 'Weight in grams (for shipping calculation)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  weight: number;
}

export class UpdateVariantDto extends CreateVariantDto {}

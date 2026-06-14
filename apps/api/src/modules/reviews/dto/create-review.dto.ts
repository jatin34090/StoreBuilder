import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ description: 'Product UUID being reviewed', format: 'uuid' })
  @IsString()
  productId: string;

  @ApiProperty({
    description: 'Order UUID that contains this product. Validates delivery eligibility.',
    format: 'uuid',
  })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'Star rating from 1 (worst) to 5 (best)', minimum: 1, maximum: 5, example: 4 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ description: 'Short review title', minLength: 3, maxLength: 100, example: 'Beautiful quality!' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Detailed review body',
    maxLength: 2000,
    example: 'The necklace arrived well-packaged and looks exactly like the photos.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Cloudinary public_ids of review images (max 5). Upload via /users/me/review-images first.',
    maxItems: 5,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  images?: string[];
}

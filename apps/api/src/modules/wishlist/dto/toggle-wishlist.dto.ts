import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleWishlistDto {
  @ApiProperty({ description: 'Product UUID to add/remove from wishlist', format: 'uuid' })
  @IsString()
  productId: string;
}

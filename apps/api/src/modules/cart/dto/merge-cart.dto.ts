import { Type } from 'class-transformer';
import { IsArray, ValidateNested, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UpsertCartItemDto } from './upsert-cart-item.dto';

export class MergeCartDto {
  @ApiProperty({
    description: 'Guest cart items to merge into the authenticated cart',
    type: [UpsertCartItemDto],
    maxItems: 50,
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UpsertCartItemDto)
  items: UpsertCartItemDto[];
}

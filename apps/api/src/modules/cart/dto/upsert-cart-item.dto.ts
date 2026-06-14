import { IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertCartItemDto {
  @ApiProperty({ description: 'Product variant UUID', format: 'uuid' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ description: 'Quantity (1–99)', minimum: 1, maximum: 99, default: 1 })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

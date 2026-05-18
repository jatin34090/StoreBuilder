import { IsInt, IsString, IsEnum, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum StockAdjustReason {
  RESTOCK = 'RESTOCK',
  DAMAGE = 'DAMAGE',
  RETURN = 'RETURN',
  CORRECTION = 'CORRECTION',
  SALE = 'SALE',
  MANUAL = 'MANUAL',
}

export class AdjustStockDto {
  @ApiProperty({
    description: 'Delta to apply to current stock. Positive = add, Negative = subtract.',
    example: 50,
  })
  @IsInt()
  delta: number;

  @ApiProperty({
    enum: StockAdjustReason,
    description: 'Reason for the stock adjustment',
    example: StockAdjustReason.RESTOCK,
  })
  @IsEnum(StockAdjustReason)
  reason: StockAdjustReason;

  @ApiProperty({
    description: 'Human-readable note for this adjustment',
    example: 'Received 50 units from supplier',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  note: string;
}

import { IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateCouponDto {
  @ApiProperty({ example: 'SAVE20', description: 'Coupon code to validate' })
  @IsString()
  code: string;

  @ApiProperty({ example: 1200, description: 'Order subtotal in INR before discount' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  orderSubtotal: number;
}

import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, DeliveryType } from '@prisma/client';

export class OrderItemInputDto {
  @ApiProperty({ description: 'ProductVariant UUID', format: 'uuid' })
  @IsString()
  variantId: string;

  @ApiProperty({ description: 'Quantity to order', minimum: 1, example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemInputDto], description: 'Cart items to order (1–50)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];

  @ApiProperty({ description: 'Delivery address UUID', format: 'uuid' })
  @IsString()
  addressId: string;

  @ApiProperty({ enum: PaymentMethod, description: 'Payment method', example: PaymentMethod.UPI })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({
    enum: DeliveryType,
    description: 'Delivery fulfillment type',
    example: DeliveryType.SELF,
  })
  @IsEnum(DeliveryType)
  deliveryType: DeliveryType;

  @ApiPropertyOptional({ description: 'Coupon code to apply', example: 'SAVE10' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  couponCode?: string;

  @ApiPropertyOptional({ description: 'Optional order notes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

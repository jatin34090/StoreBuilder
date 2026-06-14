import { IsString,Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Internal order UUID', format: 'uuid' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'Razorpay order ID returned at order placement', example: 'order_OFldlMzXiKXzc3' })
  @IsString()
  @Matches(/^order_[A-Za-z0-9]+$/, { message: 'Invalid Razorpay order ID format' })
  razorpayOrderId: string;

  @ApiProperty({ description: 'Razorpay payment ID from checkout', example: 'pay_OFldlMzXiKXzc3' })
  @IsString()
  @Matches(/^pay_[A-Za-z0-9]+$/, { message: 'Invalid Razorpay payment ID format' })
  razorpayPaymentId: string;

  @ApiProperty({ description: 'HMAC-SHA256 signature from Razorpay checkout handler', example: 'a5f3c...' })
  @IsString()
  @MinLength(64)
  razorpaySignature: string;
}

import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelOrderDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    minLength: 10,
    maxLength: 300,
    example: 'Changed my mind, no longer need the item',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  reason: string;
}

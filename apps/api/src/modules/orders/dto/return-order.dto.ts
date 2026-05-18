import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReturnOrderDto {
  @ApiProperty({
    description: 'Reason for return request',
    minLength: 10,
    maxLength: 500,
    example: 'Received a damaged item, the clasp is broken',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}

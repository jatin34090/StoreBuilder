import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@yourdomain.in or 9876543210' })
  @IsString()
  @MinLength(1)
  identifier: string;

  @ApiProperty({ example: 'your_password' })
  @IsString()
  @MinLength(8)
  password: string;
}
